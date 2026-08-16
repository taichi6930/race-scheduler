/**
 * audit-skill-usage.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 集計ロジックを誤ると利用頻度レポートが誤った実態を示してしまうため、
 * 純粋関数（fs非依存）のUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### extractCycleRecipes
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `## 2026-07-23T03:20:00Z cycle 1 — refactor` | `['refactor']` |
 * | T-02 | recipe名の後ろに補足`（未完了）`が続く見出し | 補足を除いたrecipe名のみ |
 * | T-03 | cycle見出しが無い本文 | 空配列 |
 * | T-04 | 複数のcycle見出し | 出現順に全件抽出 |
 *
 * ### aggregateCounts
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-05 | `['refactor','coverage','refactor']` | refactor:2, coverage:1（件数降順） |
 * | T-06 | 件数が同じ場合 | recipe名の辞書順 |
 *
 * ### formatReport
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-07 | 空配列 | 「見つかりませんでした」を含む |
 * | T-08 | 集計結果1件以上 | 件数と表形式の行を含む |
 */
import { describe, expect, it } from 'bun:test';

import {
    aggregateCounts,
    extractCycleRecipes,
    formatReport,
} from './audit-skill-usage';

describe('extractCycleRecipes', () => {
    it('[T-01] cycle見出しからrecipe名を抽出すること', () => {
        expect(
            extractCycleRecipes('## 2026-07-23T03:20:00Z cycle 1 — refactor'),
        ).toEqual(['refactor']);
    });

    it('[T-02] 補足（括弧書き）を除いたrecipe名のみ抽出すること', () => {
        expect(
            extractCycleRecipes(
                '## 2026-07-18T14:55:00Z cycle 1 — refactor（未完了・ユーザー中断）',
            ),
        ).toEqual(['refactor']);
    });

    it('[T-03] cycle見出しが無ければ空配列を返すこと', () => {
        expect(extractCycleRecipes('# Run 2026-07-18T00:00:00Z\n本文')).toEqual(
            [],
        );
    });

    it('[T-04] 複数のcycle見出しを出現順に抽出すること', () => {
        const content =
            '## a cycle 1 — refactor\n本文\n## b cycle 2 — coverage\n';
        expect(extractCycleRecipes(content)).toEqual(['refactor', 'coverage']);
    });
});

describe('aggregateCounts', () => {
    it('[T-05] 件数降順で集計すること', () => {
        expect(aggregateCounts(['refactor', 'coverage', 'refactor'])).toEqual([
            { recipe: 'refactor', count: 2 },
            { recipe: 'coverage', count: 1 },
        ]);
    });

    it('[T-06] 件数が同じ場合はrecipe名の辞書順になること', () => {
        expect(aggregateCounts(['coverage', 'refactor'])).toEqual([
            { recipe: 'coverage', count: 1 },
            { recipe: 'refactor', count: 1 },
        ]);
    });
});

describe('formatReport', () => {
    it('[T-07] 空配列の場合はメッセージを含むこと', () => {
        expect(formatReport([])).toContain('見つかりませんでした');
    });

    it('[T-08] 集計結果がある場合は件数と表形式の行を含むこと', () => {
        const report = formatReport([{ recipe: 'refactor', count: 3 }]);
        expect(report).toContain('集計対象サイクル数: 3件');
        expect(report).toContain('| refactor | 3 |');
    });
});
