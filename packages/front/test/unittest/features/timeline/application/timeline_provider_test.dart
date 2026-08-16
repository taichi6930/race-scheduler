// timeline_provider.dart のデシジョンテーブル
//
// | ID   | 対象                    | 条件                              | 期待                          |
// | ---- | ----------------------- | ---------------------------------- | ------------------------------ |
// | T-01 | formatDateForApi        | 2026-04-19                        | '2026-04-19'                  |
// | T-02 | formatDateForApi        | 月日が1桁                         | ゼロパディングされる          |
// | T-03 | sortRacesByDatetime     | 順不同の3件                       | datetime昇順に並び替わる      |
// | T-04 | sortRacesByDatetime     | 空リスト                          | 空リストを返す                |
// | T-05 | sortRacesByDatetime     | 元のリストは変更しない            | 元のリストの順序が保たれる    |
// | T-06 | TimelineDateNotifier    | 初期状態                          | 今日の日付（時刻は00:00）     |
// | T-07 | TimelineDateNotifier    | goToPrevDay                       | 前日になる                    |
// | T-08 | TimelineDateNotifier    | goToNextDay                       | 翌日になる                    |
// | T-09 | TimelineDateNotifier    | setDate（時刻付き）                | 時刻が切り捨てられる          |
// | T-10 | timelineProvider        | 最後のlistenerが外れた後           | autoDisposeによりstateが破棄される（PERF-001） |
// | T-11 | timelineProvider        | listenerが存在する間               | stateが保持され続ける         |

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/jst_time.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';

RaceEntity _race(String id, String datetime) => RaceEntity(
  raceId: id,
  raceName: 'レース$id',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: datetime,
  raceNumber: 1,
);

void main() {
  group('formatDateForApi', () {
    test('[T-01] 2026-04-19を渡すと2026-04-19を返す', () {
      expect(formatDateForApi(DateTime(2026, 4, 19)), '2026-04-19');
    });

    test('[T-02] 月日が1桁_ゼロパディングされる', () {
      expect(formatDateForApi(DateTime(2026, 1, 5)), '2026-01-05');
    });
  });

  group('sortRacesByDatetime', () {
    test('[T-03] 順不同の3件_datetime昇順に並び替わる', () {
      final races = [
        _race('c', '2026-04-19T16:50:00'),
        _race('a', '2026-04-19T10:05:00'),
        _race('b', '2026-04-19T15:40:00'),
      ];

      final sorted = sortRacesByDatetime(races);

      expect(sorted.map((r) => r.raceId).toList(), ['a', 'b', 'c']);
    });

    test('[T-04] 空リスト_空リストを返す', () {
      expect(sortRacesByDatetime(const []), isEmpty);
    });

    test('[T-05] 元のリストは変更しない', () {
      final races = [
        _race('c', '2026-04-19T16:50:00'),
        _race('a', '2026-04-19T10:05:00'),
      ];

      sortRacesByDatetime(races);

      expect(races.map((r) => r.raceId).toList(), ['c', 'a']);
    });
  });

  group('TimelineDateNotifier', () {
    test('[T-06] 初期状態_今日の日付（時刻は00:00）', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(timelineDateProvider);
      final today = dateOnly(jstNow());

      expect(state, today);
    });

    test('[T-07] goToPrevDay_前日になる', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(timelineDateProvider.notifier);
      final before = container.read(timelineDateProvider);

      notifier.goToPrevDay();

      expect(
        container.read(timelineDateProvider),
        before.subtract(const Duration(days: 1)),
      );
    });

    test('[T-08] goToNextDay_翌日になる', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(timelineDateProvider.notifier);
      final before = container.read(timelineDateProvider);

      notifier.goToNextDay();

      expect(
        container.read(timelineDateProvider),
        before.add(const Duration(days: 1)),
      );
    });

    test('[T-09] setDate（時刻付き）_時刻が切り捨てられる', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(timelineDateProvider.notifier);

      notifier.setDate(DateTime(2026, 5, 31, 23, 59));

      expect(container.read(timelineDateProvider), DateTime(2026, 5, 31));
    });
  });

  group('timelineProvider の autoDispose（PERF-001）', () {
    final date = DateTime(2026, 4, 19);

    test('[T-10] 最後のlistenerが外れた後_stateが破棄される', () async {
      final container = ProviderContainer(
        overrides: [
          timelineProvider.overrideWith(
            (ref, date) async => const <RaceEntity>[],
          ),
        ],
      );
      addTearDown(container.dispose);

      final subscription = container.listen(
        timelineProvider(date),
        (previous, next) {},
      );
      expect(container.exists(timelineProvider(date)), isTrue);

      subscription.close();
      // autoDisposeの破棄は非同期でスケジュールされるため、
      // ProviderContainer.pump() で完了を待つ。
      await container.pump();

      expect(container.exists(timelineProvider(date)), isFalse);
    });

    test('[T-11] listenerが存在する間_stateが保持され続ける', () async {
      final container = ProviderContainer(
        overrides: [
          timelineProvider.overrideWith(
            (ref, date) async => const <RaceEntity>[],
          ),
        ],
      );
      addTearDown(container.dispose);

      final subscription = container.listen(
        timelineProvider(date),
        (previous, next) {},
      );
      await container.pump();

      expect(container.exists(timelineProvider(date)), isTrue);
      subscription.close();
    });
  });
}
