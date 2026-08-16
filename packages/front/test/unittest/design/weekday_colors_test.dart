// weekdayAccentColor のデシジョンテーブル
//
// | ID   | 日付         | 条件                          | 期待               |
// | ---- | ------------ | ----------------------------- | ------------------ |
// | T-01 | 2026-08-09   | 日曜日（祝日でない）           | colors.danger      |
// | T-02 | 2026-08-08   | 土曜日（祝日でない）           | colors.saturday    |
// | T-03 | 2026-08-10   | 平日（祝日でない）             | null                |
// | T-04 | 2026-08-11   | 祝日（火曜日、山の日）         | colors.danger      |
// | T-05 | 2026-09-21   | 祝日と重なる月曜日（敬老の日） | colors.danger（土日以外の祝日も赤） |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/tokens.dart';
import 'package:front/design/weekday_colors.dart';

void main() {
  group('weekdayAccentColor', () {
    const colors = AppColors.light;

    test('[T-01] 日曜日_dangerを返す', () {
      expect(weekdayAccentColor(colors, DateTime(2026, 8, 9)), colors.danger);
    });

    test('[T-02] 土曜日_saturdayを返す', () {
      expect(
        weekdayAccentColor(colors, DateTime(2026, 8, 8)),
        colors.saturday,
      );
    });

    test('[T-03] 平日_nullを返す', () {
      expect(weekdayAccentColor(colors, DateTime(2026, 8, 10)), isNull);
    });

    test('[T-04] 祝日(火曜日)_dangerを返す', () {
      expect(weekdayAccentColor(colors, DateTime(2026, 8, 11)), colors.danger);
    });

    test('[T-05] 祝日(月曜日)_dangerを返す', () {
      expect(weekdayAccentColor(colors, DateTime(2026, 9, 21)), colors.danger);
    });
  });
}
