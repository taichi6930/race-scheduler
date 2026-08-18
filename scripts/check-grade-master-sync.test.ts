/**
 * check-grade-master-sync.ts の自己テスト（QSYNC-02）
 *
 * ## デシジョンテーブル
 *
 * ### extractCoreGradeKeys
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-01 | `[RaceType.JRA]: { GⅠ: {...}, 'Listed': {...} }` を含む | `jra: ['GⅠ', 'Listed']` を抽出 |
 * | T-02 | raceTypeブロックが複数 | raceTypeごとに配列を分けて抽出 |
 *
 * ### extractFrontGradeKeys
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-03 | `RaceType.jra: { 'GⅠ': _GradeEntry(...) }` を含む | `jra: ['GⅠ']` を抽出 |
 *
 * ### findMissingGrades
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-04 | core/front で集合が完全一致 | 空配列 |
 * | T-05 | front側にgradeが1件欠落 | 欠落メッセージ1件 |
 * | T-06 | front側にraceType自体が存在しない | raceType欠落メッセージ |
 */

import { describe, expect, it } from 'bun:test';

import {
    extractCoreGradeKeys,
    extractFrontGradeKeys,
    findMissingGrades,
} from './check-grade-master-sync';

describe('check-grade-master-sync/extractCoreGradeKeys', () => {
    it('T-01: raceTypeブロックからgrade名を抽出すること', () => {
        const content = `
export const GradeMaster = {
    [RaceType.JRA]: {
        GⅠ: { isSpecified: true, tier: 'top' },
        'Listed': { isSpecified: true, tier: 'low' },
    },
};
`;
        expect(extractCoreGradeKeys(content)).toEqual({
            jra: ['GⅠ', 'Listed'],
        });
    });

    it('T-02: 複数raceTypeブロックをそれぞれ抽出すること', () => {
        const content = `
export const GradeMaster = {
    [RaceType.JRA]: {
        GⅠ: { isSpecified: true, tier: 'top' },
    },
    [RaceType.NAR]: {
        GⅡ: { isSpecified: true, tier: 'high' },
    },
};
`;
        expect(extractCoreGradeKeys(content)).toEqual({
            jra: ['GⅠ'],
            nar: ['GⅡ'],
        });
    });
});

describe('check-grade-master-sync/extractFrontGradeKeys', () => {
    it('T-03: raceTypeブロックからgrade名を抽出すること', () => {
        const content = `
const _gradeTable = {
  RaceType.jra: {
    'GⅠ': _GradeEntry(GradeTier.top, true),
  },
};
`;
        expect(extractFrontGradeKeys(content)).toEqual({
            jra: ['GⅠ'],
        });
    });
});

describe('check-grade-master-sync/findMissingGrades', () => {
    it('T-04: core/frontの集合が完全一致する場合は空配列を返すこと', () => {
        const missing = findMissingGrades(
            { jra: ['GⅠ', 'GⅡ'] },
            { jra: ['GⅠ', 'GⅡ'] },
        );

        expect(missing).toEqual([]);
    });

    it('T-05: front側に1件欠落している場合は欠落メッセージを返すこと', () => {
        const missing = findMissingGrades(
            { jra: ['GⅠ', 'GⅡ'] },
            { jra: ['GⅠ'] },
        );

        expect(missing).toEqual([
            'raceType=jra, grade=GⅡ: front側の _gradeTable に存在しません',
        ]);
    });

    it('T-06: front側にraceType自体が存在しない場合はraceType欠落メッセージを返すこと', () => {
        const missing = findMissingGrades({ keirin: ['GP'] }, {});

        expect(missing).toEqual([
            'raceType=keirin: front側の _gradeTable にraceType自体が存在しません',
        ]);
    });
});
