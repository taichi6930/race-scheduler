// PlaceModel.fromJson / toEntity のデシジョンテーブル
//
// | ID   | 条件                                  | 期待                              |
// | ---- | -------------------------------------- | ----------------------------------- |
// | T-01 | JSONに全フィールドを含む               | toEntity()後も値がそのまま引き継がれる |
// | T-02 | placeGrade・isRaceListAvailableを含まない | toEntity()後は両方nullになる      |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/models/place_model.dart';

Map<String, dynamic> _json({String? placeGrade, bool? isRaceListAvailable}) => {
  'placeId': 'jra2026010101',
  'raceType': 'jra',
  'raceCourse': '中山',
  'locationCode': '06',
  'datetime': '2026-01-01T00:00:00+09:00',
  'placeGrade': ?placeGrade,
  'isRaceListAvailable': ?isRaceListAvailable,
};

void main() {
  test('[T-01] 全フィールドを含む_toEntity後も値がそのまま引き継がれる', () {
    final model = PlaceModel.fromJson(
      _json(placeGrade: 'GⅠ', isRaceListAvailable: true),
    );

    final entity = model.toEntity();

    expect(entity.placeId, 'jra2026010101');
    expect(entity.raceType, 'jra');
    expect(entity.raceCourse, '中山');
    expect(entity.locationCode, '06');
    expect(entity.datetime, '2026-01-01T00:00:00+09:00');
    expect(entity.placeGrade, 'GⅠ');
    expect(entity.isRaceListAvailable, isTrue);
  });

  test('[T-02] placeGrade_isRaceListAvailableを含まない_toEntity後は両方null', () {
    final model = PlaceModel.fromJson(_json());

    final entity = model.toEntity();

    expect(entity.placeGrade, isNull);
    expect(entity.isRaceListAvailable, isNull);
  });
}
