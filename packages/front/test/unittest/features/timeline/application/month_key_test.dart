// month_key.dart のデシジョンテーブル
//
// | ID   | 対象                 | 条件                                       | 期待                                    |
// | ---- | -------------------- | ------------------------------------------- | ---------------------------------------- |
// | T-01 | monthKeyOf           | 2026-08-06                                  | '2026-08'                                |
// | T-02 | monthKeyOf           | 月が1桁（2026-01-05）                        | '2026-01'（ゼロパディング）              |
// | T-03 | offsetMonthKey       | offset=0                                    | 同じ月キー                               |
// | T-04 | offsetMonthKey       | offset=1（年をまたがない）                   | 翌月                                     |
// | T-05 | offsetMonthKey       | 12月にoffset=1（年またぎ・未来方向）         | 翌年1月                                  |
// | T-06 | offsetMonthKey       | 1月にoffset=-1（年またぎ・過去方向）         | 前年12月                                 |
// | T-07 | monthDateRange       | 平年2月（2026-02）                          | ('2026-02-01', '2026-02-28')             |
// | T-08 | monthDateRange       | うるう年2月（2024-02）                      | ('2024-02-01', '2024-02-29')             |
// | T-09 | monthDateRange       | 30日月（2026-04）                           | ('2026-04-01', '2026-04-30')             |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/features/timeline/application/month_key.dart';

void main() {
  group('monthKeyOf', () {
    test('[T-01] 2026-08-06を渡すと2026-08を返す', () {
      expect(monthKeyOf(DateTime(2026, 8, 6)), '2026-08');
    });

    test('[T-02] 月が1桁_ゼロパディングされる', () {
      expect(monthKeyOf(DateTime(2026, 1, 5)), '2026-01');
    });
  });

  group('offsetMonthKey', () {
    test('[T-03] offset=0_同じ月キーを返す', () {
      expect(offsetMonthKey('2026-08', 0), '2026-08');
    });

    test('[T-04] offset=1_翌月になる', () {
      expect(offsetMonthKey('2026-08', 1), '2026-09');
    });

    test('[T-05] 12月にoffset=1_翌年1月になる', () {
      expect(offsetMonthKey('2026-12', 1), '2027-01');
    });

    test('[T-06] 1月にoffset=-1_前年12月になる', () {
      expect(offsetMonthKey('2026-01', -1), '2025-12');
    });
  });

  group('monthDateRange', () {
    test('[T-07] 平年2月_2026-02-01から2026-02-28', () {
      expect(monthDateRange('2026-02'), ('2026-02-01', '2026-02-28'));
    });

    test('[T-08] うるう年2月_2024-02-01から2024-02-29', () {
      expect(monthDateRange('2024-02'), ('2024-02-01', '2024-02-29'));
    });

    test('[T-09] 30日月_2026-04-01から2026-04-30', () {
      expect(monthDateRange('2026-04'), ('2026-04-01', '2026-04-30'));
    });
  });
}
