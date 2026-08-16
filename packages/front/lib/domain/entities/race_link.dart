/// レースに関連する外部リンク（netkeiba・YouTube等）の1件。
class RaceLink {
  const RaceLink({required this.label, required this.url});

  /// リンクの表示ラベル
  final String label;

  /// リンク先URL
  final String url;
}
