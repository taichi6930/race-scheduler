/**
 * fetchWithTimeout ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 条件 | Input | Expected | Coverage |
 * |------|------|-------|----------|----------|
 * | 1    | 正常系 | 2xxレスポンス | パース済みJSONを返す | Line |
 * | 2    | 異常系 | 非2xxレスポンス | ステータス・本文の両方を含むErrorをスロー | Branch |
 * | 3    | 正常系 | URLオブジェクト | 文字列化して同様に動作 | Line |
 * | T-04 | 異常系 | fetchがネットワーク例外でreject | rejectをそのまま伝播 | Branch |
 * | T-05 | 異常系 | AbortSignal.timeout発火（abort） | abortエラーが伝播 | Branch |
 * | T-06 | 異常系 | 2xxだが本文が不正JSON | rejectする | Branch |
 * | T-07 | 正常系 | runWithRequestIdのスコープ内 | X-Request-Idヘッダが付与される（CFARCH-09） | Branch |
 * | T-08 | 正常系 | runWithRequestIdのスコープ外 | X-Request-Idヘッダが付かない（CFARCH-09） | Branch |
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import { fetchWithTimeout } from '../../../src/http/fetchWithTimeout';
import { runWithRequestId } from '../../../src/utilities/requestContext';

describe('fetchWithTimeout', () => {
    const originalFetch = globalThis.fetch;
    const originalAbortSignalTimeout = AbortSignal.timeout;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        AbortSignal.timeout = originalAbortSignalTimeout;
    });

    it('#1: 2xxレスポンスのときパース済みJSONを返す', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response(JSON.stringify({ ok: true }), { status: 200 }),
            ),
        ) as unknown as typeof fetch;

        const result = await fetchWithTimeout<{ ok: boolean }>(
            'https://example.com/api',
        );

        expect(result).toEqual({ ok: true });
    });

    it('#2: 非2xxレスポンスのときステータス・本文の両方を含むErrorをスローする', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response('Bad Request', { status: 400 })),
        ) as unknown as typeof fetch;

        await expect(
            fetchWithTimeout('https://example.com/api'),
        ).rejects.toThrow(
            'API https://example.com/api returned 400: Bad Request',
        );
    });

    it('#3: URLオブジェクトを渡しても文字列化して動作する', async () => {
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        await fetchWithTimeout(new URL('https://example.com/api'));

        expect(capturedUrl).toBe('https://example.com/api');
    });

    it('[T-04]: fetchがネットワーク例外でrejectした場合、そのまま例外を伝播する', async () => {
        globalThis.fetch = mock(() =>
            Promise.reject(new Error('network error')),
        ) as unknown as typeof fetch;

        await expect(
            fetchWithTimeout('https://example.com/api'),
        ).rejects.toThrow('network error');
    });

    it('[T-05]: AbortSignal.timeoutが発火(abort)した場合、abortエラーが伝播する', async () => {
        const controller = new AbortController();
        AbortSignal.timeout = mock(
            () => controller.signal,
        ) as unknown as typeof AbortSignal.timeout;

        globalThis.fetch = mock(
            (_url: string, options?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    options?.signal?.addEventListener('abort', () => {
                        reject(
                            new DOMException(
                                'The operation was aborted.',
                                'AbortError',
                            ),
                        );
                    });
                }),
        ) as unknown as typeof fetch;

        const resultPromise = fetchWithTimeout('https://example.com/api');
        controller.abort();

        await expect(resultPromise).rejects.toThrow(
            'The operation was aborted.',
        );
    });

    it('[T-06]: 2xxだが本文が不正JSONの場合、rejectする', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response('not-json', { status: 200 })),
        ) as unknown as typeof fetch;

        await expect(
            fetchWithTimeout('https://example.com/api'),
        ).rejects.toThrow();
    });

    it('[T-07]: runWithRequestIdのスコープ内ならX-Request-Idヘッダを付与する', async () => {
        let capturedHeaders: Record<string, string> | undefined;
        globalThis.fetch = mock((_url: string, options?: RequestInit) => {
            capturedHeaders = options?.headers as Record<string, string>;
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        await runWithRequestId('req-123', () =>
            fetchWithTimeout('https://example.com/api', {
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        expect(capturedHeaders).toEqual({
            'Content-Type': 'application/json',
            'X-Request-Id': 'req-123',
        });
    });

    it('[T-08]: runWithRequestIdのスコープ外ならX-Request-Idヘッダを付けない', async () => {
        let capturedHeaders: Record<string, string> | undefined;
        globalThis.fetch = mock((_url: string, options?: RequestInit) => {
            capturedHeaders = options?.headers as Record<string, string>;
            return Promise.resolve(
                new Response(JSON.stringify({ ok: true }), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        await fetchWithTimeout('https://example.com/api', {
            headers: { 'Content-Type': 'application/json' },
        });

        expect(capturedHeaders).toEqual({
            'Content-Type': 'application/json',
        });
    });
});
