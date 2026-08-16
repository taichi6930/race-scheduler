/// リリースノートのカテゴリ（更新履歴ページ, FR-02）。
///
/// `scripts/release/releaseNoteCategories.ts`（draft-release.ymlのAI要約生成側）
/// が出力するMarkdown見出しと1対1で対応する。front側でカテゴリ集合・見出し文言
/// を変更する場合は、必ずCI側（`releaseNoteCategories.ts`）も同時に更新すること。
enum ReleaseNoteCategory { backend, frontend, newInfo, improvement, other }

/// [ReleaseNoteCategory] 1件分の表示メタデータ（Markdown見出し・絵文字・
/// 画面表示ラベル）をまとめたテーブル1行分。
class ReleaseNoteCategoryInfo {
  const ReleaseNoteCategoryInfo({
    required this.category,
    required this.heading,
    required this.emoji,
    required this.label,
  });

  final ReleaseNoteCategory category;

  /// リリース本文（Markdown）中の見出し行そのもの（例: `## 🔧 バックエンドのみ`）。
  /// パース（[parseReleaseNoteBody]）はこの文字列との完全一致で見出しを判定する。
  final String heading;

  /// 見出しの先頭にある絵文字（一覧画面のカテゴリアイコンに再利用する）。
  final String emoji;

  /// 見出しから絵文字を除いた画面表示ラベル。
  final String label;
}

/// front側で唯一保持する、カテゴリ→見出し文字列の対応表（`releaseNoteCategories.ts`
/// と同期させること）。定義順がそのまま画面上のカテゴリ表示順になる。
const List<ReleaseNoteCategoryInfo> releaseNoteCategoryInfos = [
  ReleaseNoteCategoryInfo(
    category: ReleaseNoteCategory.backend,
    heading: '## 🔧 バックエンドのみ',
    emoji: '🔧',
    label: 'バックエンドのみ',
  ),
  ReleaseNoteCategoryInfo(
    category: ReleaseNoteCategory.frontend,
    heading: '## 📱 フロントの変更',
    emoji: '📱',
    label: 'フロントの変更',
  ),
  ReleaseNoteCategoryInfo(
    category: ReleaseNoteCategory.newInfo,
    heading: '## ✨ 新しく取れる情報',
    emoji: '✨',
    label: '新しく取れる情報',
  ),
  ReleaseNoteCategoryInfo(
    category: ReleaseNoteCategory.improvement,
    heading: '## 🎉 改善',
    emoji: '🎉',
    label: '改善',
  ),
  ReleaseNoteCategoryInfo(
    category: ReleaseNoteCategory.other,
    heading: '## 📝 その他',
    emoji: '📝',
    label: 'その他',
  ),
];

/// [category] に対応する [ReleaseNoteCategoryInfo] を返す（[releaseNoteCategoryInfos]
/// は全 [ReleaseNoteCategory] 値を1件ずつ必ず含むため、見つからない場合はバグとして
/// 例外にする）。
ReleaseNoteCategoryInfo releaseNoteCategoryInfoOf(ReleaseNoteCategory category) =>
    releaseNoteCategoryInfos.firstWhere((info) => info.category == category);
