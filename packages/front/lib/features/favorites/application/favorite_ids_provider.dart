import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/application/session_provider.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/di/shared_preferences_provider.dart';
import '../../../data/repositories/local_favorites_repository.dart';
import '../../../data/repositories/remote_favorites_repository.dart';
import '../../../domain/repositories/i_favorites_repository.dart';

/// お気に入り永続化のデバウンス時間（PERF-112）。
///
/// 連打（連続タップ）で毎回書き込むと書き込み順序が不定になりうるため、
/// この時間内の連続 toggle をまとめ、最終状態のみを書き込む。
const favoriteSaveDebounceDuration = Duration(milliseconds: 300);

/// [IFavoritesRepository] の実装を提供する。
///
/// ログイン済み（[sessionProvider]がnullでない）ならサーバー保存
/// （[RemoteFavoritesRepository]）、未ログインなら端末ローカル
/// （[LocalFavoritesRepository]）を返す。全画面ログイン必須の設計のため、
/// 実質的には常に[RemoteFavoritesRepository]を使うことになる
/// （未ログインのままお気に入り画面へ到達することは無い）。
final favoritesRepositoryProvider = Provider<IFavoritesRepository>((ref) {
  final session = ref.watch(sessionProvider);
  if (session == null) {
    return LocalFavoritesRepository(ref.read(sharedPreferencesProvider));
  }
  return RemoteFavoritesRepository(dio: getIt<Dio>());
});

/// お気に入り登録済みレースID集合。
///
/// タイムライン／カレンダー／詳細シートの★ボタンから共通で参照・更新する。
final favoriteIdsProvider =
    AsyncNotifierProvider<FavoriteIdsNotifier, Set<String>>(
      FavoriteIdsNotifier.new,
    );

class FavoriteIdsNotifier extends AsyncNotifier<Set<String>> {
  Timer? _saveDebounceTimer;

  // dispose時（ref.onDispose）はRefも state ゲッターも使えない（riverpodが
  // 「Cannot use Ref or modify other providers inside life-cycles」で禁止する）
  // ため、build内で解決したrepositoryと、toggle時点のstateを
  // プレーンフィールドに保持しておき、dispose時はそれらのみを参照する。
  //
  // favoritesRepositoryProviderはログイン状態が変わるとbuild()を再実行させる
  // ため（`late final`ではなく可変フィールドにしている）、`late final`だと
  // 2回目のbuild()呼び出しでLateInitializationErrorになる点に注意。
  IFavoritesRepository? _repository;
  Set<String>? _pendingRaceIds;

  /// デバウンス中の [toggle] 呼び出しが共有する、実際の永続化結果を表す
  /// Completer（QSTATE-02）。同じデバウンス区間内の複数回 toggle は
  /// 同じ Future を共有し、実際に1回だけ行われる保存の成否を受け取る。
  Completer<bool>? _pendingSaveCompleter;

  /// 初回読み込み（[build]）完了前に[toggle]/[clearAll]が呼ばれたかどうか。
  ///
  /// [build]の非同期読み込みが完了する前にユーザーが★をタップすると、
  /// 後から解決する読み込み結果がtoggle済みのstateを上書きしてしまう
  /// レースコンディションがある（読み込みは常に「build開始時点の
  /// スナップショット」を返すため）。このフラグが立っていれば読み込み結果を
  /// 捨て、既存のstateを優先する。
  bool _hasManualUpdateSinceBuild = false;

  // 戻り値の型はbase（AsyncNotifier）と同じ`FutureOr<Set<String>>`のままにする。
  // `Future<Set<String>>`まで狭めると、テストの `_FixedFavoriteIdsNotifier`
  // （同期`Set<String>`を返して固定値を注入するパターン）がoverrideとして
  // 無効になる（Dartのoverride共変性は直近の親クラスの宣言に対して
  // 判定されるため）。
  @override
  FutureOr<Set<String>> build() {
    final repository = ref.watch(favoritesRepositoryProvider);
    _repository = repository;
    _hasManualUpdateSinceBuild = false;
    ref.onDispose(_flushPendingSave);
    return repository.loadFavoriteRaceIds().then((loaded) {
      if (_hasManualUpdateSinceBuild) return state.value ?? loaded;
      return loaded;
    });
  }

  bool isFavorite(String raceId) =>
      (state.value ?? const <String>{}).contains(raceId);

  /// お気に入りの登録／解除を切り替える。UI へは即座に反映し、永続化は
  /// デバウンスする（PERF-112）。
  ///
  /// 返り値はデバウンス後に実際に永続化された結果（QSTATE-02）。呼び出し側は
  /// timeline_filter_feedback.dart（QERR-11）と同じパターンで、失敗した
  /// 場合のみ後追いでUIへ知らせられる。
  Future<bool> toggle(String raceId) {
    _hasManualUpdateSinceBuild = true;
    final updated = Set<String>.from(state.value ?? const <String>{});
    if (!updated.remove(raceId)) {
      updated.add(raceId);
    }
    state = AsyncData(updated);
    _pendingRaceIds = updated;

    final completer = _pendingSaveCompleter ??= Completer<bool>();

    _saveDebounceTimer?.cancel();
    _saveDebounceTimer = Timer(favoriteSaveDebounceDuration, _flushPendingSave);
    return completer.future;
  }

  /// お気に入りを一括削除する（QPRIV-05）。
  ///
  /// 誤操作防止のため、呼び出し元（設定画面）で確認ダイアログを挟むこと。
  /// 永続化は [toggle] と同じデバウンス経路に乗せる。
  void clearAll() {
    _hasManualUpdateSinceBuild = true;
    state = const AsyncData(<String>{});
    _pendingRaceIds = const <String>{};

    _saveDebounceTimer?.cancel();
    _saveDebounceTimer = Timer(favoriteSaveDebounceDuration, _flushPendingSave);
  }

  /// デバウンス中の保存を即座に確定させる。タイマー発火時と
  /// Notifier 破棄時（`ref.onDispose`）の両方から呼ばれる。
  /// 保留中の保存が無い場合（連続 toggle 中でない・既に保存済み）は何もしない。
  Future<void> _flushPendingSave() async {
    _saveDebounceTimer?.cancel();
    _saveDebounceTimer = null;

    final pending = _pendingRaceIds;
    final completer = _pendingSaveCompleter;
    _pendingSaveCompleter = null;
    if (pending == null) return;
    _pendingRaceIds = null;
    final repository = _repository;
    final succeeded = repository == null
        ? false
        : await repository.saveFavoriteRaceIds(pending);
    completer?.complete(succeeded);
  }
}
