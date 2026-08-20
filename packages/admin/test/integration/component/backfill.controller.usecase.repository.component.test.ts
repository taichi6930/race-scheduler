/**
 * backfill.controller.usecase.repository.component.test.ts
 *
 * BACKFILL-ADMIN-1〜3: `GET /backfill`・`POST /backfill/api/{place,race}`
 * エンドポイントのコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → BackfillController → BackfillUsecase →
 *   MainApiRepository → MainApiGateway(mock)
 *
 * adminパッケージはD1へ直接アクセスせず、外部境界はメインAPI（HTTP経由）の
 * Gatewayに集約されている（featureFlagsのコンポーネントテストと同じ方針）ため、
 * Gateway層をモックに差し替え、Controller→Usecase→Repositoryを実際に
 * 解決・通過させる構成にする。
 *
 * ## シナリオテーブル
 *
 * | #                 | 条件                                | 期待                                      |
 * |--------------------|--------------------------------------|---------------------------------------------|
 * | BACKFILL-ADMIN-1  | POST /backfill/api/place（正常bo dy）| 200・gateway.backfillPlaceへ委譲される      |
 * | BACKFILL-ADMIN-2  | POST /backfill/api/race（正常body）  | 200・gateway.backfillRaceへ委譲される       |
 * | BACKFILL-ADMIN-3  | GET /backfill（画面）                | 200・HTML                                   |
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import type { IMainApiGateway } from '../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';
import { router } from '../../../src/router';

const SAMPLE_FILTER = {
    startDate: '2026-01-01',
    finishDate: '2026-01-31',
    raceTypeList: ['keirin'],
};

describe('コンポーネントテスト: Backfill Router → Controller → Usecase → Repository → Gateway(mock)', () => {
    let mainApiGateway: IMainApiGateway;

    beforeEach(() => {
        container.clearInstances();

        mainApiGateway = {
            fetchFeatureFlagList: mock(() => Promise.resolve([])),
            updateFeatureFlag: mock(() => Promise.resolve([])),
            backfillPlace: mock(() =>
                Promise.resolve({
                    successCount: 1,
                    failureCount: 0,
                    failures: [],
                    notCachedKeys: [],
                }),
            ),
            backfillRace: mock(() =>
                Promise.resolve({
                    successCount: 0,
                    failureCount: 0,
                    failures: [],
                    notCachedPlaceIds: [],
                }),
            ),
            fetchUiLayout: mock(() => Promise.resolve({ sections: [] })),
            saveUiLayout: mock(() => Promise.resolve({ sections: [] })),
            previewUiLayout: mock(() => Promise.resolve(undefined)),
            fetchUpcomingKeirinRaces: mock(() => Promise.resolve([])),
            fetchReleaseNotes: mock(() => Promise.resolve([])),
            issueInvite: mock(() => Promise.resolve({ token: 'invite-token' })),
            fetchParticipants: mock(() => Promise.resolve([])),
        };

        container.register<IMainApiGateway>(DI_TOKENS.MainApiGateway, {
            useValue: mainApiGateway,
        });
        container.register<IMainApiRepository>(DI_TOKENS.MainApiRepository, {
            useClass: MainApiRepository,
        });
        registerApplication();
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('BACKFILL-ADMIN-1: POST /backfill/api/placeはgateway.backfillPlaceへ委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/backfill/api/place', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(SAMPLE_FILTER),
            }),
        );

        expect(response.status).toBe(200);
        expect(mainApiGateway.backfillPlace).toHaveBeenCalledWith(
            SAMPLE_FILTER,
        );
        const body = (await response.json()) as { successCount: number };
        expect(body.successCount).toBe(1);
    });

    it('BACKFILL-ADMIN-2: POST /backfill/api/raceはgateway.backfillRaceへ委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/backfill/api/race', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(SAMPLE_FILTER),
            }),
        );

        expect(response.status).toBe(200);
        expect(mainApiGateway.backfillRace).toHaveBeenCalledWith(SAMPLE_FILTER);
    });

    it('BACKFILL-ADMIN-3: GET /backfill(画面)は200・HTMLを返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/backfill'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });
});
