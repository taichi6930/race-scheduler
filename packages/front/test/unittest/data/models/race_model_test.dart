// RaceModel.fromJson / toEntity のデシジョンテーブル（isCalendarSpecified周りのみ）
//
// | ID   | 条件                                  | 期待                              |
// | ---- | -------------------------------------- | ----------------------------------- |
// | T-01 | JSONにisCalendarSpecified:trueを含む      | toEntity()後もtrueが引き継がれる    |
// | T-02 | JSONにisCalendarSpecifiedを含まない       | toEntity()後はnullになる            |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/models/race_model.dart';

Map<String, dynamic> _json({bool? isCalendarSpecified}) => {
  'raceId': 'jra202601010101',
  'raceName': 'テストレース',
  'raceType': 'jra',
  'placeId': 'jra2026010101',
  'raceCourse': '中山',
  'datetime': '2026-01-01T15:40:00+09:00',
  'raceGrade': 'GⅠ',
  'raceNumber': 1,
  'isCalendarSpecified': ?isCalendarSpecified,
};

void main() {
  test('[T-01] isCalendarSpecified_trueを含む_toEntity後もtrueが引き継がれる', () {
    final model = RaceModel.fromJson(_json(isCalendarSpecified: true));

    final entity = model.toEntity();

    expect(entity.isCalendarSpecified, isTrue);
  });

  test('[T-02] isCalendarSpecifiedを含まない_toEntity後はnullになる', () {
    final model = RaceModel.fromJson(_json());

    final entity = model.toEntity();

    expect(entity.isCalendarSpecified, isNull);
  });
}
