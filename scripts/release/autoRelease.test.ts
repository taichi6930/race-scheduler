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
 */
import { describe, expect, it } from 'bun:test';

import {
    computeNextVersion,
    determineAutoReleaseEligibility,
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
