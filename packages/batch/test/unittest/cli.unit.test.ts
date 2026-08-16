/**
 * batchCli.ts（main / run）UT
 *
 * 実処理は batchCli.ts に集約されており、トップレベルの副作用
 * （`if (import.meta.main)`）を持たないため、直接 import してプロセス内で
 * ユニットテストできる（`import.meta.main` 分岐自体は cli.ts に分離済み）。
 * executeMultipleBatches / getApiConfig は main/run の第一引数（MainDependencies）
 * として注入できるようになっているため、mock.module は使わない
 * （mock.module はモジュールレジストリを書き換えるため、他テストファイルの
 * live binding にも影響し得るリスクがある）。
 * process.exit は例外を投げるようスパイし、呼び出しを検証する。
 *
 * cli.ts のサブプロセス経由 E2E テストは packages/batch/test/unittest/cli.test.ts に別途ある。
 *
 * ## デシジョンテーブル: main()
 *
 * | #    | 引数                                  | 期待結果                                    |
 * |------|----------------------------------------|----------------------------------------------|
 * | M-01 | 引数不足（2個以下）                    | usage を error 出力し exit(1)                |
 * | M-02 | raceType が不正                        | Invalid raceType を error 出力し exit(1)     |
 * | M-03 | target が不正                          | Invalid target を error 出力し exit(1)       |
 * | M-04 | 日付が不正（invalid-date）             | error 出力し exit(1)                         |
 * | M-05 | finishDate < startDate（negative-range）| error 出力し exit(1)                        |
 * | M-06 | レンジ超過（range-too-large）          | error 出力し exit(1)                         |
 * | M-07 | 正常系・失敗0件                        | exit されない                                |
 * | M-08 | 正常系・失敗あり                       | exit(1)                                      |
 * | M-09 | target 省略                            | デフォルト 'all' として実行される            |
 * | M-10 | 複数raceType（jra,nar）・全件成功      | 両方のexecuteMultipleBatchesが呼ばれ、結果が全て集約される（PERF-068） |
 * | M-11 | 複数raceType・1件がreject              | 他のraceTypeの結果は反映されつつexit(1)（Promise.allSettledの効果） |
 * | M-12 | 複数raceType・並列実行                 | 直列合計より短時間で完了する（実際に並列化されていること） |
 *
 * ## デシジョンテーブル: run()
 *
 * | #    | 状態                     | 期待結果                             |
 * |------|----------------------------|----------------------------------------|
 * | R-01 | main が成功                | run が正常終了する                    |
 * | R-02 | main が例外を throw        | error 出力し exit(1)                  |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { MainDependencies } from '../../src/batchCli';
import { main, run } from '../../src/batchCli';
import type { BatchResult } from '../../src/orchestrator';
import type { ApiConfig, BatchExecTarget } from '../../src/types';

/** process.exit(code) が呼ばれたことを検知するための sentinel エラー */
class ProcessExitSignal extends Error {
    constructor(public readonly code: number) {
        super(`process.exit(${code})`);
    }
}

const buildResult = (overrides: Partial<BatchResult> = {}): BatchResult => ({
    target: 'place',
    successCount: 1,
    failureCount: 0,
    failures: [],
    duration: 1,
    ...overrides,
});

const buildApiConfig = (): ApiConfig => ({
    scrapingApiUrl: 'http://scraping.test',
    mainApiUrl: 'http://main.test',
});

describe('cli', () => {
    let originalArgv: string[];
    let exitSpy: ReturnType<typeof spyOn<typeof process, 'exit'>>;
    let deps: MainDependencies;
    let executeMultipleBatchesCalls: {
        targets: BatchExecTarget[];
    }[];

    beforeEach(() => {
        originalArgv = process.argv;
        executeMultipleBatchesCalls = [];
        deps = {
            executeMultipleBatches: (targets) => {
                executeMultipleBatchesCalls.push({ targets: [...targets] });
                return Promise.resolve([]);
            },
            getApiConfig: buildApiConfig,
        };
        exitSpy = spyOn(process, 'exit').mockImplementation(((
            code?: number,
        ) => {
            throw new ProcessExitSignal(code ?? 0);
        }) as never);
    });

    afterEach(() => {
        process.argv = originalArgv;
        exitSpy.mockRestore();
    });

    describe('main', () => {
        it('[M-01] 引数不足_usageをerror出力しexit(1)', async () => {
            process.argv = ['bun', 'cli.ts', 'JRA'];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-02] raceTypeが不正_exit(1)', async () => {
            process.argv = [
                'bun',
                'cli.ts',
                'INVALID_RACE_TYPE',
                '2024-01-01',
                '2024-01-05',
            ];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-03] targetが不正_exit(1)', async () => {
            process.argv = [
                'bun',
                'cli.ts',
                'jra',
                '2024-01-01',
                '2024-01-05',
                'unknown-target',
            ];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-04] 日付が不正_invalid-date_exit(1)', async () => {
            process.argv = [
                'bun',
                'cli.ts',
                'nar',
                'not-a-date',
                '2024-01-05',
                'race',
            ];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-05] finishDateがstartDateより前_negative-range_exit(1)', async () => {
            process.argv = [
                'bun',
                'cli.ts',
                'nar',
                '2024-01-05',
                '2024-01-01',
                'race',
            ];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-06] レンジ超過_range-too-large_exit(1)', async () => {
            process.argv = [
                'bun',
                'cli.ts',
                'nar',
                '2024-01-01',
                '2024-03-01',
                'race',
            ];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-07] 正常系_失敗0件_exitされない', async () => {
            deps.executeMultipleBatches = () =>
                Promise.resolve([buildResult({ successCount: 3 })]);
            process.argv = [
                'bun',
                'cli.ts',
                'nar',
                '2024-01-01',
                '2024-01-05',
                'place',
            ];

            await main(deps);

            expect(exitSpy).not.toHaveBeenCalled();
        });

        it('[M-08] 正常系_失敗あり_exit(1)', async () => {
            deps.executeMultipleBatches = () =>
                Promise.resolve([
                    buildResult({
                        failureCount: 1,
                        failures: [{ id: 'x', reason: 'boom' }],
                    }),
                ]);
            process.argv = [
                'bun',
                'cli.ts',
                'nar',
                '2024-01-01',
                '2024-01-05',
                'place',
            ];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-09] targetを省略_デフォルトallとして実行される', async () => {
            process.argv = ['bun', 'cli.ts', 'nar', '2024-01-01', '2024-01-05'];

            await main(deps);

            expect(executeMultipleBatchesCalls[0]?.targets).toEqual([
                'place',
                'race',
                'calendar',
            ]);
        });

        it('[M-10] 複数raceType（jra,nar）・全件成功_両方呼ばれ結果が全て集約される', async () => {
            const raceTypesCalled: string[] = [];
            deps.executeMultipleBatches = (_targets, config) => {
                raceTypesCalled.push(config.raceType.valueOf());
                return Promise.resolve([
                    buildResult({ successCount: 1, target: 'place' }),
                ]);
            };
            process.argv = [
                'bun',
                'cli.ts',
                'jra,nar',
                '2024-01-01',
                '2024-01-05',
                'place',
            ];

            await main(deps);

            expect(exitSpy).not.toHaveBeenCalled();
            expect(raceTypesCalled.sort()).toEqual(['jra', 'nar']);
        });

        it('[M-11] 複数raceType・1件がreject_他方の結果は反映されつつexit(1)', async () => {
            const successResult = buildResult({
                successCount: 5,
                target: 'place',
            });
            deps.executeMultipleBatches = (_targets, config) => {
                if (config.raceType.valueOf() === 'jra') {
                    return Promise.reject(new Error('jra batch crashed'));
                }
                return Promise.resolve([successResult]);
            };
            process.argv = [
                'bun',
                'cli.ts',
                'jra,nar',
                '2024-01-01',
                '2024-01-05',
                'place',
            ];

            await expect(main(deps)).rejects.toThrow(ProcessExitSignal);

            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('[M-12] 複数raceType・並列実行_直列合計より短時間で完了する', async () => {
            const delayMs = 50;
            deps.executeMultipleBatches = async () => {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                return [buildResult({ successCount: 1, target: 'place' })];
            };
            process.argv = [
                'bun',
                'cli.ts',
                'jra,nar,keirin',
                '2024-01-01',
                '2024-01-05',
                'place',
            ];

            const start = Date.now();
            await main(deps);
            const elapsedMs = Date.now() - start;

            // 直列なら 3 * delayMs 以上かかるが、並列であれば delayMs 程度で完了する
            expect(elapsedMs).toBeLessThan(delayMs * 3);
        });
    });

    describe('run', () => {
        it('[R-01] main成功_正常終了する', async () => {
            deps.executeMultipleBatches = () =>
                Promise.resolve([buildResult()]);
            process.argv = [
                'bun',
                'cli.ts',
                'nar',
                '2024-01-01',
                '2024-01-05',
                'place',
            ];

            await run(deps);

            expect(exitSpy).not.toHaveBeenCalled();
        });

        it('[R-02] mainが例外をthrow_error出力しexit(1)', async () => {
            deps.executeMultipleBatches = () => {
                throw new Error('unexpected failure');
            };
            process.argv = [
                'bun',
                'cli.ts',
                'nar',
                '2024-01-01',
                '2024-01-05',
                'place',
            ];

            await expect(run(deps)).rejects.toThrow(ProcessExitSignal);

            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });
});
