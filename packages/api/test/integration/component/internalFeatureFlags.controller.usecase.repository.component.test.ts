/**
 * internalFeatureFlags.controller.usecase.repository.component.test.ts
 *
 * FEATURE-FLAGS: 機能フラグ管理のサービス間API（`packages/admin`専用Worker、
 * admin-package-design.md）のコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → InternalFeatureFlagsController → FeatureFlagUsecase →
 * FeatureFlagRepository → DrizzleGateway → D1
 *
 * `GET`/`POST /internal/feature-flags` は `X-Service-Auth-Token`
 * （`requireServiceAuth`）を要求する。最も重要な配線パターン（FLAGS-3）として、
 * 更新がD1へ書き込まれ`GET /ui/announcement`（AnnouncementUsecase）の実効値に
 * 反映されることを検証する。
 *
 * ## シナリオテーブル
 *
 * | #        | リクエスト                                              | 期待                                          |
 * |----------|-------------------------------------------------------------|-------------------------------------------------|
 * | FLAGS-1  | 認証ヘッダー無しでGET /internal/feature-flags               | 401                                              |
 * | FLAGS-2  | 正しいトークンでGET /internal/feature-flags                 | 200・announcement_bannerを含む一覧              |
 * | FLAGS-3  | 正しいトークンでPOST /internal/feature-flags（enabled:true） | 200・GET /ui/announcementにも反映される         |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import type { Announcement } from '@race-schedule/core';
import { SERVICE_AUTH_HEADER } from '@race-schedule/core';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

interface FeatureFlagsListResponse {
    flags: {
        key: string;
        storedEnabled: boolean | undefined;
        effectiveEnabled: boolean;
    }[];
}

describe('コンポーネントテスト: InternalFeatureFlags Router → Controller → Usecase → Repository', () => {
    let d1: D1Database;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('FLAGS-1: 認証ヘッダー無しでGET /internal/feature-flagsした場合は401を返すこと', async () => {
        const response = await requestApi(d1, '/internal/feature-flags');

        expect(response.status).toBe(401);
    });

    it('FLAGS-2: 正しいトークンでGET /internal/feature-flagsした場合は200・announcement_bannerを含む一覧を返すこと', async () => {
        const response = await requestApi(d1, '/internal/feature-flags', {
            headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
        });
        const body = (await response.json()) as FeatureFlagsListResponse;

        expect(response.status).toBe(200);
        expect(
            body.flags.find((flag) => flag.key === 'announcement_banner'),
        ).toBeDefined();
    });

    it('FLAGS-3: POST /internal/feature-flagsでの更新がGET /ui/announcementの実効値に反映されること', async () => {
        const updateResponse = await requestApi(d1, '/internal/feature-flags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify({
                key: 'announcement_banner',
                enabled: true,
            }),
        });
        const updateBody =
            (await updateResponse.json()) as FeatureFlagsListResponse;

        expect(updateResponse.status).toBe(200);
        expect(
            updateBody.flags.find((flag) => flag.key === 'announcement_banner')
                ?.storedEnabled,
        ).toBe(true);

        const announcementResponse = await requestApi(d1, '/ui/announcement', {
            headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
        });
        const announcement =
            (await announcementResponse.json()) as Announcement;

        expect(announcement.enabled).toBe(true);
    });
});
