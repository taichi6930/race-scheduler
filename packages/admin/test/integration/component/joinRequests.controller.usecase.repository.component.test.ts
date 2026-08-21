/**
 * joinRequests.controller.usecase.repository.component.test.ts
 *
 * JOIN-REQUESTS-ADMIN-1〜4: `GET /join-requests`・`GET /join-requests/api`・
 * `POST /join-requests/api/:id/approve`・`POST /join-requests/api/:id/reject`
 * エンドポイントのコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → JoinRequestsController → JoinRequestsUsecase →
 *   MainApiRepository → MainApiGateway(mock)
 *
 * adminパッケージはD1へ直接アクセスせず、外部境界はメインAPI（HTTP経由）の
 * Gatewayに集約されている（calendarパッケージと同じ方針。STR-06参照）ため、
 * Gateway層をモックに差し替え、Controller→Usecase→Repositoryを実際に
 * 解決・通過させる構成にする。
 *
 * ## シナリオテーブル
 *
 * | #                       | 条件                                        | 期待                                              |
 * |--------------------------|---------------------------------------------|-----------------------------------------------------|
 * | JOIN-REQUESTS-ADMIN-1    | GET /join-requests/api                       | 200・メインAPIから取得した参加リクエスト一覧を返す  |
 * | JOIN-REQUESTS-ADMIN-2    | POST /join-requests/api/:id/approve          | 200・gateway.approveJoinRequestへidを渡し委譲される |
 * | JOIN-REQUESTS-ADMIN-3    | POST /join-requests/api/:id/reject           | 200・gateway.rejectJoinRequestへidを渡し委譲される  |
 * | JOIN-REQUESTS-ADMIN-4    | GET /join-requests（画面）                    | 200・HTML                                          |
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import type { JoinRequestSummary } from '../../../src/dto/joinRequest';
import type { IMainApiGateway } from '../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';
import { router } from '../../../src/router';

const SAMPLE_REQUESTS: JoinRequestSummary[] = [
    { id: 'request-1', nickname: 'にっくねーむ' },
];

describe('コンポーネントテスト: JoinRequests Router → Controller → Usecase → Repository → Gateway(mock)', () => {
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
            fetchUiLayout: mock(() => Promise.resolve({ sections: [] })),
            saveUiLayout: mock(() => Promise.resolve({ sections: [] })),
            previewUiLayout: mock(() => Promise.resolve(undefined)),
            fetchUpcomingKeirinRaces: mock(() => Promise.resolve([])),
            fetchReleaseNotes: mock(() => Promise.resolve([])),
            issueInvite: mock(() => Promise.resolve({ token: 'invite-token' })),
            fetchParticipants: mock(() => Promise.resolve([])),
            fetchJoinRequests: mock(() => Promise.resolve(SAMPLE_REQUESTS)),
            approveJoinRequest: mock(() => Promise.resolve()),
            rejectJoinRequest: mock(() => Promise.resolve()),
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

    it('JOIN-REQUESTS-ADMIN-1: GET /join-requests/apiは200・メインAPIから取得した参加リクエスト一覧を返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/join-requests/api'),
        );
        const body = (await response.json()) as {
            requests: JoinRequestSummary[];
        };

        expect(response.status).toBe(200);
        expect(body.requests).toEqual(SAMPLE_REQUESTS);
        expect(mainApiGateway.fetchJoinRequests).toHaveBeenCalled();
    });

    it('JOIN-REQUESTS-ADMIN-2: POST /join-requests/api/:id/approveは200・gateway.approveJoinRequestへidを渡し委譲されること', async () => {
        const response = await router.fetch(
            new Request(
                'http://localhost/join-requests/api/request-1/approve',
                { method: 'POST' },
            ),
        );

        expect(response.status).toBe(200);
        expect(mainApiGateway.approveJoinRequest).toHaveBeenCalledWith(
            'request-1',
        );
    });

    it('JOIN-REQUESTS-ADMIN-3: POST /join-requests/api/:id/rejectは200・gateway.rejectJoinRequestへidを渡し委譲されること', async () => {
        const response = await router.fetch(
            new Request('http://localhost/join-requests/api/request-1/reject', {
                method: 'POST',
            }),
        );

        expect(response.status).toBe(200);
        expect(mainApiGateway.rejectJoinRequest).toHaveBeenCalledWith(
            'request-1',
        );
    });

    it('JOIN-REQUESTS-ADMIN-4: GET /join-requests(画面)は200・HTMLを返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/join-requests'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });
});
