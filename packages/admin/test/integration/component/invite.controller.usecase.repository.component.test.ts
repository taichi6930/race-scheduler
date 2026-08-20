/**
 * invite.controller.usecase.repository.component.test.ts
 *
 * INVITE-ADMIN-1〜3: `GET/POST /invite`・`GET /participants` エンドポイントの
 * コンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → Invite/ParticipantsController →
 *   Invite/ParticipantsUsecase → MainApiRepository → MainApiGateway(mock)
 *
 * adminパッケージはD1へ直接アクセスせず、外部境界はメインAPI（HTTP経由）の
 * Gatewayに集約されている（calendarパッケージと同じ方針。STR-06参照）ため、
 * Gateway層をモックに差し替え、Controller→Usecase→Repositoryを実際に
 * 解決・通過させる構成にする。
 *
 * ## シナリオテーブル
 *
 * | #                | 条件                          | 期待                                        |
 * |-------------------|-------------------------------|-----------------------------------------------|
 * | INVITE-ADMIN-1    | POST /invite/api（正常なbody） | 201・gateway.issueInviteへ委譲され招待URLを返す |
 * | INVITE-ADMIN-2    | GET /participants/api          | 200・メインAPIから取得した参加者一覧を返す      |
 * | INVITE-ADMIN-3    | GET /invite（画面）            | 200・HTML                                     |
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import type { ParticipantSummary } from '../../../src/dto/participant';
import type { IMainApiGateway } from '../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';
import { router } from '../../../src/router';

const SAMPLE_PARTICIPANTS: ParticipantSummary[] = [
    {
        userId: 'user-1',
        nickname: 'にっくねーむ',
        inviteMemo: 'メモ',
        credentialId: 'credential-1',
        deviceLabel: 'iPhone',
        lastUsedAt: '2026-08-19T00:00:00.000Z',
        userCreatedAt: '2026-08-01T00:00:00.000Z',
    },
];

describe('コンポーネントテスト: Invite/Participants Router → Controller → Usecase → Repository → Gateway(mock)', () => {
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
            fetchParticipants: mock(() => Promise.resolve(SAMPLE_PARTICIPANTS)),
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

    it('INVITE-ADMIN-1: POST /invite/apiは201・gateway.issueInviteへ委譲され招待URLを返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/invite/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memo: 'テストメモ' }),
            }),
        );
        const body = (await response.json()) as {
            token: string;
            inviteUrl: string;
        };

        expect(response.status).toBe(201);
        expect(mainApiGateway.issueInvite).toHaveBeenCalledWith('テストメモ');
        expect(body.token).toBe('invite-token');
        expect(body.inviteUrl).toBe('/invite/invite-token');
    });

    it('INVITE-ADMIN-2: GET /participants/apiは200・メインAPIから取得した参加者一覧を返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/participants/api'),
        );
        const body = (await response.json()) as {
            participants: ParticipantSummary[];
        };

        expect(response.status).toBe(200);
        expect(body.participants).toEqual(SAMPLE_PARTICIPANTS);
        expect(mainApiGateway.fetchParticipants).toHaveBeenCalled();
    });

    it('INVITE-ADMIN-3: GET /invite(画面)は200・HTMLを返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/invite'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });
});
