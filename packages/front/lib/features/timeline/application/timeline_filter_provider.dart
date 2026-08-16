import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/di/shared_preferences_provider.dart';
import '../../../core/persist_write.dart';
import '../../../domain/entities/grade_tier.dart';
import '../../../domain/entities/race_entity.dart';
import '../../../domain/entities/race_type.dart';
import '../../../domain/entities/timeline_filter.dart';
import '../../favorites/application/favorite_ids_provider.dart';
import '../../settings/application/settings_provider.dart';
import 'timeline_provider.dart';

export '../../../domain/entities/timeline_filter.dart';

const _kGradeOnly = 'timeline_filter_grade_only';
const _kFavoriteOnly = 'timeline_filter_favorite_only';
const _kGradeTiers = 'timeline_filter_grade_tiers';
const _kKeibaTypes = 'timeline_filter_keiba_types';
const _kVenues = 'timeline_filter_venues';

/// KPLAYER-07: デフォルトフィルタを「重賞のみ」単独から「重賞＋お気に入り」の
/// 両方ONへ変更する一度限りの移行が完了したかどうか。既存ユーザーの
/// 保存済み設定も含めて一律で新しい既定値に置き換えるため（Q8-B）、
/// このフラグが立っていない間だけ強制上書きする。
const _kDefaultFilterMigrationDone = 'timeline_filter_default_migration_v2';

final _gradeTierByName = {for (final tier in GradeTier.values) tier.name: tier};
final _raceTypeByValue = {for (final type in RaceType.values) type.value: type};

/// [set] に [value] が含まれていれば除去、含まれていなければ追加した新しい集合を返す。
Set<T> _toggled<T>(Set<T> set, T value) => set.contains(value)
    ? (Set<T>.of(set)..remove(value))
    : (Set<T>.of(set)..add(value));

/// 永続化された階層一覧の文字列表現を [GradeTier] 集合に復元する。
/// 未知の値（旧バージョンの残骸等）は無視する。
Set<GradeTier> _decodeGradeTiers(List<String>? values) =>
    (values ?? const <String>[])
        .map((v) => _gradeTierByName[v])
        .whereType<GradeTier>()
        .toSet();

/// 永続化された区分一覧の文字列表現を [RaceType] 集合に復元する。
/// 未知の値（旧バージョンの残骸等）は無視する。
Set<RaceType> _decodeKeibaTypes(List<String>? values) =>
    (values ?? const <String>[])
        .map((v) => _raceTypeByValue[v])
        .whereType<RaceType>()
        .toSet();

/// タイムラインのフィルタ状態。既定は「重賞のみ」。`shared_preferences` に
/// 永続化し、アプリを終了・再起動しても直前の絞り込み条件を復元する。
final timelineFilterProvider =
    NotifierProvider<TimelineFilterNotifier, TimelineFilterState>(
      TimelineFilterNotifier.new,
    );

class TimelineFilterNotifier extends Notifier<TimelineFilterState> {
  SharedPreferences get _prefs => ref.read(sharedPreferencesProvider);

  @override
  TimelineFilterState build() {
    final prefs = ref.read(sharedPreferencesProvider);

    // KPLAYER-07: 初回のみ、既存ユーザーの保存済み設定も含めて
    // gradeOnly/favoriteOnlyを新しい既定値（両方ON）で一律上書きする。
    if (!(prefs.getBool(_kDefaultFilterMigrationDone) ?? false)) {
      persistWrite(() => prefs.setBool(_kGradeOnly, true));
      persistWrite(() => prefs.setBool(_kFavoriteOnly, true));
      persistWrite(() => prefs.setBool(_kDefaultFilterMigrationDone, true));
      return TimelineFilterState(
        gradeOnly: true,
        favoriteOnly: true,
        gradeTiers: _decodeGradeTiers(prefs.getStringList(_kGradeTiers)),
        keibaTypes: _decodeKeibaTypes(prefs.getStringList(_kKeibaTypes)),
        venues: (prefs.getStringList(_kVenues) ?? const <String>[]).toSet(),
      );
    }

    return TimelineFilterState(
      gradeOnly: prefs.getBool(_kGradeOnly) ?? false,
      favoriteOnly: prefs.getBool(_kFavoriteOnly) ?? false,
      gradeTiers: _decodeGradeTiers(prefs.getStringList(_kGradeTiers)),
      keibaTypes: _decodeKeibaTypes(prefs.getStringList(_kKeibaTypes)),
      venues: (prefs.getStringList(_kVenues) ?? const <String>[]).toSet(),
    );
  }

  /// 指定したチップのON/OFFを独立に切り替える（他方には影響しない）。
  ///
  /// 永続化の成否を返す（QERR-11: 呼び出し側が失敗をUIへ伝えられるようにする）。
  Future<bool> toggle(TimelineFilterMode target) {
    state = switch (target) {
      TimelineFilterMode.grade => state.copyWith(gradeOnly: !state.gradeOnly),
      TimelineFilterMode.favorite => state.copyWith(
        favoriteOnly: !state.favoriteOnly,
      ),
    };
    return switch (target) {
      TimelineFilterMode.grade => persistWrite(
        () => _prefs.setBool(_kGradeOnly, state.gradeOnly),
      ),
      TimelineFilterMode.favorite => persistWrite(
        () => _prefs.setBool(_kFavoriteOnly, state.favoriteOnly),
      ),
    };
  }

  /// 階層（GⅠ/GⅡ/GⅢ）の絞り込みを独立にON/OFFする（複数選択可）。
  ///
  /// 永続化の成否を返す（QERR-11）。
  Future<bool> toggleGradeTier(GradeTier tier) {
    state = state.copyWith(gradeTiers: _toggled(state.gradeTiers, tier));
    return persistWrite(
      () => _prefs.setStringList(
        _kGradeTiers,
        state.gradeTiers.map((t) => t.name).toList(),
      ),
    );
  }

  /// 「競馬」のJRA/NAR/海外の絞り込みを独立にON/OFFする（複数選択可）。
  ///
  /// 永続化の成否を返す（QERR-11）。
  Future<bool> toggleKeibaType(RaceType type) {
    state = state.copyWith(keibaTypes: _toggled(state.keibaTypes, type));
    return persistWrite(
      () => _prefs.setStringList(
        _kKeibaTypes,
        state.keibaTypes.map((t) => t.value).toList(),
      ),
    );
  }

  /// 競走場の絞り込みを独立にON/OFFする（複数選択可）。
  ///
  /// 永続化の成否を返す（QERR-11）。
  Future<bool> toggleVenue(String venue) {
    state = state.copyWith(venues: _toggled(state.venues, venue));
    return persistWrite(
      () => _prefs.setStringList(_kVenues, state.venues.toList()),
    );
  }

  /// 全ての絞り込み条件を一括で解除する（UX-019）。
  ///
  /// 全項目の永続化に成功した場合のみtrueを返す（QERR-11）。
  Future<bool> clearAll() async {
    state = const TimelineFilterState();
    final results = await Future.wait([
      persistWrite(() => _prefs.setBool(_kGradeOnly, false)),
      persistWrite(() => _prefs.setBool(_kFavoriteOnly, false)),
      persistWrite(() => _prefs.setStringList(_kGradeTiers, const [])),
      persistWrite(() => _prefs.setStringList(_kKeibaTypes, const [])),
      persistWrite(() => _prefs.setStringList(_kVenues, const [])),
    ]);
    return results.every((succeeded) => succeeded);
  }
}

/// [state] または [enabledDisciplines]（設定画面の「対象の公営競技」）が
/// 何らかの絞り込み条件を持っているか（UX-019: 一括クリア表示の判定）。
///
/// QEMP-09: 表示件数を実際に左右する [applyTimelineFilter] は
/// [enabledDisciplines] も条件として使うため、[state] の5軸だけを見ていると
/// 設定画面で競技を絞った結果タイムラインが0件になっても「絞り込みを解除」
/// ボタンが出ず、原因に気づけない。
bool hasActiveTimelineFilter(
  TimelineFilterState state,
  Set<Discipline> enabledDisciplines,
) =>
    state.gradeOnly ||
    state.favoriteOnly ||
    state.gradeTiers.isNotEmpty ||
    state.keibaTypes.isNotEmpty ||
    state.venues.isNotEmpty ||
    enabledDisciplines.length < Discipline.all.length;

/// [races] に [filter]・[enabledDisciplines]・[favoriteRaceIds] を適用した
/// 表示対象一覧を返す（純粋関数）。
///
/// [filter] の keibaTypes・venues は [enabledDisciplines] と同じくAND条件
/// （空集合なら絞り込みなし）。そのうえで gradeOnly/favoriteOnly が両方OFF
/// なら全件、片方のみONならその条件、両方ONなら「重賞 または お気に入り」の
/// OR結合で絞り込む。[TimelineFilterState.gradeTiers] は gradeOnly ON時のみ
/// さらに階層で絞り込む（空集合なら階層による絞り込みなし）。
///
/// KPLAYER-07: 「お気に入り」条件は、ローカル登録済み（[favoriteRaceIds]）
/// **または** 注目選手が出走するレース（[RaceEntity.isWatched]）のOR結合で
/// 判定する。注目選手を解除すればisWatchedがfalseになり自動的に対象から
/// 外れるため、ローカルへの書き込みは行わない（要件定義参照）。
List<RaceEntity> applyTimelineFilter(
  List<RaceEntity> races,
  TimelineFilterState filter,
  Set<Discipline> enabledDisciplines,
  Set<String> favoriteRaceIds,
) {
  return races.where((race) {
    final raceType = RaceType.fromValue(race.raceType);
    final discipline = Discipline.of(raceType);
    if (!enabledDisciplines.contains(discipline)) return false;
    if (discipline == Discipline.keiba &&
        filter.keibaTypes.isNotEmpty &&
        !filter.keibaTypes.contains(raceType)) {
      return false;
    }
    if (filter.venues.isNotEmpty && !filter.venues.contains(race.raceCourse)) {
      return false;
    }
    if (!filter.gradeOnly && !filter.favoriteOnly) return true;

    final matchesGrade =
        filter.gradeOnly &&
        _matchesGradeTiers(race, raceType, filter.gradeTiers);
    final matchesFavorite =
        filter.favoriteOnly &&
        (favoriteRaceIds.contains(race.raceId) || (race.isWatched ?? false));
    return matchesGrade || matchesFavorite;
  }).toList();
}

/// [race] が「重賞（指定レース）」であり、かつ [gradeTiers] による階層の
/// 絞り込みにも合致するかどうかを判定する（[gradeTiers] が空集合なら階層は
/// 問わない）。
bool _matchesGradeTiers(
  RaceEntity race,
  RaceType raceType,
  Set<GradeTier> gradeTiers,
) {
  final isSpecified =
      race.isCalendarSpecified ??
      isCalendarSpecifiedGrade(raceType, race.raceGrade, race.raceStage);
  if (!isSpecified) return false;
  if (gradeTiers.isEmpty) return true;
  return gradeTiers.contains(
    gradeTierOf(raceType, race.raceGrade, race.raceStage),
  );
}

/// [races] のうち [enabledDisciplines] に該当するものから、登場順で重複を
/// 除いた競走場一覧を返す（[VenueChipsBar] の選択肢生成に使う純粋関数）。
List<String> visibleVenuesOf(
  List<RaceEntity> races,
  Set<Discipline> enabledDisciplines,
) {
  final seen = <String>{};
  final venues = <String>[];
  for (final race in races) {
    final raceType = RaceType.fromValue(race.raceType);
    if (!enabledDisciplines.contains(Discipline.of(raceType))) continue;
    if (seen.add(race.raceCourse)) venues.add(race.raceCourse);
  }
  return venues;
}

/// 指定日の表示対象レース一覧（フィルタ適用後）。タイムライン画面から利用する。
///
/// [timelineProvider] は `autoDispose`（PERF-001）のため、ここも
/// `autoDispose` にしないと本 provider が非 autoDispose のまま
/// `timelineProvider` を watch し続け、下位の autoDispose が実質的に
/// 無効化されてしまう（訪問済み日付分のキャッシュが解放されなくなる）。
final visibleTimelineRacesProvider = Provider.autoDispose
    .family<AsyncValue<List<RaceEntity>>, DateTime>((ref, date) {
      final racesAsync = ref.watch(timelineProvider(date));
      final filter = ref.watch(timelineFilterProvider);
      final enabledDisciplines = ref.watch(
        settingsProvider.select((s) => s.enabledDisciplines),
      );
      final favorites = ref.watch(favoriteIdsProvider);
      return racesAsync.whenData(
        (races) =>
            applyTimelineFilter(races, filter, enabledDisciplines, favorites),
      );
    });

/// 指定日の競走場選択肢一覧（[VenueChipsBar] 用）。日別モードから利用する。
final visibleTimelineVenuesProvider = Provider.family<List<String>, DateTime>((
  ref,
  date,
) {
  final racesAsync = ref.watch(timelineProvider(date));
  final enabledDisciplines = ref.watch(
    settingsProvider.select((s) => s.enabledDisciplines),
  );
  return racesAsync.maybeWhen(
    data: (races) => visibleVenuesOf(races, enabledDisciplines),
    orElse: () => const [],
  );
});
