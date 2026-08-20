/**
 * place.get.controller.usecase.repository.component.test.ts
 *
 * PLACE-1 ~ PLACE-3: GET /place エンドポイントのコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * このファイルはコンポーネントテストの手本。以下の方針で構成している
 * （詳細は .claude/docs/testing-conventions.md §コンポーネントテスト を参照）:
 *
 * - controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 *   （`requestApi` ヘルパー経由。CORS・body-limit・cache-control等のミドルウェアも通過する）
 * - 「配線1パターンにつき代表1本」に絞り、フィルタの組み合わせ網羅（境界値・AND条件等）は
 *   Repository の UT（`packages/api/test/unittest/repository/implement/placeRepository.test.ts`）
 *   に担保させる。旧 PLACE-3（日付境界: finishDateが日末補正されない挙動）は同ファイルの F2 へ、
 *   旧 PLACE-4（raceType+locationのAND）は F3/F4（各フィールド単体のフィルタ）で個別に
 *   担保済みのため削除した（AND自体の組み合わせテストは、配線の観点では代表1本で十分なため
 *   PLACE-1のクエリに locationList を含めて兼務させている）。
 *
 * ## シナリオテーブル（Place GET Router → Controller → Usecase → Repository → InMemory D1）
 *
 * | #       | 投入データ           | リクエスト条件                                    | 期待                                        |
 * |---------|----------------------|-----------------------------------------------------|---------------------------------------------|
 * | PLACE-1 | JRA 2件（場所違い）  | 実HTTP GET・raceTypeList+locationListの複合クエリ  | 200・複数パラメータが正しくパースされ1件に絞られる |
 * | PLACE-2 | 該当なし             | 実HTTP GET・期間外                                 | 200・count=0・空配列                        |
 * | PLACE-3 | KEIRIN 1件（グレード付き） | 実HTTP GET                                    | 200・placeGradeがJSONレスポンスに含まれる   |
 */

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import {
    RaceType,
    SERVICE_AUTH_HEADER,
    toJstISOString,
    validateLocationCode,
} from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import { PlaceFactory } from '../../../../../tests/shared/factories';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

/** GET /place は service-or-session のため、サービス間認証ヘッダーを既定で付与する */
const AUTH_HEADERS = { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN };

/** インメモリD1（Drizzle経由）へ 1 件の PlaceEntity を投入する（place + 付随テーブル） */
const insertPlace = async (
    db: DrizzleD1Database<typeof schema>,
    place: ReturnType<typeof PlaceFactory.create>,
): Promise<void> => {
    await db.insert(schema.place).values({
        placeId: place.placeId,
        raceType: place.raceType,
        dateTime: toJstISOString(place.datetime),
        locationCode: place.locationCode,
    });

    if (place.placeHeldDays !== undefined) {
        await db.insert(schema.placeHeldDay).values({
            placeId: place.placeId,
            heldTimes: place.placeHeldDays.heldTimes,
            heldDayTimes: place.placeHeldDays.heldDayTimes,
        });
    }

    if (place.placeGrade !== undefined) {
        await db.insert(schema.placeGrade).values({
            placeId: place.placeId,
            placeGrade: place.placeGrade,
        });
    }
};

interface PlaceGetResponseBody {
    count: number;
    places: { placeId: string; locationCode: string; placeGrade?: string }[];
}

describe('コンポーネントテスト: Place GET Router → Controller → Usecase → Repository → InMemory D1', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;

    beforeAll(() => {
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        restoreEnv();
    });

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('PLACE-1: 複合クエリ_JRA2件のうちlocationList指定で1件に絞られること', async () => {
        // Arrange
        const tokyo = PlaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('05'),
        });
        const hanshin = PlaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('06'),
        });
        await insertPlace(db, tokyo);
        await insertPlace(db, hanshin);

        // Act: 実HTTPリクエスト（router経由。CORS等のミドルウェアも通過する）
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
            locationList: '05',
        });
        const response = await requestApi(d1, `/place?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const body = (await response.json()) as PlaceGetResponseBody;

        // Assert
        expect(response.status).toBe(200);
        expect(body.count).toBe(1);
        expect(body.places[0].placeId).toBe(tokyo.placeId);
    });

    it('PLACE-2: 該当なし_該当期間なしで200と空配列を返すこと', async () => {
        // Arrange
        await insertPlace(
            db,
            PlaceFactory.create({
                datetime: new Date('2026-04-26T10:00:00+09:00'),
                locationCode: validateLocationCode('05'),
            }),
        );

        // Act
        const params = new URLSearchParams({
            startDate: '2026-05-01',
            finishDate: '2026-05-02',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/place?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const body = (await response.json()) as PlaceGetResponseBody;

        // Assert
        expect(response.status).toBe(200);
        expect(body.count).toBe(0);
        expect(body.places).toHaveLength(0);
    });

    it('PLACE-3: グレード付き_KEIRIN1件のplaceGradeがJSONレスポンスに含まれること', async () => {
        // Arrange
        const place = PlaceFactory.create({
            raceType: RaceType.KEIRIN,
            locationCode: validateLocationCode('11'),
            placeGrade: 'GⅢ',
            datetime: new Date('2026-04-26T10:00:00+09:00'),
        });
        await insertPlace(db, place);

        // Act
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'keirin',
        });
        const response = await requestApi(d1, `/place?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const body = (await response.json()) as PlaceGetResponseBody;

        // Assert: DBのplace_grade → Repository → JSONシリアライズまで通した値を確認
        // （Repository UTのF4はエンティティレベルまでしか見ないため、この最終形はここでしか見えない）
        expect(response.status).toBe(200);
        expect(body.places[0].placeGrade).toBe(place.placeGrade);
    });
});
