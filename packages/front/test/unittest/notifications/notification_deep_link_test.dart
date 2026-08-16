// notificationDeepLinkFor のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                          |
// | ---- | ----------------------------- | ---------------------------------------------- |
// | T-01 | 通常のレース                  | `/timeline?date=...&raceId=...`形式のURLを返す |
// | T-02 | raceIdにURLエンコードが必要な文字を含む | raceIdがクエリエンコードされる          |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/notifications/notification_deep_link.dart';

RaceEntity _race({
  required String raceId,
  String datetime = '2026-05-01T15:40:00',
}) => RaceEntity(
  raceId: raceId,
  raceName: 'テストレース',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: datetime,
  raceNumber: 11,
);

void main() {
  test('[T-01] 通常のレース_date と raceId を含むURLを返す', () {
    final url = notificationDeepLinkFor(_race(raceId: 'race-001'));

    expect(url, '/timeline?date=2026-05-01&raceId=race-001');
  });

  test('[T-02] raceIdにURLエンコードが必要な文字を含む_クエリエンコードされる', () {
    final url = notificationDeepLinkFor(_race(raceId: 'race&001'));

    expect(url, '/timeline?date=2026-05-01&raceId=race%26001');
  });
}
