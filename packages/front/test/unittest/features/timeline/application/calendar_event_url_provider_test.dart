// CalendarEventRaceKey のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                          |
// | ---- | ------------------------------------------- | -------------------------------- |
// | T-01 | raceIdが同じでその他フィールドが異なる2件   | 等価（==）・hashCodeも一致       |
// | T-02 | raceIdが異なる2件                            | 非等価                           |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/calendar_event_url_provider.dart';

RaceEntity _race({required String id, required String name}) => RaceEntity(
  raceId: id,
  raceName: name,
  raceType: 'jra',
  placeId: 'place-$id',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00+09:00',
  raceNumber: 11,
);

void main() {
  group('CalendarEventRaceKey', () {
    test('[T-01] raceIdが同じ_その他フィールドが異なっても等価', () {
      final key1 = CalendarEventRaceKey(_race(id: 'r1', name: '皐月賞'));
      final key2 = CalendarEventRaceKey(_race(id: 'r1', name: '別名'));

      expect(key1, key2);
      expect(key1.hashCode, key2.hashCode);
    });

    test('[T-02] raceIdが異なる_非等価', () {
      final key1 = CalendarEventRaceKey(_race(id: 'r1', name: '皐月賞'));
      final key2 = CalendarEventRaceKey(_race(id: 'r2', name: '皐月賞'));

      expect(key1 == key2, isFalse);
    });
  });
}
