/**
 * calendar.sync.controller.usecase.repository.component.test.ts
 *
 * @spec SPEC-API-001
 *
 * CS-1 ~ CS-5: POST /sync エンドポイントのコンポーネントテスト
 *
 * 保護対象ルート（POST /sync）を正しい X-Service-Auth-Token 付きで呼ぶと
 * router → controller → usecase → repository → gateway の実配線まで到達し
 * 正常応答が返ること（SPEC-API-001の受け入れ基準「保護対象ルートを正しい
 * トークン付きで呼ぶと処理が実行される」）をComponent層で検証する。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase(CalendarSyncUsecase) →
 *   Repository(MainApiRepository/GoogleCalendarRepository) → Gateway
 *
 * calendarパッケージはD1へ直接アクセスせず、外部境界は
 * メインAPI（HTTP経由）とGoogle Calendar APIの2つの Gateway に集約されている
 * （STR-06: 他パッケージはD1相当をInMemory化してコンポーネントテストを組むが、calendarには
 * DBが無いためGateway層をモックに差し替え、Controller→Usecase→Repositoryを
 * 実際に解決・通過させる構成にする）。
 *
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 * （`requestSync` ヘルパー経由。詳細・設計方針は
 * packages/api/test/integration/component/place.get...component.test.ts のコメントおよび
 * .claude/docs/testing-conventions.md §コンポーネントテスト を参照）。
 *
 * ## シナリオテーブル
 *
 * | #    | 条件                                              | 期待                                                    |
 * |------|---------------------------------------------------|-----------------------------------------------------------|
 * | CS-1 | 重賞レース1件（新規） | insertCalendarDataが呼ばれ200・insertedCount=1・successCount=1 |
 * | CS-2 | 未勝利レース1件（フラグ無し） | shouldIncludeInCalendarで除外されinsertCalendarData未呼び出し・successCount=0 |
 * | CS-3 | Google Calendar側でinsertCalendarDataが失敗 | failureCount=1・failuresにraceIdと理由が入る |
 * | CS-4 | 不正なリクエストボディ（raceTypeList空） | 400・usecase/repository未到達 |
 * | CS-5 | MainApiGateway.fetchRaceListが失敗 | 500（handleControllerErrorで捕捉） |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { CalendarUpsertResult } from '@race-schedule/core';
import { DI_TOKENS, RaceType, SERVICE_AUTH_HEADER } from '@race-schedule/core';
import { container } from 'tsyringe';
import { RaceFactory } from '../../../../../tests/shared/factories';
import { registerApplication } from '../../../src/di/application';
import type { IGoogleCalendarGateway } from '../../../src/gateway/interface/IGoogleCalendarGateway';
import type {
    IMainApiGateway,
    MainApiRaceFilter,
} from '../../../src/gateway/interface/IMainApiGateway';
import { GoogleCalendarRepository } from '../../../src/repository/implement/googleCalendarRepository';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { ICalendarRepository } from '../../../src/repository/interface/ICalendarRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';
import { router } from '../../../src/router';

interface SyncResponseBody extends CalendarUpsertResult {}

const MOCK_SERVICE_AUTH_TOKEN = 'mock-service-auth-token';

/**
 * コンポーネントテストから、本番と同じ `router`（Hono app）を経由して
 * POST /sync へ実HTTPリクエストを送るヘルパー。
 * @param body - リクエストボディ（JSON.stringifyされる）
 */
const requestSync = async (body: unknown): Promise<Response> =>
    router.fetch(
        new Request('http://localhost/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify(body),
        }),
        {},
    );

describe('コンポーネントテスト: Calendar Sync Router → Controller → Usecase → Repository → Gateway(mock)', () => {
    let mainApiGateway: IMainApiGateway;
    let googleCalendarGateway: IGoogleCalendarGateway;

    beforeEach(() => {
        process.env.SERVICE_AUTH_TOKEN = MOCK_SERVICE_AUTH_TOKEN;
        container.clearInstances();

        mainApiGateway = {
            fetchRaceList: mock((_filter: MainApiRaceFilter) =>
                Promise.resolve([]),
            ),
            fetchCalendarFlagList: mock(() => Promise.resolve([])),
        };
        googleCalendarGateway = {
            fetchCalendarDataList: mock(() => Promise.resolve([])),
            // CONC-02: saveEventDataの新規作成直前の再確認（fetchExistingEventOrNull）で
            // 呼ばれる。既定は「まだ存在しない」ことを表す404を返す（従来通りinsertへ進む）。
            fetchCalendarData: mock(() =>
                Promise.reject(
                    new Error('Google Calendar API error: 404 Not Found'),
                ),
            ),
            insertCalendarData: mock(() => Promise.resolve('created-event-id')),
            updateCalendarData: mock(() => Promise.resolve()),
            deleteCalendarData: mock(() => Promise.resolve()),
        };

        container.register<IMainApiGateway>(DI_TOKENS.MainApiGateway, {
            useValue: mainApiGateway,
        });
        container.register<IGoogleCalendarGateway>(DI_TOKENS.CalendarGateway, {
            useValue: googleCalendarGateway,
        });
        container.register<IMainApiRepository>(DI_TOKENS.MainApiRepository, {
            useClass: MainApiRepository,
        });
        container.register<ICalendarRepository>(DI_TOKENS.CalendarRepository, {
            useClass: GoogleCalendarRepository,
        });
        registerApplication();
    });

    afterEach(() => {
        container.clearInstances();
    });

    const SYNC_BODY = {
        startDate: '2026-01-01',
        finishDate: '2026-01-31',
        raceTypeList: ['jra'],
    };

    it('CS-1: 重賞レース1件（新規）_insertCalendarDataが呼ばれ200・insertedCount1・successCount1を返す', async () => {
        const race = RaceFactory.create({
            raceType: RaceType.JRA,
            overrides: { raceGrade: 'GⅠ' },
        });
        mainApiGateway.fetchRaceList = mock(() => Promise.resolve([race]));

        const response = await requestSync(SYNC_BODY);
        const body = (await response.json()) as SyncResponseBody;

        expect(response.status).toBe(200);
        expect(googleCalendarGateway.insertCalendarData).toHaveBeenCalledTimes(
            1,
        );
        expect(body.insertedCount).toBe(1);
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);
    });

    it('CS-2: 未勝利レース1件（フラグ無し）_shouldIncludeInCalendarで除外されinsertCalendarData未呼び出し', async () => {
        const race = RaceFactory.create({
            raceType: RaceType.JRA,
            overrides: { raceGrade: '未勝利' },
        });
        mainApiGateway.fetchRaceList = mock(() => Promise.resolve([race]));

        const response = await requestSync(SYNC_BODY);
        const body = (await response.json()) as SyncResponseBody;

        expect(response.status).toBe(200);
        expect(googleCalendarGateway.insertCalendarData).not.toHaveBeenCalled();
        expect(body.successCount).toBe(0);
    });

    it('CS-3: Google Calendar側でinsertCalendarDataが失敗_failureCount1でfailuresにraceIdと理由が入る', async () => {
        const race = RaceFactory.create({
            raceType: RaceType.JRA,
            overrides: { raceGrade: 'GⅠ' },
        });
        mainApiGateway.fetchRaceList = mock(() => Promise.resolve([race]));
        googleCalendarGateway.insertCalendarData = mock(() =>
            Promise.reject(new Error('Google Calendar API quota exceeded')),
        );

        const response = await requestSync(SYNC_BODY);
        const body = (await response.json()) as SyncResponseBody;

        expect(response.status).toBe(200);
        expect(body.failureCount).toBe(1);
        expect(body.failures[0]?.id).toBe(race.raceId);
        expect(body.failures[0]?.reason).toContain(
            'Google Calendar API quota exceeded',
        );
    });

    it('CS-4: 不正なリクエストボディ（raceTypeList空）_400でusecase/repositoryに未到達', async () => {
        const response = await requestSync({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: [],
        });

        expect(response.status).toBe(400);
        expect(mainApiGateway.fetchRaceList).not.toHaveBeenCalled();
    });

    it('CS-5: MainApiGateway.fetchRaceListが失敗_500（handleControllerErrorで捕捉）', async () => {
        mainApiGateway.fetchRaceList = mock(() =>
            Promise.reject(new Error('main api unreachable')),
        );

        const response = await requestSync(SYNC_BODY);

        expect(response.status).toBe(500);
    });
});
