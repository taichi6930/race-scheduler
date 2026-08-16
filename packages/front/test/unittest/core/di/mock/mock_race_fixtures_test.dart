// MockScheduleGenerator のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                       |
// | ---- | ------------------------------------------- | -------------------------------------------- |
// | T-01 | 同一anchorで2回生成                         | 完全に同じレース一覧を返す（決定論的）       |
// | T-02 | generateRaces                               | 全レースがraceType/日付の指定範囲内に収まる |
// | T-03 | generateRaces                               | 少なくとも1件はraceGradeが重賞級で生成される |
// | T-04 | generatePlaces                              | 高知(nar)・高知(keirin)の両方が生成される   |
// | T-05 | toRaceModel                                 | RaceModelへ変換すると各フィールドが対応する  |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/mock/mock_race_fixtures.dart';
import 'package:front/domain/entities/race_type.dart';

void main() {
  final anchor = DateTime(2026, 4, 19);

  test('[T-01] 同一anchorで2回生成_完全に同じレース一覧を返す', () {
    final first = MockScheduleGenerator(
      anchor: anchor,
    ).generateRaces(startOffset: -5, endOffset: 5);
    final second = MockScheduleGenerator(
      anchor: anchor,
    ).generateRaces(startOffset: -5, endOffset: 5);

    expect(
      first.map((r) => r.raceId).toList(),
      second.map((r) => r.raceId).toList(),
    );
  });

  test('[T-02] generateRaces_全レースが指定範囲内に収まる', () {
    final generator = MockScheduleGenerator(anchor: anchor);

    final races = generator.generateRaces(startOffset: -3, endOffset: 3);

    final rangeStart = anchor.subtract(const Duration(days: 3));
    final rangeEndExclusive = anchor.add(const Duration(days: 4));
    for (final race in races) {
      expect(race.dateTime.isBefore(rangeStart), isFalse);
      expect(race.dateTime.isBefore(rangeEndExclusive), isTrue);
    }
  });

  test('[T-03] generateRaces_少なくとも1件は重賞級で生成される', () {
    final generator = MockScheduleGenerator(anchor: anchor);

    final races = generator.generateRaces(startOffset: -20, endOffset: 20);

    expect(races.any((r) => r.isCalendarSpecified), isTrue);
  });

  test('[T-04] generatePlaces_高知(nar)と高知(keirin)の両方が生成される', () {
    final generator = MockScheduleGenerator(anchor: anchor);

    final places = generator.generatePlaces(startOffset: -20, endOffset: 20);

    expect(
      places.any((p) => p.raceCourse == '高知' && p.raceType == RaceType.nar),
      isTrue,
    );
    expect(
      places.any((p) => p.raceCourse == '高知' && p.raceType == RaceType.keirin),
      isTrue,
    );
  });

  test('[T-05] toRaceModel_各フィールドが対応する', () {
    final fixture = MockRaceFixture(
      raceId: 'race-1',
      raceName: '皐月賞',
      raceType: RaceType.jra,
      placeId: 'place-1',
      raceCourse: '中山',
      locationCode: 'jra-nakayama',
      dateTime: DateTime(2026, 4, 19, 15, 40),
      raceGrade: 'GⅠ',
      raceNumber: 11,
      isCalendarSpecified: true,
    );

    final model = fixture.toRaceModel();

    expect(model.raceId, 'race-1');
    expect(model.raceName, '皐月賞');
    expect(model.raceType, 'jra');
    expect(model.raceCourse, '中山');
    expect(model.datetime, DateTime(2026, 4, 19, 15, 40).toIso8601String());
    expect(model.raceGrade, 'GⅠ');
    expect(model.raceNumber, 11);
    expect(model.isCalendarSpecified, isTrue);
  });
}
