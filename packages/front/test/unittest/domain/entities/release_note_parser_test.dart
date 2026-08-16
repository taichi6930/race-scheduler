// parseReleaseNoteBody / visibleReleaseNotes のデシジョンテーブル
//
// | ID   | 条件                                                  | 期待                                          |
// | ---- | ------------------------------------------------------ | ----------------------------------------------- |
// | T-01 | 全カテゴリ見出しが揃った本文（full match）              | 5カテゴリ全てが順番どおりパースされる          |
// | T-02 | 一部見出しが無い本文（partial match）                   | 存在する見出しのみパースされる                 |
// | T-03 | 見出しが1つも無い本文（zero match, レガシー形式）       | 空リストを返す                                 |
// | T-04 | `null` 本文                                             | 空リストを返す                                 |
// | T-05 | 空文字列の本文                                          | 空リストを返す                                 |
// | T-06 | 崩れたMarkdown（見出し表記ゆれ・箇条書きでない行混在）  | 例外を投げず、認識できた範囲だけパースする     |
// | T-07 | 見出しはあるが箇条書きが1件も無いカテゴリ               | そのカテゴリはpublish対象に含まれない          |
// | T-08 | `*` 始まりの箇条書き（表記ゆれ）                        | `-` と同様に項目として扱われる                 |
// | T-09 | visibleReleaseNotes: カテゴリが空のリリースを含む       | カテゴリが空のリリースは除外される             |
// | T-10 | カテゴリ見出しの後にPRテンプレートの他見出しが続く      | 他見出し以降の箇条書きは直前のカテゴリに混入しない |
// | T-11 | カテゴリ見出しの後にGitHub純正のWhat's Changed＋Full     | カテゴリ部分のみパースされ、What's Changed以降は  |
// |      | Changelog比較リンクが続く（実際のRelease本文の形）      | 混入しない                                          |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/domain/entities/release_note_category.dart';
import 'package:front/domain/entities/release_note_entity.dart';
import 'package:front/domain/entities/release_note_parser.dart';

void main() {
  group('parseReleaseNoteBody', () {
    test('[T-01] 全カテゴリ見出しが揃った本文_5カテゴリ全てがパースされる', () {
      const body =
          '## 🔧 バックエンドのみ\n'
          '- APIのレスポンスを高速化しました\n\n'
          '## 📱 フロントの変更\n'
          '- レース一覧の表示速度を改善しました\n'
          '- お気に入り登録のアイコンを見やすくしました\n\n'
          '## ✨ 新しく取れる情報\n'
          '- 騎手の通算成績を表示するようになりました\n\n'
          '## 🎉 改善\n'
          '- 通知の重複を解消しました\n\n'
          '## 📝 その他\n'
          '- ドキュメントを整理しました';

      final result = parseReleaseNoteBody(body);

      expect(result.map((e) => e.category).toList(), [
        ReleaseNoteCategory.backend,
        ReleaseNoteCategory.frontend,
        ReleaseNoteCategory.newInfo,
        ReleaseNoteCategory.improvement,
        ReleaseNoteCategory.other,
      ]);
      expect(result[1].items, [
        'レース一覧の表示速度を改善しました',
        'お気に入り登録のアイコンを見やすくしました',
      ]);
    });

    test('[T-02] 一部見出しが無い本文_存在する見出しのみパースされる', () {
      const body =
          '## 📱 フロントの変更\n'
          '- レース一覧の表示速度を改善しました\n\n'
          '## 🎉 改善\n'
          '- 通知の重複を解消しました';

      final result = parseReleaseNoteBody(body);

      expect(result.map((e) => e.category).toList(), [
        ReleaseNoteCategory.frontend,
        ReleaseNoteCategory.improvement,
      ]);
    });

    test('[T-03] 見出しが1つも無いレガシー形式の本文_空リストを返す', () {
      const body =
          '## What\'s Changed\n'
          '* Fix bug by @someone in #123\n'
          '* Add feature by @someone in #124\n\n'
          '**Full Changelog**: https://example.com/compare/v1...v2';

      final result = parseReleaseNoteBody(body);

      expect(result, isEmpty);
    });

    test('[T-04] null本文_空リストを返す', () {
      final result = parseReleaseNoteBody(null);

      expect(result, isEmpty);
    });

    test('[T-05] 空文字列の本文_空リストを返す', () {
      final result = parseReleaseNoteBody('');

      expect(result, isEmpty);
    });

    test('[T-06] 崩れたMarkdown_例外を投げず認識できた範囲だけパースする', () {
      const body =
          '不正な前置きテキスト\n'
          '### 🔧 バックエンドのみ\n' // レベル違いの見出し（## ではなく ###）は無視される
          '- この行は見出し前の扱いになるため無視される\n\n'
          '## 📱 フロントの変更\n'
          '見出し直後の箇条書きでない行\n'
          '- レース一覧の表示速度を改善しました\n'
          '\n'
          '- \n' // 項目本文が空の行は無視される
          '- お気に入り登録のアイコンを見やすくしました';

      expect(() => parseReleaseNoteBody(body), returnsNormally);
      final result = parseReleaseNoteBody(body);

      expect(result, hasLength(1));
      expect(result.single.category, ReleaseNoteCategory.frontend);
      expect(result.single.items, [
        'レース一覧の表示速度を改善しました',
        'お気に入り登録のアイコンを見やすくしました',
      ]);
    });

    test('[T-07] 見出しはあるが箇条書きが1件も無いカテゴリ_publish対象に含まれない', () {
      const body =
          '## 🔧 バックエンドのみ\n'
          '\n'
          '## 📱 フロントの変更\n'
          '- レース一覧の表示速度を改善しました';

      final result = parseReleaseNoteBody(body);

      expect(result.map((e) => e.category).toList(), [
        ReleaseNoteCategory.frontend,
      ]);
    });

    test('[T-08] アスタリスク始まりの箇条書き_-と同様に項目として扱われる', () {
      const body = '## 🎉 改善\n* 通知の重複を解消しました';

      final result = parseReleaseNoteBody(body);

      expect(result.single.items, ['通知の重複を解消しました']);
    });

    test('[T-10] カテゴリ見出しの後にPRテンプレートの他見出しが続く場合_混入しない', () {
      const body =
          '## 📱 フロントの変更\n'
          '- レース一覧の表示速度を改善しました\n\n'
          '## Test plan\n'
          '- 手動確認した\n'
          '- スクリーンショットを添付した';

      final result = parseReleaseNoteBody(body);

      expect(result, hasLength(1));
      expect(result.single.category, ReleaseNoteCategory.frontend);
      expect(result.single.items, ['レース一覧の表示速度を改善しました']);
    });

    test('[T-11] カテゴリ見出しの後にGitHub純正のWhats Changedが続く場合_混入しない', () {
      const body =
          '## 🔧 バックエンドのみ\n'
          '- リリースノートを自動生成する仕組みを整備しました\n\n'
          '## 📱 フロントの変更\n'
          '- 設定画面に更新履歴を追加しました\n\n'
          '---\n\n'
          '## What\'s Changed\n'
          '* PR A by @alice in https://example.com/pull/100\n'
          '* PR B by @bob in https://example.com/pull/101\n\n'
          '**Full Changelog**: https://example.com/compare/v1.0.0...main';

      final result = parseReleaseNoteBody(body);

      expect(result, hasLength(2));
      expect(result[0].category, ReleaseNoteCategory.backend);
      expect(result[0].items, ['リリースノートを自動生成する仕組みを整備しました']);
      expect(result[1].category, ReleaseNoteCategory.frontend);
      expect(result[1].items, ['設定画面に更新履歴を追加しました']);
    });
  });

  group('visibleReleaseNotes', () {
    test('[T-09] カテゴリが空のリリースを含む_カテゴリが空のリリースは除外される', () {
      final withCategories = ReleaseNoteEntity(
        tagName: 'v1.1.0',
        publishedAt: DateTime(2026, 8, 1),
        categories: const [
          ReleaseNoteCategoryEntryEntity(
            category: ReleaseNoteCategory.improvement,
            items: ['通知の重複を解消しました'],
          ),
        ],
      );
      final withoutCategories = ReleaseNoteEntity(
        tagName: 'v1.0.0',
        publishedAt: DateTime(2026, 7, 1),
        categories: const [],
      );

      final result = visibleReleaseNotes([withCategories, withoutCategories]);

      expect(result, [withCategories]);
    });
  });
}
