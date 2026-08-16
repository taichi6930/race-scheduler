// applyTimelineFilter / TimelineFilterNotifier / visibleVenuesOf のデシジョンテーブル
//
// | ID   | 対象                  | 条件                                          | 期待                          |
// | ---- | --------------------- | ---------------------------------------------- | ------------------------------ |
// | T-01 | applyTimelineFilter   | gradeOnly=true・favoriteOnly=false             | 重賞のみ残る                  |
// | T-02 | applyTimelineFilter   | gradeOnly=false・favoriteOnly=true             | お気に入りのみ残る            |
// | T-03 | applyTimelineFilter   | gradeOnly=false・favoriteOnly=false（既定＝OFF）| 全件残る                      |
// | T-04 | applyTimelineFilter   | 対象競技からkeirinを除外                       | keirinのレースが除外される    |
// | T-05 | TimelineFilterNotifier| 初期状態（未保存、KPLAYER-07で既定値変更）      | gradeOnly=true, favoriteOnly=true（初回移行で両方ON） |
// | T-06 | TimelineFilterNotifier| toggle(favorite)                               | favoriteOnlyがtrueになる（gradeOnlyは不変） |
// | T-07 | TimelineFilterNotifier| toggle(favorite)を2回                          | favoriteOnlyがfalseに戻る     |
// | T-08 | applyTimelineFilter   | gradeOnly=true、isCalendarSpecified=falseだがgrade=GⅠ | API算出値が優先され除外される |
// | T-09 | applyTimelineFilter   | gradeOnly=true・favoriteOnly=true（両方ON）    | 重賞 または お気に入り のOR結合で残る |
// | T-10 | applyTimelineFilter   | gradeTiers={top}（gradeOnly=true）             | GⅠのみ残り、GⅢは除外される   |
// | T-11 | applyTimelineFilter   | gradeTiers={}（既定）                          | 階層を問わず重賞が全て残る    |
// | T-12 | applyTimelineFilter   | keibaTypes={jra}                               | jra以外の競馬（nar）が除外される |
// | T-13 | applyTimelineFilter   | keibaTypes={jra}                               | 競馬以外（keirin）は影響を受けない |
// | T-14 | applyTimelineFilter   | venues={中山}                                  | 中山以外の競走場が除外される  |
// | T-15 | TimelineFilterNotifier| toggleGradeTier(top)を2回                      | gradeTiersが空集合に戻る      |
// | T-16 | TimelineFilterNotifier| toggleKeibaType(jra)                           | keibaTypesに{jra}が追加される |
// | T-17 | TimelineFilterNotifier| toggleVenue(中山)                              | venuesに{中山}が追加される    |
// | T-18 | visibleVenuesOf       | 対象競技から一部を除外                          | 除外した競技の競走場は含まれない |
// | T-19 | visibleVenuesOf       | 同じ競走場が複数レースに登場                    | 登場順で重複なく1件になる     |
// | T-20 | visibleTimelineRacesProvider | 最後のlistenerが外れた後                 | autoDisposeによりstateが破棄される（PERF-001） |
// | T-21 | TimelineFilterNotifier| 未保存                                          | 既定値（全項目OFF・空集合）が復元される |
// | T-22 | TimelineFilterNotifier| toggle(grade)後に別コンテナで再読込             | gradeOnlyが永続化・復元される |
// | T-23 | TimelineFilterNotifier| toggleGradeTier(top)後に別コンテナで再読込      | gradeTiersが永続化・復元される |
// | T-24 | TimelineFilterNotifier| toggleKeibaType(jra)後に別コンテナで再読込      | keibaTypesが永続化・復元される |
// | T-25 | TimelineFilterNotifier| toggleVenue(中山)後に別コンテナで再読込         | venuesが永続化・復元される    |
// | T-26 | TimelineFilterNotifier| gradeOnly/venues等をONにした状態でclearAll()   | 全項目が既定値（OFF・空集合）に戻る |
// | T-27 | TimelineFilterNotifier| clearAll()後に別コンテナで再読込                | 解除後の既定値が永続化・復元される |
// | T-28 | hasActiveTimelineFilter| 全項目が既定値（未絞り込み）・enabledDisciplinesも全件 | falseを返す            |
// | T-29 | hasActiveTimelineFilter| gradeOnlyのみtrue                              | trueを返す                    |
// | T-30 | hasActiveTimelineFilter| venuesのみ非空                                 | trueを返す                    |
// | T-31 | applyTimelineFilter   | favoriteOnly=true・isWatched=trueだがfavoriteRaceIdsに未登録 | 含まれる（isWatchedのみで一致、KPLAYER-07） |
// | T-32 | applyTimelineFilter   | favoriteOnly=true・isWatched=false・favoriteRaceIdsにも未登録 | 除外される |
// | T-33 | TimelineFilterNotifier| 既存ユーザーがgradeOnly/favoriteOnly=falseを保存済み・初回読込 | 新既定値(true/true)で上書きされる（Q8-B） |
// | T-34 | TimelineFilterNotifier| 移行後に別コンテナで再読込                      | 移行フラグにより再上書きされず、ユーザーの変更が保持される |
// | T-35 | TimelineFilterNotifier| 移行時                                          | gradeTiers/keibaTypes/venuesは既定値（空集合）のまま影響を受けない |
// | T-36 | hasActiveTimelineFilter| stateは既定値・enabledDisciplinesが一部のみ    | trueを返す（QEMP-09）         |

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/grade_tier.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/domain/entities/race_type.dart';
import 'package:front/features/timeline/application/timeline_filter_provider.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

RaceEntity _race({
  required String id,
  required String raceType,
  String? grade,
  bool? isCalendarSpecified,
  String raceCourse = '中山',
  bool? isWatched,
}) => RaceEntity(
  raceId: id,
  raceName: 'レース$id',
  raceType: raceType,
  placeId: 'place-001',
  raceCourse: raceCourse,
  datetime: '2026-04-19T15:40:00',
  raceGrade: grade,
  raceNumber: 1,
  isCalendarSpecified: isCalendarSpecified,
  isWatched: isWatched,
);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<ProviderContainer> buildContainer() async {
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('applyTimelineFilter', () {
    final races = [
      _race(id: 'g1', raceType: 'jra', grade: 'GⅠ'),
      _race(id: 'plain', raceType: 'jra'),
      _race(id: 'keirin', raceType: 'keirin', grade: 'GP'),
    ];
    const allDisciplines = Discipline.values;

    test('[T-01] gradeOnly=true_重賞のみ残る', () {
      const filter = TimelineFilterState(gradeOnly: true);

      final result = applyTimelineFilter(
        races,
        filter,
        allDisciplines.toSet(),
        {},
      );

      expect(result.map((r) => r.raceId).toSet(), {'g1', 'keirin'});
    });

    test('[T-02] favoriteOnly=true_お気に入りのみ残る', () {
      const filter = TimelineFilterState(gradeOnly: false, favoriteOnly: true);

      final result = applyTimelineFilter(
        races,
        filter,
        allDisciplines.toSet(),
        {'plain'},
      );

      expect(result.map((r) => r.raceId).toList(), ['plain']);
    });

    test('[T-03] 両方OFF_全件残る', () {
      const filter = TimelineFilterState(gradeOnly: false, favoriteOnly: false);

      final result = applyTimelineFilter(
        races,
        filter,
        allDisciplines.toSet(),
        {},
      );

      expect(result.length, races.length);
    });

    test('[T-04] 対象競技からkeirinを除外_keirinのレースが除外される', () {
      const filter = TimelineFilterState(gradeOnly: false, favoriteOnly: false);

      final result = applyTimelineFilter(
        races,
        filter,
        allDisciplines.toSet().difference({Discipline.keirin}),
        {},
      );

      expect(result.map((r) => r.raceId).toSet(), {'g1', 'plain'});
    });

    test(
      '[T-08] gradeOnly=true_isCalendarSpecifiedがfalseならgradeがGⅠでも除外される',
      () {
        const filter = TimelineFilterState(gradeOnly: true);
        final overridden = [
          _race(
            id: 'overridden',
            raceType: 'jra',
            grade: 'GⅠ',
            isCalendarSpecified: false,
          ),
        ];

        final result = applyTimelineFilter(
          overridden,
          filter,
          allDisciplines.toSet(),
          {},
        );

        expect(result, isEmpty);
      },
    );

    test('[T-09] 両方ON_重賞またはお気に入りのOR結合で残る', () {
      const filter = TimelineFilterState(gradeOnly: true, favoriteOnly: true);

      final result = applyTimelineFilter(
        races,
        filter,
        allDisciplines.toSet(),
        {'plain'},
      );

      expect(result.map((r) => r.raceId).toSet(), {'g1', 'keirin', 'plain'});
    });

    test('[T-10] gradeTiers=top指定_GⅠのみ残りGⅢは除外される', () {
      const filter = TimelineFilterState(
        gradeOnly: true,
        gradeTiers: {GradeTier.top},
      );
      final tieredRaces = [
        _race(id: 'g1', raceType: 'jra', grade: 'GⅠ'),
        _race(id: 'g3', raceType: 'jra', grade: 'GⅢ'),
      ];

      final result = applyTimelineFilter(
        tieredRaces,
        filter,
        allDisciplines.toSet(),
        {},
      );

      expect(result.map((r) => r.raceId).toSet(), {'g1'});
    });

    test('[T-11] gradeTiers=空集合（既定）_階層を問わず重賞が全て残る', () {
      const filter = TimelineFilterState(gradeOnly: true);
      final tieredRaces = [
        _race(id: 'g1', raceType: 'jra', grade: 'GⅠ'),
        _race(id: 'g3', raceType: 'jra', grade: 'GⅢ'),
      ];

      final result = applyTimelineFilter(
        tieredRaces,
        filter,
        allDisciplines.toSet(),
        {},
      );

      expect(result.map((r) => r.raceId).toSet(), {'g1', 'g3'});
    });

    test('[T-12] keibaTypes=jra指定_jra以外の競馬（nar）が除外される', () {
      const filter = TimelineFilterState(
        gradeOnly: false,
        keibaTypes: {RaceType.jra},
      );
      final keibaRaces = [
        _race(id: 'jra', raceType: 'jra'),
        _race(id: 'nar', raceType: 'nar'),
      ];

      final result = applyTimelineFilter(
        keibaRaces,
        filter,
        allDisciplines.toSet(),
        {},
      );

      expect(result.map((r) => r.raceId).toSet(), {'jra'});
    });

    test('[T-13] keibaTypes=jra指定_競馬以外（keirin）は影響を受けない', () {
      const filter = TimelineFilterState(
        gradeOnly: false,
        keibaTypes: {RaceType.jra},
      );

      final result = applyTimelineFilter(
        races,
        filter,
        allDisciplines.toSet(),
        {},
      );

      expect(result.map((r) => r.raceId).toSet(), {'g1', 'plain', 'keirin'});
    });

    test('[T-14] venues=中山指定_中山以外の競走場が除外される', () {
      const filter = TimelineFilterState(gradeOnly: false, venues: {'中山'});
      final venueRaces = [
        _race(id: 'nakayama', raceType: 'jra'),
        _race(id: 'tokyo', raceType: 'jra', raceCourse: '東京'),
      ];

      final result = applyTimelineFilter(
        venueRaces,
        filter,
        allDisciplines.toSet(),
        {},
      );

      expect(result.map((r) => r.raceId).toSet(), {'nakayama'});
    });

    test(
      '[T-31] favoriteOnly=true_isWatched=trueだがfavoriteRaceIdsに未登録_含まれる',
      () {
        const filter = TimelineFilterState(
          gradeOnly: false,
          favoriteOnly: true,
        );
        final watchedRaces = [
          _race(id: 'watched', raceType: 'keirin', isWatched: true),
        ];

        final result = applyTimelineFilter(
          watchedRaces,
          filter,
          allDisciplines.toSet(),
          {},
        );

        expect(result.map((r) => r.raceId).toSet(), {'watched'});
      },
    );

    test(
      '[T-32] favoriteOnly=true_isWatched=false_favoriteRaceIdsにも未登録_除外される',
      () {
        const filter = TimelineFilterState(
          gradeOnly: false,
          favoriteOnly: true,
        );
        final notWatchedRaces = [
          _race(id: 'plain', raceType: 'keirin', isWatched: false),
        ];

        final result = applyTimelineFilter(
          notWatchedRaces,
          filter,
          allDisciplines.toSet(),
          {},
        );

        expect(result, isEmpty);
      },
    );
  });

  group('visibleVenuesOf', () {
    test('[T-18] 対象競技からkeirinを除外_keirinの競走場は含まれない', () {
      final venueRaces = [
        _race(id: 'jra', raceType: 'jra', raceCourse: '中山'),
        _race(id: 'keirin', raceType: 'keirin', raceCourse: '京王閣'),
      ];

      final result = visibleVenuesOf(
        venueRaces,
        Discipline.values.toSet().difference({Discipline.keirin}),
      );

      expect(result, ['中山']);
    });

    test('[T-19] 同じ競走場が複数レースに登場_登場順で重複なく1件になる', () {
      final venueRaces = [
        _race(id: 'r1', raceType: 'jra', raceCourse: '中山'),
        _race(id: 'r2', raceType: 'jra', raceCourse: '東京'),
        _race(id: 'r3', raceType: 'jra', raceCourse: '中山'),
      ];

      final result = visibleVenuesOf(venueRaces, Discipline.values.toSet());

      expect(result, ['中山', '東京']);
    });
  });

  group('TimelineFilterNotifier', () {
    test('[T-05] 初期状態_KPLAYER-07の初回移行でgradeOnly/favoriteOnlyが両方true', () async {
      final container = await buildContainer();

      final state = container.read(timelineFilterProvider);

      expect(state.gradeOnly, isTrue);
      expect(state.favoriteOnly, isTrue);
    });

    test('[T-06] toggle(favorite)_favoriteOnlyがfalseになりgradeOnlyは不変', () async {
      // KPLAYER-07の初回移行により初期状態は既に gradeOnly=true, favoriteOnly=true
      // のため、1回目のtoggleはfavoriteOnlyをOFFにする方向になる。
      final container = await buildContainer();
      final notifier = container.read(timelineFilterProvider.notifier);

      await notifier.toggle(TimelineFilterMode.favorite);

      final state = container.read(timelineFilterProvider);
      expect(state.favoriteOnly, isFalse);
      expect(state.gradeOnly, isTrue);
    });

    test('[T-07] toggle(favorite)を2回_favoriteOnlyが既定値(true)に戻る', () async {
      final container = await buildContainer();
      final notifier = container.read(timelineFilterProvider.notifier);
      await notifier.toggle(TimelineFilterMode.favorite);

      await notifier.toggle(TimelineFilterMode.favorite);

      expect(container.read(timelineFilterProvider).favoriteOnly, isTrue);
    });

    test('[T-15] toggleGradeTier(top)を2回_gradeTiersが空集合に戻る', () async {
      final container = await buildContainer();
      final notifier = container.read(timelineFilterProvider.notifier);
      await notifier.toggleGradeTier(GradeTier.top);

      await notifier.toggleGradeTier(GradeTier.top);

      expect(container.read(timelineFilterProvider).gradeTiers, isEmpty);
    });

    test('[T-16] toggleKeibaType(jra)_keibaTypesに{jra}が追加される', () async {
      final container = await buildContainer();
      final notifier = container.read(timelineFilterProvider.notifier);

      await notifier.toggleKeibaType(RaceType.jra);

      expect(container.read(timelineFilterProvider).keibaTypes, {RaceType.jra});
    });

    test('[T-17] toggleVenue(中山)_venuesに{中山}が追加される', () async {
      final container = await buildContainer();
      final notifier = container.read(timelineFilterProvider.notifier);

      await notifier.toggleVenue('中山');

      expect(container.read(timelineFilterProvider).venues, {'中山'});
    });

    test('[T-26] 複数項目ONの状態でclearAll_全項目が既定値に戻る', () async {
      final container = await buildContainer();
      final notifier = container.read(timelineFilterProvider.notifier);
      await notifier.toggle(TimelineFilterMode.grade);
      await notifier.toggle(TimelineFilterMode.favorite);
      await notifier.toggleGradeTier(GradeTier.top);
      await notifier.toggleKeibaType(RaceType.jra);
      await notifier.toggleVenue('中山');

      await notifier.clearAll();

      final state = container.read(timelineFilterProvider);
      expect(state.gradeOnly, isFalse);
      expect(state.favoriteOnly, isFalse);
      expect(state.gradeTiers, isEmpty);
      expect(state.keibaTypes, isEmpty);
      expect(state.venues, isEmpty);
    });
  });

  group('TimelineFilterNotifier の永続化', () {
    test('[T-21] 未保存_KPLAYER-07の既定値（grade/favoriteはON・他は空集合）が復元される', () async {
      final container = await buildContainer();

      final state = container.read(timelineFilterProvider);

      expect(state.gradeOnly, isTrue);
      expect(state.favoriteOnly, isTrue);
      expect(state.gradeTiers, isEmpty);
      expect(state.keibaTypes, isEmpty);
      expect(state.venues, isEmpty);
    });

    test('[T-22] toggle(grade)後に別コンテナで再読込_gradeOnlyが復元される', () async {
      // 初回移行でgradeOnlyは既にtrueのため、1回のtoggleでfalseへ反転する。
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      await first
          .read(timelineFilterProvider.notifier)
          .toggle(TimelineFilterMode.grade);
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);

      expect(second.read(timelineFilterProvider).gradeOnly, isFalse);
    });

    test('[T-23] toggleGradeTier(top)後に別コンテナで再読込_gradeTiersが復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      await first
          .read(timelineFilterProvider.notifier)
          .toggleGradeTier(GradeTier.top);
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);

      expect(second.read(timelineFilterProvider).gradeTiers, {GradeTier.top});
    });

    test('[T-24] toggleKeibaType(jra)後に別コンテナで再読込_keibaTypesが復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      await first
          .read(timelineFilterProvider.notifier)
          .toggleKeibaType(RaceType.jra);
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);

      expect(second.read(timelineFilterProvider).keibaTypes, {RaceType.jra});
    });

    test('[T-25] toggleVenue(中山)後に別コンテナで再読込_venuesが復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      await first.read(timelineFilterProvider.notifier).toggleVenue('中山');
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);

      expect(second.read(timelineFilterProvider).venues, {'中山'});
    });

    test('[T-27] clearAll()後に別コンテナで再読込_解除後の既定値が復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      final firstNotifier = first.read(timelineFilterProvider.notifier);
      await firstNotifier.toggle(TimelineFilterMode.grade);
      await firstNotifier.toggleVenue('中山');
      await firstNotifier.clearAll();
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);

      final state = second.read(timelineFilterProvider);
      expect(state.gradeOnly, isFalse);
      expect(state.favoriteOnly, isFalse);
      expect(state.gradeTiers, isEmpty);
      expect(state.keibaTypes, isEmpty);
      expect(state.venues, isEmpty);
    });

    test(
      '[T-33] 既存ユーザーがgradeOnly_favoriteOnly_falseを保存済み_初回読込で新既定値(true)に上書きされる',
      () async {
        SharedPreferences.setMockInitialValues({
          'timeline_filter_grade_only': false,
          'timeline_filter_favorite_only': false,
        });
        final prefs = await SharedPreferences.getInstance();
        final container = ProviderContainer(
          overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        );
        addTearDown(container.dispose);

        final state = container.read(timelineFilterProvider);

        expect(state.gradeOnly, isTrue);
        expect(state.favoriteOnly, isTrue);
      },
    );

    test('[T-34] 移行後に別コンテナで再読込_ユーザーの変更が保持され再上書きされない', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      // 初回読込で移行（true/true）が走った後、ユーザー自身がfavoriteOnlyを
      // OFFに変更したケース。
      await first
          .read(timelineFilterProvider.notifier)
          .toggle(TimelineFilterMode.favorite);
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);

      final state = second.read(timelineFilterProvider);
      expect(
        state.favoriteOnly,
        isFalse,
        reason: '移行フラグが立っているため、ユーザーが選んだOFFが再度trueに上書きされてはならない',
      );
      expect(state.gradeOnly, isTrue);
    });

    test(
      '[T-35] 初回移行時_gradeTiers_keibaTypes_venuesは既定値（空集合）のまま影響を受けない',
      () async {
        final container = await buildContainer();

        final state = container.read(timelineFilterProvider);

        expect(state.gradeTiers, isEmpty);
        expect(state.keibaTypes, isEmpty);
        expect(state.venues, isEmpty);
      },
    );
  });

  group('hasActiveTimelineFilter', () {
    test('[T-28] 全項目が既定値_enabledDisciplinesも全件_falseを返す', () {
      expect(
        hasActiveTimelineFilter(
          const TimelineFilterState(),
          Discipline.all.toSet(),
        ),
        isFalse,
      );
    });

    test('[T-29] gradeOnlyのみtrue_trueを返す', () {
      expect(
        hasActiveTimelineFilter(
          const TimelineFilterState(gradeOnly: true),
          Discipline.all.toSet(),
        ),
        isTrue,
      );
    });

    test('[T-30] venuesのみ非空_trueを返す', () {
      expect(
        hasActiveTimelineFilter(
          const TimelineFilterState(venues: {'中山'}),
          Discipline.all.toSet(),
        ),
        isTrue,
      );
    });

    test('[T-36] state既定値_enabledDisciplinesが一部のみ_trueを返す（QEMP-09）', () {
      expect(
        hasActiveTimelineFilter(const TimelineFilterState(), {
          Discipline.keiba,
        }),
        isTrue,
      );
    });
  });

  group('visibleTimelineRacesProvider の autoDispose（PERF-001）', () {
    test('[T-20] 最後のlistenerが外れた後_stateが破棄される', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final date = DateTime(2026, 4, 19);
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          timelineProvider.overrideWith(
            (ref, date) async => const <RaceEntity>[],
          ),
        ],
      );
      addTearDown(container.dispose);

      final subscription = container.listen(
        visibleTimelineRacesProvider(date),
        (previous, next) {},
      );
      expect(container.exists(visibleTimelineRacesProvider(date)), isTrue);

      subscription.close();
      await container.pump();

      expect(container.exists(visibleTimelineRacesProvider(date)), isFalse);
      // 下流のtimelineProviderも同様に破棄される（両方をautoDisposeにした効果）。
      expect(container.exists(timelineProvider(date)), isFalse);
    });
  });
}
