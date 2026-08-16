/**
 * googleCalendarGateway.test.ts - GoogleCalendarGateway ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | ケース | 操作 | 期待値 |
 * |--------|------|--------|
 * | CCR1 | checkGoogleCalendarResponse - ok=true | エラーなし |
 * | CCR2 | checkGoogleCalendarResponse - ok=false | エラーをスロー |
 * | EAT1 | ensureAccessToken - トークン未取得 | getAccessToken を呼んでキャッシュ |
 * | EAT2 | ensureAccessToken - トークン有効期限内 | キャッシュを返す |
 * | EAT3 | ensureAccessToken - PRIVATE_KEY が空 | "GOOGLE_PRIVATE_KEY is not set in environment variables" を含むエラーをスロー |
 * | FL1  | fetchCalendarDataList - 成功（items あり） | items を返す |
 * | FL2  | fetchCalendarDataList - 成功（items なし） | [] を返す |
 * | FL3  | fetchCalendarDataList - HTTP 403エラー | "Google Calendar API error: 403 Forbidden" を含むエラーをスロー |
 * | FD1  | fetchCalendarData - 成功 | イベントを返す |
 * | FD2  | fetchCalendarData - HTTP 404エラー | "Google Calendar API error: 404 Not Found" を含むエラーをスロー |
 * | UC1  | updateCalendarData - id あり・成功 | 正常終了 |
 * | UC2  | updateCalendarData - id なし | エラーをスロー |
 * | UC3  | updateCalendarData - HTTP 500エラー | "Google Calendar API error: 500 Internal Server Error" を含むエラーをスロー |
 * | IC1  | insertCalendarData - 成功（id あり） | id を返す |
 * | IC2  | insertCalendarData - 成功（id なし） | '' を返す |
 * | IC3  | insertCalendarData - HTTP 400エラー | "Google Calendar API error: 400 Bad Request" を含むエラーをスロー |
 * | EL1  | ensureEventLabels - 未登録ラベルがある | calendars.patchで不足分を登録 |
 * | EL2  | ensureEventLabels - 全ラベル登録済み | calendars.patchを呼ばない |
 * | EL3  | ensureEventLabels - 同一カレンダーへの2回目呼び出し | calendars.getを再取得しない |
 * | EL4  | insertCalendarData/updateCalendarData | URLにeventLabelVersion=1を付与 |
 * | DC1  | deleteCalendarData - 成功 | 正常終了 |
 * | DC2  | deleteCalendarData - HTTP 404エラー | "Google Calendar API error: 404 Not Found" を含むエラーをスロー |
 * | GCI1 | getCalendarId - 各 RaceType | 対応する calendar ID を返す |
 * | GCI2 | getCalendarId - 不正な calendar ID | "Invalid or empty calendarId for raceType: jra, value: invalid-calendar-id" を含むエラーをスロー |
 * | GAT1 | getAccessToken - OAuth2 が401エラー | "Failed to get access token: OAuth2 error (status 401)"（要約のみ、生の応答本文は含まない）を含むエラーをスロー（SEC-018） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { CloudFlareEnv } from '@race-schedule/core';
import {
    EnvStore,
    GOOGLE_CALENDAR_ALL_COLORS,
    RaceType,
} from '@race-schedule/core';
import type { calendar_v3 } from 'googleapis';

import { GoogleCalendarGateway } from '../../../src/gateway/implement/googleCalendarGateway';

interface MockGoogleCalendarEventLabel {
    id: string;
    name?: string;
    backgroundColor: string;
}

interface FetchCallRecord {
    url: string;
    method: string;
    body?: string;
}

// モック用定数
const MOCK_CALENDAR_IDS = {
    JRA: 'mock-jra@group.calendar.google.com',
    NAR: 'mock-nar@group.calendar.google.com',
    WORLD: 'mock-world@group.calendar.google.com',
    KEIRIN: 'mock-keirin@group.calendar.google.com',
    AUTORACE: 'mock-autorace@group.calendar.google.com',
    BOATRACE: 'mock-boatrace@group.calendar.google.com',
} as const;

// PKCS8 形式のモック秘密鍵（base64: "mockprivatekey12345" をエンコード）
// crypto.subtle.importKey をモックするため、実際には使用されない
const MOCK_PRIVATE_KEY =
    '-----BEGIN PRIVATE KEY-----\nbW9ja3ByaXZhdGVrZXkxMjM0NQ==\n-----END PRIVATE KEY-----';

/**
 * テスト用 EnvStore を設定する
 */
const setupEnv = (privateKey = MOCK_PRIVATE_KEY): void => {
    EnvStore.setEnv({
        DB: {},
        JRA_CALENDAR_ID: MOCK_CALENDAR_IDS.JRA,
        NAR_CALENDAR_ID: MOCK_CALENDAR_IDS.NAR,
        WORLD_CALENDAR_ID: MOCK_CALENDAR_IDS.WORLD,
        KEIRIN_CALENDAR_ID: MOCK_CALENDAR_IDS.KEIRIN,
        AUTORACE_CALENDAR_ID: MOCK_CALENDAR_IDS.AUTORACE,
        BOATRACE_CALENDAR_ID: MOCK_CALENDAR_IDS.BOATRACE,
        GOOGLE_CLIENT_EMAIL: 'mock@example.com',
        GOOGLE_PRIVATE_KEY: privateKey,
        R2_BUCKET: {},
    } as unknown as CloudFlareEnv);
};

/**
 * モック Response を生成する
 */
const createMockResponse = (
    body: unknown,
    status = 200,
    ok = true,
): Response => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        ok,
        status,
        json: async <T>() => body as T,
        text: async () => bodyStr,
    } as unknown as Response;
};

describe('GoogleCalendarGateway', () => {
    let gateway: GoogleCalendarGateway;
    let originalFetch: typeof globalThis.fetch;
    let importKeySpy: ReturnType<typeof spyOn>;
    let signSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        setupEnv();
        gateway = new GoogleCalendarGateway();

        // crypto.subtle をモック（実際の RSA 署名を回避）
        importKeySpy = spyOn(crypto.subtle, 'importKey').mockResolvedValue(
            {} as CryptoKey,
        );
        const mockSignature = new ArrayBuffer(32);
        signSpy = spyOn(crypto.subtle, 'sign').mockResolvedValue(mockSignature);

        // グローバル fetch をモック（デフォルト: OAuth2 トークン取得成功）
        originalFetch = globalThis.fetch;
        globalThis.fetch = (async (
            input: RequestInfo | URL,
            _init?: RequestInit,
        ) => {
            const url = input.toString();
            // OAuth2 トークン取得
            if (url === 'https://oauth2.googleapis.com/token') {
                return createMockResponse({
                    access_token: 'mock-access-token',
                });
            }
            return createMockResponse({}, 404, false);
        }) as unknown as typeof globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        importKeySpy.mockRestore();
        signSpy.mockRestore();
        EnvStore.reset();
    });

    // =========================================================================
    // ensureAccessToken（トークンキャッシュ）
    // =========================================================================
    describe('ensureAccessToken - トークンキャッシュ', () => {
        // EAT1: トークン未取得の場合、getAccessToken を呼んでキャッシュする
        it('EAT1: トークン未取得の場合、新規取得してキャッシュする', async () => {
            let fetchCallCount = 0;
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    fetchCallCount++;
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                // Calendar API
                return createMockResponse({ items: [] });
            }) as unknown as typeof globalThis.fetch;

            const startDate = new Date('2025-01-01T00:00:00Z');
            const finishDate = new Date('2025-01-31T23:59:59Z');

            // 1回目の呼び出し
            await gateway.fetchCalendarDataList(
                RaceType.JRA,
                startDate,
                finishDate,
            );
            // 2回目の呼び出し（キャッシュヒット）
            await gateway.fetchCalendarDataList(
                RaceType.JRA,
                startDate,
                finishDate,
            );

            // OAuth2 トークン取得は1回だけ（2回目はキャッシュ）
            expect(fetchCallCount).toBe(1);
        });

        // EAT3: GOOGLE_PRIVATE_KEY が空文字の場合はエラーをスロー
        it('EAT3: GOOGLE_PRIVATE_KEY が空文字の場合は具体的なエラーメッセージをスロー', async () => {
            setupEnv('');
            const gw = new GoogleCalendarGateway();

            await expect(
                gw.fetchCalendarDataList(
                    RaceType.JRA,
                    new Date('2025-01-01'),
                    new Date('2025-01-31'),
                ),
            ).rejects.toThrow(
                'GOOGLE_PRIVATE_KEY is not set in environment variables',
            );
        });
    });

    // =========================================================================
    // fetchCalendarDataList
    // =========================================================================
    describe('fetchCalendarDataList', () => {
        const startDate = new Date('2025-01-01T00:00:00Z');
        const finishDate = new Date('2025-01-31T23:59:59Z');

        // FL1: 成功（items あり）
        it('FL1: 成功時に items を返す', async () => {
            const mockEvents: calendar_v3.Schema$Event[] = [
                { id: 'event-1', summary: '有馬記念' },
                { id: 'event-2', summary: '天皇賞' },
            ];
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse({ items: mockEvents });
            }) as unknown as typeof globalThis.fetch;

            const result = await gateway.fetchCalendarDataList(
                RaceType.JRA,
                startDate,
                finishDate,
            );
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 'event-1' });
        });

        // FL2: 成功（items なし → [] を返す）
        it('FL2: items が undefined の場合は空配列を返す', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse({});
            }) as unknown as typeof globalThis.fetch;

            const result = await gateway.fetchCalendarDataList(
                RaceType.NAR,
                startDate,
                finishDate,
            );
            expect(result).toEqual([]);
        });

        // FL3: HTTP エラー（checkGoogleCalendarResponse がエラーをスロー）
        it('FL3: Calendar API が403エラーを返すとGoogle Calendar API error: 403を含むエラーをスロー', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse('Forbidden', 403, false);
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.fetchCalendarDataList(
                    RaceType.KEIRIN,
                    startDate,
                    finishDate,
                ),
            ).rejects.toThrow('Google Calendar API error: 403 Forbidden');
        });
    });

    // =========================================================================
    // fetchCalendarData
    // =========================================================================
    describe('fetchCalendarData', () => {
        // FD1: 成功
        it('FD1: 成功時にイベントを返す', async () => {
            const mockEvent: calendar_v3.Schema$Event = {
                id: 'event-1',
                summary: '有馬記念',
            };
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse(mockEvent);
            }) as unknown as typeof globalThis.fetch;

            const result = await gateway.fetchCalendarData(
                RaceType.JRA,
                'event-1',
            );
            expect(result).toMatchObject({ id: 'event-1' });
        });

        // FD2: HTTP エラー
        it('FD2: Calendar API が404エラーを返すとGoogle Calendar API error: 404を含むエラーをスロー', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse('Not Found', 404, false);
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.fetchCalendarData(RaceType.NAR, 'non-existent'),
            ).rejects.toThrow('Google Calendar API error: 404 Not Found');
        });
    });

    // =========================================================================
    // updateCalendarData
    // =========================================================================
    describe('updateCalendarData', () => {
        // UC1: id あり・成功
        it('UC1: id があり成功する場合は正常終了', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse({});
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.updateCalendarData(RaceType.JRA, {
                    id: 'event-1',
                    summary: '有馬記念',
                }),
            ).resolves.toBeUndefined();
        });

        // UC2: id なし → エラー
        it('UC2: id がない場合はエラーをスロー', async () => {
            await expect(
                gateway.updateCalendarData(RaceType.JRA, { summary: 'test' }),
            ).rejects.toThrow('eventId (id) is required for update');
        });

        // UC3: HTTP エラー
        it('UC3: Calendar API が500エラーを返すとGoogle Calendar API error: 500を含むエラーをスロー', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse('Internal Server Error', 500, false);
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.updateCalendarData(RaceType.OVERSEAS, {
                    id: 'event-1',
                }),
            ).rejects.toThrow(
                'Google Calendar API error: 500 Internal Server Error',
            );
        });
    });

    // =========================================================================
    // insertCalendarData
    // =========================================================================
    describe('insertCalendarData', () => {
        // IC1: 成功（id あり）
        it('IC1: 成功時に作成されたイベントの id を返す', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse({ id: 'new-event-id' });
            }) as unknown as typeof globalThis.fetch;

            const result = await gateway.insertCalendarData(RaceType.JRA, {
                summary: '有馬記念',
            });
            expect(result).toBe('new-event-id');
        });

        // IC2: 成功（id なし → '' を返す）
        it('IC2: 作成されたイベントに id がない場合は空文字を返す', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse({});
            }) as unknown as typeof globalThis.fetch;

            const result = await gateway.insertCalendarData(RaceType.NAR, {
                summary: 'テスト',
            });
            expect(result).toBe('');
        });

        // IC3: HTTP エラー
        it('IC3: Calendar API が400エラーを返すとGoogle Calendar API error: 400を含むエラーをスロー', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse('Bad Request', 400, false);
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.insertCalendarData(RaceType.KEIRIN, {
                    summary: 'test',
                }),
            ).rejects.toThrow('Google Calendar API error: 400 Bad Request');
        });
    });

    // =========================================================================
    // ensureEventLabels（Event Labels 自動登録・insert/update 経由でテスト）
    // =========================================================================
    describe('ensureEventLabels - イベントラベル自動登録', () => {
        const calendarDetailUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(MOCK_CALENDAR_IDS.JRA)}`;

        const mockFetchRecording = (
            calls: FetchCallRecord[],
            existingLabels: MockGoogleCalendarEventLabel[],
        ): typeof globalThis.fetch =>
            (async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = input.toString();
                const method = init?.method ?? 'GET';
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                calls.push({
                    url,
                    method,
                    body:
                        typeof init?.body === 'string' ? init.body : undefined,
                });

                if (url === calendarDetailUrl && method === 'GET') {
                    return createMockResponse({
                        labelProperties: { eventLabels: existingLabels },
                    });
                }
                if (url === calendarDetailUrl && method === 'PATCH') {
                    return createMockResponse({});
                }
                return createMockResponse({ id: 'new-event-id' });
            }) as unknown as typeof globalThis.fetch;

        // EL1: 未登録ラベルがある場合は calendars.patch で不足分を登録する
        it('EL1: 未登録ラベルがある場合はcalendars.patchで不足分を登録する', async () => {
            const calls: FetchCallRecord[] = [];
            const existingLabels: MockGoogleCalendarEventLabel[] = [
                {
                    id: 'existing-label-id',
                    name: 'Existing',
                    backgroundColor: '#000000',
                },
            ];
            globalThis.fetch = mockFetchRecording(calls, existingLabels);

            await gateway.insertCalendarData(RaceType.JRA, {
                summary: 'test',
            });

            const patchCall = calls.find(
                (c) => c.url === calendarDetailUrl && c.method === 'PATCH',
            );
            expect(patchCall).toBeTruthy();
            const patchBody = JSON.parse(patchCall?.body ?? '{}') as {
                labelProperties: {
                    eventLabels: MockGoogleCalendarEventLabel[];
                };
            };
            // 既存の1件 + 未登録分（GOOGLE_CALENDAR_ALL_COLORS 全件）
            expect(patchBody.labelProperties.eventLabels).toHaveLength(
                1 + GOOGLE_CALENDAR_ALL_COLORS.length,
            );
            expect(
                patchBody.labelProperties.eventLabels.some(
                    (label) => label.id === 'existing-label-id',
                ),
            ).toBe(true);
        });

        // EL2: 全ラベルが登録済みの場合は calendars.patch を呼ばない
        it('EL2: 全ラベルが登録済みの場合はcalendars.patchを呼ばない', async () => {
            const calls: FetchCallRecord[] = [];
            const existingLabels: MockGoogleCalendarEventLabel[] =
                GOOGLE_CALENDAR_ALL_COLORS.map((color) => ({
                    id: color.labelId,
                    name: color.labelName,
                    backgroundColor: color.backgroundColor,
                }));
            globalThis.fetch = mockFetchRecording(calls, existingLabels);

            await gateway.insertCalendarData(RaceType.JRA, {
                summary: 'test',
            });

            const patchCall = calls.find((c) => c.method === 'PATCH');
            expect(patchCall).toBeUndefined();
        });

        // EL3: 同一カレンダーへの2回目の呼び出しでは calendars.get を再取得しない
        it('EL3: 同一カレンダーへの2回目の呼び出しはcalendars.getを呼ばない', async () => {
            const calls: FetchCallRecord[] = [];
            globalThis.fetch = mockFetchRecording(calls, []);

            await gateway.insertCalendarData(RaceType.JRA, { summary: 'A' });
            await gateway.insertCalendarData(RaceType.JRA, { summary: 'B' });

            const getCalls = calls.filter(
                (c) => c.url === calendarDetailUrl && c.method === 'GET',
            );
            expect(getCalls).toHaveLength(1);
        });

        // EL4: insertCalendarData/updateCalendarData のURLに eventLabelVersion=1 を付与する
        it('EL4: insert/updateのURLにeventLabelVersion=1を付与する', async () => {
            const calls: FetchCallRecord[] = [];
            globalThis.fetch = mockFetchRecording(calls, []);

            await gateway.insertCalendarData(RaceType.JRA, { summary: 'A' });
            await gateway.updateCalendarData(RaceType.JRA, {
                id: 'event-1',
                summary: 'B',
            });

            const eventCalls = calls.filter((c) => c.url.includes('/events'));
            expect(eventCalls).toHaveLength(2);
            expect(
                eventCalls.every((c) => c.url.includes('eventLabelVersion=1')),
            ).toBe(true);
        });
    });

    // =========================================================================
    // deleteCalendarData
    // =========================================================================
    describe('deleteCalendarData', () => {
        // DC1: 成功
        it('DC1: 成功する場合は正常終了', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse({});
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.deleteCalendarData(RaceType.JRA, 'event-1'),
            ).resolves.toBeUndefined();
        });

        // DC2: HTTP エラー
        it('DC2: Calendar API が404エラーを返すとGoogle Calendar API error: 404を含むエラーをスロー', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse({
                        access_token: 'mock-access-token',
                    });
                }
                return createMockResponse('Not Found', 404, false);
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.deleteCalendarData(RaceType.AUTORACE, 'event-1'),
            ).rejects.toThrow('Google Calendar API error: 404 Not Found');
        });
    });

    // =========================================================================
    // getCalendarId（private メソッド - fetchCalendarDataList 経由でテスト）
    // =========================================================================
    describe('getCalendarId - RaceType マッピング', () => {
        const startDate = new Date('2025-01-01T00:00:00Z');
        const finishDate = new Date('2025-01-31T23:59:59Z');

        // 各 RaceType に対応する URL が呼ばれることを確認
        it.each([
            [RaceType.JRA, MOCK_CALENDAR_IDS.JRA],
            [RaceType.NAR, MOCK_CALENDAR_IDS.NAR],
            [RaceType.OVERSEAS, MOCK_CALENDAR_IDS.WORLD],
            [RaceType.KEIRIN, MOCK_CALENDAR_IDS.KEIRIN],
            [RaceType.AUTORACE, MOCK_CALENDAR_IDS.AUTORACE],
            [RaceType.BOATRACE, MOCK_CALENDAR_IDS.BOATRACE],
        ] as const)(
            'GCI1: RaceType.%s → %s を使う',
            async (raceType, expectedCalendarId) => {
                let calledUrl = '';
                globalThis.fetch = (async (
                    input: RequestInfo | URL,
                    _init?: RequestInit,
                ) => {
                    const url = input.toString();
                    if (url === 'https://oauth2.googleapis.com/token') {
                        return createMockResponse({
                            access_token: 'mock-access-token',
                        });
                    }
                    calledUrl = url;
                    return createMockResponse({ items: [] });
                }) as unknown as typeof globalThis.fetch;

                const gw = new GoogleCalendarGateway();
                await gw.fetchCalendarDataList(raceType, startDate, finishDate);
                expect(calledUrl).toContain(
                    encodeURIComponent(expectedCalendarId),
                );
            },
        );

        // GCI2: 不正な calendar ID（@group.calendar.google.com を含まない）の場合はエラー
        it('GCI2: 不正な calendar ID の場合は具体的なエラーメッセージをスロー', async () => {
            EnvStore.setEnv({
                DB: {},
                JRA_CALENDAR_ID: 'invalid-calendar-id', // @group.calendar.google.com なし
                NAR_CALENDAR_ID: MOCK_CALENDAR_IDS.NAR,
                WORLD_CALENDAR_ID: MOCK_CALENDAR_IDS.WORLD,
                KEIRIN_CALENDAR_ID: MOCK_CALENDAR_IDS.KEIRIN,
                AUTORACE_CALENDAR_ID: MOCK_CALENDAR_IDS.AUTORACE,
                BOATRACE_CALENDAR_ID: MOCK_CALENDAR_IDS.BOATRACE,
                GOOGLE_CLIENT_EMAIL: 'mock@example.com',
                GOOGLE_PRIVATE_KEY: MOCK_PRIVATE_KEY,
                R2_BUCKET: {},
            } as unknown as CloudFlareEnv);
            const gw = new GoogleCalendarGateway();

            await expect(
                gw.fetchCalendarDataList(RaceType.JRA, startDate, finishDate),
            ).rejects.toThrow(
                'Invalid or empty calendarId for raceType: jra, value: invalid-calendar-id',
            );
        });
    });

    // =========================================================================
    // OAuth2 トークン取得エラー（getAccessToken）
    // =========================================================================
    describe('getAccessToken - OAuth2 エラー', () => {
        it('GAT1: OAuth2 が401エラーを返すと要約したエラー（生の応答本文は含まない）をスロー（SEC-018）', async () => {
            globalThis.fetch = (async (
                input: RequestInfo | URL,
                _init?: RequestInit,
            ) => {
                const url = input.toString();
                if (url === 'https://oauth2.googleapis.com/token') {
                    return createMockResponse('Unauthorized', 401, false);
                }
                return createMockResponse({});
            }) as unknown as typeof globalThis.fetch;

            await expect(
                gateway.fetchCalendarDataList(
                    RaceType.JRA,
                    new Date('2025-01-01'),
                    new Date('2025-01-31'),
                ),
            ).rejects.toThrow(
                'Failed to get access token: OAuth2 error (status 401)',
            );
        });
    });
});
