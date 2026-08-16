/// Server-Driven UI PoC: `GET /ui/announcement`（api）から取得する
/// 起動時お知らせバナーの内容。
///
/// [enabled] が false の場合はバナーを表示しない（apiが明示的に「今は
/// お知らせ無し」を表現できるようにするためのフィールドで、front側では
/// 表示要否の判定にのみ使う）。
class Announcement {
  const Announcement({
    required this.enabled,
    required this.message,
    this.actionLabel,
    this.actionUrl,
  });

  /// このお知らせを表示すべきか。
  final bool enabled;

  /// バナーに表示する文言。
  final String message;

  /// アクションボタンのラベル（無ければボタンを表示しない）。
  final String? actionLabel;

  /// アクションボタン押下時に開くURL（[actionLabel] と対）。
  final String? actionUrl;
}
