/**
 * ScrapingApiGateway テスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件 | 期待される動作 | Coverage |
 * |----|---------|------|----------------|----------|
 * | 1  | syncPlace | 正常系 | POST /sync/place を叩き cacheOnly:true を含むボディを送信、結果を返す | Line |
 * | 2  | syncRace | 件数が閾値(500件)以下 | POSTは1回のみ | Branch |
 * | 3  | syncRace | 件数が閾値(500件)を超過 | 複数回に分割してPOSTし、結果（notCachedPlaceIds含む）を集計する | Branch |
 * | 4  | syncPlace / syncRace | SERVICE_AUTH_TOKEN設定済み | X-Service-Auth-Tokenヘッダが付与される | Line |
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { ScrapingApiGateway } from '../../../src/gateway/implement/scrapingApiGateway';

describe('ScrapingApiGateway', () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = process.env.SCRAPING_API_URL;
    let gateway: ScrapingApiGateway;

    beforeEach(() => {
        process.env.SCRAPING_API_URL = 'https://scraping.example.com';
        gateway = new ScrapingApiGateway();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        if (originalEnv === undefined) {
            delete process.env.SCRAPING_API_URL;
        } else {
            process.env.SCRAPING_API_URL = originalEnv;
        }
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    it('#1: syncPlace はPOST /sync/place をcacheOnly:true付きで叩き結果を返す', async () => {
        let capturedUrl: string | undefined;
        let capturedBody: string | undefined;
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedBody = init?.body as string;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        successCount: 1,
                        failureCount: 0,
                        failures: [],
                        notCachedKeys: [],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.syncPlace({
            startDate: new Date('2026-01-01'),
            finishDate: new Date('2026-01-31'),
            raceTypeList: [RaceType.KEIRIN],
            cacheOnly: true,
        });

        expect(capturedUrl).toBe('https://scraping.example.com/sync/place');
        const parsedBody = JSON.parse(capturedBody ?? '{}') as {
            cacheOnly: boolean;
        };
        expect(parsedBody.cacheOnly).toBe(true);
        expect(result.successCount).toBe(1);
        expect(result.notCachedKeys).toEqual([]);
    });

    it('#2: syncRace は件数が閾値(500件)以下の場合POSTを1回のみ実行する', async () => {
        const capturedBodies: string[] = [];
        globalThis.fetch = mock((_url: string, init?: RequestInit) => {
            capturedBodies.push(init?.body as string);
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        successCount: 1,
                        failureCount: 0,
                        failures: [],
                        notCachedPlaceIds: [],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const placeIdList = Array.from(
            { length: 500 },
            (_, index) => `keirin2026010${index}`,
        );
        await gateway.syncRace({ placeIdList, cacheOnly: true });

        expect(capturedBodies.length).toBe(1);
        const parsed = JSON.parse(capturedBodies[0]) as {
            placeIdList: string[];
        };
        expect(parsed.placeIdList.length).toBe(500);
    });

    it('#3: syncRace は件数が閾値(500件)を超過した場合、複数回に分割してPOSTし結果を集計する', async () => {
        const capturedBodies: string[] = [];
        globalThis.fetch = mock((_url: string, init?: RequestInit) => {
            capturedBodies.push(init?.body as string);
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        successCount: 1,
                        failureCount: 0,
                        failures: [],
                        notCachedPlaceIds: ['keirin2026010999'],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const placeIdList = Array.from(
            { length: 750 },
            (_, index) => `keirin2026010${index}`,
        );
        const result = await gateway.syncRace({ placeIdList, cacheOnly: true });

        expect(capturedBodies.length).toBe(2);
        const firstChunk = JSON.parse(capturedBodies[0]) as {
            placeIdList: string[];
        };
        const secondChunk = JSON.parse(capturedBodies[1]) as {
            placeIdList: string[];
        };
        expect(firstChunk.placeIdList.length).toBe(500);
        expect(secondChunk.placeIdList.length).toBe(250);
        expect(result.successCount).toBe(2);
        expect(result.notCachedPlaceIds).toEqual([
            'keirin2026010999',
            'keirin2026010999',
        ]);
    });

    it('#4: syncPlace はSERVICE_AUTH_TOKEN設定済みならX-Service-Auth-Tokenヘッダを付与する', async () => {
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((_url: string, init?: RequestInit) => {
            capturedInit = init;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        successCount: 0,
                        failureCount: 0,
                        failures: [],
                        notCachedKeys: [],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        await gateway.syncPlace({
            startDate: new Date('2026-01-01'),
            finishDate: new Date('2026-01-31'),
            raceTypeList: [RaceType.KEIRIN],
            cacheOnly: true,
        });

        const headers = capturedInit?.headers as Record<string, string>;
        expect(headers['X-Service-Auth-Token']).toBe('test-service-auth-token');
    });
});
