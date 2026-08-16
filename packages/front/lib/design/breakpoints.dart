/// レスポンシブ判定のブレークポイント（technical-design.md §7）。
///
/// モバイル幅ではボトムナビ、広い画面（Web/デスクトップ）では
/// 左サイドレールに切り替える判定に使う。
class AppBreakpoints {
  AppBreakpoints._();

  /// この幅（dp）以上を「広画面」とみなす。
  static const double wide = 900;

  static bool isWide(double width) => width >= wide;
}
