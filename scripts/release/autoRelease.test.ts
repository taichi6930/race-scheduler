/**
 * autoRelease.ts の自己テスト(純粋関数のみ。fetch依存の関数はスコープ外)
 *
 * ## デシジョンテーブル
 *
 * ### computeNextVersion
 * | # | lastTag | bumpLevel | 期待 |
 * |---|---------|-----------|------|
 * | T-01 | 'v1.32.0' | 'patch' | 'v1.32.1' |
 * | T-02 | null | 'patch' | null |
 * | T-03 | 'not-a-version' | 'patch' | null |
 * | T-11 | 'v1.32.5' | 'minor' | 'v1.33.0' |
 *
 * ### determineAutoReleaseEligibility
 * | # | prLevels / unresolvedCommitCount | 期待 |
 * |---|-----------------------------------|------|
 * | T-04 | ['patch','patch'] / 0 | eligible=true, bumpLevel='patch' |
 * | T-05 | ['patch','major'] / 0 | eligible=false(majorが含まれる) |
 * | T-06 | ['patch', undefined] / 0 | eligible=false（未設定ラベルを含む） |
 * | T-07 | [] / 1 | eligible=false（PR番号不明コミットあり） |
 * | T-08 | [] / 0 | eligible=false（対象PRが無い） |
 * | T-09 | ['patch','none'] / 0 | eligible=true（noneを除外した残りがpatchのみ） |
 * | T-10 | ['none','none'] / 0 | eligible=false（noneを除外すると対象PRが無い） |
 * | T-12 | ['patch','minor'] / 0 | eligible=true, bumpLevel='minor'（minorも自動リリース対象） |
 * | T-13 | ['minor','minor'] / 0 | eligible=true, bumpLevel='minor' |
 *
 * ### buildReleaseNoteWritePayload
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-14 | GitHub Releaseレスポンス（name/bodyあり）+ sourceRepo | releaseの全フィールド + source_repo を含むオブジェクト |
 * | T-15 | name/bodyがnull | nullがそのまま維持される |
 *
 * ### resolveDualWriteSkipReason
 * | # | mainApiUrl / serviceAuthToken | 期待 |
 * |---|-------------------------------|------|
 * | T-16 | 両方あり | null（スキップしない） |
 * | T-17 | 両方なし | 'MAIN_API_URL / SERVICE_AUTH_TOKEN が未設定...' |
 * | T-18 | mainApiUrlのみなし | 'MAIN_API_URL が未設定...' |
 * | T-19 | serviceAuthTokenのみなし | 'SERVICE_AUTH_TOKEN が未設定...' |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildReleaseNoteWritePayload,
    computeNextVersion,
    determineAutoReleaseEligibility,
    resolveDualWriteSkipReason,
} from './autoRelease';

describe('computeNextVersion', () => {
    it('T-01_通常のバージョンタグでpatchバンプの場合_patchを1つ上げる', () => {
        const result = computeNextVersion('v1.32.0', 'patch');

        expect(result).toBe('v1.32.1');
    });

    it('T-02_lastTagがnullの場合_nullを返す', () => {
        const result = computeNextVersion(null, 'patch');

        expect(result).toBeNull();
    });

    it('T-03_バージョン形式でない場合_nullを返す', () => {
        const result = computeNextVersion('not-a-version', 'patch');

        expect(result).toBeNull();
    });

    it('T-11_minorバンプの場合_minorを1つ上げてpatchを0にリセットする', () => {
        const result = computeNextVersion('v1.32.5', 'minor');

        expect(result).toBe('v1.33.0');
    });
});

describe('determineAutoReleaseEligibility', () => {
    it('T-04_全PRがpatchの場合_eligibleがtrueでbumpLevelがpatch', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: ['patch', 'patch'],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(true);
        expect(result.bumpLevel).toBe('patch');
    });

    it('T-05_majorが含まれる場合_eligibleがfalse', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: ['patch', 'major'],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(false);
    });

    it('T-06_ラベル未設定のPRが含まれる場合_eligibleがfalse', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: ['patch', undefined],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(false);
    });

    it('T-07_PR番号不明のコミットがある場合_eligibleがfalse', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: [],
            unresolvedCommitCount: 1,
        });

        expect(result.eligible).toBe(false);
    });

    it('T-08_対象PRが無い場合_eligibleがfalse', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: [],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(false);
    });

    it('T-09_noneとpatchが混在する場合_noneを除外してeligibleがtrue', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: ['patch', 'none'],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(true);
    });

    it('T-10_全PRがnoneの場合_eligibleがfalse', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: ['none', 'none'],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(false);
    });

    it('T-12_patchとminorが混在する場合_eligibleがtrueでbumpLevelがminor', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: ['patch', 'minor'],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(true);
        expect(result.bumpLevel).toBe('minor');
    });

    it('T-13_全PRがminorの場合_eligibleがtrueでbumpLevelがminor', () => {
        const result = determineAutoReleaseEligibility({
            prLevels: ['minor', 'minor'],
            unresolvedCommitCount: 0,
        });

        expect(result.eligible).toBe(true);
        expect(result.bumpLevel).toBe('minor');
    });
});

describe('buildReleaseNoteWritePayload', () => {
    it('T-14_GitHub Releaseレスポンスの場合_source_repoを付与したオブジェクトを返す', () => {
        const result = buildReleaseNoteWritePayload({
            release: {
                tag_name: 'v2.0.0',
                name: 'v2.0.0',
                body: '本文',
                published_at: '2026-08-16T00:00:00Z',
                draft: false,
                prerelease: false,
            },
            sourceRepo: 'race-scheduler',
        });

        expect(result).toEqual({
            tag_name: 'v2.0.0',
            name: 'v2.0.0',
            body: '本文',
            published_at: '2026-08-16T00:00:00Z',
            draft: false,
            prerelease: false,
            source_repo: 'race-scheduler',
        });
    });

    it('T-15_name-bodyがnullの場合_nullのまま維持される', () => {
        const result = buildReleaseNoteWritePayload({
            release: {
                tag_name: 'v2.0.0',
                name: null,
                body: null,
                published_at: null,
                draft: false,
                prerelease: false,
            },
            sourceRepo: 'race-schedule',
        });

        expect(result.name).toBeNull();
        expect(result.body).toBeNull();
    });
});

describe('resolveDualWriteSkipReason', () => {
    it('T-16_両方設定されている場合_nullを返す', () => {
        const result = resolveDualWriteSkipReason({
            mainApiUrl: 'https://example.com',
            serviceAuthToken: 'token',
        });

        expect(result).toBeNull();
    });

    it('T-17_両方とも未設定の場合_両方の変数名を含む警告を返す', () => {
        const result = resolveDualWriteSkipReason({});

        expect(result).toContain('MAIN_API_URL');
        expect(result).toContain('SERVICE_AUTH_TOKEN');
    });

    it('T-18_mainApiUrlのみ未設定の場合_MAIN_API_URLのみ含む警告を返す', () => {
        const result = resolveDualWriteSkipReason({
            serviceAuthToken: 'token',
        });

        expect(result).toContain('MAIN_API_URL');
        expect(result).not.toContain('SERVICE_AUTH_TOKEN');
    });

    it('T-19_serviceAuthTokenのみ未設定の場合_SERVICE_AUTH_TOKENのみ含む警告を返す', () => {
        const result = resolveDualWriteSkipReason({
            mainApiUrl: 'https://example.com',
        });

        expect(result).not.toContain('MAIN_API_URL');
        expect(result).toContain('SERVICE_AUTH_TOKEN');
    });
});
