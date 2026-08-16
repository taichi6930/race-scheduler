/**
 * announcement.controller.usecase.component.test.ts
 *
 * ANNOUNCEMENT-1: GET /ui/announcement エンドポイントのコンポーネントテスト
 * （Server-Driven UI PoC）。
 *
 * 層構造: Router（実HTTP） → AnnouncementController → AnnouncementUsecase
 * （D1を参照しないためrepository/gatewayは無し）
 *
 * `SERVICE_AUTH_EXEMPT_ROUTES` に登録済みの公開エンドポイントのため、認証ヘッダー無しで
 * 到達できることも合わせて検証する。
 *
 * ## シナリオテーブル
 *
 * | #                | リクエスト                | 期待                                      |
 * |--------------------|------------------------------|---------------------------------------------|
 * | ANNOUNCEMENT-1    | 認証ヘッダー無しでGET        | 200・schemaVersion:1・message非空文字列    |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import type { Announcement } from '@race-schedule/core';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { createInMemoryD1Database } from '../../common/inMemoryD1';
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

    it('ANNOUNCEMENT-1: 認証ヘッダー無しでGETした場合は200・UIスキーマを返すこと', async () => {
        const response = await requestApi(d1, '/ui/announcement');
        const body = (await response.json()) as Announcement;

        expect(response.status).toBe(200);
        expect(body.schemaVersion).toBe(1);
        expect(typeof body.message).toBe('string');
        expect(body.message.length).toBeGreaterThan(0);
    });
});
