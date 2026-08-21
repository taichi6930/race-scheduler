import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/application/session_provider.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/jst_time.dart';
import '../../../core/riverpod/ttl_refresh.dart';
import '../../../domain/entities/race_entity.dart';
import '../../../domain/entities/race_type.dart';
import '../../../domain/usecases/get_races_by_date_range.dart';
import '../../timeline/application/now_provider.dart';
import '../../timeline/application/race_time_utils.dart';
import '../../timeline/application/timeline_provider.dart';
import 'favorite_ids_provider.dart';

/// お気に入りに登録されたレースを検索する範囲（今日から何日先まで）。
///
/// バックエンドに「IDで複数取得」する API が無いため、期間指定で取得し
/// クライアント側でお気に入りIDに絞り込む（screens.md §3）。
const int favoritesSearchRangeDays = 30;

/// お気に入り登録済みレースの生データ（期間内・お気に入りID絞り込み後、
/// 過去/未来のフィルタは未適用）。
///
/// [favoriteIdsProvider] のみを watch し、`nowProvider`（30秒毎に発火）には
/// 依存しない。「現在時刻」による絞り込みは [favoriteRacesProvider] 側で
/// 行うことで、時刻が進むたびに API を叩き直すことを避ける。
///
/// [defaultCacheTtl] 経過後は自動で再取得する（[scheduleTtlInvalidate]）。
///
/// KPLAYER-07: ローカル登録済み（[favoriteIdsProvider]）に加えて、注目選手が
/// 出走するレース（[RaceEntity.isWatched]）も対象に含める。isWatchedは期間内の
/// レース一覧を実際に取得しないと判定できないため、favoriteIdsが空でも
/// 常にAPIを呼ぶ（以前は空なら呼ばずに済ませていたが、注目選手のみ登録して
/// いるユーザーがいるため早期returnは廃止した）。
///
/// 未ログイン時はAPIを呼ばない: `MyApp`（app.dart）が起動直後から
/// [favoriteRacesProvider] を `ref.listen` するため、この関数がsession状態を
/// 見ずに即APIを叩くと、ログイン画面が表示されるだけの未認証状態でも
/// レースAPIへの不要なリクエストが発生してしまう（全画面ログイン必須の
/// 設計と矛盾する）。
final favoriteRacesRawProvider = FutureProvider<List<RaceEntity>>((ref) async {
  if (ref.watch(sessionProvider) == null) return const <RaceEntity>[];

  scheduleTtlInvalidate(ref, defaultCacheTtl);
  final favoriteIds = ref.watch(favoriteIdsProvider).value ?? const <String>{};

  final useCase = getIt<GetRacesByDateRangeUseCase>();
  final today = dateOnly(jstNow());
  final races = await useCase(
    startDate: formatDateForApi(today),
    finishDate: formatDateForApi(
      today.add(const Duration(days: favoritesSearchRangeDays)),
    ),
    raceTypeList: RaceType.all.map((type) => type.value).toList(),
  );
  return races
      .where(
        (race) =>
            favoriteIds.contains(race.raceId) || (race.isWatched ?? false),
      )
      .toList();
});

/// [UpcomingFavoritesCache] のインスタンスを1つだけ保持するための入れ物。
///
/// 依存を持たないため、[favoriteRacesProvider] 自身が（`nowProvider` の
/// tickなどで）何度再計算されても、この provider の build は最初の1回しか
/// 走らず、常に同じキャッシュインスタンスが返る（Riverpodの定番パターン）。
final _upcomingFavoritesCacheProvider = Provider<UpcomingFavoritesCache>(
  (ref) => UpcomingFavoritesCache(),
);

/// お気に入り登録済みレースの実体（発走時刻順、当日〜将来のみ）。
///
/// 過去に発走したお気に入りは既定で非表示（screens.md §3、MVPでは固定）。
final favoriteRacesProvider = Provider<AsyncValue<List<RaceEntity>>>((ref) {
  final rawAsync = ref.watch(favoriteRacesRawProvider);
  final favoriteIds = ref.watch(favoriteIdsProvider).value ?? const <String>{};
  final now = ref.watch(nowProvider).value ?? jstNow();
  final cache = ref.watch(_upcomingFavoritesCacheProvider);
  return rawAsync.whenData((races) => cache.resolve(races, favoriteIds, now));
});

/// [races] のうち、お気に入り登録済み（[favoriteIds]）または注目選手が
/// 出走する（[RaceEntity.isWatched]、KPLAYER-07）かつ [now] 以降に
/// 発走するものだけを、発走時刻昇順で返す（純粋関数）。
List<RaceEntity> filterUpcomingFavoriteRaces(
  List<RaceEntity> races,
  Set<String> favoriteIds,
  DateTime now,
) {
  final upcomingFavorites = races.where(
    (race) =>
        (favoriteIds.contains(race.raceId) || (race.isWatched ?? false)) &&
        !raceDateTime(race).isBefore(now),
  );
  return sortRacesByDatetime(upcomingFavorites.toList());
}

/// [filterUpcomingFavoriteRaces] の結果をメモ化するキャッシュ（PERF-109）。
///
/// `now`（`nowProvider` により30秒毎に発火）が変わっても、[races]・
/// [favoriteIds] が前回と同一（お気に入り登録の変更・データ再取得が無い）で、
/// かつ結果の先頭（発走時刻が最も近いお気に入り）の発走時刻に `now` がまだ
/// 到達していなければ、前回のフィルタ・ソート済みリストをそのまま返す
/// （同一インスタンスを返すことで、[favoriteRacesProvider] を watch している
/// 側の不要な再構築も併せて避けられる。`AsyncValue`/`List` の既定の等価性は
/// 参照ベースのため）。
///
/// 「未発走→発走済み」の遷移でしか結果は変わらない（お気に入りIDが増減
/// しない限り、時間経過だけでは対象レースが増えることは無い）ため、
/// 次に変化しうるのは常に結果先頭のレースの発走時刻である。
class UpcomingFavoritesCache {
  List<RaceEntity>? _races;
  Set<String>? _favoriteIds;
  DateTime? _validUntil;
  List<RaceEntity>? _result;

  List<RaceEntity> resolve(
    List<RaceEntity> races,
    Set<String> favoriteIds,
    DateTime now,
  ) {
    final cached = _result;
    final canReuse =
        cached != null &&
        identical(_races, races) &&
        identical(_favoriteIds, favoriteIds) &&
        (_validUntil == null || now.isBefore(_validUntil!));
    if (canReuse) return cached;

    final result = filterUpcomingFavoriteRaces(races, favoriteIds, now);
    _races = races;
    _favoriteIds = favoriteIds;
    _result = result;
    _validUntil = result.isEmpty ? null : raceDateTime(result.first);
    return result;
  }
}
