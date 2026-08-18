/**
 * ciDuration.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * `gh api` へ渡す引数の組み立てはミスるとCI所要時間レポート（CICD-54/55）が
 * 静かに壊れる（実際に`-f`のみで`--method GET`を付けず、`gh api`が
 * POSTをデフォルトにしてしまい、GET専用エンドポイントに対して404になる
 * バグを踏んだ）ため、UTで固定する。
 *
 * ## デシジョンテーブル
 *
 * ### buildRecentRunsArgs
 * | # | 検証観点 | 期待 |
 * |---|---------|------|
 * | T-01 | `-f`使用時のメソッド明示 | `-X` `GET` が引数に含まれる（POSTデフォルト化を防ぐ） |
 * | T-02 | エンドポイント・パラメータの組み立て | repo/workflowFile/countが正しく埋め込まれる |
 *
 * ### billableMinutes / totalBillableMinutes（CICD-72）
 * | # | 入力（秒） | 期待 |
 * |---|-----------|------|
 * | T-03 | 45秒 | 1分（切り上げ） |
 * | T-04 | 60秒 | 1分（境界値） |
 * | T-05 | 61秒 | 2分（境界値+1） |
 * | T-06 | 複数run×複数ジョブ | 全ジョブの切り上げ分数の合計 |
 *
 * ### excludeSkipped / groupByJobName（2026-08-14、skippedジョブによる平均値汚染の是正）
 * | # | 検証観点 | 期待 |
 * |---|---------|------|
 * | T-07 | conclusion='skipped'を含む一覧 | skippedのジョブが除外される |
 * | T-08 | groupByJobNameの集計 | skippedジョブが平均対象から除かれる |
 *
 * ### 未完了ジョブ（completed_at=null）の除外
 * | # | 検証観点 | 期待 |
 * |---|---------|------|
 * | T-09 | totalBillableMinutes/groupByJobNameへ未完了ジョブが混在 | new Date(null)による1970年計算に汚染されず、完了済みジョブのみで集計される |
 */
import { describe, expect, it } from 'bun:test';

import {
    billableMinutes,
    buildRecentRunsArgs,
    excludeSkipped,
    groupByJobName,
    type JobTiming,
    totalBillableMinutes,
} from './ciDuration';

describe('buildRecentRunsArgs', () => {
    it('[T-01] -Xで明示的にGETを指定していること（-f指定時のPOSTデフォルト化を防ぐ）', () => {
        const args = buildRecentRunsArgs('owner/repo', 'pull_request.yml', 10);

        const methodFlagIndex = args.indexOf('-X');
        expect(methodFlagIndex).toBeGreaterThanOrEqual(0);
        expect(args[methodFlagIndex + 1]).toBe('GET');
    });

    it('[T-02] repo・workflowFile・countがエンドポイント/パラメータに正しく埋め込まれること', () => {
        const args = buildRecentRunsArgs('owner/repo', 'pull_request.yml', 11);

        expect(args).toContain(
            'repos/owner/repo/actions/workflows/pull_request.yml/runs',
        );
        expect(args).toContain('status=completed');
        expect(args).toContain('per_page=11');
    });
});

const makeJob = (
    name: string,
    startedAt: string,
    completedAt: string | null,
    conclusion: string | null = 'success',
): JobTiming => ({
    name,
    started_at: startedAt,
    completed_at: completedAt,
    conclusion,
});

describe('billableMinutes', () => {
    it('[T-03] 45秒は1分に切り上げられること', () => {
        expect(billableMinutes(45)).toBe(1);
    });

    it('[T-04] 60秒はちょうど1分になること（境界値）', () => {
        expect(billableMinutes(60)).toBe(1);
    });

    it('[T-05] 61秒は2分に切り上げられること（境界値+1）', () => {
        expect(billableMinutes(61)).toBe(2);
    });
});

describe('totalBillableMinutes', () => {
    it('[T-06] 複数run・複数ジョブの課金対象分数を合計できること', () => {
        const run1: JobTiming[] = [
            makeJob('job-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:45Z'), // 1分
            makeJob('job-b', '2026-01-01T00:00:00Z', '2026-01-01T00:01:01Z'), // 2分
        ];
        const run2: JobTiming[] = [
            makeJob('job-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:30Z'), // 1分
        ];

        expect(totalBillableMinutes([run1, run2])).toBe(4);
    });
});

describe('excludeSkipped', () => {
    it('[T-07] conclusion=skippedのジョブが除外されること', () => {
        const timings: JobTiming[] = [
            makeJob(
                'call-static-checks',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:30Z',
                'success',
            ),
            makeJob(
                'call-workflow-hygiene-check',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:00Z',
                'skipped',
            ),
        ];

        const result = excludeSkipped(timings);

        expect(result.map((t) => t.name)).toEqual(['call-static-checks']);
    });
});

describe('groupByJobName', () => {
    it('[T-08] skippedジョブが平均対象から除かれること（skipped混入による平均0秒への汚染を防ぐ）', () => {
        // 条件付きジョブが1回だけ実際に25秒かけて実行され、他2回はskippedだったケース。
        // skippedを除外しないと平均が (25+0+0)/3 ≈ 8.3秒 に歪む。
        const run1: JobTiming[] = [
            makeJob(
                'call-workflow-hygiene-check',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:25Z',
                'success',
            ),
        ];
        const run2: JobTiming[] = [
            makeJob(
                'call-workflow-hygiene-check',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:00Z',
                'skipped',
            ),
        ];
        const run3: JobTiming[] = [
            makeJob(
                'call-workflow-hygiene-check',
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:00Z',
                'skipped',
            ),
        ];

        const byJob = groupByJobName([run1, run2, run3]);

        expect(byJob.get('call-workflow-hygiene-check')).toEqual([25]);
    });
});

describe('未完了ジョブ（completed_at=null）の除外', () => {
    it('[T-09] totalBillableMinutes/groupByJobNameが未完了ジョブをnew Date(null)で汚染せず除外すること', () => {
        // 完了済み1件（45秒→1分）+ 未完了1件（completed_at=null、
        // フィルタが無いと1970-01-01との差分でduration計算が破綻する）。
        const run: JobTiming[] = [
            makeJob('job-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:45Z'),
            makeJob('job-a', '2026-01-01T00:01:00Z', null),
        ];

        expect(totalBillableMinutes([run])).toBe(1);
        expect(groupByJobName([run]).get('job-a')).toEqual([45]);
    });
});
