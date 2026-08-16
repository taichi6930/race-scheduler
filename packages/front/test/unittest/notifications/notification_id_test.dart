// notificationIdFor のデシジョンテーブル
//
// | ID   | 条件                          | 期待                          |
// | ---- | ----------------------------- | ------------------------------ |
// | T-01 | 同じraceIdを2回計算            | 常に同じIDを返す（決定的）    |
// | T-02 | 異なるraceId                   | 異なるIDを返す                |
// | T-03 | 任意のraceId                   | 32bit正の整数の範囲に収まる   |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/notifications/notification_id.dart';

void main() {
  test('[T-01] 同じraceIdを2回計算_常に同じIDを返す', () {
    expect(notificationIdFor('race-001'), notificationIdFor('race-001'));
  });

  test('[T-02] 異なるraceId_異なるIDを返す', () {
    expect(notificationIdFor('race-001'), isNot(notificationIdFor('race-002')));
  });

  test('[T-03] 任意のraceId_32bit正の整数の範囲に収まる', () {
    for (final raceId in ['a', 'race-999999', '中山11R', '']) {
      final id = notificationIdFor(raceId);
      expect(id, greaterThanOrEqualTo(0));
      expect(id, lessThanOrEqualTo(0x7fffffff));
    }
  });
}
