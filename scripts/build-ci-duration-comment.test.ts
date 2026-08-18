/**
 * build-ci-duration-comment.ts の自己テスト（CICD-55）
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * PRコメントに出す回帰判定ロジック（誤検知/見逃しがあるとノイズ化・
 * 検知漏れに直結する）は誤りを避けたいため、純粋関数部分にUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### buildComparisonRows / isRegression（内部判定）
 * | # | current(秒) | baseline(秒) | 期待 |
 * |---|-------------|--------------|------|
 * | T-01 | ベースライン無し | undefined | isRegression=false, baseline/delta=undefined |
 * | T-02 | ベースラインと同程度 | 差分小 | isRegression=false |
 * | T-03 | 絶対差分は大きいが倍率未満 | 例: 100→113(+13, x1.13) | isRegression=false |
 * | T-04 | 絶対差分・倍率とも閾値超過 | 例: 10→30(+20, x3) | isRegression=true |
 * | T-05 | 複数ジョブ | - | current降順にソートされる |
 *
 * ### buildComment
 * | T-06 | 回帰あり | ⚠️バナー・フラグ付き行を含む |
 * | T-07 | 回帰なし | ✅バナー |
 *
 * ### onlyCompleted
 * | T-08 | completed_atがnullを含む | 除外される |
 *
 * ### parseArgs
 * | T-09 | --run-id未指定 | throw |
 * | T-10 | --run-id指定・--baseline-samples省略 | デフォルト10件 |
 *
 * ### buildDegradedComment
 * | T-12 | 任意の失敗理由 | 理由を含む代替コメントを返す |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildComment,
    buildComparisonRows,
    buildDegradedComment,
    parseArgs,
} from './build-ci-duration-comment';
import { type JobTiming, onlyCompleted } from './lib/ciDuration';

const job = (
    name: string,
    startedAt: string,
    completedAt: string | null,
): JobTiming => ({
    name,
    started_at: startedAt,
    completed_at: completedAt,
    conclusion: 'success',
});

describe('buildComparisonRows', () => {
    it('[T-01] ベースラインが無いジョブはisRegression=falseでbaseline/deltaがundefinedになること', () => {
        const timings = [
            job(
                'call-eslint-check',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:30Z',
            ),
        ];
        const baseline = new Map<string, number>();

        const rows = buildComparisonRows(onlyCompleted(timings), baseline);

        expect(rows[0]?.isRegression).toBe(false);
        expect(rows[0]?.baseline).toBeUndefined();
        expect(rows[0]?.delta).toBeUndefined();
    });

    it('[T-02] ベースラインと同程度の所要時間はisRegression=falseになること', () => {
        const timings = [
            job(
                'call-type-check',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:26Z',
            ),
        ];
        const baseline = new Map([['call-type-check', 25]]);

        const rows = buildComparisonRows(onlyCompleted(timings), baseline);

        expect(rows[0]?.isRegression).toBe(false);
    });

    it('[T-03] 絶対差分は閾値超過だが倍率が閾値未満の場合isRegression=falseになること', () => {
        // 100秒→120秒（+20秒 ≥ 15秒閾値だが、x1.2倍 < 1.3倍閾値）
        const timings = [
            job(
                'test-packages-core',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:02:00Z',
            ),
        ];
        const baseline = new Map([['test-packages-core', 100]]);

        const rows = buildComparisonRows(onlyCompleted(timings), baseline);

        expect(rows[0]?.isRegression).toBe(false);
        expect(rows[0]?.delta).toBe(20);
    });

    it('[T-04] 絶対差分・倍率とも閾値を超過した場合isRegression=trueになること', () => {
        const timings = [
            job(
                'call-build-test',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:30Z',
            ),
        ];
        const baseline = new Map([['call-build-test', 10]]);

        const rows = buildComparisonRows(onlyCompleted(timings), baseline);

        expect(rows[0]?.isRegression).toBe(true);
        expect(rows[0]?.delta).toBe(20);
    });

    it('[T-05] 複数ジョブがcurrent降順にソートされること', () => {
        const timings = [
            job('short-job', '2026-01-01T00:00:00Z', '2026-01-01T00:00:05Z'),
            job('long-job', '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z'),
        ];
        const baseline = new Map<string, number>();

        const rows = buildComparisonRows(onlyCompleted(timings), baseline);

        expect(rows.map((r) => r.name)).toEqual(['long-job', 'short-job']);
    });
});

describe('buildComment', () => {
    it('[T-06] 回帰があれば警告バナーとフラグ付き行を含むこと', () => {
        const rows = [
            {
                name: 'call-build-test',
                current: 30,
                baseline: 10,
                delta: 20,
                isRegression: true,
            },
        ];

        const comment = buildComment(rows, 10);

        expect(comment).toContain('⚠️');
        expect(comment).toContain('call-build-test');
    });

    it('[T-07] 回帰が無ければ✅バナーになること', () => {
        const rows = [
            {
                name: 'call-eslint-check',
                current: 5,
                baseline: 5,
                delta: 0,
                isRegression: false,
            },
        ];

        const comment = buildComment(rows, 10);

        expect(comment).toContain('✅');
        expect(comment).not.toContain('⚠️');
    });
});

describe('onlyCompleted', () => {
    it('[T-08] completed_atがnullのジョブを除外すること', () => {
        const timings = [
            job('finished', '2026-01-01T00:00:00Z', '2026-01-01T00:00:10Z'),
            job('still-running', '2026-01-01T00:00:00Z', null),
        ];

        const result = onlyCompleted(timings);

        expect(result.map((t) => t.name)).toEqual(['finished']);
    });
});

describe('parseArgs', () => {
    it('[T-09] --run-idが無ければ例外を投げること', () => {
        expect(() => parseArgs([])).toThrow('--run-id');
    });

    it('[T-10] --run-idのみ指定時、baselineSamplesはデフォルト10になること', () => {
        const options = parseArgs(['--run-id=123']);

        expect(options.runId).toBe(123);
        expect(options.baselineSamples).toBe(10);
    });

    it('[T-11] --run-idと--baseline-samplesを両方指定できること', () => {
        const options = parseArgs(['--run-id=123', '--baseline-samples=5']);

        expect(options.runId).toBe(123);
        expect(options.baselineSamples).toBe(5);
    });
});

describe('buildDegradedComment', () => {
    it('[T-12] 失敗理由を含む代替コメントを返すこと', () => {
        const comment = buildDegradedComment('gh: Not Found (HTTP 404)');

        expect(comment).toContain('CI所要時間レポート');
        expect(comment).toContain('gh: Not Found (HTTP 404)');
    });
});
