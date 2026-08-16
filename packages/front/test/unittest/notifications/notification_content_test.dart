// buildRaceNotificationContent のデシジョンテーブル
//
// | ID   | 条件                    | 期待                                        |
// | ---- | ----------------------- | --------------------------------------------- |
// | T-01 | グレードあり・lead=5     | タイトルにグレード、本文に「発走 5分前」    |
// | T-02 | グレードなし（一般）     | タイトルにグレード表記なし                   |
// | T-03 | lead=0                  | 本文が「まもなく発走」になる                 |
// | T-04 | 競技=keirin              | タイトルに🚲アイコンが付く                   |
// | T-05 | datetime=15:40           | 本文に発走時刻「15:40」が含まれる            |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/notifications/notification_content.dart';

RaceEntity _race({required String raceType, String? grade}) => RaceEntity(
  raceId: 'race-001',
  raceName: '皐月賞',
  raceType: raceType,
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00',
  raceGrade: grade,
  raceNumber: 11,
);

void main() {
  test('[T-01] グレードあり_lead5_タイトルにグレード本文に発走5分前', () {
    final content = buildRaceNotificationContent(
      _race(raceType: 'jra', grade: 'GⅠ'),
      5,
    );

    expect(content.title, contains('（GⅠ）'));
    expect(content.title, contains('皐月賞'));
    expect(content.body, contains('中山 11R'));
    expect(content.body, contains('発走 5分前'));
  });

  test('[T-02] グレードなし_タイトルにグレード表記なし', () {
    final content = buildRaceNotificationContent(_race(raceType: 'jra'), 5);

    expect(content.title, isNot(contains('（')));
  });

  test('[T-03] lead0_本文がまもなく発走になる', () {
    final content = buildRaceNotificationContent(
      _race(raceType: 'jra', grade: 'GⅠ'),
      0,
    );

    expect(content.body, contains('まもなく発走'));
  });

  test('[T-04] 競技keirin_タイトルに🚲アイコンが付く', () {
    final content = buildRaceNotificationContent(
      _race(raceType: 'keirin', grade: 'GP'),
      5,
    );

    expect(content.title, startsWith('🚲'));
  });

  test('[T-05] datetime1540_本文に発走時刻1540が含まれる', () {
    final content = buildRaceNotificationContent(
      _race(raceType: 'jra', grade: 'GⅠ'),
      0,
    );

    expect(content.body, contains('15:40'));
  });
}
