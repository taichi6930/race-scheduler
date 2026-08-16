import 'package:timezone/timezone.dart' as tz;

/// 日本標準時（UTC+9固定・サマータイムなし）を表す [tz.Location]。
///
/// `timezone` パッケージの `initializeTimeZones()`
/// （`package:timezone/data/latest_all.dart`）はIANAの全タイムゾーン
/// （350件超）をデシリアライズしてメモリに保持するが、このアプリは
/// JST固定運用（`core/jst_time.dart`）のため不要（PERF-022）。
///
/// 日本は現在サマータイムを採用しておらず年間を通じて常にUTC+9のため、
/// 遷移テーブルを持たない固定オフセットの [tz.Location] を直接構築する
/// ことで、全タイムゾーンデータの読み込み・保持を回避できる。
final tz.Location jstLocation = tz.Location(
  'Asia/Tokyo',
  const [],
  const [],
  const [tz.TimeZone(Duration(hours: 9), isDst: false, abbreviation: 'JST')],
);
