#!/usr/bin/env bun
/**
 * audit-skill-usage.ts
 *
 * AIEFF-060対応: `loop-engineering` の実利用状況（どの recipe＝Worker skill がどれだけ
 * 稼働しているか）は `aidlc-docs/loop-engineering/journal.md` に累積記録されているが、
 * 集計されたことが無く「実際にどのWorker skillがよく使われているか」が把握できない
 * （§1 AIEFF-005と対）。journal.md の `## <timestamp> cycle <N> — <recipe>` 見出しから
 * recipe 名を集計し、利用頻度レポートを出力する（読み取り専用）。
 *
 * 使い方:
 *   bun scripts/audit-skill-usage.ts [journal.mdのパス]
 *   （省略時は aidlc-docs/loop-engineering/journal.md）
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CYCLE_HEADER_RE = /^## \S+ cycle \d+ — ([^\n（(]+)/gm;

/**
 * journal.md の cycle 見出しから recipe 名を抽出する
 * @param content - journal.md の内容
 * @returns 出現順の recipe 名配列（末尾の空白は除去済み）
 */
export function extractCycleRecipes(content: string): string[] {
    const recipes: string[] = [];
    for (const match of content.matchAll(CYCLE_HEADER_RE)) {
        recipes.push(match[1].trim());
    }
    return recipes;
}

export interface RecipeCount {
    recipe: string;
    count: number;
}

/**
 * recipe 名の出現回数を集計し、件数降順で返す
 * @param recipes - `extractCycleRecipes` の出力
 * @returns recipe 名 → 件数（件数降順、同数はrecipe名の辞書順）
 */
export function aggregateCounts(recipes: string[]): RecipeCount[] {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
        counts.set(recipe, (counts.get(recipe) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([recipe, count]) => ({ recipe, count }))
        .sort((a, b) => b.count - a.count || a.recipe.localeCompare(b.recipe));
}

/**
 * recipe利用頻度を markdown レポートに整形する
 * @param counts - `aggregateCounts` の出力
 * @returns markdown 文字列
 */
export function formatReport(counts: RecipeCount[]): string {
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    const header = [
        '# loop-engineering recipe 利用頻度レポート（自動生成）',
        '',
        `\`bun scripts/audit-skill-usage.ts\` で生成。集計対象サイクル数: ${total}件`,
        '',
    ];
    if (counts.length === 0) {
        return [
            ...header,
            '（journal.md に cycle 記録が見つかりませんでした）',
        ].join('\n');
    }
    const rows = counts.map((c) => `| ${c.recipe} | ${c.count} |`);
    return [...header, '| recipe | 件数 |', '| --- | --- |', ...rows, ''].join(
        '\n',
    );
}

if (import.meta.main) {
    const journalPath =
        process.argv[2] ??
        join(
            import.meta.dir,
            '..',
            'aidlc-docs',
            'loop-engineering',
            'journal.md',
        );
    const content = readFileSync(journalPath, 'utf8');
    const report = formatReport(aggregateCounts(extractCycleRecipes(content)));
    // eslint-disable-next-line no-console
    console.log(report);
}
