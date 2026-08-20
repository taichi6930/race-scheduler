/**
 * MainApiGateway テスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件 | 期待される動作 | Coverage |
 *----|---------|------|----------------|----------|
 * | 1 | fetchFeatureFlagList | 正常系 | GET /internal/feature-flags を叩き、flags[]を返す | Line |
 * | 2 | updateFeatureFlag | 正常系 | POST /internal/feature-flags に key/enabled を渡し、flags[]を返す | Line |
 * | 3 | fetchFeatureFlagList | fetchWithTimeoutが非2xxレスポンスで失敗 | エラーが呼び出し元へ伝播する | Branch |
 * | 4 | fetchFeatureFlagList | SERVICE_AUTH_TOKEN設定済み | X-Service-Auth-Tokenヘッダが付与される | Line |
 * | 5 | backfillPlace | 正常系 | POST /internal/backfill/place をfilterのbodyで叩き結果を返す | Line |
 * | 6 | backfillRace | 正常系 | POST /internal/backfill/race をfilterのbodyで叩き結果を返す | Line |
 * | 7 | fetchUiLayout | 正常系 | GET /internal/ui-layout?raceType=keirin を叩きconfigを返す | Line |
 * | 8 | saveUiLayout | 正常系 | POST /internal/ui-layout にraceType/configを渡し保存後のconfigを返す | Line |
 * | 9 | previewUiLayout | 正常系 | POST /internal/ui-layout/preview にconfig/raceIdを渡し解決結果を返す | Line |
 * | 10 | previewUiLayout | fetchWithTimeoutが404で失敗 | undefinedを返す（例外を投げない） | Branch |
 * | 11 | previewUiLayout | fetchWithTimeoutが404以外で失敗 | エラーが呼び出し元へ伝播する | Branch |
 * | 12 | fetchUpcomingKeirinRaces | 正常系 | GET /raceをstartDate/finishDate/raceTypeList=keirinで叩きraces[]を返す | Line |
 * | 13 | fetchReleaseNotes | 正常系 | GET /internal/release-notes を叩きリリースノート配列を返す | Line |
 * | 14 | issueInvite | 正常系 | POST /auth/invite にmemoを渡し発行結果を返す | Line |
 * | 15 | fetchParticipants | 正常系 | GET /auth/participants を叩きparticipants[]を返す | Line |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
    type RaceDetailUiConfig,
    RaceType,
    type ReleaseNote,
} from '@race-schedule/core';

import type { BackfillFilter } from '../../../../src/dto/backfillResult';
import type { FeatureFlagStatus } from '../../../../src/dto/featureFlagStatus';
import type { ParticipantSummary } from '../../../../src/dto/participant';
import type { RaceSummary } from '../../../../src/dto/raceSummary';
import { MainApiGateway } from '../../../../src/gateway/implement/mainApiGateway';

const SAMPLE_FLAG: FeatureFlagStatus = {
    key: 'announcement_banner',
    label: 'A',
    storedEnabled: true,
    envDefault: false,
    effectiveEnabled: true,
    updatedAt: '2026-08-07T00:00:00.000Z',
};

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

    it('#1: fetchFeatureFlagListはGET /internal/feature-flagsを叩きflags[]を返す', async () => {
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        flags: [SAMPLE_FLAG],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.fetchFeatureFlagList();

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/feature-flags');
        expect(result).toEqual([SAMPLE_FLAG]);
    });

    it('#2: updateFeatureFlagはPOST /internal/feature-flagsへkey/enabledを渡しflags[]を返す', async () => {
        let capturedUrl: string | undefined;
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedInit = init;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        flags: [SAMPLE_FLAG],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.updateFeatureFlag(
            'announcement_banner',
            true,
        );

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/feature-flags');
        expect(capturedInit?.method).toBe('POST');
        expect(capturedInit?.body).toBe(
            JSON.stringify({ key: 'announcement_banner', enabled: true }),
        );
        expect(result).toEqual([SAMPLE_FLAG]);
    });

    it('#3: fetchFeatureFlagListはfetchWithTimeoutが非2xxレスポンスで失敗したときエラーを伝播する', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response('Internal Server Error', { status: 500 }),
            ),
        ) as unknown as typeof fetch;

        await expect(gateway.fetchFeatureFlagList()).rejects.toThrow(/500/);
    });

    it('#4: fetchFeatureFlagListはSERVICE_AUTH_TOKEN設定済みならX-Service-Auth-Tokenヘッダを付与する', async () => {
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((_url: string, init?: RequestInit) => {
            capturedInit = init;
            return Promise.resolve(
                new Response(JSON.stringify({ flags: [] }), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        await gateway.fetchFeatureFlagList();

        const headers = capturedInit?.headers as Record<string, string>;
        expect(headers['X-Service-Auth-Token']).toBe('test-service-auth-token');
    });

    it('#5: backfillPlaceはPOST /internal/backfill/placeをfilterのbodyで叩き結果を返す', async () => {
        const filter: BackfillFilter = {
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: ['keirin'],
        };
        let capturedUrl: string | undefined;
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedInit = init;
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

        const result = await gateway.backfillPlace(filter);

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/backfill/place');
        expect(capturedInit?.method).toBe('POST');
        expect(capturedInit?.body).toBe(JSON.stringify(filter));
        expect(result.successCount).toBe(1);
    });

    it('#6: backfillRaceはPOST /internal/backfill/raceをfilterのbodyで叩き結果を返す', async () => {
        const filter: BackfillFilter = {
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: ['keirin'],
        };
        let capturedUrl: string | undefined;
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedInit = init;
            return Promise.resolve(
                new Response(
                    JSON.stringify({
                        successCount: 0,
                        failureCount: 0,
                        failures: [],
                        notCachedPlaceIds: [],
                    }),
                    { status: 200 },
                ),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.backfillRace(filter);

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/backfill/race');
        expect(capturedInit?.method).toBe('POST');
        expect(capturedInit?.body).toBe(JSON.stringify(filter));
        expect(result.notCachedPlaceIds).toEqual([]);
    });

    it('#7: fetchUiLayoutはGET /internal/ui-layout?raceType=keirinを叩きconfigを返す', async () => {
        const config: RaceDetailUiConfig = { sections: [] };
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(JSON.stringify({ raceType: 'keirin', config }), {
                    status: 200,
                }),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.fetchUiLayout(RaceType.KEIRIN);

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/ui-layout');
        expect(url.searchParams.get('raceType')).toBe('keirin');
        expect(result).toEqual(config);
    });

    it('#8: saveUiLayoutはPOST /internal/ui-layoutにraceType/configを渡し保存後のconfigを返す', async () => {
        const config: RaceDetailUiConfig = { sections: [] };
        let capturedUrl: string | undefined;
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedInit = init;
            return Promise.resolve(
                new Response(JSON.stringify({ raceType: 'keirin', config }), {
                    status: 200,
                }),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.saveUiLayout(RaceType.KEIRIN, config);

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/ui-layout');
        expect(capturedInit?.method).toBe('POST');
        expect(capturedInit?.body).toBe(
            JSON.stringify({ raceType: 'keirin', config }),
        );
        expect(result).toEqual(config);
    });

    it('#9: previewUiLayoutはPOST /internal/ui-layout/previewにconfig/raceIdを渡し解決結果を返す', async () => {
        const config: RaceDetailUiConfig = { sections: [] };
        const preview = { schemaVersion: 1 as const, sections: [] };
        let capturedUrl: string | undefined;
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedInit = init;
            return Promise.resolve(
                new Response(JSON.stringify(preview), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.previewUiLayout(config, 'race-1');

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/ui-layout/preview');
        expect(capturedInit?.body).toBe(
            JSON.stringify({ config, raceId: 'race-1' }),
        );
        expect(result).toEqual(preview);
    });

    it('#10: previewUiLayoutはfetchWithTimeoutが404で失敗した場合undefinedを返す', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response('Not Found', { status: 404 })),
        ) as unknown as typeof fetch;

        const result = await gateway.previewUiLayout(
            { sections: [] },
            'race-1',
        );

        expect(result).toBeUndefined();
    });

    it('#11: previewUiLayoutはfetchWithTimeoutが404以外で失敗した場合エラーを伝播する', async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response('Internal Server Error', { status: 500 }),
            ),
        ) as unknown as typeof fetch;

        await expect(
            gateway.previewUiLayout({ sections: [] }, 'race-1'),
        ).rejects.toThrow(/500/);
    });

    it('#12: fetchUpcomingKeirinRacesはGET /raceをstartDate/finishDate/raceTypeList=keirinで叩きraces[]を返す', async () => {
        const race: RaceSummary = {
            raceId: 'keirin202608091',
            raceName: '開設70周年記念',
            raceCourse: '大宮',
            raceNumber: 7,
            raceGrade: 'GⅢ',
            datetime: '2026-08-09T10:00:00+09:00',
        };
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(JSON.stringify({ races: [race] }), {
                    status: 200,
                }),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.fetchUpcomingKeirinRaces(14);

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/race');
        expect(url.searchParams.get('raceTypeList')).toBe('keirin');
        expect(url.searchParams.get('startDate')).toMatch(
            /^\d{4}-\d{2}-\d{2}$/,
        );
        expect(url.searchParams.get('finishDate')).toMatch(
            /^\d{4}-\d{2}-\d{2}$/,
        );
        expect(result).toEqual([race]);
    });

    it('#13: fetchReleaseNotesはGET /internal/release-notesを叩きリリースノート配列を返す', async () => {
        const note: ReleaseNote = {
            tag_name: 'v1.0.0',
            name: 'v1.0.0',
            body: '本文',
            published_at: '2026-08-16T00:00:00Z',
            draft: false,
            prerelease: false,
            source_repo: 'race-schedule',
        };
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(JSON.stringify([note]), { status: 200 }),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.fetchReleaseNotes();

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/internal/release-notes');
        expect(result).toEqual([note]);
    });

    it('#14: issueInviteはPOST /auth/inviteにmemoを渡し発行結果を返す', async () => {
        let capturedUrl: string | undefined;
        let capturedInit: RequestInit | undefined;
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedInit = init;
            return Promise.resolve(
                new Response(JSON.stringify({ token: 'invite-token' }), {
                    status: 201,
                }),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.issueInvite('テストメモ');

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/auth/invite');
        expect(capturedInit?.method).toBe('POST');
        expect(capturedInit?.body).toBe(JSON.stringify({ memo: 'テストメモ' }));
        expect(result).toEqual({ token: 'invite-token' });
    });

    it('#15: fetchParticipantsはGET /auth/participantsを叩きparticipants[]を返す', async () => {
        const participant: ParticipantSummary = {
            userId: 'user-1',
            nickname: 'にっくねーむ',
            inviteMemo: 'メモ',
            credentialId: 'credential-1',
            deviceLabel: 'iPhone',
            lastUsedAt: '2026-08-19T00:00:00.000Z',
            userCreatedAt: '2026-08-01T00:00:00.000Z',
        };
        let capturedUrl: string | undefined;
        globalThis.fetch = mock((url: string) => {
            capturedUrl = url;
            return Promise.resolve(
                new Response(JSON.stringify({ participants: [participant] }), {
                    status: 200,
                }),
            );
        }) as unknown as typeof fetch;

        const result = await gateway.fetchParticipants();

        const url = new URL(capturedUrl ?? '');
        expect(url.pathname).toBe('/auth/participants');
        expect(result).toEqual([participant]);
    });
});
