// googleCalendarColorKeyOf のデシジョンテーブル
//
// | ID   | raceType  | grade        | 期待色キー   |
// | ---- | --------- | ------------ | ------------ |
// | T-01 | jra       | GⅠ           | blueberry    |
// | T-02 | jra       | GⅡ           | tomato       |
// | T-03 | jra       | GⅢ           | basil        |
// | T-04 | jra       | JpnⅠ         | lavender     |
// | T-05 | jra       | JpnⅡ         | flamingo     |
// | T-06 | jra       | JpnⅢ         | sage         |
// | T-07 | jra       | 重賞         | banana       |
// | T-08 | jra       | Listed       | banana       |
// | T-09 | jra       | オープン     | tangerine    |
// | T-10 | jra       | オープン特別 | tangerine    |
// | T-11 | jra       | 未勝利（未収載grade） | graphite（既定色にフォールバック） |
// | T-12 | nar       | 地方重賞     | grape        |
// | T-13 | overseas  | 格付けなし   | graphite     |
// | T-14 | keirin    | GP           | blueberry    |
// | T-15 | keirin    | FⅠ           | graphite     |
// | T-16 | boatrace  | 一般         | graphite     |
// | T-17 | autorace  | 開催         | graphite     |
// | T-18 | jra       | null         | graphite     |
// | T-19 | jra       | ''（空文字） | graphite     |
// | T-20 | jra       | 未知の文字列 | graphite     |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/google_calendar_colors.dart';
import 'package:front/design/grade_color.dart';
import 'package:front/domain/entities/race_type.dart';

void main() {
  group('googleCalendarColorKeyOf', () {
    test('[T-01] jra_GⅠ_blueberryを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'GⅠ'),
        GoogleCalendarColorKey.blueberry,
      );
    });

    test('[T-02] jra_GⅡ_tomatoを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'GⅡ'),
        GoogleCalendarColorKey.tomato,
      );
    });

    test('[T-03] jra_GⅢ_basilを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'GⅢ'),
        GoogleCalendarColorKey.basil,
      );
    });

    test('[T-04] jra_JpnⅠ_lavenderを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'JpnⅠ'),
        GoogleCalendarColorKey.lavender,
      );
    });

    test('[T-05] jra_JpnⅡ_flamingoを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'JpnⅡ'),
        GoogleCalendarColorKey.flamingo,
      );
    });

    test('[T-06] jra_JpnⅢ_sageを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'JpnⅢ'),
        GoogleCalendarColorKey.sage,
      );
    });

    test('[T-07] jra_重賞_bananaを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, '重賞'),
        GoogleCalendarColorKey.banana,
      );
    });

    test('[T-08] jra_Listed_bananaを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'Listed'),
        GoogleCalendarColorKey.banana,
      );
    });

    test('[T-09] jra_オープン_tangerineを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'オープン'),
        GoogleCalendarColorKey.tangerine,
      );
    });

    test('[T-10] jra_オープン特別_tangerineを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'オープン特別'),
        GoogleCalendarColorKey.tangerine,
      );
    });

    test('[T-11] jra_未勝利_graphiteを返す（未収載gradeのフォールバック）', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, '未勝利'),
        GoogleCalendarColorKey.graphite,
      );
    });

    test('[T-12] nar_地方重賞_grapeを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.nar, '地方重賞'),
        GoogleCalendarColorKey.grape,
      );
    });

    test('[T-13] overseas_格付けなし_graphiteを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.overseas, '格付けなし'),
        GoogleCalendarColorKey.graphite,
      );
    });

    test('[T-14] keirin_GP_blueberryを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.keirin, 'GP'),
        GoogleCalendarColorKey.blueberry,
      );
    });

    test('[T-15] keirin_FⅠ_graphiteを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.keirin, 'FⅠ'),
        GoogleCalendarColorKey.graphite,
      );
    });

    test('[T-16] boatrace_一般_graphiteを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.boatrace, '一般'),
        GoogleCalendarColorKey.graphite,
      );
    });

    test('[T-17] autorace_開催_graphiteを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.autorace, '開催'),
        GoogleCalendarColorKey.graphite,
      );
    });

    test('[T-18] jra_null_graphiteを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, null),
        GoogleCalendarColorKey.graphite,
      );
    });

    test('[T-19] jra_空文字_graphiteを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, ''),
        GoogleCalendarColorKey.graphite,
      );
    });

    test('[T-20] jra_未知の文字列_graphiteを返す', () {
      expect(
        googleCalendarColorKeyOf(RaceType.jra, 'UNKNOWN'),
        GoogleCalendarColorKey.graphite,
      );
    });
  });
}
