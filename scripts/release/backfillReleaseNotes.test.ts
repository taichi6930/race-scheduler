/**
 * backfillReleaseNotes.ts の自己テスト（純粋関数のみ。fetch依存の fetchAllReleases はスコープ外）
 *
 * ## デシジョンテーブル
 *
 * ### sqlString
 * | # | value | 期待 |
 * |---|-------|------|
 * | T-01 | null | 'NULL'（クオート無し） |
 * | T-02 | シングルクオートを含む文字列 | 二重化してエスケープ |
 * | T-03 | 通常の文字列 | シングルクオートで囲む |
 *
 * ### buildInsertStatements
 * | # | releases | 期待 |
 * |---|----------|------|
 * | T-04 | 空配列 | 空文字列 |
 * | T-05 | 1件（name/body/published_atあり） | INSERT OR IGNORE文が1行生成される |
 * | T-06 | 1件（name/body/published_atがnull） | NULLがそのまま埋め込まれる |
 * | T-07 | draft:true, prerelease:true | 1/1が埋め込まれる |
 * | T-08 | 複数件 | 改行区切りで複数行生成される |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildInsertStatements,
    type GithubReleaseSource,
    sqlString,
} from './backfillReleaseNotes';

describe('sqlString', () => {
    it('T-01_nullの場合_NULLをクオート無しで返す', () => {
        expect(sqlString(null)).toBe('NULL');
    });

    it('T-02_シングルクオートを含む文字列の場合_二重化してエスケープする', () => {
        expect(sqlString("it's a test")).toBe("'it''s a test'");
    });

    it('T-03_通常の文字列の場合_シングルクオートで囲む', () => {
        expect(sqlString('v1.0.0')).toBe("'v1.0.0'");
    });
});

describe('buildInsertStatements', () => {
    it('T-04_空配列の場合_空文字列を返す', () => {
        expect(buildInsertStatements([])).toBe('');
    });

    it('T-05_1件の場合_INSERT OR IGNORE文を生成する', () => {
        const release: GithubReleaseSource & { sourceRepo: string } = {
            tag_name: 'v1.0.0',
            name: 'v1.0.0',
            body: '初回リリース',
            published_at: '2026-01-01T00:00:00Z',
            draft: false,
            prerelease: false,
            sourceRepo: 'race-schedule',
        };

        const result = buildInsertStatements([release]);

        expect(result).toBe(
            "INSERT OR IGNORE INTO release_note (tag_name, name, body, published_at, draft, prerelease, source_repo) VALUES ('v1.0.0', 'v1.0.0', '初回リリース', '2026-01-01T00:00:00Z', 0, 0, 'race-schedule');",
        );
    });

    it('T-06_name-body-published_atがnullの場合_NULLがそのまま埋め込まれる', () => {
        const release: GithubReleaseSource & { sourceRepo: string } = {
            tag_name: 'v1.0.0',
            name: null,
            body: null,
            published_at: null,
            draft: false,
            prerelease: false,
            sourceRepo: 'race-scheduler',
        };

        const result = buildInsertStatements([release]);

        expect(result).toBe(
            "INSERT OR IGNORE INTO release_note (tag_name, name, body, published_at, draft, prerelease, source_repo) VALUES ('v1.0.0', NULL, NULL, NULL, 0, 0, 'race-scheduler');",
        );
    });

    it('T-07_draft-prereleaseがtrueの場合_1-1が埋め込まれる', () => {
        const release: GithubReleaseSource & { sourceRepo: string } = {
            tag_name: 'v1.0.0-beta',
            name: 'v1.0.0-beta',
            body: null,
            published_at: null,
            draft: true,
            prerelease: true,
            sourceRepo: 'race-scheduler',
        };

        const result = buildInsertStatements([release]);

        expect(result).toContain(', 1, 1,');
    });

    it('T-08_複数件の場合_改行区切りで複数行生成される', () => {
        const releases: (GithubReleaseSource & { sourceRepo: string })[] = [
            {
                tag_name: 'v1.0.0',
                name: 'v1.0.0',
                body: null,
                published_at: null,
                draft: false,
                prerelease: false,
                sourceRepo: 'race-schedule',
            },
            {
                tag_name: 'v2.0.0',
                name: 'v2.0.0',
                body: null,
                published_at: null,
                draft: false,
                prerelease: false,
                sourceRepo: 'race-scheduler',
            },
        ];

        const result = buildInsertStatements(releases);

        expect(result.split('\n')).toHaveLength(2);
    });
});
