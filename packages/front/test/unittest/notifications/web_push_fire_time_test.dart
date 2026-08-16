// webPushFireAtMs のデシジョンテーブル
//
// | ID   | 条件                     | 期待                                              |
// | ---- | ------------------------ | -------------------------------------------------- |
// | T-01 | leadMinutes=5             | 発走5分前のUTC epoch millisを返す                  |
// | T-02 | leadMinutes=0             | 発走時刻そのもののUTC epoch millisを返す           |
// | T-03 | JST発走時刻               | JST壁時計から9時間引いたUTC値になる（-9h変換）     |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/notifications/web_push_fire_time.dart';

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
  test('[T-01] leadMinutes=5_発走5分前のUTC epoch millisを返す', () {
    final race = _race('2026-04-19T15:40:00');

    final fireAtMs = webPushFireAtMs(race, 5);

    expect(fireAtMs, DateTime.utc(2026, 4, 19, 6, 35).millisecondsSinceEpoch);
  });

  test('[T-02] leadMinutes=0_発走時刻そのもののUTC epoch millisを返す', () {
    final race = _race('2026-04-19T15:40:00');

    final fireAtMs = webPushFireAtMs(race, 0);

    expect(fireAtMs, DateTime.utc(2026, 4, 19, 6, 40).millisecondsSinceEpoch);
  });

  test('[T-03] JST発走時刻_壁時計から9時間引いたUTC値になる', () {
    final race = _race('2026-01-01T00:30:00');

    final fireAtMs = webPushFireAtMs(race, 0);

    // JST 2026-01-01 00:30 → UTC 2025-12-31 15:30（日付をまたぐケース）
    expect(fireAtMs, DateTime.utc(2025, 12, 31, 15, 30).millisecondsSinceEpoch);
  });
}
