#!/usr/bin/env bun
/**
 * verify-scheduled-workflows.ts
 *
 * AIEFF-062対応: `.github/workflows/*.yml` の `schedule:`（cron）トリガーは、GitHub Actions
 * 自体はほぼ構文検証をしない（明らかに不正な値でもワークフローの保存自体は通ってしまい、
 * 実行時に静かにスキップされる/意図しない頻度で走る、といった事故に気づきにくい）。
 * 各ワークフローの cron 式が妥当な5フィールド構文（分/時/日/月/曜日、各フィールドの範囲）を
 * 満たしているかを機械的に検証する（読み取り専用）。
 *
 * 使い方:
 *   bun scripts/verify-scheduled-workflows.ts
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CronEntry {
    file: string;
    cron: string;
}

const CRON_LINE_RE = /-\s*cron:\s*["']([^"']+)["']/;

/**
 * ワークフローYAMLから `- cron: "..."` の値を抽出する
 * @param yamlContent - ワークフローファイルの内容
 * @param file - レポートに表示するファイル名
 * @returns 出現順の cron エントリ配列
 */
export function extractCronEntries(
    yamlContent: string,
    file: string,
): CronEntry[] {
    const entries: CronEntry[] = [];
    for (const line of yamlContent.split('\n')) {
        const match = CRON_LINE_RE.exec(line);
        if (match) {
            entries.push({ file, cron: match[1] });
        }
    }
    return entries;
}

const FIELD_BOUNDS: Array<[number, number]> = [
    [0, 59], // minute
    [0, 23], // hour
    [1, 31], // day of month
    [1, 12], // month
    [0, 7], // day of week（0/7 = Sunday）
];

/**
 * cron の1フィールド（分/時/日/月/曜日いずれか）が指定範囲内の妥当な構文か判定する
 * @param field - フィールド文字列（例: `*`, `*&#47;15`, `3,9,15,21`, `1-5`）
 * @param min - このフィールド位置で許容される最小値
 * @param max - このフィールド位置で許容される最大値
 * @returns 妥当なら true
 */
function isValidField(field: string, min: number, max: number): boolean {
    return field.split(',').every((part) => {
        const m = /^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/.exec(part);
        if (!m) {
            return false;
        }
        const [, base, rangeEnd, step] = m;
        if (step !== undefined && Number.parseInt(step, 10) < 1) {
            return false;
        }
        const inBounds = (v: string): boolean => {
            const n = Number.parseInt(v, 10);
            return n >= min && n <= max;
        };
        if (base !== '*' && !inBounds(base)) {
            return false;
        }
        if (rangeEnd !== undefined && !inBounds(rangeEnd)) {
            return false;
        }
        return true;
    });
}

/**
 * cron 式が 5 フィールドの妥当な構文かを検証する
 * @param cron - cron 式（例: `"0 6 * * *"`）
 * @returns 妥当なら true
 */
export function isValidCronExpression(cron: string): boolean {
    const fields = cron.trim().split(/\s+/);
    if (fields.length !== 5) {
        return false;
    }
    return fields.every((field, i) => {
        const [min, max] = FIELD_BOUNDS[i];
        return isValidField(field, min, max);
    });
}

if (import.meta.main) {
    const repoRoot = join(import.meta.dir, '..');
    const workflowsDir = join(repoRoot, '.github', 'workflows');
    const files = readdirSync(workflowsDir).filter(
        (f) => f.endsWith('.yml') || f.endsWith('.yaml'),
    );

    const allEntries: CronEntry[] = [];
    for (const file of files) {
        const content = readFileSync(join(workflowsDir, file), 'utf8');
        allEntries.push(...extractCronEntries(content, file));
    }

    const invalid = allEntries.filter((e) => !isValidCronExpression(e.cron));

    // eslint-disable-next-line no-console
    console.log(
        `📅 ${allEntries.length} 件の schedule トリガーを検出（${files.length} ワークフロー中）`,
    );
    for (const entry of allEntries) {
        const mark = isValidCronExpression(entry.cron) ? '✅' : '❌';
        // eslint-disable-next-line no-console
        console.log(`   ${mark} ${entry.file}: "${entry.cron}"`);
    }

    if (invalid.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
            `\n⚠️  ${invalid.length} 件の不正な cron 式を検出しました`,
        );
        process.exit(1);
    }
    process.exit(0);
}
