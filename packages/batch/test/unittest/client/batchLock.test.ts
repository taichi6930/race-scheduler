/**
 * batchLock.ts (acquireBatchLock/releaseBatchLock) クライアント テスト
 *
 * ## デシジョンテーブル
 *
 * ### acquireBatchLock()
 * | #    | レスポンス            | 期待値                                  |
 * |------|-------------------------|--------------------------------------------|
 * | A-01 | 200 + { acquired: true } | `{ acquired: true }` を返す                |
 * | A-02 | 409                      | 例外を投げず `{ acquired: false }` を返す  |
 * | A-03 | 500                      | 例外を投げる                               |
 * | A-04 | 正常系                   | POST /internal/batch-lock/acquire にJSONボディ・SERVICE_AUTH_TOKENヘッダ付きでリクエストする |
 * | A-05 | runWithRequestIdのスコープ内 | X-Request-Idヘッダが付与される（CFARCH-09）        |
 *
 * ### releaseBatchLock()
 * | #    | レスポンス | 期待値                                    |
 * |------|------------|--------------------------------------------|
 * | R-01 | 200        | 例外を投げず解決する                        |
 * | R-02 | 500        | 例外を投げる                                |
 * | R-03 | 正常系     | POST /internal/batch-lock/release にJSONボディでリクエストする |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { runWithRequestId } from '@race-schedule/core';

import {
    acquireBatchLock,
    releaseBatchLock,
} from '../../../src/client/batchLock';

describe('acquireBatchLock', () => {
    let fetchSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        process.env.MAIN_API_URL = 'http://main.test';
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        delete process.env.MAIN_API_URL;
        delete process.env.SCRAPING_API_URL;
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    it('A-01_200_acquired_trueの場合はそのまま返す', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: true,
            status: 200,
            json: async () => ({ acquired: true }),
        })) as unknown as typeof fetch);

        const result = await acquireBatchLock('instance-1');

        expect(result).toEqual({ acquired: true });
    });

    it('A-02_409の場合は例外を投げずacquired_falseを返す', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: false,
            status: 409,
            text: async () => 'conflict',
        })) as unknown as typeof fetch);

        const result = await acquireBatchLock('instance-1');

        expect(result).toEqual({ acquired: false });
    });

    it('A-03_500の場合は例外を投げる', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: false,
            status: 500,
            text: async () => 'internal error',
        })) as unknown as typeof fetch);

        await expect(acquireBatchLock('instance-1')).rejects.toThrow();
    });

    it('A-04_正常系_POSTでJSONボディ_SERVICE_AUTH_TOKENヘッダ付きでリクエストする', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: true,
            status: 200,
            json: async () => ({ acquired: true }),
        })) as unknown as typeof fetch);

        await acquireBatchLock('instance-1');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const urlArg = fetchSpy.mock.calls[0]?.[0] as URL;
        expect(urlArg.pathname).toBe('/internal/batch-lock/acquire');
        const options = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body as string) as {
            instanceId: string;
        };
        expect(body.instanceId).toBe('instance-1');
        const headers = options.headers as Record<string, string>;
        expect(headers['X-Service-Auth-Token']).toBe('test-service-auth-token');
    });

    it('A-05_runWithRequestIdのスコープ内_X-Request-Idヘッダが付与される', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: true,
            status: 200,
            json: async () => ({ acquired: true }),
        })) as unknown as typeof fetch);

        await runWithRequestId('req-lock-1', () =>
            acquireBatchLock('instance-1'),
        );

        const options = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        const headers = options.headers as Record<string, string>;
        expect(headers['X-Request-Id']).toBe('req-lock-1');
    });
});

describe('releaseBatchLock', () => {
    let fetchSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        process.env.MAIN_API_URL = 'http://main.test';
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        delete process.env.MAIN_API_URL;
        delete process.env.SCRAPING_API_URL;
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    it('R-01_200の場合は例外を投げず解決する', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
        })) as unknown as typeof fetch);

        await expect(releaseBatchLock('instance-1')).resolves.toBeUndefined();
    });

    it('R-02_500の場合は例外を投げる', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: false,
            status: 500,
            text: async () => 'internal error',
        })) as unknown as typeof fetch);

        await expect(releaseBatchLock('instance-1')).rejects.toThrow();
    });

    it('R-03_正常系_POSTでJSONボディでリクエストする', async () => {
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () => ({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
        })) as unknown as typeof fetch);

        await releaseBatchLock('instance-1');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const urlArg = fetchSpy.mock.calls[0]?.[0] as URL;
        expect(urlArg.pathname).toBe('/internal/batch-lock/release');
        const options = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body as string) as {
            instanceId: string;
        };
        expect(body.instanceId).toBe('instance-1');
    });
});
