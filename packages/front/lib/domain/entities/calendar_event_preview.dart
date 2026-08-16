import 'race_link.dart';

/// レースをカレンダーに登録する際のイベント内容のプレビュー
/// （`GET /race/calendar-event` のレスポンス）。
///
/// calendar Workerが実際にGoogle Calendarへ登録する内容
/// （発走時刻・netkeiba/YouTubeリンク等）と同一の内容を表す。
class CalendarEventPreview {
  const CalendarEventPreview({
    required this.summary,
    required this.description,
    required this.location,
    required this.startDateTime,
    required this.endDateTime,
    required this.links,
  });

  /// イベントタイトル
  final String summary;

  /// イベント詳細（発走時刻・netkeiba/YouTubeリンク等を含むHTML）
  final String description;

  /// 開催場所
  final String location;

  /// 開始日時（ISO8601、例: 2026-07-25T10:20:00+09:00）
  final String startDateTime;

  /// 終了日時（ISO8601）
  final String endDateTime;

  /// レースに関連する外部リンク（netkeiba出馬表・レース動画・YouTube公式配信等）。
  /// 対応データが無いレース種別（オートレース・ボートレース・海外競馬）は空リスト。
  final List<RaceLink> links;
}
