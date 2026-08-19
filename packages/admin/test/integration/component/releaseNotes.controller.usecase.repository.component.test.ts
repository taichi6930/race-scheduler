/**
 * releaseNotes.controller.usecase.repository.component.test.ts
 *
 * RELNOTES-ADMIN-1〜2: `GET /release-notes*` エンドポイントのコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → ReleaseNotesController → ReleaseNotesUsecase →
 *   MainApiRepository → MainApiGateway(mock)
 *
 * adminパッケージはD1へ直接アクセスせず、外部境界はメインAPI（HTTP経由）の
 * Gatewayに集約されている（calendarパッケージと同じ方針。STR-06参照）ため、
 * Gateway層をモックに差し替え、Controller→Usecase→Repositoryを実際に
 * 解決・通過させる構成にする。
 *
 * ## シナリオテーブル
 *
 * | #                   | 条件                              | 期待                                   |
 * |----------------------|-----------------------------------|-------------------------------------------|
 * | RELNOTES-ADMIN-1    | GET /release-notes/api            | 200・gateway.fetchReleaseNotesの結果を返す（非公開分含む） |
 * | RELNOTES-ADMIN-2    | GET /release-notes（画面）        | 200・HTML                                |
 */

import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { DI_TOKENS, type ReleaseNote } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import type { IMainApiGateway } from '../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';
import { router } from '../../../src/router';

const SAMPLE_NOTES: ReleaseNote[] = [
    {
        tag_name: 'v2.0.0',
        name: 'v2.0.0',
        body: '公開リポジトリのリリース',
        published_at: '2026-08-16T00:00:00Z',
        draft: false,
        prerelease: false,
        source_repo: 'race-scheduler',
    },
    {
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        body: '非公開リポジトリのリリース',
        published_at: '2026-01-01T00:00:00Z',
        draft: false,
        prerelease: false,
        source_repo: 'race-schedule',
    },
];

describe('コンポーネントテスト: ReleaseNotes Router → Controller → Usecase → Repository → Gateway(mock)', () => {
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
            fetchReleaseNotes: mock(() => Promise.resolve(SAMPLE_NOTES)),
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

    it('RELNOTES-ADMIN-1: GET /release-notes/apiは200・非公開分を含む全件を返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/release-notes/api'),
        );
        const body = (await response.json()) as ReleaseNote[];

        expect(response.status).toBe(200);
        expect(body).toEqual(SAMPLE_NOTES);
        expect(mainApiGateway.fetchReleaseNotes).toHaveBeenCalled();
    });

    it('RELNOTES-ADMIN-2: GET /release-notes(画面)は200・HTMLを返すこと', async () => {
        const response = await router.fetch(
            new Request('http://localhost/release-notes'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });
});
