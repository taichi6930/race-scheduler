import '../domain/entities/race_type.dart';
import 'google_calendar_colors.dart';

/// (raceType, gradeName) -> Google Calendar 色キー の対応表。
///
/// `packages/core/src/domain/policy/calendarEventContent.ts` の
/// `GoogleCalendarColorKeyMap` を単一の正典とし、front(Dart) 用に手動で
/// 同期した静的テーブル。バックエンドのマッピングが変更された場合は
/// このテーブルも追従させること。
const Map<RaceType, Map<String, GoogleCalendarColorKey>> _gradeColorTable = {
  RaceType.jra: {
    'GⅠ': GoogleCalendarColorKey.blueberry,
    'GⅡ': GoogleCalendarColorKey.tomato,
    'GⅢ': GoogleCalendarColorKey.basil,
    'J.GⅠ': GoogleCalendarColorKey.blueberry,
    'J.GⅡ': GoogleCalendarColorKey.tomato,
    'J.GⅢ': GoogleCalendarColorKey.basil,
    'JpnⅠ': GoogleCalendarColorKey.lavender,
    'JpnⅡ': GoogleCalendarColorKey.flamingo,
    'JpnⅢ': GoogleCalendarColorKey.sage,
    '重賞': GoogleCalendarColorKey.banana,
    'Listed': GoogleCalendarColorKey.banana,
    'オープン': GoogleCalendarColorKey.tangerine,
    'オープン特別': GoogleCalendarColorKey.tangerine,
  },
  RaceType.nar: {
    'GⅠ': GoogleCalendarColorKey.blueberry,
    'GⅡ': GoogleCalendarColorKey.tomato,
    'GⅢ': GoogleCalendarColorKey.basil,
    'JpnⅠ': GoogleCalendarColorKey.lavender,
    'JpnⅡ': GoogleCalendarColorKey.flamingo,
    'JpnⅢ': GoogleCalendarColorKey.sage,
    '重賞': GoogleCalendarColorKey.banana,
    'Listed': GoogleCalendarColorKey.banana,
    'オープン': GoogleCalendarColorKey.tangerine,
    'オープン特別': GoogleCalendarColorKey.tangerine,
    '地方重賞': GoogleCalendarColorKey.grape,
  },
  RaceType.overseas: {
    'GⅠ': GoogleCalendarColorKey.blueberry,
    'GⅡ': GoogleCalendarColorKey.tomato,
    'GⅢ': GoogleCalendarColorKey.basil,
    'Listed': GoogleCalendarColorKey.banana,
    '格付けなし': GoogleCalendarColorKey.graphite,
  },
  RaceType.keirin: {
    'GP': GoogleCalendarColorKey.blueberry,
    'GⅠ': GoogleCalendarColorKey.blueberry,
    'GⅡ': GoogleCalendarColorKey.tomato,
    'GⅢ': GoogleCalendarColorKey.basil,
    'FⅠ': GoogleCalendarColorKey.graphite,
    'FⅡ': GoogleCalendarColorKey.graphite,
  },
  RaceType.boatrace: {
    'SG': GoogleCalendarColorKey.blueberry,
    'GⅠ': GoogleCalendarColorKey.blueberry,
    'GⅡ': GoogleCalendarColorKey.tomato,
    'GⅢ': GoogleCalendarColorKey.basil,
    '一般': GoogleCalendarColorKey.graphite,
  },
  RaceType.autorace: {
    'SG': GoogleCalendarColorKey.blueberry,
    '特GⅠ': GoogleCalendarColorKey.blueberry,
    'GⅠ': GoogleCalendarColorKey.blueberry,
    'GⅡ': GoogleCalendarColorKey.tomato,
    '開催': GoogleCalendarColorKey.graphite,
  },
};

/// grade から、Googleカレンダー上の実際のイベント色キーを判定する。
/// 未知の grade・null・空文字は [GoogleCalendarColorKey.graphite]（既定色）を返す。
GoogleCalendarColorKey googleCalendarColorKeyOf(
  RaceType raceType,
  String? grade,
) {
  if (grade == null || grade.isEmpty) return GoogleCalendarColorKey.graphite;
  return _gradeColorTable[raceType]?[grade] ?? GoogleCalendarColorKey.graphite;
}
