/**
 * build-allure-environment.ts の自己テスト
 *
 * ## デシジョンテーブル
 *
 * ### buildProperties
 * | # | 環境変数 | 期待 |
 * |---|---------|------|
 * | T-01 | GitHub Actions環境変数あり | Branch/CommitがGitHub Actionsの値になる |
 * | T-02 | 環境変数なし（ローカル実行） | Branch/Commitが'(local)'になる |
 */
import { describe, expect, it } from 'bun:test';

import { buildProperties } from './build-allure-environment';

describe('buildProperties', () => {
    it('[T-01] GitHub Actions環境変数がある場合はBranch/Commitに反映される', () => {
        const result = buildProperties({
            RUNNER_OS: 'Linux',
            GITHUB_REF_NAME: 'claude/test',
            GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
        });

        expect(result.OS).toBe('Linux');
        expect(result.Branch).toBe('claude/test');
        expect(result.Commit).toBe('0123456789ab');
    });

    it('[T-02] 環境変数が無い場合はローカル実行のフォールバック値になる', () => {
        const result = buildProperties({});

        expect(result.Branch).toBe('(local)');
        expect(result.Commit).toBe('(local)');
        expect(result.OS).toEqual(expect.any(String));
        expect(result.OS.length).toBeGreaterThan(0);
    });
});
