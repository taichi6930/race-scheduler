/**
 * cli.ts UT (subprocess-based)
 *
 * cli.ts はモジュールロード時に main を自動実行するため、
 * `Bun.spawnSync` でサブプロセスとして起動して exit code を検証する。
 *
 * | #      | テストケース                           | argv                     | Expected     |
 * |--------|----------------------------------------|--------------------------|--------------|
 * | CLI-03 | 引数不足                                | 2 引数のみ                | exit(1)      |
 * | CLI-04 | 不正 raceType                           | "INVALID" ...            | exit(1)      |
 * | CLI-05 | 不正 target                             | ... "unknown"            | exit(1)      |
 * | CLI-06 | 無効な日付文字列                          | "not-date"               | exit(1)      |
 * | CLI-07 | finishDate < startDate                  | 逆順                      | exit(1)      |
 * | CLI-08 | JRA race で 36 日範囲                   | 超過 (maxDays=35)         | exit(1)      |
 * | CLI-09 | place で 366 日範囲                     | 超過 (maxDays=365)        | exit(1)      |
 * | CLI-10 | place で 365 日範囲                     | ちょうど                   | range エラー出ない |
 */

import { describe, expect, it } from 'bun:test';
import path from 'node:path';

const CLI_PATH = path.resolve(import.meta.dir, '../../src/cli.ts');

interface CliResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

const runCli = (
    args: string[],
    env: Record<string, string> = {},
): CliResult => {
    const proc = Bun.spawnSync({
        cmd: ['bun', 'run', CLI_PATH, ...args],
        env: {
            ...process.env,
            // テスト中は executeMultipleBatches を呼ばないよう、必須 env を未設定にすると
            // getApiConfig() で throw → exit(1) になるため、validation 系のみ検証する
            SCRAPING_API_URL: 'http://scraping.invalid.example',
            MAIN_API_URL: 'http://main.invalid.example',
            ...env,
        },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    return {
        exitCode: proc.exitCode ?? -1,
        stdout: new TextDecoder().decode(proc.stdout),
        stderr: new TextDecoder().decode(proc.stderr),
    };
};

describe('cli.ts main()', () => {
    it('CLI-03_引数不足_exit(1)とusage表示', () => {
        const result = runCli(['JRA', '2026-01-01']);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Usage');
    });

    it('CLI-04_不正raceType_exit(1)とエラー', () => {
        const result = runCli(['INVALID', '2026-01-01', '2026-01-05', 'place']);
        expect(result.exitCode).toBe(1);
        expect(result.stderr.toLowerCase()).toContain('invalid racetype');
    });

    it('CLI-05_不正target_exit(1)', () => {
        const result = runCli(['jra', '2026-01-01', '2026-01-05', 'unknown']);
        expect(result.exitCode).toBe(1);
        expect(result.stderr.toLowerCase()).toContain('invalid target');
    });

    it('CLI-06_無効な日付_exit(1)', () => {
        const result = runCli(['jra', 'not-date', 'not-date', 'place']);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('valid YYYY-MM-DD');
    });

    it('CLI-07_finishDateがstartDateより前_exit(1)', () => {
        const result = runCli(['jra', '2026-01-31', '2026-01-01', 'place']);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('finishDate must be');
    });

    it('CLI-08_JRA raceで36日範囲_exit(1)', () => {
        // JRA race の maxDays=35 → 36 日 (diffMs >= 36 days) で NG
        const result = runCli([
            'jra',
            '2026-01-01',
            '2026-02-07', // 37 日後
            'race',
        ]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Range too large');
    });

    it('CLI-09_placeで391日範囲_exit(1)', () => {
        // maxDays=390 を超えるには、diffMs >= 391 * 86400000 が必要
        // 2025-01-01 から 2026-12-31 = 731日 > 390日 → Range too large
        const result = runCli(['jra', '2025-01-01', '2026-12-31', 'place']);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Range too large');
    });

    it('CLI-10_placeで365日範囲_範囲エラーは出ない', () => {
        // 範囲チェックは pass する。getApiConfig は env 設定済みなので通る。
        // executeMultipleBatches で実際に fetch すると失敗するが、
        // ここでは「Range too large が出ないこと」のみ検証。
        const result = runCli([
            'jra',
            '2026-01-01',
            '2026-12-31', // 364 日後 → 365日以内
            'place',
        ]);
        expect(result.stderr).not.toContain('Range too large');
    });
});
