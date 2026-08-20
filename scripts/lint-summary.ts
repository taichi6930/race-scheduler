#!/usr/bin/env bun
/**
 * lint-summary.ts
 *
 * `bun run lint:check`（`biome check .` + `eslint --quiet`）と同じコマンドを実行し、
 * 生の全出力ではなく「件数サマリ＋先頭20件」だけを表示する（TOK-046）。
 * AI 向けの既定は静音、全件確認したい人間は `bun run lint` を使う運用（TOK-058）。
 *
 * 終了コードは元のlintコマンドの終了コードをそのまま返す（握り潰さない）。
 *
 * 使い方:
 *   bun scripts/lint-summary.ts
 */

/* eslint-disable no-console */
export {}; // このファイルをモジュールスコープにする（トップレベル識別子の衝突防止）

const MAX_ISSUE_LINES = 20;

interface CommandResult {
    exitCode: number;
    output: string;
}

/** lint 出力から抽出したエラー・警告の件数。 */
interface LintCounts {
    errors: number;
    warnings: number;
}

/**
 * コマンドを実行し、標準出力・標準エラーを結合したテキストと終了コードを返す。
 * @param cmd - 実行するコマンド（配列形式）
 * @returns 終了コードと結合出力
 */
const runCapture = (cmd: string[]): CommandResult => {
    const proc = Bun.spawnSync({
        cmd,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const output =
        new TextDecoder().decode(proc.stdout) +
        new TextDecoder().decode(proc.stderr);
    return { exitCode: proc.exitCode ?? 1, output };
};

/**
 * biome の出力末尾から `Found N error(s)./Found N warning(s).` を抽出する。
 * @param output - biome の結合出力
 * @returns エラー件数・警告件数
 */
const parseBiomeCounts = (output: string): LintCounts => {
    const errorMatch = output.match(/Found (\d+) error/);
    const warningMatch = output.match(/Found (\d+) warning/);
    return {
        errors: errorMatch ? Number(errorMatch[1]) : 0,
        warnings: warningMatch ? Number(warningMatch[1]) : 0,
    };
};

/**
 * eslint の出力末尾から `N problems (X errors, Y warnings)` を抽出する。
 * `--quiet` 実行のため通常 warnings は 0 件になる。
 * @param output - eslint の結合出力
 * @returns エラー件数・警告件数
 */
const parseEslintCounts = (output: string): LintCounts => {
    const match = output.match(
        /\d+\s+problems?\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/,
    );
    return {
        errors: match ? Number(match[1]) : 0,
        warnings: match ? Number(match[2]) : 0,
    };
};

/** 出力から先頭N行の「意味のある行」（空行を除く）を取り出す */
const firstIssueLines = (output: string, max: number): string[] =>
    output
        .split('\n')
        .filter((line) => line.trim() !== '')
        .slice(0, max);

const main = (): void => {
    const biome = runCapture(['bunx', 'biome', 'check', '.']);
    const biomeCounts = parseBiomeCounts(biome.output);

    let eslint: CommandResult = { exitCode: 0, output: '' };
    let eslintCounts = { errors: 0, warnings: 0 };
    // lint:check と同じく `&&` 相当: biome が失敗したら eslint は実行しない
    if (biome.exitCode === 0) {
        eslint = runCapture([
            'bunx',
            'eslint',
            '--quiet',
            '--cache',
            '--cache-location',
            '.eslintcache',
            '--cache-strategy',
            'content',
            'packages',
            '--ext',
            '.ts,.tsx',
        ]);
        eslintCounts = parseEslintCounts(eslint.output);
    }

    const totalErrors = biomeCounts.errors + eslintCounts.errors;
    const totalWarnings = biomeCounts.warnings + eslintCounts.warnings;
    const exitCode = biome.exitCode !== 0 ? biome.exitCode : eslint.exitCode;

    console.log(`${totalErrors} errors, ${totalWarnings} warnings`);

    if (exitCode !== 0) {
        const combinedOutput = `${biome.output}\n${eslint.output}`;
        const issueLines = firstIssueLines(combinedOutput, MAX_ISSUE_LINES);
        if (issueLines.length > 0) {
            console.log(issueLines.join('\n'));
        }
    }
    console.log('全件表示は `bun run lint` を実行してください。');

    process.exit(exitCode);
};

main();
