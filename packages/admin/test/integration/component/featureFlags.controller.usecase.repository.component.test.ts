/**
 * featureFlags.controller.usecase.repository.component.test.ts
 *
 * FLAGS-ADMIN-1〜3: `GET`/`POST /flags/api` エンドポイントのコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → FeatureFlagsController → FeatureFlagsUsecase →
 *   MainApiRepository → MainApiGateway(mock)
 *
 * adminパッケージはD1へ直接アクセスせず、外部境界はメインAPI（HTTP経由）の
 * Gatewayに集約されている（calendarパッケージと同じ方針。STR-06参照）ため、
 * Gateway層をモックに差し替え、Controller→Usecase→Repositoryを実際に
 * 解決・通過させる構成にする。
 *
 * ## シナリオテーブル
 *
 * | #             | 条件                              | 期待                              |
 * |----------------|-----------------------------------|-------------------------------------|
 * | FLAGS-ADMIN-1  | GET /flags/api                    | 200・メインAPIから取得した一覧を返す |
 * | FLAGS-ADMIN-2  | POST /flags/api（正常なbody）     | 200・gateway.updateFeatureFlagへ委譲される |
 * | FLAGS-ADMIN-3  | GET /flags（画面）                | 200・HTML                          |
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import type { FeatureFlagStatus } from '../../../src/dto/featureFlagStatus';
import type { IMainApiGateway } from '../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';
import { router } from '../../../src/router';

const SAMPLE_FLAGS: FeatureFlagStatus[] = [
    {
        key: 'announcement_banner',
        label: '起動時お知らせバナー',
        storedEnabled: true,
        envDefault: false,
        effectiveEnabled: true,
        updatedAt: '2026-08-07T00:00:00.000Z',
    },
];

describe('コンポーネントテスト: FeatureFlags Router → Controller → Usecase → Repository → Gateway(mock)', () => {
    let mainApiGateway: IMainApiGateway;

    beforeEach(() => {
        container.clearInstances();

        mainApiGateway = {
            fetchFeatureFlagList: mock(() => Promise.resolve(SAMPLE_FLAGS)),
            updateFeatureFlag: mock(() => Promise.resolve(SAMPLE_FLAGS)),
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

    it('FLAGS-ADMIN-1: GET /flags/apiは200・メインAPIから取得した一覧を返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/flags/api'),
        );
        const body = (await response.json()) as { flags: FeatureFlagStatus[] };

        expect(response.status).toBe(200);
        expect(body.flags).toEqual(SAMPLE_FLAGS);
        expect(mainApiGateway.fetchFeatureFlagList).toHaveBeenCalled();
    });

    it('FLAGS-ADMIN-2: POST /flags/apiはgateway.updateFeatureFlagへ委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/flags/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'announcement_banner',
                    enabled: true,
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mainApiGateway.updateFeatureFlag).toHaveBeenCalledWith(
            'announcement_banner',
            true,
        );
    });

    it('FLAGS-ADMIN-3: GET /flags(画面)は200・HTMLを返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/flags'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });
});
