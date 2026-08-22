/**
 * fetchWithTimeout ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | Function         | fetch 返却           | options             | Expected                              | Coverage |
 * |------|------------------|----------------------|---------------------|---------------------------------------|----------|
 * | H-01 | fetchWithTimeout | 200 OK + JSON        | なし                | JSON をパースして返す                 | Line     |
 * | H-02 | fetchWithTimeout | URL オブジェクト     | なし                | パースしたJSONを返す                  | Line     |
 * | H-03 | fetchWithTimeout | 404 エラー           | なし                | Error("API ... returned 404: ...") をスロー | Branch |
 * | H-04 | fetchWithTimeout | 500 エラー           | なし                | Error をスロー（レスポンスボディを含む）| Branch  |
 * | H-05 | fetchWithTimeout | 200 OK               | POST method/body    | options が正しく fetch に渡る         | Line     |
 * | H-06 | fetchWithTimeout | 200 OK               | なし                | AbortSignal.timeout が設定される      | Line     |
 * | H-07 | fetchWithTimeout | 200 OK + スキーマ不一致 | なし             | schema.parse が ZodError をスロー     | Branch   |
 * | H-08 | fetchWithTimeout | 200 OK               | timeoutMs=明示指定  | AbortSignal.timeout が指定値で設定される（PERF-080） | Line |
 * | H-09 | fetchWithTimeout | 1回目ネットワークエラー→2回目200 OK | なし | リトライして成功しレスポンスを返す（fetch 2回） | Branch (PERF-055) |
 * | H-10 | fetchWithTimeout | 1回目500→2回目200 OK  | なし                | リトライして成功しレスポンスを返す（fetch 2回） | Branch (PERF-055) |
 * | H-11 | fetchWithTimeout | 400エラー（連続）      | なし                | リトライせず1回で失敗する（fetch 1回）  | Branch (PERF-055) |
 * | H-12 | fetchWithTimeout | 500エラーが上限まで継続 | maxRetries=2（既定） | リトライ上限到達後に失敗する（fetch 3回） | Branch (PERF-055) |
 * | H-13 | fetchWithTimeout | 200 OK               | runWithRequestIdのスコープ内 | X-Request-Idヘッダが付与される（CFARCH-09） | Branch |
 * | H-14 | fetchWithTimeout | 200 OK               | runWithRequestIdのスコープ外 | X-Request-Idヘッダが付かない（CFARCH-09）   | Branch |
 * | H-15 | fetchWithTimeout | fetchがError以外の値をthrow（連続） | なし | String()でラップしたErrorとしてリトライ後スロー | Branch |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { runWithRequestId } from '@race-schedule/core';
import { z } from 'zod';

import { fetchWithTimeout } from '../../../src/client/http';
import { FETCH_TIMEOUT_MS } from '../../../src/constants';

/** 任意の値をそのまま受け入れる検証用スキーマ */
const anySchema = z.unknown();

describe('fetchWithTimeout', () => {
    // fetch モック用の型
    interface MockResponse {
        ok: boolean;
        status: number;
        text: () => Promise<string>;
        json: () => Promise<unknown>;
    }

    let fetchSpy: ReturnType<typeof spyOn>;

    const createMockResponse = (
        overrides: Partial<MockResponse>,
    ): MockResponse => ({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({}),
        ...overrides,
    });

    beforeEach(() => {
        fetchSpy = spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it('H-01_200OKとJSONを返す_パース済みオブジェクトを返す', async () => {
        // Arrange
        const mockData = { id: 1, name: 'test' };
        fetchSpy.mockResolvedValue(
            createMockResponse({ json: async () => mockData }) as Response,
        );

        // Act
        const result = await fetchWithTimeout(
            'https://example.com/api',
            anySchema,
        );

        // Assert
        expect(result).toEqual(mockData);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('H-02_URLオブジェクトを渡す_パース済みオブジェクトを返す', async () => {
        // Arrange
        const mockData = { n: 1 };
        fetchSpy.mockResolvedValue(
            createMockResponse({ json: async () => mockData }) as Response,
        );

        // Act
        const result = await fetchWithTimeout(
            new URL('https://example.com/api'),
            anySchema,
        );

        // Assert
        expect(result).toEqual(mockData);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('H-03_404エラーを返す_ErrorをスローしURLとステータスを含む', async () => {
        // Arrange
        const url = 'https://example.com/api';
        fetchSpy.mockResolvedValue(
            createMockResponse({
                ok: false,
                status: 404,
                text: async () => 'Not Found',
            }) as Response,
        );

        // Act / Assert
        await expect(fetchWithTimeout(url, anySchema)).rejects.toThrow(
            /returned 404: Not Found/,
        );
    });

    it('H-04_500エラーを返す_ErrorをスローしレスポンスボディをError文に含む', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            }) as Response,
        );

        // Act / Assert
        await expect(
            fetchWithTimeout('https://example.com', anySchema),
        ).rejects.toThrow(/returned 500: Internal Server Error/);
    });

    it('H-05_POSTオプションを渡す_methodとbodyが正しくfetchに渡る', async () => {
        // Arrange
        const mockData = { success: true };
        fetchSpy.mockResolvedValue(
            createMockResponse({ json: async () => mockData }) as Response,
        );
        const url = 'https://example.com/api';
        const options: RequestInit & { headers?: Record<string, string> } = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'value' }),
        };

        // Act
        await fetchWithTimeout(url, anySchema, options);

        // Assert
        const calledWith = fetchSpy.mock.calls[0];
        expect(calledWith[0]).toBe(url);
        const calledOptions = calledWith[1] as RequestInit & {
            signal: AbortSignal;
        };
        expect(calledOptions.method).toBe('POST');
        expect(calledOptions.body).toBe(JSON.stringify({ key: 'value' }));
    });

    it('H-06_シグナルなしで呼び出す_AbortSignalTimeoutがFETCH_TIMEOUT_MSで設定される', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({ json: async () => ({}) }) as Response,
        );
        const timeoutSpy = spyOn(AbortSignal, 'timeout');

        // Act
        await fetchWithTimeout('https://example.com/api', anySchema);

        // Assert
        expect(timeoutSpy).toHaveBeenCalledWith(FETCH_TIMEOUT_MS);
        timeoutSpy.mockRestore();
    });

    it('H-13_runWithRequestIdのスコープ内_X-Request-Idヘッダが付与される', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({ json: async () => ({}) }) as Response,
        );

        // Act
        await runWithRequestId('req-abc', () =>
            fetchWithTimeout('https://example.com/api', anySchema, {
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        // Assert
        const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit;
        expect(calledOptions.headers).toEqual({
            'Content-Type': 'application/json',
            'X-Request-Id': 'req-abc',
        });
    });

    it('H-14_runWithRequestIdのスコープ外_X-Request-Idヘッダが付かない', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({ json: async () => ({}) }) as Response,
        );

        // Act
        await fetchWithTimeout('https://example.com/api', anySchema, {
            headers: { 'Content-Type': 'application/json' },
        });

        // Assert
        const calledOptions = fetchSpy.mock.calls[0][1] as RequestInit;
        expect(calledOptions.headers).toEqual({
            'Content-Type': 'application/json',
        });
    });

    it('H-07_スキーマ検証に失敗するレスポンス_ZodErrorをスローする', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({
                json: async () => ({ n: 'not-a-number' }),
            }) as Response,
        );
        const strictSchema = z.object({ n: z.number() });

        // Act / Assert
        await expect(
            fetchWithTimeout('https://example.com/api', strictSchema),
        ).rejects.toThrow();
    });

    it('H-08_timeoutMsを明示的に渡す_AbortSignalTimeoutが指定値で設定される', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({ json: async () => ({}) }) as Response,
        );
        const timeoutSpy = spyOn(AbortSignal, 'timeout');
        const explicitTimeoutMs = 30_000;

        // Act
        await fetchWithTimeout(
            'https://example.com/api',
            anySchema,
            undefined,
            explicitTimeoutMs,
        );

        // Assert: デフォルト（FETCH_TIMEOUT_MS）ではなく明示指定値が使われること
        expect(timeoutSpy).toHaveBeenCalledWith(explicitTimeoutMs);
        expect(timeoutSpy).not.toHaveBeenCalledWith(FETCH_TIMEOUT_MS);
        timeoutSpy.mockRestore();
    });

    it('H-09_1回目ネットワークエラー2回目200OK_リトライして成功しレスポンスを返す', async () => {
        // Arrange
        const mockData = { retried: true };
        fetchSpy
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce(
                createMockResponse({ json: async () => mockData }) as Response,
            );

        // Act
        const result = await fetchWithTimeout(
            'https://example.com/api',
            anySchema,
        );

        // Assert
        expect(result).toEqual(mockData);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('H-10_1回目500エラー2回目200OK_リトライして成功しレスポンスを返す', async () => {
        // Arrange
        const mockData = { retried: true };
        fetchSpy
            .mockResolvedValueOnce(
                createMockResponse({
                    ok: false,
                    status: 500,
                    text: async () => 'Internal Server Error',
                }) as Response,
            )
            .mockResolvedValueOnce(
                createMockResponse({ json: async () => mockData }) as Response,
            );

        // Act
        const result = await fetchWithTimeout(
            'https://example.com/api',
            anySchema,
        );

        // Assert
        expect(result).toEqual(mockData);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('H-11_400エラーが連続する_リトライせず1回で失敗する', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({
                ok: false,
                status: 400,
                text: async () => 'Bad Request',
            }) as Response,
        );

        // Act / Assert
        await expect(
            fetchWithTimeout('https://example.com/api', anySchema),
        ).rejects.toThrow(/returned 400: Bad Request/);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('H-12_500エラーが上限まで継続する_リトライ上限到達後に失敗する', async () => {
        // Arrange
        fetchSpy.mockResolvedValue(
            createMockResponse({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            }) as Response,
        );

        // Act / Assert: デフォルトの maxRetries=2 のため計3回試行して失敗する
        await expect(
            fetchWithTimeout('https://example.com/api', anySchema),
        ).rejects.toThrow(/returned 500: Internal Server Error/);
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('H-15_fetchがError以外の値をthrowし続ける_StringでラップしたErrorとしてリトライ後スローする', async () => {
        // Arrange: Errorインスタンスではない値（文字列）をfetchがthrowするケース
        // （instanceof Errorがfalseとなる分岐を通し、String(error)でラップされることを確認）
        fetchSpy.mockRejectedValue('network failure string');

        // Act / Assert: デフォルトの maxRetries=2 のため計3回試行して失敗する
        await expect(
            fetchWithTimeout('https://example.com/api', anySchema),
        ).rejects.toThrow('network failure string');
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
});
