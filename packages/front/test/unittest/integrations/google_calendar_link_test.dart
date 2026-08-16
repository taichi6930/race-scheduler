// buildGoogleCalendarEventUrl のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                        |
// | ---- | ----------------------------- | ---------------------------------------------- |
// | T-01 | グレードあり                  | text にレース名とグレードが含まれる         |
// | T-02 | グレードなし（一般）          | text にグレード表記が付かない               |
// | T-03 | JST発走時刻                    | dates が JST-9時間したUTCの開始/終了になる  |
// | T-04 | 任意のレース                  | details に競技ラベルと会場・R番号が含まれる |
// | T-05 | 任意のレース                  | location に会場名が入る                     |
// | T-06 | 任意のレース                  | ホストが calendar.google.com                |
//
// buildGoogleCalendarEventUrlFromPreview のデシジョンテーブル
//
// | ID   | 条件                          | 期待                                        |
// | ---- | ----------------------------- | ---------------------------------------------- |
// | T-07 | previewのsummary/location      | text/locationにそのまま反映される            |
// | T-08 | previewのHTMLアンカー付きdescription | details中でTEXT: URL形式に変換される  |
// | T-09 | previewのISO8601 start/end     | datesがUTCに変換される                      |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/calendar_event_preview.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/integrations/google_calendar_link.dart';

RaceEntity _race({required String grade}) => RaceEntity(
  raceId: 'race-001',
  raceName: '皐月賞',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: '2026-04-19T15:40:00',
  raceGrade: grade,
  raceNumber: 11,
);

void main() {
  test('[T-01] グレードあり_textにレース名とグレードが含まれる', () {
    final url = buildGoogleCalendarEventUrl(_race(grade: 'GⅠ'));

    expect(url.queryParameters['text'], '皐月賞（GⅠ）');
  });

  test('[T-02] グレードなし_textにグレード表記が付かない', () {
    final url = buildGoogleCalendarEventUrl(_race(grade: ''));

    expect(url.queryParameters['text'], '皐月賞');
  });

  test('[T-03] JST発走時刻_datesがUTCの開始終了になる', () {
    final url = buildGoogleCalendarEventUrl(_race(grade: 'GⅠ'));

    // JST 15:40 → UTC 06:40。所要1時間と仮定して終了はUTC 07:40。
    expect(url.queryParameters['dates'], '20260419T064000Z/20260419T074000Z');
  });

  test('[T-04] 任意のレース_detailsに競技ラベルと会場R番号が含まれる', () {
    final url = buildGoogleCalendarEventUrl(_race(grade: 'GⅠ'));

    final details = url.queryParameters['details']!;
    expect(details, contains('JRA'));
    expect(details, contains('中山 11R'));
  });

  test('[T-05] 任意のレース_locationに会場名が入る', () {
    final url = buildGoogleCalendarEventUrl(_race(grade: 'GⅠ'));

    expect(url.queryParameters['location'], '中山');
  });

  test('[T-06] 任意のレース_ホストがcalendar.google.com', () {
    final url = buildGoogleCalendarEventUrl(_race(grade: 'GⅠ'));

    expect(url.host, 'calendar.google.com');
    expect(url.path, '/calendar/render');
    expect(url.queryParameters['action'], 'TEMPLATE');
  });

  group('buildGoogleCalendarEventUrlFromPreview', () {
    const preview = CalendarEventPreview(
      summary: '2歳新馬',
      description:
          '発走: 10:20\n'
          '<a href="https://netkeiba.example/info">レース情報(netkeiba)</a>\n'
          '<a href="https://youtube.example/live">レース映像（公式YouTube）</a>\n'
          '更新日時: 2026/07/25 09:00',
      location: '新潟競馬場',
      startDateTime: '2026-07-25T10:20:00+09:00',
      endDateTime: '2026-07-25T10:30:00+09:00',
      links: [],
    );

    test('[T-07] summary_locationがそのままtext_locationに反映される', () {
      final url = buildGoogleCalendarEventUrlFromPreview(preview);

      expect(url.queryParameters['text'], '2歳新馬');
      expect(url.queryParameters['location'], '新潟競馬場');
    });

    test('[T-08] HTMLアンカー付きdescription_TEXT_URL形式に変換される', () {
      final url = buildGoogleCalendarEventUrlFromPreview(preview);

      final details = url.queryParameters['details']!;
      expect(details, contains('発走: 10:20'));
      expect(
        details,
        contains('レース情報(netkeiba): https://netkeiba.example/info'),
      );
      expect(
        details,
        contains('レース映像（公式YouTube）: https://youtube.example/live'),
      );
      expect(details, isNot(contains('<a href')));
    });

    test('[T-09] ISO8601のstart_end_UTCに変換される', () {
      final url = buildGoogleCalendarEventUrlFromPreview(preview);

      // JST 10:20-10:30 → UTC 01:20-01:30
      expect(url.queryParameters['dates'], '20260725T012000Z/20260725T013000Z');
    });
  });
}
