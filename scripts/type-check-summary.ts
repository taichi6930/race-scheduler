#!/usr/bin/env bun
/**
 * type-check-summary.ts
 *
 * `bun run type-check`（`tsc --noEmit`）と同じコマンドを実行し、生の全出力ではなく
 * 「ファイル別エラー件数サマリ＋先頭N件」だけを表示する（TOK-047）。`tsc` は
 * 1エラーで複数行を出す場合があるため、行数ではなく検出したエラー診断行を基準に
 * 要約する。AI 向けの既定は静音、全件確認したい人間は `bun run type-check` を使う運用
 * （TOK-058）。
 *
 * 終了コードは `tsc --noEmit` の終了コードをそのまま返す（握り潰さない）。
 *
 * 使い方:
 *   bun scripts/type-check-summary.ts
 */

/* eslint-disable no-console */
export {}; // このファイルをモジュールスコープにする（トップレベル識別子の衝突防止）

const MAX_ISSUE_LINES = 20;
// tscの診断行フォーマット（--pretty無効時、パイプ実行では既定でこの形式になる）:
// "path/to/file.ts(12,5): error TS2345: message..."
const TSC_ERROR_LINE = /^(.+?)\(\d+,\d+\): error TS\d+:/;

const runTypeCheck = (): { exitCode: number; output: string } => {
    const proc = Bun.spawnSync({
        cmd: ['bunx', 'tsc', '--noEmit'],
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const output =
        new TextDecoder().decode(proc.stdout) +
        new TextDecoder().decode(proc.stderr);
    return { exitCode: proc.exitCode ?? 1, output };
};

/**
 * tsc の出力からエラー診断行を抽出する。
 * @param output - tsc の結合出力
 * @returns エラー診断行の配列
 */
const extractErrorLines = (output: string): string[] =>
    output.split('\n').filter((line) => TSC_ERROR_LINE.test(line));

/**
 * エラー診断行からファイルパスの一意集合を取り出す。
 * @param errorLines - `extractErrorLines` の結果
 * @returns エラーを含むファイルパスの集合
 */
const uniqueFiles = (errorLines: string[]): Set<string> => {
    const files = new Set<string>();
    for (const line of errorLines) {
        const match = line.match(TSC_ERROR_LINE);
        if (match) {
            files.add(match[1]);
        }
    }
    return files;
};

const main = (): void => {
    const { exitCode, output } = runTypeCheck();
    const errorLines = extractErrorLines(output);
    const files = uniqueFiles(errorLines);

    console.log(
        `${files.size} files with errors, ${errorLines.length} total errors`,
    );

    if (exitCode !== 0) {
        console.log(errorLines.slice(0, MAX_ISSUE_LINES).join('\n'));
    }
    console.log('全件表示は `bun run type-check` を実行してください。');

    process.exit(exitCode);
};

main();
