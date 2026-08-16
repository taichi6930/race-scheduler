// jstNow / parseJstDateTime のデシジョンテーブル
//
// | ID   | 対象             | 条件                              | 期待                                      |
// | ---- | ---------------- | ---------------------------------- | -------------------------------------------- |
// | T-01 | jstNow           | 任意の実行時刻                     | UTC基準の現在時刻より常に9時間進んでいる     |
// | T-02 | jstNow           | 任意の実行時刻                     | isUtc（変換ロジックの前提）が true           |
// | T-03 | parseJstDateTime | +09:00オフセット付き文字列         | 9時間進めてJSTの壁時計フィールドに正規化する |
// | T-04 | parseJstDateTime | +09:00オフセット付き文字列         | isUtcがtrue（jstNowと同じ表現）              |
// | T-05 | parseJstDateTime | Z（UTC）サフィックス付き文字列     | 9時間進めてJSTの壁時計フィールドに正規化する |
// | T-06 | parseJstDateTime | オフセットなし（naive）文字列      | 数値をそのままJST壁時計として返す（無変換）  |
// | T-07 | formatDateForApi | 2026-04-19                        | '2026-04-19'                                 |
// | T-08 | formatDateForApi | 月日が1桁                         | ゼロパディングされる                          |
// | T-09 | formatJapaneseDateLabel | 2026-04-19                 | '2026年4月19日'                              |
// | T-10 | formatJapaneseDateLabel | 月日が1桁                  | ゼロパディングしない                          |
// | T-11 | parseJstDateTime | オフセットなし（naive）文字列（QJST-08） | 返り値は変わらず、想定外を伝える警告ログが出力される |

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/jst_time.dart';

void main() {
  group('jstNow', () {
    test('[T-01] 任意の実行時刻_UTCより常に9時間進んでいる', () {
      final beforeUtc = DateTime.now().toUtc();

      final result = jstNow();

      final diff = result.difference(beforeUtc);
      expect(diff.inHours, 9);
    });

    test('[T-02] 任意の実行時刻_isUtcがtrue', () {
      final result = jstNow();

      expect(result.isUtc, isTrue);
    });
  });

  group('parseJstDateTime', () {
    test('[T-03] +09:00オフセット付き文字列_JST壁時計フィールドに正規化する', () {
      final result = parseJstDateTime('2026-07-23T23:30:00+09:00');

      expect(result, DateTime.utc(2026, 7, 23, 23, 30, 0));
    });

    test('[T-04] +09:00オフセット付き文字列_isUtcがtrue', () {
      final result = parseJstDateTime('2026-07-23T23:30:00+09:00');

      expect(result.isUtc, isTrue);
    });

    test('[T-05] Zサフィックス付き文字列_JST壁時計フィールドに正規化する', () {
      final result = parseJstDateTime('2026-07-23T14:30:00Z');

      expect(result, DateTime.utc(2026, 7, 23, 23, 30, 0));
    });

    test('[T-06] オフセットなし文字列_数値をそのまま返す（無変換）', () {
      final result = parseJstDateTime('2026-07-23T23:30:00');

      expect(result, DateTime(2026, 7, 23, 23, 30, 0));
      expect(result.isUtc, isFalse);
    });

    test('[T-11] オフセットなし文字列_返り値は変わらず想定外の警告ログが出力される（QJST-08）', () {
      final originalDebugPrint = debugPrint;
      final logs = <String>[];
      debugPrint = (String? message, {int? wrapWidth}) {
        logs.add(message ?? '');
      };

      try {
        final result = parseJstDateTime('2026-07-23T23:30:00');

        expect(result, DateTime(2026, 7, 23, 23, 30, 0));
        expect(result.isUtc, isFalse);
        expect(logs, hasLength(1));
        expect(logs.single, contains('parseJstDateTime'));
        expect(logs.single, contains('2026-07-23T23:30:00'));
      } finally {
        debugPrint = originalDebugPrint;
      }
    });
  });

  group('formatDateForApi', () {
    test('[T-07] 2026-04-19を渡すと2026-04-19を返す', () {
      expect(formatDateForApi(DateTime(2026, 4, 19)), '2026-04-19');
    });

    test('[T-08] 月日が1桁_ゼロパディングされる', () {
      expect(formatDateForApi(DateTime(2026, 1, 5)), '2026-01-05');
    });
  });

  group('formatJapaneseDateLabel', () {
    test('[T-09] 2026-04-19を渡すと2026年4月19日を返す', () {
      expect(formatJapaneseDateLabel(DateTime(2026, 4, 19)), '2026年4月19日');
    });

    test('[T-10] 月日が1桁_ゼロパディングしない', () {
      expect(formatJapaneseDateLabel(DateTime(2026, 1, 5)), '2026年1月5日');
    });
  });
}
