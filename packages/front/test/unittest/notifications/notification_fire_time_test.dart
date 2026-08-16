// notificationFireTime / isFireTimeUpcoming のデシジョンテーブル
//
// | ID   | 対象                | 条件                          | 期待                    |
// | ---- | ------------------- | ------------------------------ | -------------------------- |
// | T-01 | notificationFireTime| leadMinutes=5                  | 発走5分前の時刻を返す   |
// | T-02 | notificationFireTime| leadMinutes=0                  | 発走時刻そのものを返す  |
// | T-03 | isFireTimeUpcoming  | fireTimeがnowより後            | true                    |
// | T-04 | isFireTimeUpcoming  | fireTimeがnowより前            | false                   |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/notifications/notification_fire_time.dart';

RaceEntity _race(String datetime) => RaceEntity(
  raceId: 'race-001',
  raceName: 'テストレース',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: datetime,
  raceNumber: 11,
);

void main() {
  group('notificationFireTime', () {
    test('[T-01] leadMinutes=5_発走5分前の時刻を返す', () {
      final race = _race('2026-04-19T15:40:00');

      final fireTime = notificationFireTime(race, 5);

      expect(fireTime, DateTime.parse('2026-04-19T15:35:00'));
    });

    test('[T-02] leadMinutes=0_発走時刻そのものを返す', () {
      final race = _race('2026-04-19T15:40:00');

      final fireTime = notificationFireTime(race, 0);

      expect(fireTime, DateTime.parse('2026-04-19T15:40:00'));
    });
  });

  group('isFireTimeUpcoming', () {
    test('[T-03] fireTimeがnowより後_true', () {
      final now = DateTime(2026, 4, 19, 15, 30);
      final fireTime = DateTime(2026, 4, 19, 15, 35);

      expect(isFireTimeUpcoming(fireTime, now), isTrue);
    });

    test('[T-04] fireTimeがnowより前_false', () {
      final now = DateTime(2026, 4, 19, 15, 40);
      final fireTime = DateTime(2026, 4, 19, 15, 35);

      expect(isFireTimeUpcoming(fireTime, now), isFalse);
    });
  });
}
