import '../core/jst_time.dart';
import '../design/atoms/discipline_icon.dart';
import '../domain/entities/calendar_event_preview.dart';
import '../domain/entities/race_entity.dart';
import '../domain/entities/race_type.dart';

/// カレンダー説明文中のHTMLアンカータグ（`<a href="URL">TEXT</a>`）を検出する。
/// API（core の `createAnchorTag`）が生成する形式に限定して一致させる。
final RegExp _anchorTagPattern = RegExp(r'<a href="([^"]*)">([^<]*)</a>');

/// レースの所要時間として仮定する長さ（実際のレース時間データを
/// 持たないためのMVP上の割り切り。詳細画面の「カレンダー追加」用）。
const Duration assumedRaceDuration = Duration(hours: 1);

/// [race] を Google カレンダーの「予定を追加」画面（Quick Add）に
/// 事前入力した状態で開くための URL を組み立てる（純粋関数）。
///
/// OAuth 等の認可は不要（`action=TEMPLATE` はブラウザ/アプリでの手動保存を
/// 促すだけの公開エンドポイント）。レースの `datetime` から得たJST壁時計を、
/// Google Calendar が要求する UTC の `dates` パラメータへは -9時間して変換する。
Uri buildGoogleCalendarEventUrl(RaceEntity race) {
  final raceType = RaceType.fromValue(race.raceType);
  final jstWall = parseJstDateTime(race.datetime);
  final startUtc = DateTime.utc(
    jstWall.year,
    jstWall.month,
    jstWall.day,
    jstWall.hour,
    jstWall.minute,
    jstWall.second,
  ).subtract(const Duration(hours: 9));
  final endUtc = startUtc.add(assumedRaceDuration);

  final grade = race.raceGrade;
  final title = grade != null && grade.isNotEmpty
      ? '${race.raceName}（$grade）'
      : race.raceName;
  final detailsLines = [
    DisciplineIcon.labelFor(raceType),
    '${race.raceCourse} ${race.raceNumber}R',
  ];

  return Uri.https('calendar.google.com', '/calendar/render', {
    'action': 'TEMPLATE',
    'text': title,
    'dates': '${_formatUtc(startUtc)}/${_formatUtc(endUtc)}',
    'details': detailsLines.join('\n'),
    'location': race.raceCourse,
  });
}

String _formatUtc(DateTime utc) {
  String pad2(int value) => value.toString().padLeft(2, '0');
  return '${utc.year}${pad2(utc.month)}${pad2(utc.day)}'
      'T${pad2(utc.hour)}${pad2(utc.minute)}${pad2(utc.second)}Z';
}

/// [preview]（`GET /race/calendar-event` から取得した内容）を使って、
/// バックエンドが実際にGoogle Calendarへ登録するのと同じ内容で
/// Quick Add画面を開くための URL を組み立てる（純粋関数）。
///
/// [preview.description] はGoogle Calendar登録用のHTMLアンカータグ
/// （`<a href="URL">TEXT</a>`）を含むため、Quick Add のプレーンテキストの
/// `details` パラメータ向けに `TEXT: URL` の形式へ変換する
/// （URLがプレーンテキストのまま含まれていれば、Google Calendar側で
/// 自動的にリンクとして認識される）。
Uri buildGoogleCalendarEventUrlFromPreview(CalendarEventPreview preview) {
  final startUtc = DateTime.parse(preview.startDateTime).toUtc();
  final endUtc = DateTime.parse(preview.endDateTime).toUtc();

  return Uri.https('calendar.google.com', '/calendar/render', {
    'action': 'TEMPLATE',
    'text': preview.summary,
    'dates': '${_formatUtc(startUtc)}/${_formatUtc(endUtc)}',
    'details': _toPlainTextDescription(preview.description),
    'location': preview.location,
  });
}

/// カレンダー説明文中のHTMLアンカータグを `TEXT: URL` 形式のプレーンテキストへ変換する。
String _toPlainTextDescription(String description) {
  return description.replaceAllMapped(
    _anchorTagPattern,
    (match) => '${match.group(2)}: ${match.group(1)}',
  );
}
