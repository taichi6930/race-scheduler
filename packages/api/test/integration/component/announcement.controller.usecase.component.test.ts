/**
 * announcement.controller.usecase.component.test.ts
 *
 * ANNOUNCEMENT-1: GET /ui/announcement エンドポイントのコンポーネントテスト
 * （Server-Driven UI PoC）。
 *
 * 層構造: Router（実HTTP） → AnnouncementController → AnnouncementUsecase
 * （D1を参照しないためrepository/gatewayは無し）
 *
 * `GET /ui/announcement` は `APP_AUTH_ROUTES` で `service-or-session`（front招待制
 * クローズド化、router.ts）のため、ここでは calendar/scraping Worker等からのサービス間
 * 呼び出しを模してサービス間認証ヘッダーを付与する。
 *
 * ## シナリオテーブル
 *
 * | #                | リクエスト                    | 期待                                      |
 * |--------------------|--------------------------------|---------------------------------------------|
 * | ANNOUNCEMENT-1    | サービス間認証ヘッダーありでGET | 200・schemaVersion:1・message非空文字列    |
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

describe('コンポーネントテスト: Announcement Router → Controller → Usecase', () => {
    let d1: D1Database;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('ANNOUNCEMENT-1: サービス間認証ヘッダーありでGETした場合は200・UIスキーマを返すこと', async () => {
        const response = await requestApi(d1, '/ui/announcement', {
            headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
        });
        const body = (await response.json()) as Announcement;

        expect(response.status).toBe(200);
        expect(body.schemaVersion).toBe(1);
        expect(typeof body.message).toBe('string');
        expect(body.message.length).toBeGreaterThan(0);
    });
});
