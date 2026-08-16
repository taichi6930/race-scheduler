/**
 * MainApiGateway テスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件 | 期待される動作 | Coverage |
 *----|---------|------|----------------|----------|
 * | 1 | fetchRaceList | 正常系 | GET /race を叩き、RaceEntity[]を返す | Line |
 * | 2 | fetchRaceList | クエリパラメータ | startDate/finishDate/raceTypeListが正しく渡る | Line |
 * | 3 | fetchCalendarFlagList | 正常系 | GET /calendar/flag を叩き、CalendarFlagEntity[]を返す | Line |
 * | 4 | fetchRaceList | fetchWithTimeoutが非2xxレスポンスで失敗 | エラーが呼び出し元へ伝播する | Branch |
 * | 5 | fetchRaceList | fetchがネットワークエラーでreject | エラーが呼び出し元へ伝播する | Branch |
 * | 6 | fetchRaceList | レスポンスのracesに不正なdatetimeを含む | validateRaceEntityがthrowし例外が伝播する | Branch |
 * | 7 | fetchCalendarFlagList | レスポンスのflagsに不正なraceIdを含む | validateCalendarFlagEntityがthrowし例外が伝播する | Branch |
 * | 8 | fetchRaceList | SERVICE_AUTH_TOKEN設定済み | X-Service-Auth-Tokenヘッダが付与される | Line |
 * | 9 | fetchCalendarFlagList | SERVICE_AUTH_TOKEN設定済み | X-Service-Auth-Tokenヘッダが付与される | Line |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { RaceFactory } from '../../../../../tests/shared/factories';
import { MainApiGateway } from '../../../src/gateway/implement/mainApiGateway';

describe('MainApiGateway', () => {
    const originalFetch = globalThis.fetch;
    let gateway: MainApiGateway;

    beforeEach(() => {
        process.env.MAIN_API_URL = 'https://api.example.com';
        gateway = new MainApiGateway();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        delete process.env.MAIN_API_URL;
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    it('#1/#2: fetchRaceList はGET /race を正しいクエリで叩きRaceEntity[]を返す', async () => {
        const race = RaceFactory.create();
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        races: [
                            {
                                ...race,
                                datetime: race.datetime.toISOString(),
                            },
                        ],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.fetchRaceList({
            startDate: new Date('2026-01-01T00:00:00+09:00'),
            finishDate: new Date('2026-01-31T00:00:00+09:00'),
            raceTypeList: [RaceType.JRA],
        });

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/race');
        expect(url.searchParams.get('raceTypeList')).toBe('jra');
        expect(result).toHaveLength(1);
        expect(result[0].raceId).toBe(race.raceId);
        expect(result[0].datetime).toBeInstanceOf(Date);
    });

    it('#3: fetchCalendarFlagList はGET /calendar/flag を叩きCalendarFlagEntity[]を返す', async () => {
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        flags: [{ raceId: 'jra202601270501', label: 'メモ' }],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.fetchCalendarFlagList();

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/calendar/flag');
        expect(result).toHaveLength(1);
        expect(String(result[0].raceId)).toBe('jra202601270501');
        expect(result[0].label).toBe('メモ');
    });

    it('#4: fetchRaceListはfetchWithTimeoutが非2xxレスポンスで失敗したときエラーを伝播する', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response('Internal Server Error', { status: 500 }),
            ),
        ) as unknown as typeof fetch;

        await expect(
            gateway.fetchRaceList({
                startDate: new Date('2026-01-01T00:00:00+09:00'),
                finishDate: new Date('2026-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
            }),
        ).rejects.toThrow(/500/);
    });

    it('#5: fetchRaceListはfetchがネットワークエラーでrejectしたときエラーを伝播する', async () => {
        globalThis.fetch = mock(() =>
            Promise.reject(new Error('network error')),
        ) as unknown as typeof fetch;

        await expect(
            gateway.fetchRaceList({
                startDate: new Date('2026-01-01T00:00:00+09:00'),
                finishDate: new Date('2026-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
            }),
        ).rejects.toThrow('network error');
    });

    it('#6: fetchRaceListはレスポンスのracesに不正なdatetimeを含むときvalidateRaceEntityがthrowし伝播する', async () => {
        const race = RaceFactory.create();
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        races: [
                            {
                                ...race,
                                datetime: 'not-a-valid-datetime',
                            },
                        ],
                    }),
                    { status: 200 },
                ),
            ),
        ) as unknown as typeof fetch;

        await expect(
            gateway.fetchRaceList({
                startDate: new Date('2026-01-01T00:00:00+09:00'),
                finishDate: new Date('2026-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
            }),
        ).rejects.toThrow();
    });

    it('#7: fetchCalendarFlagListはレスポンスのflagsに不正なraceIdを含むときvalidateCalendarFlagEntityがthrowし伝播する', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        flags: [{ raceId: '不正なraceId', label: 'メモ' }],
                    }),
                    { status: 200 },
                ),
            ),
        ) as unknown as typeof fetch;

        await expect(gateway.fetchCalendarFlagList()).rejects.toThrow();
    });

    it('#8: fetchRaceListはSERVICE_AUTH_TOKEN設定済みならX-Service-Auth-Tokenヘッダを付与する', async () => {
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((_url: string, init?: RequestInit) => {
            capturedInit = init;
            return Promise.resolve(
                new Response(JSON.stringify({ races: [] }), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        await gateway.fetchRaceList({
            startDate: new Date('2026-01-01T00:00:00+09:00'),
            finishDate: new Date('2026-01-31T00:00:00+09:00'),
            raceTypeList: [RaceType.JRA],
        });

        const headers = capturedInit?.headers as Record<string, string>;
        expect(headers['X-Service-Auth-Token']).toBe('test-service-auth-token');
    });

    it('#9: fetchCalendarFlagListはSERVICE_AUTH_TOKEN設定済みならX-Service-Auth-Tokenヘッダを付与する', async () => {
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((_url: string, init?: RequestInit) => {
            capturedInit = init;
            return Promise.resolve(
                new Response(JSON.stringify({ flags: [] }), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        await gateway.fetchCalendarFlagList();

        const headers = capturedInit?.headers as Record<string, string>;
        expect(headers['X-Service-Auth-Token']).toBe('test-service-auth-token');
    });
});
