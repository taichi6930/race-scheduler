/**
 * raceDetailLayout.controller.usecase.repository.component.test.ts
 *
 * LAYOUT-ADMIN-1〜4: `GET /race-detail-layout`・`GET`/`POST /race-detail-layout/api`・
 * `POST /race-detail-layout/api/preview` エンドポイントのコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → RaceDetailLayoutController → RaceDetailLayoutUsecase →
 *   MainApiRepository → MainApiGateway(mock)
 *
 * adminパッケージはD1へ直接アクセスせず、外部境界はメインAPI（HTTP経由）の
 * Gatewayに集約されている（featureFlags/backfillのコンポーネントテストと同じ方針）
 * ため、Gateway層をモックに差し替え、Controller→Usecase→Repositoryを実際に
 * 解決・通過させる構成にする。
 *
 * ## シナリオテーブル
 *
 * | #                | 条件                                          | 期待                                     |
 * |-------------------|------------------------------------------------|---------------------------------------------|
 * | LAYOUT-ADMIN-1   | GET /race-detail-layout/api                   | 200・gateway.fetchUiLayoutへraceType=keirinで委譲 |
 * | LAYOUT-ADMIN-2   | POST /race-detail-layout/api（正常なbody）    | 200・gateway.saveUiLayoutへ委譲される       |
 * | LAYOUT-ADMIN-3   | POST /race-detail-layout/api/preview（正常body）| 200・gateway.previewUiLayoutへ委譲される  |
 * | LAYOUT-ADMIN-4   | GET /race-detail-layout（画面）               | 200・HTML                                   |
 * | LAYOUT-ADMIN-5   | GET /race-detail-layout/api/races             | 200・gateway.fetchUpcomingKeirinRacesへ委譲される |
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
    DI_TOKENS,
    type RaceDetailUiConfig,
    RaceType,
} from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import type { RaceSummary } from '../../../src/dto/raceSummary';
import type { IMainApiGateway } from '../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';
import { router } from '../../../src/router';

const SAMPLE_CONFIG: RaceDetailUiConfig = {
    sections: [{ type: 'kv', fields: [{ key: 'time' }] }],
};

const SAMPLE_RACES: RaceSummary[] = [
    {
        raceId: 'keirin202608091',
        raceName: '開設70周年記念',
        raceCourse: '大宮',
        raceNumber: 7,
        raceGrade: 'GⅢ',
        datetime: '2026-08-09T10:00:00+09:00',
    },
];

describe('コンポーネントテスト: RaceDetailLayout Router → Controller → Usecase → Repository → Gateway(mock)', () => {
    let mainApiGateway: IMainApiGateway;

    beforeEach(() => {
        container.clearInstances();

        mainApiGateway = {
            fetchFeatureFlagList: mock(() => Promise.resolve([])),
            updateFeatureFlag: mock(() => Promise.resolve([])),
            backfillPlace: mock(() =>
                Promise.resolve({
                    successCount: 0,
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
            fetchUiLayout: mock(() => Promise.resolve(SAMPLE_CONFIG)),
            saveUiLayout: mock(() => Promise.resolve(SAMPLE_CONFIG)),
            previewUiLayout: mock(() =>
                Promise.resolve({ schemaVersion: 1 as const, sections: [] }),
            ),
            fetchUpcomingKeirinRaces: mock(() => Promise.resolve(SAMPLE_RACES)),
            fetchReleaseNotes: mock(() => Promise.resolve([])),
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

    it('LAYOUT-ADMIN-1: GET /race-detail-layout/apiは200・gateway.fetchUiLayoutへraceType=keirinで委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/race-detail-layout/api'),
        );
        const body = (await response.json()) as {
            raceType: string;
            config: RaceDetailUiConfig;
        };

        expect(response.status).toBe(200);
        expect(body.raceType).toBe('keirin');
        expect(body.config).toEqual(SAMPLE_CONFIG);
        expect(mainApiGateway.fetchUiLayout).toHaveBeenCalledWith(
            RaceType.KEIRIN,
        );
    });

    it('LAYOUT-ADMIN-2: POST /race-detail-layout/apiはgateway.saveUiLayoutへ委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/race-detail-layout/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: SAMPLE_CONFIG }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mainApiGateway.saveUiLayout).toHaveBeenCalledWith(
            RaceType.KEIRIN,
            SAMPLE_CONFIG,
        );
    });

    it('LAYOUT-ADMIN-3: POST /race-detail-layout/api/previewはgateway.previewUiLayoutへ委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/race-detail-layout/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: SAMPLE_CONFIG,
                    raceId: 'race-1',
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mainApiGateway.previewUiLayout).toHaveBeenCalledWith(
            SAMPLE_CONFIG,
            'race-1',
        );
    });

    it('LAYOUT-ADMIN-4: GET /race-detail-layout(画面)は200・HTMLを返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/race-detail-layout'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });

    it('LAYOUT-ADMIN-5: GET /race-detail-layout/api/racesはgateway.fetchUpcomingKeirinRacesへ委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/race-detail-layout/api/races'),
        );
        const body = (await response.json()) as { races: RaceSummary[] };

        expect(response.status).toBe(200);
        expect(body.races).toEqual(SAMPLE_RACES);
        expect(mainApiGateway.fetchUpcomingKeirinRaces).toHaveBeenCalledWith(
            14,
        );
    });
});
