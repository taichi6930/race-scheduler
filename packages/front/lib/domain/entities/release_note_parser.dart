import 'release_note_category.dart';
import 'release_note_entity.dart';

/// リリース本文（Markdown）を、既知のカテゴリ見出し（[releaseNoteCategoryInfos]）
/// ごとの箇条書き項目一覧へパースする（FR-02, NFR-02）。
///
/// - 見出し行（例: `## 🔧 バックエンドのみ`）は完全一致で判定する。
/// - 各見出しの直後から次の見出し（または本文末尾）までの `- `/`* ` で始まる行を
///   箇条書き項目として抽出する（先頭・末尾の空白は取り除く）。
/// - 見出しが1つも見つからない場合（過去形式のリリース・GitHub純正の
///   「## What's Changed」形式・空文字列・`null` 等）は空リストを返す。
/// - 文字列操作のみで完結し、例外を投げない（本文がどれだけ崩れていても
///   ページ全体をクラッシュさせない、NFR-02）。
List<ReleaseNoteCategoryEntryEntity> parseReleaseNoteBody(String? body) {
  if (body == null) {
    return const [];
  }

  final results = <ReleaseNoteCategoryEntryEntity>[];
  ReleaseNoteCategory? currentCategory;
  var currentItems = <String>[];

  void flushCurrentCategory() {
    if (currentCategory != null && currentItems.isNotEmpty) {
      results.add(
        ReleaseNoteCategoryEntryEntity(
          category: currentCategory,
          items: List.unmodifiable(currentItems),
        ),
      );
    }
  }

  for (final rawLine in body.split('\n')) {
    final line = rawLine.trim();
    final matchedCategory = _matchHeading(line);
    if (matchedCategory != null) {
      flushCurrentCategory();
      currentCategory = matchedCategory;
      currentItems = <String>[];
      continue;
    }
    if (line.startsWith('## ')) {
      // 更新履歴カテゴリ以外の見出し（PRテンプレートの「## Summary」「## Test plan」
      // 等）に入ったら、直前のカテゴリの収集を終了する。そうしないと、更新履歴
      // セクションの後にPRテンプレートの他セクションが続く本文で、無関係な箇条書きが
      // 直前のカテゴリに混入してしまう（generateReleaseSummary.tsのparseCategorizedSections
      // と同じ規約）。
      flushCurrentCategory();
      currentCategory = null;
      continue;
    }
    if (currentCategory == null) {
      // 既知の見出しが登場する前の行（前置きテキスト等）は無視する。
      continue;
    }
    final item = _parseBulletItem(line);
    if (item != null) {
      currentItems.add(item);
    }
  }
  flushCurrentCategory();

  return results;
}

/// [line] が既知のカテゴリ見出しと完全一致するかを判定する。
ReleaseNoteCategory? _matchHeading(String line) {
  for (final info in releaseNoteCategoryInfos) {
    if (line == info.heading) {
      return info.category;
    }
  }
  return null;
}

/// [line] が箇条書き行（`- ` または `* ` 始まり）であれば、項目本文を返す。
/// 該当しない行・項目本文が空の行は `null`。
String? _parseBulletItem(String line) {
  for (final prefix in const ['- ', '* ']) {
    if (line.startsWith(prefix)) {
      final text = line.substring(prefix.length).trim();
      return text.isEmpty ? null : text;
    }
  }
  return null;
}

/// [releases] のうち、本文のパースでカテゴリが1件以上得られたものだけを残す。
///
/// カテゴリが0件（旧形式のリリース・パース不能な本文）のリリースは、見出しだけの
/// 空カードを表示するより一覧から除外したほうがUIとして自然なため、更新履歴
/// 画面ではこの関数を通した結果を表示する（NFR-02: 過去形式のリリースが混在
/// してもクラッシュせず、単に一覧から漏れるだけに留める）。
List<ReleaseNoteEntity> visibleReleaseNotes(List<ReleaseNoteEntity> releases) =>
    releases.where((release) => release.categories.isNotEmpty).toList();
