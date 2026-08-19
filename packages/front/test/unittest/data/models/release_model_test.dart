// ReleaseModel.fromJson / toEntity のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                            |
// | ---- | -------------------------------------------- | -------------------------------------------------- |
// | T-01 | 正常なJSON（全フィールドあり）              | 各フィールドがそのままマッピングされる            |
// | T-02 | name・body が null                          | エラーにならず null のまま保持される              |
// | T-03 | draft・prerelease が未指定                  | いずれも既定値 false になる                       |
// | T-04 | toEntity: 正常な published_at               | DateTimeへ変換される                              |
// | T-05 | toEntity: published_at が null              | UNIXエポック（最古扱い）にフォールバックする       |
// | T-06 | toEntity: published_at が不正な日時文字列   | UNIXエポック（最古扱い）にフォールバックする       |
// | T-07 | toEntity: bodyがカテゴリ見出しを含む        | categoriesにパース結果が反映される                |
// | T-08 | source_repoあり                             | sourceRepoにマッピングされる                       |
// | T-09 | source_repo未指定                           | sourceRepoがnullのまま保持される                   |
// | T-10 | toEntity: source_repoあり                    | entity.sourceRepoに反映される                      |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/models/release_model.dart';
import 'package:front/domain/entities/release_note_category.dart';
import 'package:front/domain/entities/release_note_entity.dart';

void main() {
  group('ReleaseModel.fromJson', () {
    test('[T-01] 正常なJSON_各フィールドがそのままマッピングされる', () {
      final model = ReleaseModel.fromJson({
        'tag_name': 'v1.2.0',
        'name': 'v1.2.0 リリース',
        'body': '## 🎉 改善\n- 通知の重複を解消しました',
        'published_at': '2026-08-01T00:00:00Z',
        'draft': false,
        'prerelease': false,
      });

      expect(model.tagName, 'v1.2.0');
      expect(model.name, 'v1.2.0 リリース');
      expect(model.body, '## 🎉 改善\n- 通知の重複を解消しました');
      expect(model.draft, isFalse);
      expect(model.prerelease, isFalse);
    });

    test('[T-02] name_bodyがnull_エラーにならずnullのまま保持される', () {
      final model = ReleaseModel.fromJson({
        'tag_name': 'v1.2.0',
        'name': null,
        'body': null,
        'published_at': '2026-08-01T00:00:00Z',
      });

      expect(model.name, isNull);
      expect(model.body, isNull);
    });

    test('[T-03] draft_prereleaseが未指定_既定値falseになる', () {
      final model = ReleaseModel.fromJson({
        'tag_name': 'v1.2.0',
        'published_at': '2026-08-01T00:00:00Z',
      });

      expect(model.draft, isFalse);
      expect(model.prerelease, isFalse);
    });

    test('[T-08] source_repoありの場合_sourceRepoにマッピングされる', () {
      final model = ReleaseModel.fromJson({
        'tag_name': 'v1.2.0',
        'published_at': '2026-08-01T00:00:00Z',
        'source_repo': 'race-scheduler',
      });

      expect(model.sourceRepo, 'race-scheduler');
    });

    test('[T-09] source_repo未指定の場合_nullのまま保持される', () {
      final model = ReleaseModel.fromJson({
        'tag_name': 'v1.2.0',
        'published_at': '2026-08-01T00:00:00Z',
      });

      expect(model.sourceRepo, isNull);
    });
  });

  group('ReleaseModel.toEntity', () {
    test('[T-04] 正常なpublished_at_DateTimeへ変換される', () {
      const model = ReleaseModel(
        tagName: 'v1.2.0',
        publishedAt: '2026-08-01T12:00:00Z',
      );

      final entity = model.toEntity();

      expect(entity.publishedAt, DateTime.parse('2026-08-01T12:00:00Z'));
    });

    test('[T-05] published_atがnull_UNIXエポックにフォールバックする', () {
      const model = ReleaseModel(tagName: 'v1.2.0');

      final entity = model.toEntity();

      expect(entity.publishedAt, DateTime.fromMillisecondsSinceEpoch(0));
    });

    test('[T-06] published_atが不正な日時文字列_UNIXエポックにフォールバックする', () {
      const model = ReleaseModel(
        tagName: 'v1.2.0',
        publishedAt: 'not-a-date',
      );

      final entity = model.toEntity();

      expect(entity.publishedAt, DateTime.fromMillisecondsSinceEpoch(0));
    });

    test('[T-07] bodyがカテゴリ見出しを含む_categoriesにパース結果が反映される', () {
      const model = ReleaseModel(
        tagName: 'v1.2.0',
        publishedAt: '2026-08-01T00:00:00Z',
        body: '## 🎉 改善\n- 通知の重複を解消しました',
      );

      final entity = model.toEntity();

      expect(entity.categories, [
        const ReleaseNoteCategoryEntryEntity(
          category: ReleaseNoteCategory.improvement,
          items: ['通知の重複を解消しました'],
        ),
      ]);
    });

    test('[T-10] source_repoありの場合_entity.sourceRepoに反映される', () {
      const model = ReleaseModel(
        tagName: 'v1.2.0',
        publishedAt: '2026-08-01T00:00:00Z',
        sourceRepo: 'race-schedule',
      );

      final entity = model.toEntity();

      expect(entity.sourceRepo, 'race-schedule');
    });
  });
}
