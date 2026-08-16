// isJapaneseHoliday のデシジョンテーブル
//
// | ID    | 日付         | 種別                              | 期待  |
// | ----- | ------------ | --------------------------------- | ----- |
// | T-01  | 2026-01-01   | 元日（固定日）                     | true  |
// | T-02  | 2026-01-12   | 成人の日（第2月曜）                | true  |
// | T-03  | 2026-02-11   | 建国記念の日（固定日）             | true  |
// | T-04  | 2026-02-23   | 天皇誕生日（2020年以降・固定日）   | true  |
// | T-05  | 2016-12-23   | 天皇誕生日（2020年より前・固定日） | true  |
// | T-06  | 2026-03-20   | 春分の日（近似式）                 | true  |
// | T-07  | 2026-04-29   | 昭和の日（固定日）                 | true  |
// | T-08  | 2026-07-20   | 海の日（第3月曜）                  | true  |
// | T-09  | 2026-08-11   | 山の日（固定日）                   | true  |
// | T-10  | 2026-09-21   | 敬老の日（第3月曜）                | true  |
// | T-11  | 2026-09-23   | 秋分の日（近似式）                 | true  |
// | T-12  | 2026-10-12   | スポーツの日（第2月曜）            | true  |
// | T-13  | 2026-11-03   | 文化の日（固定日）                 | true  |
// | T-14  | 2026-11-23   | 勤労感謝の日（固定日）             | true  |
// | T-15  | 2026-08-10   | 平日（祝日でない）                 | false |
// | T-16  | 2026-08-09   | 祝日でない日曜日                   | false |
// | T-17  | 2025-02-24   | 振替休日（2/23が日曜のため翌月曜） | true  |
// | T-18  | 2026-05-06   | 振替休日（5/3日曜→5/4,5/5も祝日で連鎖し5/6へ） | true |
// | T-19  | 2026-09-22   | 国民の休日（敬老の日と秋分の日に挟まれた火曜） | true |
// | T-20  | 2015-08-11   | 対象範囲外（2016年より前）         | false |
// | T-21  | 2100-01-01   | 対象範囲外（2099年より後）         | false |
// | T-22  | 2099-01-01   | 対象範囲の上限年                   | true  |
// | T-23  | 2016-01-01   | 対象範囲の下限年                   | true  |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/japanese_holiday.dart';

void main() {
  group('isJapaneseHoliday', () {
    test('[T-01] 2026-01-01_元日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 1, 1)), isTrue);
    });

    test('[T-02] 2026-01-12_成人の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 1, 12)), isTrue);
    });

    test('[T-03] 2026-02-11_建国記念の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 2, 11)), isTrue);
    });

    test('[T-04] 2026-02-23_天皇誕生日(2020年以降)_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 2, 23)), isTrue);
    });

    test('[T-05] 2016-12-23_天皇誕生日(2020年より前)_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2016, 12, 23)), isTrue);
    });

    test('[T-06] 2026-03-20_春分の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 3, 20)), isTrue);
    });

    test('[T-07] 2026-04-29_昭和の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 4, 29)), isTrue);
    });

    test('[T-08] 2026-07-20_海の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 7, 20)), isTrue);
    });

    test('[T-09] 2026-08-11_山の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 8, 11)), isTrue);
    });

    test('[T-10] 2026-09-21_敬老の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 9, 21)), isTrue);
    });

    test('[T-11] 2026-09-23_秋分の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 9, 23)), isTrue);
    });

    test('[T-12] 2026-10-12_スポーツの日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 10, 12)), isTrue);
    });

    test('[T-13] 2026-11-03_文化の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 11, 3)), isTrue);
    });

    test('[T-14] 2026-11-23_勤労感謝の日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 11, 23)), isTrue);
    });

    test('[T-15] 2026-08-10_平日_falseを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 8, 10)), isFalse);
    });

    test('[T-16] 2026-08-09_祝日でない日曜日_falseを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 8, 9)), isFalse);
    });

    test('[T-17] 2025-02-24_振替休日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2025, 2, 23)), isTrue);
      expect(isJapaneseHoliday(DateTime(2025, 2, 24)), isTrue);
    });

    test('[T-18] 2026-05-06_ゴールデンウィークの連鎖振替休日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 5, 3)), isTrue);
      expect(isJapaneseHoliday(DateTime(2026, 5, 4)), isTrue);
      expect(isJapaneseHoliday(DateTime(2026, 5, 5)), isTrue);
      expect(isJapaneseHoliday(DateTime(2026, 5, 6)), isTrue);
    });

    test('[T-19] 2026-09-22_国民の休日_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2026, 9, 22)), isTrue);
    });

    test('[T-20] 2015-08-11_対象範囲外(下限より前)_falseを返す', () {
      expect(isJapaneseHoliday(DateTime(2015, 8, 11)), isFalse);
    });

    test('[T-21] 2100-01-01_対象範囲外(上限より後)_falseを返す', () {
      expect(isJapaneseHoliday(DateTime(2100, 1, 1)), isFalse);
    });

    test('[T-22] 2099-01-01_対象範囲の上限年_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2099, 1, 1)), isTrue);
    });

    test('[T-23] 2016-01-01_対象範囲の下限年_trueを返す', () {
      expect(isJapaneseHoliday(DateTime(2016, 1, 1)), isTrue);
    });
  });
}
