// specifiedGradeRacesFor / racesNeedingReschedule のデシジョンテーブル
//
// | ID   | 条件                          | 期待                          |
// | ---- | ----------------------------- | ------------------------------ |
// | T-01 | 重賞（GⅠ）のレースを含む      | そのレースが結果に含まれる     |
// | T-02 | 一般（グレードなし）のレース   | 結果から除外される             |
// | T-03 | 空リスト                       | 空リストを返す                 |
// | T-04 | 重賞と一般が混在               | 重賞のみが結果に残る           |
// | T-05 | isCalendarSpecified=true（grade=null） | API算出値が優先され結果に含まれる |
// | T-06 | isCalendarSpecified=false（grade=GⅠ）  | API算出値が優先され除外される     |
// | T-07 | racesNeedingReschedule: previousRacesがnull       | 全件が「新規」として返る       |
// | T-08 | racesNeedingReschedule: 新規追加のレース          | 結果に含まれる                 |
// | T-09 | racesNeedingReschedule: 内容が変わっていないレース | 結果から除外される              |
// | T-10 | racesNeedingReschedule: raceIdは同じで内容が変わったレース | 結果に含まれる           |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/notifications/application/notification_sync.dart';

RaceEntity _race({
  required String raceId,
  required String raceType,
  String? grade,
  bool? isCalendarSpecified,
}) => RaceEntity(
  raceId: raceId,
  raceName: 'テストレース',
  raceType: raceType,
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00',
  raceGrade: grade,
  raceNumber: 11,
  isCalendarSpecified: isCalendarSpecified,
);

void main() {
  test('[T-01] 重賞GⅠのレースを含む_結果に含まれる', () {
    final race = _race(raceId: 'race-001', raceType: 'jra', grade: 'GⅠ');

    final result = specifiedGradeRacesFor([race]);

    expect(result, contains(race));
  });

  test('[T-02] 一般グレードなしのレース_結果から除外される', () {
    final race = _race(raceId: 'race-002', raceType: 'jra');

    final result = specifiedGradeRacesFor([race]);

    expect(result, isEmpty);
  });

  test('[T-03] 空リスト_空リストを返す', () {
    final result = specifiedGradeRacesFor(const []);

    expect(result, isEmpty);
  });

  test('[T-04] 重賞と一般が混在_重賞のみが結果に残る', () {
    final graded = _race(raceId: 'race-003', raceType: 'keirin', grade: 'GP');
    final general = _race(raceId: 'race-004', raceType: 'keirin');

    final result = specifiedGradeRacesFor([graded, general]);

    expect(result, [graded]);
  });

  test('[T-05] isCalendarSpecifiedがtrue_gradeがnullでも結果に含まれる', () {
    final race = _race(
      raceId: 'race-005',
      raceType: 'jra',
      isCalendarSpecified: true,
    );

    final result = specifiedGradeRacesFor([race]);

    expect(result, contains(race));
  });

  test('[T-06] isCalendarSpecifiedがfalse_gradeがGⅠでも除外される', () {
    final race = _race(
      raceId: 'race-006',
      raceType: 'jra',
      grade: 'GⅠ',
      isCalendarSpecified: false,
    );

    final result = specifiedGradeRacesFor([race]);

    expect(result, isEmpty);
  });

  test('[T-07] previousRacesがnull_全件が新規として返る', () {
    final race = _race(raceId: 'race-007', raceType: 'jra');

    final result = racesNeedingReschedule([race], null);

    expect(result, [race]);
  });

  test('[T-08] 新規追加のレース_結果に含まれる', () {
    final existing = _race(raceId: 'race-008', raceType: 'jra');
    final added = _race(raceId: 'race-009', raceType: 'jra');

    final result = racesNeedingReschedule([existing, added], [existing]);

    expect(result, [added]);
  });

  test('[T-09] 内容が変わっていないレース_結果から除外される', () {
    final race = _race(raceId: 'race-010', raceType: 'jra', grade: 'GⅠ');

    final result = racesNeedingReschedule([race], [race]);

    expect(result, isEmpty);
  });

  test('[T-10] raceIdは同じで内容が変わったレース_結果に含まれる', () {
    final previous = _race(raceId: 'race-011', raceType: 'jra', grade: 'GⅠ');
    final updated = _race(raceId: 'race-011', raceType: 'jra', grade: 'GⅡ');

    final result = racesNeedingReschedule([updated], [previous]);

    expect(result, [updated]);
  });
}
