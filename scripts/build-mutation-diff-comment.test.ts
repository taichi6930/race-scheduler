/**
 * build-mutation-diff-comment.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * スコア計算（分母・分子の集計ロジック）を誤ると「悪い結果なのに良く見える」
 * 逆方向の誤りが起きうるため、UTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### summarizePackageReport / calculateScore
 * | # | mutants | 期待 |
 * |---|---------|------|
 * | T-01 | Killedのみ2件 | killed=2, survived=0, score=100 |
 * | T-02 | Killed1件+Survived1件 | killed=1, survived=1, score=50 |
 * | T-03 | Timeoutのみ1件 | killedと同じ扱い（KILLED_LIKE） |
 * | T-04 | NoCoverageのみ1件 | survived扱い（分母に含むが殺せていない） |
 * | T-05 | CompileError混在 | excludedとしてスコア計算対象外 |
 * | T-06 | mutants空配列 | score=null（対象ミュータントなし） |
 *
 * ### buildComment
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-07 | survivedあり | survivedミュータント一覧のdetailsを含む |
 * | T-08 | survivedなし | detailsセクションを含まない |
 * | T-09 | 30件超のsurvived | 上限で切り詰められ「... and N more」を含む |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildComment,
    calculateScore,
    summarizePackageReport,
} from './build-mutation-diff-comment';

const makeMutant = (id: string, status: string, line = 1) => ({
    id,
    mutatorName: 'StringLiteral',
    status,
    location: { start: { line, column: 1 }, end: { line, column: 10 } },
});

describe('build-mutation-diff-comment', () => {
    describe('summarizePackageReport / calculateScore', () => {
        it('T-01: Killedのみならscoreは100', () => {
            const report = {
                files: {
                    'a.ts': {
                        mutants: [
                            makeMutant('0', 'Killed'),
                            makeMutant('1', 'Killed'),
                        ],
                    },
                },
            };

            const result = summarizePackageReport('core', report);

            expect(result.killed).toBe(2);
            expect(result.survived).toHaveLength(0);
            expect(calculateScore(result)).toBe(100);
        });

        it('T-02: Killed1件+Survived1件ならscoreは50', () => {
            const report = {
                files: {
                    'a.ts': {
                        mutants: [
                            makeMutant('0', 'Killed'),
                            makeMutant('1', 'Survived'),
                        ],
                    },
                },
            };

            const result = summarizePackageReport('core', report);

            expect(result.killed).toBe(1);
            expect(result.survived).toHaveLength(1);
            expect(calculateScore(result)).toBe(50);
        });

        it('T-03: TimeoutはKilled同様にkilled扱いされる', () => {
            const report = {
                files: { 'a.ts': { mutants: [makeMutant('0', 'Timeout')] } },
            };

            const result = summarizePackageReport('core', report);

            expect(result.killed).toBe(1);
            expect(calculateScore(result)).toBe(100);
        });

        it('T-04: NoCoverageは殺せなかった扱いだがsurvived一覧には含まれない', () => {
            const report = {
                files: { 'a.ts': { mutants: [makeMutant('0', 'NoCoverage')] } },
            };

            const result = summarizePackageReport('core', report);

            expect(result.killed).toBe(0);
            expect(result.noCoverage).toBe(1);
            expect(result.survived).toHaveLength(0);
            expect(calculateScore(result)).toBe(0);
        });

        it('T-05: CompileErrorはexcludedに計上されスコア計算対象外', () => {
            const report = {
                files: {
                    'a.ts': {
                        mutants: [
                            makeMutant('0', 'Killed'),
                            makeMutant('1', 'CompileError'),
                        ],
                    },
                },
            };

            const result = summarizePackageReport('core', report);

            expect(result.excluded).toBe(1);
            expect(calculateScore(result)).toBe(100);
        });

        it('T-06: 対象ミュータントが無ければscoreはnull', () => {
            const report = { files: { 'a.ts': { mutants: [] } } };

            const result = summarizePackageReport('core', report);

            expect(calculateScore(result)).toBeNull();
        });
    });

    describe('buildComment', () => {
        it('T-07: survivedがあれば一覧のdetailsを含む', () => {
            const report = {
                files: {
                    'a.ts': {
                        mutants: [makeMutant('0', 'Survived', 42)],
                    },
                },
            };
            const result = summarizePackageReport('core', report);

            const comment = buildComment([result]);

            expect(comment).toContain('survivedミュータント一覧');
            expect(comment).toContain('a.ts:42');
        });

        it('T-08: survivedが無ければdetailsセクションを含まない', () => {
            const report = {
                files: { 'a.ts': { mutants: [makeMutant('0', 'Killed')] } },
            };
            const result = summarizePackageReport('core', report);

            const comment = buildComment([result]);

            expect(comment).not.toContain('survivedミュータント一覧');
        });

        it('T-09: 30件超のsurvivedは上限で切り詰められる', () => {
            const mutants = Array.from({ length: 35 }, (_, i) =>
                makeMutant(String(i), 'Survived', i + 1),
            );
            const report = { files: { 'a.ts': { mutants } } };
            const result = summarizePackageReport('core', report);

            const comment = buildComment([result]);

            expect(comment).toContain('... and 5 more');
        });
    });
});
