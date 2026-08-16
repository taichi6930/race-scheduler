import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/shared_preferences_provider.dart';
import '../../../data/repositories/local_favorites_repository.dart';
import '../../../domain/repositories/i_favorites_repository.dart';

/// お気に入り永続化のデバウンス時間（PERF-112）。
///
/// 連打（連続タップ）で毎回 SharedPreferences へ書き込むと書き込み順序が
/// 不定になりうるため、この時間内の連続 toggle をまとめ、最終状態のみを書き込む。
const favoriteSaveDebounceDuration = Duration(milliseconds: 300);

/// [IFavoritesRepository] の実装（端末ローカル永続化）を提供する。
final favoritesRepositoryProvider = Provider<IFavoritesRepository>(
  (ref) => LocalFavoritesRepository(ref.read(sharedPreferencesProvider)),
);

/// お気に入り登録済みレースID集合。
///
/// タイムライン／カレンダー／詳細シートの★ボタンから共通で参照・更新する。
final favoriteIdsProvider = NotifierProvider<FavoriteIdsNotifier, Set<String>>(
  FavoriteIdsNotifier.new,
);

class FavoriteIdsNotifier extends Notifier<Set<String>> {
  Timer? _saveDebounceTimer;

  // dispose時（ref.onDispose）はRefも state ゲッターも使えない（riverpodが
  // 「Cannot use Ref or modify other providers inside life-cycles」で禁止する）
  // ため、build内で一度だけ解決したrepositoryと、toggle時点のstateを
  // プレーンフィールドに保持しておき、dispose時はそれらのみを参照する。
  late final IFavoritesRepository _repository;
  Set<String>? _pendingRaceIds;

  /// デバウンス中の [toggle] 呼び出しが共有する、実際の永続化結果を表す
  /// Completer（QSTATE-02）。同じデバウンス区間内の複数回 toggle は
  /// 同じ Future を共有し、実際に1回だけ行われる保存の成否を受け取る。
  Completer<bool>? _pendingSaveCompleter;

  @override
  Set<String> build() {
    _repository = ref.read(favoritesRepositoryProvider);
    ref.onDispose(_flushPendingSave);
    return _repository.loadFavoriteRaceIds();
  }

  bool isFavorite(String raceId) => state.contains(raceId);

  /// お気に入りの登録／解除を切り替える。UI へは即座に反映し、永続化は
  /// デバウンスする（PERF-112）。
  ///
  /// 返り値はデバウンス後に実際に永続化された結果（QSTATE-02）。呼び出し側は
  /// timeline_filter_feedback.dart（QERR-11）と同じパターンで、失敗した
  /// 場合のみ後追いでUIへ知らせられる。
  Future<bool> toggle(String raceId) {
    final updated = Set<String>.from(state);
    if (!updated.remove(raceId)) {
      updated.add(raceId);
    }
    state = updated;
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
    state = const <String>{};
    _pendingRaceIds = state;

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
    final succeeded = await _repository.saveFavoriteRaceIds(pending);
    completer?.complete(succeeded);
  }
}
