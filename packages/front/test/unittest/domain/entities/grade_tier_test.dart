// gradeTierOf / isCalendarSpecifiedGrade のデシジョンテーブル
//
// | ID    | raceType  | grade      | stage                       | tier   | isSpecified |
// | ----- | --------- | ---------- | ---------------------------- | ------ | ----------- |
// | T-01  | jra       | GⅠ         | -                             | top    | true        |
// | T-02  | jra       | GⅡ         | -                             | high   | true        |
// | T-03  | jra       | GⅢ         | -                             | mid    | true        |
// | T-04  | jra       | オープン    | -                             | low    | true        |
// | T-05  | jra       | 未勝利      | -                             | none   | false       |
// | T-06  | jra       | null       | -                             | none   | false       |
// | T-07  | jra       | ''（空文字）| -                             | none   | false       |
// | T-08  | jra       | 未知の文字列 | -                             | none   | false       |
// | T-09  | nar       | 地方重賞    | -                             | low    | true        |
// | T-10  | overseas  | 格付けなし   | -                             | none   | true        |
// | T-11  | keirin    | GP         | -                             | top    | true        |
// | T-12  | keirin    | FⅠ         | -（平場）                    | none   | false       |
// | T-13  | autorace  | SG         | -                             | top    | true        |
// | T-14  | autorace  | 開催        | -                             | none   | false       |
// | T-15  | boatrace  | SG         | -                             | top    | true        |
// | T-16  | boatrace  | PGⅠ        | -                             | top    | true        |
// | T-17  | boatrace  | GⅠ         | -                             | high   | false       |
// | T-18  | keirin    | FⅡ         | -（平場）                    | none   | false       |
// | T-19  | keirin    | FⅡ         | S級ダイナミックステージ（全プロ例外） | low    | true        |
// | T-20  | keirin    | FⅡ         | S級決勝（全プロ例外に非該当） | none   | false       |
// | T-21  | keirin    | FⅠ         | S級スーパープロピストレーサー賞（例外はFⅡ限定） | none   | false       |
// | T-22  | jra       | FⅡ         | S級スーパープロピストレーサー賞（例外はKEIRIN限定） | none   | false       |
// | T-23  | jra       | オープン特別 | -                             | low    | true        |
// | T-24  | jra       | 格付けなし   | -                             | none   | false       |
//
// specifiedGradeNamesOfTier のデシジョンテーブル
//
// | ID    | raceType  | tier | 期待                                          |
// | ----- | --------- | ---- | ---------------------------------------------- |
// | T-25  | jra       | top  | [GⅠ, JpnⅠ, J.GⅠ]（テーブル定義順）           |
// | T-26  | boatrace  | top  | [SG, PGⅠ]                                     |
// | T-27  | boatrace  | high | 空（GⅠはisSpecified:falseのため含まれない）  |
// | T-28  | autorace  | mid  | 空（autoraceにmid階層の指定グレードが無い）    |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/grade_tier.dart';
import 'package:front/domain/entities/race_type.dart';

void main() {
  group('gradeTierOf', () {
    test('[T-01] jra_GⅠ_topを返す', () {
      expect(gradeTierOf(RaceType.jra, 'GⅠ'), GradeTier.top);
    });

    test('[T-02] jra_GⅡ_highを返す', () {
      expect(gradeTierOf(RaceType.jra, 'GⅡ'), GradeTier.high);
    });

    test('[T-03] jra_GⅢ_midを返す', () {
      expect(gradeTierOf(RaceType.jra, 'GⅢ'), GradeTier.mid);
    });

    test('[T-04] jra_オープン_lowを返す', () {
      expect(gradeTierOf(RaceType.jra, 'オープン'), GradeTier.low);
    });

    test('[T-05] jra_未勝利_noneを返す', () {
      expect(gradeTierOf(RaceType.jra, '未勝利'), GradeTier.none);
    });

    test('[T-06] jra_null_noneを返す', () {
      expect(gradeTierOf(RaceType.jra, null), GradeTier.none);
    });

    test('[T-07] jra_空文字_noneを返す', () {
      expect(gradeTierOf(RaceType.jra, ''), GradeTier.none);
    });

    test('[T-08] jra_未知の文字列_noneを返す', () {
      expect(gradeTierOf(RaceType.jra, 'UNKNOWN'), GradeTier.none);
    });

    test('[T-09] nar_地方重賞_lowを返す', () {
      expect(gradeTierOf(RaceType.nar, '地方重賞'), GradeTier.low);
    });

    test('[T-10] overseas_格付けなし_noneを返す', () {
      expect(gradeTierOf(RaceType.overseas, '格付けなし'), GradeTier.none);
    });

    test('[T-11] keirin_GP_topを返す', () {
      expect(gradeTierOf(RaceType.keirin, 'GP'), GradeTier.top);
    });

    test('[T-12] keirin_FⅠ_noneを返す（平場）', () {
      expect(gradeTierOf(RaceType.keirin, 'FⅠ'), GradeTier.none);
    });

    test('[T-13] autorace_SG_topを返す', () {
      expect(gradeTierOf(RaceType.autorace, 'SG'), GradeTier.top);
    });

    test('[T-14] autorace_開催_noneを返す', () {
      expect(gradeTierOf(RaceType.autorace, '開催'), GradeTier.none);
    });

    test('[T-15] boatrace_SG_topを返す', () {
      expect(gradeTierOf(RaceType.boatrace, 'SG'), GradeTier.top);
    });

    test('[T-16] boatrace_PGⅠ_topを返す', () {
      expect(gradeTierOf(RaceType.boatrace, 'PGⅠ'), GradeTier.top);
    });

    test('[T-17] boatrace_GⅠ_highを返す', () {
      expect(gradeTierOf(RaceType.boatrace, 'GⅠ'), GradeTier.high);
    });

    test('[T-18] keirin_FⅡ_noneを返す（平場）', () {
      expect(gradeTierOf(RaceType.keirin, 'FⅡ'), GradeTier.none);
    });

    test('[T-19] keirin_FⅡ_全プロ例外ステージ_lowを返す', () {
      expect(gradeTierOf(RaceType.keirin, 'FⅡ', 'S級ダイナミックステージ'), GradeTier.low);
    });

    test('[T-20] keirin_FⅡ_全プロ例外に非該当のステージ_noneを返す', () {
      expect(gradeTierOf(RaceType.keirin, 'FⅡ', 'S級決勝'), GradeTier.none);
    });

    test('[T-21] keirin_FⅠ_全プロ例外ステージ名でもnoneを返す（例外はFⅡ限定）', () {
      expect(
        gradeTierOf(RaceType.keirin, 'FⅠ', 'S級スーパープロピストレーサー賞'),
        GradeTier.none,
      );
    });

    test('[T-22] jra_FⅡ_全プロ例外ステージ名でもnoneを返す（例外はKEIRIN限定）', () {
      expect(
        gradeTierOf(RaceType.jra, 'FⅡ', 'S級スーパープロピストレーサー賞'),
        GradeTier.none,
      );
    });

    test('[T-23] jra_オープン特別_lowを返す（コアマスタとの回帰テスト）', () {
      expect(gradeTierOf(RaceType.jra, 'オープン特別'), GradeTier.low);
    });

    test('[T-24] jra_格付けなし_noneを返す（コアマスタとの回帰テスト）', () {
      expect(gradeTierOf(RaceType.jra, '格付けなし'), GradeTier.none);
    });
  });

  group('isCalendarSpecifiedGrade', () {
    test('[T-01] jra_GⅠ_trueを返す', () {
      expect(isCalendarSpecifiedGrade(RaceType.jra, 'GⅠ'), isTrue);
    });

    test('[T-05] jra_未勝利_falseを返す', () {
      expect(isCalendarSpecifiedGrade(RaceType.jra, '未勝利'), isFalse);
    });

    test('[T-06] jra_null_falseを返す', () {
      expect(isCalendarSpecifiedGrade(RaceType.jra, null), isFalse);
    });

    test('[T-07] jra_空文字_falseを返す', () {
      expect(isCalendarSpecifiedGrade(RaceType.jra, ''), isFalse);
    });

    test('[T-08] jra_未知の文字列_falseを返す', () {
      expect(isCalendarSpecifiedGrade(RaceType.jra, 'UNKNOWN'), isFalse);
    });

    test('[T-10] overseas_格付けなし_trueを返す（コアマスタ準拠の例外）', () {
      expect(isCalendarSpecifiedGrade(RaceType.overseas, '格付けなし'), isTrue);
    });

    test('[T-16] boatrace_PGⅠ_trueを返す', () {
      expect(isCalendarSpecifiedGrade(RaceType.boatrace, 'PGⅠ'), isTrue);
    });

    test(
      '[T-17] boatrace_GⅠ_falseを返す（BOATRACEのGⅠはコアマスタでisSpecified:false）',
      () {
        expect(isCalendarSpecifiedGrade(RaceType.boatrace, 'GⅠ'), isFalse);
      },
    );

    test('[T-12] keirin_FⅠ_falseを返す（平場）', () {
      expect(isCalendarSpecifiedGrade(RaceType.keirin, 'FⅠ'), isFalse);
    });

    test('[T-18] keirin_FⅡ_falseを返す（平場）', () {
      expect(isCalendarSpecifiedGrade(RaceType.keirin, 'FⅡ'), isFalse);
    });

    test('[T-19] keirin_FⅡ_全プロ例外ステージ_trueを返す', () {
      expect(
        isCalendarSpecifiedGrade(RaceType.keirin, 'FⅡ', 'S級ダイナミックステージ'),
        isTrue,
      );
    });

    test('[T-20] keirin_FⅡ_全プロ例外に非該当のステージ_falseを返す', () {
      expect(isCalendarSpecifiedGrade(RaceType.keirin, 'FⅡ', 'S級決勝'), isFalse);
    });

    test('[T-21] keirin_FⅠ_全プロ例外ステージ名でもfalseを返す（例外はFⅡ限定）', () {
      expect(
        isCalendarSpecifiedGrade(RaceType.keirin, 'FⅠ', 'S級スーパープロピストレーサー賞'),
        isFalse,
      );
    });

    test('[T-22] jra_FⅡ_全プロ例外ステージ名でもfalseを返す（例外はKEIRIN限定）', () {
      expect(
        isCalendarSpecifiedGrade(RaceType.jra, 'FⅡ', 'S級スーパープロピストレーサー賞'),
        isFalse,
      );
    });

    test('[T-23] jra_オープン特別_trueを返す（コアマスタとの回帰テスト）', () {
      expect(isCalendarSpecifiedGrade(RaceType.jra, 'オープン特別'), isTrue);
    });

    test('[T-24] jra_格付けなし_falseを返す（コアマスタとの回帰テスト）', () {
      expect(isCalendarSpecifiedGrade(RaceType.jra, '格付けなし'), isFalse);
    });
  });

  group('specifiedGradeNamesOfTier', () {
    test('[T-25] jra_top_GⅠ・JpnⅠ・J.GⅠをテーブル定義順で返す', () {
      expect(specifiedGradeNamesOfTier(RaceType.jra, GradeTier.top), [
        'GⅠ',
        'JpnⅠ',
        'J.GⅠ',
      ]);
    });

    test('[T-26] boatrace_top_SG・PGⅠを返す', () {
      expect(specifiedGradeNamesOfTier(RaceType.boatrace, GradeTier.top), [
        'SG',
        'PGⅠ',
      ]);
    });

    test('[T-27] boatrace_high_空を返す（GⅠはisSpecified:falseのため含まれない）', () {
      expect(
        specifiedGradeNamesOfTier(RaceType.boatrace, GradeTier.high),
        isEmpty,
      );
    });

    test('[T-28] autorace_mid_空を返す（mid階層の指定グレードが無い）', () {
      expect(
        specifiedGradeNamesOfTier(RaceType.autorace, GradeTier.mid),
        isEmpty,
      );
    });
  });
}
