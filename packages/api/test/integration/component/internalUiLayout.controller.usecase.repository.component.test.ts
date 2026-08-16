/**
 * internalUiLayout.controller.usecase.repository.component.test.ts
 *
 * レイアウト構成管理のサービス間API（`packages/admin`専用Worker、
 * race-detail-sdui-design.md）のコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → InternalUiLayoutController → UiLayoutUsecase →
 * UiLayoutRepository/RaceRepository → DrizzleGateway → D1
 *
 * `GET`/`POST /internal/ui-layout`・`POST /internal/ui-layout/preview` は
 * `X-Service-Auth-Token`（`requireServiceAuth`）を要求する。最も重要な配線
 * パターンとして、POSTでの保存が `GET /ui/race-detail`（front向け、RaceUsecase）
 * の解決結果にも反映されることを検証する。
 *
 * ## シナリオテーブル
 *
 * | #        | リクエスト                                              | 期待                                          |
 * |----------|-------------------------------------------------------------|-------------------------------------------------|
 * | LAYOUT-1 | 認証ヘッダー無しでGET /internal/ui-layout                   | 401                                              |
 * | LAYOUT-2 | 正しいトークンでGET /internal/ui-layout?raceType=keirin      | 200・既定構成（D1未保存）                        |
 * | LAYOUT-3 | 正しいトークンでPOST /internal/ui-layout（カスタム構成）     | 200・GET /ui/race-detailにも反映される           |
 * | LAYOUT-4 | 正しいトークンでPOST /internal/ui-layout/preview             | 200・保存せずに解決結果を返す                    |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import {
    type RaceDetailUi,
    type RaceDetailUiConfig,
    RaceType,
    SERVICE_AUTH_HEADER,
    toJstISOString,
    validateLocationCode,
} from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import { RaceFactory } from '../../../../../tests/shared/factories';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

const CUSTOM_CONFIG: RaceDetailUiConfig = {
    sections: [
        { type: 'kv', fields: [{ key: 'grade', label: '級・グレード' }] },
    ],
};

describe('コンポーネントテスト: InternalUiLayout Router → Controller → Usecase → Repository → InMemory D1', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;

    beforeEach(() => {
        restoreEnv = useInMemoryDB();
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        restoreEnv();
        container.clearInstances();
    });

    it('LAYOUT-1: 認証ヘッダー無しでGET /internal/ui-layoutした場合は401を返すこと', async () => {
        const response = await requestApi(
            d1,
            '/internal/ui-layout?raceType=keirin',
        );

        expect(response.status).toBe(401);
    });

    it('LAYOUT-2: 正しいトークンでGET /internal/ui-layoutした場合は200・既定構成を返すこと', async () => {
        const response = await requestApi(
            d1,
            '/internal/ui-layout?raceType=keirin',
            { headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN } },
        );
        const body = (await response.json()) as {
            raceType: string;
            config: RaceDetailUiConfig;
        };

        expect(response.status).toBe(200);
        expect(body.raceType).toBe('keirin');
        const playersSection = body.config.sections.find(
            (s) => s.type === 'players',
        );
        expect(
            playersSection?.type === 'players' && playersSection.watchToggle,
        ).toBe(true);
    });

    it('LAYOUT-3: POST /internal/ui-layoutでの保存がGET /ui/race-detailの解決結果に反映されること', async () => {
        const race = RaceFactory.create({
            raceType: RaceType.KEIRIN,
            datetime: new Date('2026-08-02T14:33:00+09:00'),
            locationCode: validateLocationCode('36'),
            raceNumber: 10,
            overrides: { raceGrade: 'GⅢ' },
        });
        await db.insert(schema.race).values({
            raceId: race.raceId,
            placeId: race.placeId,
            raceType: race.raceType,
            raceName: race.raceName,
            dateTime: toJstISOString(race.datetime),
            locationCode: race.locationCode,
            grade: race.raceGrade,
            raceNumber: race.raceNumber,
        });
        if (race.raceStage) {
            await db.insert(schema.raceStage).values({
                raceId: race.raceId,
                raceStage: race.raceStage,
            });
        }

        const saveResponse = await requestApi(d1, '/internal/ui-layout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify({ raceType: 'keirin', config: CUSTOM_CONFIG }),
        });
        expect(saveResponse.status).toBe(200);

        const detailResponse = await requestApi(
            d1,
            `/ui/race-detail?raceId=${race.raceId}`,
        );
        const detail = (await detailResponse.json()) as RaceDetailUi;

        expect(detail.sections).toEqual([
            { type: 'kv', rows: [{ label: '級・グレード', value: 'GⅢ' }] },
        ]);
    });

    it('LAYOUT-4: POST /internal/ui-layout/previewは保存せずに解決結果を返すこと', async () => {
        const race = RaceFactory.create({
            raceType: RaceType.KEIRIN,
            datetime: new Date('2026-08-02T14:33:00+09:00'),
            locationCode: validateLocationCode('36'),
            raceNumber: 11,
            overrides: { raceGrade: 'GⅠ' },
        });
        await db.insert(schema.race).values({
            raceId: race.raceId,
            placeId: race.placeId,
            raceType: race.raceType,
            raceName: race.raceName,
            dateTime: toJstISOString(race.datetime),
            locationCode: race.locationCode,
            grade: race.raceGrade,
            raceNumber: race.raceNumber,
        });
        if (race.raceStage) {
            await db.insert(schema.raceStage).values({
                raceId: race.raceId,
                raceStage: race.raceStage,
            });
        }

        const previewResponse = await requestApi(
            d1,
            '/internal/ui-layout/preview',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                },
                body: JSON.stringify({
                    config: CUSTOM_CONFIG,
                    raceId: race.raceId,
                }),
            },
        );
        const preview = (await previewResponse.json()) as RaceDetailUi;

        expect(previewResponse.status).toBe(200);
        expect(preview.sections).toEqual([
            { type: 'kv', rows: [{ label: '級・グレード', value: 'GⅠ' }] },
        ]);

        // 保存されていないことを確認する（GET /internal/ui-layoutが既定構成のまま）
        const getResponse = await requestApi(
            d1,
            '/internal/ui-layout?raceType=keirin',
            { headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN } },
        );
        const getBody = (await getResponse.json()) as {
            config: RaceDetailUiConfig;
        };
        const kvSection = getBody.config.sections.find((s) => s.type === 'kv');
        expect(kvSection?.type === 'kv' && kvSection.fields.length > 1).toBe(
            true,
        );
    });
});
