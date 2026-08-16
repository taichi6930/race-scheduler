/**
 * Batch CLI → Service(main.ts) → Client → HTTP コンポーネントテスト
 *
 * 旧テストは `MockApiClient`/`MockBatchService`（リトライロジック含む）を
 * テストファイル内で自作定義し、それ自身を検証していた（src を1行も通らず
 * 実質価値ゼロ）。本ファイルは cli.ts の `main()`（実 `executeMultipleBatches`
 * を注入）から `src/batch/*` → `src/client/*` → `src/client/http.ts` までの
 * 実コードを通し、`fetch`（最外層のHTTP呼び出し）だけを spy して検証する。
 *
 * 注記: 本パッケージの本番実装に「リトライ」機構は存在しない
 * （`fetchWithTimeout` はタイムアウト付き単純フェッチのみで、失敗を
 * リトライせずそのまま throw する）。旧テストが謳っていたリトライ検証は
 * 実装に存在しないロジックの捏造になるため行わない。代わりに、CLI起動から
 * HTTP境界までの実コードパスの疎通と、複数バッチ実行時の
 * 成功/失敗集約・隔離（`executeMultipleBatches`/`executeBatch` の核心）を検証する。
 *
 * ## シナリオテーブル
 *
 * | #     | シナリオ                                              | 期待                                                                           |
 * |-------|----------------------------------------------------------|----------------------------------------------------------------------------------|
 * | CLI-1 | main() 経由 target=place・fetch成功応答                  | process.exit されない・実際に POST /sync/place へ fetch される                   |
 * | CLI-2 | main() 経由 target=place・fetch 500エラー応答            | 実サービス層の失敗が main() の終了コードに反映され process.exit(1)              |
 * | CLI-3 | executeMultipleBatches(['place','race','calendar']) 全成功 | 3件が順序通り返り、各対象が正しいエンドポイントへ fetch される                  |
 * | CLI-4 | 同上で race 対象のみ 500 エラー                           | race のみ failureCount=1（理由に 'race'/'500' 含む）・place/calendar は成功維持（部分失敗の隔離） |
 * | CLI-5 | calendar 対象を実行                                       | CALENDAR_API_URL を基準とした別ホストのエンドポイントへ fetch される             |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { main } from '../../../src/batchCli';
import { executeMultipleBatches } from '../../../src/orchestrator';
import type { BatchConfig, BatchExecTarget } from '../../../src/types';
import { getApiConfig } from '../../../src/types';

/** process.exit(code) が呼ばれたことを検知するための sentinel エラー */
class ProcessExitSignal extends Error {
    constructor(public readonly code: number) {
        super(`process.exit(${code})`);
    }
}

interface MockResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
}

interface FetchCall {
    url: string;
    method?: string;
}

const okJson = (data: unknown): MockResponse => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
    json: async () => data,
});

const errorResponse = (status: number, body: string): MockResponse => ({
    ok: false,
    status,
    text: async () => body,
    json: async () => ({}),
});

/**
 * URL ごとにハンドラを振り分ける fetch spy をインストールする。
 * `fetchWithTimeout`（最外層のHTTP呼び出し）のみをテストダブルに置き換え、
 * cli → main → batch/* → client/* の実コードは全て素通しする。
 */
const installFetchSpy = (
    handler: (call: FetchCall) => MockResponse | Promise<MockResponse>,
): { spy: ReturnType<typeof spyOn>; calls: FetchCall[] } => {
    const calls: FetchCall[] = [];
    const spy = spyOn(globalThis, 'fetch');
    spy.mockImplementation((async (
        input: string | URL | Request,
        init?: RequestInit,
    ) => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        const call: FetchCall = { url, method: init?.method };
        calls.push(call);
        return handler(call);
    }) as unknown as typeof fetch);
    return { spy, calls };
};

describe('コンポーネントテスト: Batch - CLI → Service(main) → Client → HTTP', () => {
    let originalArgv: string[];
    let exitSpy: ReturnType<typeof spyOn<typeof process, 'exit'>>;
    let fetchSpy: ReturnType<typeof spyOn> | undefined;

    beforeEach(() => {
        originalArgv = process.argv;
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.MAIN_API_URL = 'http://main.test';
        process.env.CALENDAR_API_URL = 'http://calendar.test';
        exitSpy = spyOn(process, 'exit').mockImplementation(((
            code?: number,
        ) => {
            throw new ProcessExitSignal(code ?? 0);
        }) as never);
    });

    afterEach(() => {
        process.argv = originalArgv;
        exitSpy.mockRestore();
        fetchSpy?.mockRestore();
        fetchSpy = undefined;
        delete process.env.SCRAPING_API_URL;
        delete process.env.MAIN_API_URL;
        delete process.env.CALENDAR_API_URL;
    });

    it('CLI-1_target=place_fetch成功応答_exitされずPOST/sync/placeが実行される', async () => {
        // Arrange
        const { spy, calls } = installFetchSpy(() =>
            okJson({ successCount: 2, failureCount: 0, failures: [] }),
        );
        fetchSpy = spy;
        process.argv = [
            'bun',
            'cli.ts',
            'nar',
            '2026-01-01',
            '2026-01-05',
            'place',
        ];

        // Act
        await main({ executeMultipleBatches, getApiConfig });

        // Assert
        expect(exitSpy).not.toHaveBeenCalled();
        const placeCalls = calls.filter((c) => c.url.includes('/sync/place'));
        expect(placeCalls).toHaveLength(1);
        expect(placeCalls[0]?.method).toBe('POST');
    });

    it('CLI-2_target=place_fetchが500エラー応答_実サービス層の失敗でexit(1)', async () => {
        // Arrange
        const { spy } = installFetchSpy(() =>
            errorResponse(500, 'Service Unavailable'),
        );
        fetchSpy = spy;
        process.argv = [
            'bun',
            'cli.ts',
            'nar',
            '2026-01-01',
            '2026-01-05',
            'place',
        ];

        // Act / Assert
        await expect(
            main({ executeMultipleBatches, getApiConfig }),
        ).rejects.toThrow(ProcessExitSignal);
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('CLI-3_all実行_全成功で3件が順序通り返り各エンドポイントが呼ばれる', async () => {
        // Arrange
        const { spy, calls } = installFetchSpy((call) => {
            if (call.url.includes('/sync/place')) {
                return okJson({
                    successCount: 1,
                    failureCount: 0,
                    failures: [],
                });
            }
            if (call.url.includes('/sync/race')) {
                return okJson({
                    successCount: 1,
                    failureCount: 0,
                    failures: [],
                });
            }
            return okJson({
                successCount: 1,
                insertedCount: 1,
                updatedCount: 0,
                deletedCount: 0,
                failureCount: 0,
                failures: [],
            });
        });
        fetchSpy = spy;
        const targets: BatchExecTarget[] = ['place', 'race', 'calendar'];
        const config: BatchConfig = {
            raceType: RaceType.OVERSEAS,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        };

        // Act
        const results = await executeMultipleBatches(targets, config);

        // Assert
        expect(results.map((r) => r.target)).toEqual(targets);
        expect(results.every((r) => r.failureCount === 0)).toBe(true);
        expect(
            calls.some((c) => c.url === 'http://scraping.test/sync/place'),
        ).toBe(true);
        expect(
            calls.some((c) => c.url === 'http://scraping.test/sync/race'),
        ).toBe(true);
        expect(calls.some((c) => c.url === 'http://calendar.test/sync')).toBe(
            true,
        );
    });

    it('CLI-4_all実行_raceのみ500エラーでも部分失敗が隔離される', async () => {
        // Arrange
        const { spy } = installFetchSpy((call) => {
            if (call.url.includes('/sync/race')) {
                return errorResponse(500, 'race sync failed');
            }
            if (call.url.includes('/sync/place')) {
                return okJson({
                    successCount: 3,
                    failureCount: 0,
                    failures: [],
                });
            }
            return okJson({
                successCount: 3,
                insertedCount: 2,
                updatedCount: 1,
                deletedCount: 0,
                failureCount: 0,
                failures: [],
            });
        });
        fetchSpy = spy;
        const targets: BatchExecTarget[] = ['place', 'race', 'calendar'];
        const config: BatchConfig = {
            raceType: RaceType.OVERSEAS,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        };

        // Act
        const results = await executeMultipleBatches(targets, config);

        // Assert
        const place = results.find((r) => r.target === 'place');
        const race = results.find((r) => r.target === 'race');
        const calendar = results.find((r) => r.target === 'calendar');

        expect(place?.successCount).toBe(3);
        expect(place?.failureCount).toBe(0);

        expect(race?.successCount).toBe(0);
        expect(race?.failureCount).toBe(1);
        expect(race?.failures[0]?.id).toBe('race');
        expect(race?.failures[0]?.reason).toContain('race sync failed');
        expect(race?.failures[0]?.reason).toContain('500');

        expect(calendar?.successCount).toBe(3);
        expect(calendar?.failureCount).toBe(0);
    });

    it('CLI-5_calendar対象_CALENDAR_API_URLを基準としたエンドポイントへfetchされる', async () => {
        // Arrange
        const { spy, calls } = installFetchSpy(() =>
            okJson({
                successCount: 1,
                insertedCount: 1,
                updatedCount: 0,
                deletedCount: 0,
                failureCount: 0,
                failures: [],
            }),
        );
        fetchSpy = spy;
        const config: BatchConfig = {
            raceType: RaceType.NAR,
            startDate: '2026-01-01',
            finishDate: '2026-01-05',
        };

        // Act
        const results = await executeMultipleBatches(['calendar'], config);

        // Assert
        expect(results[0]?.successCount).toBe(1);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe('http://calendar.test/sync');
    });
});
