/**
 * calendar.get.controller.usecase.repository.component.test.ts
 *
 * @spec SPEC-CAL-001
 *
 * CAL-1 ~ CAL-5: GET /calendar エンドポイントのコンポーネントテスト
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository(RaceRepository/CalendarRepository) → InMemory D1（Drizzle）
 *
 * apiはD1唯一のアクセス点という方針のもと、GET /calendarはGoogle Calendarへは
 * 問い合わせず、D1（race / calendar_flag）から「カレンダー掲載対象レース+
 * フラグ状態」を組み立てて返す。
 *
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 * （`requestApi` ヘルパー経由。詳細・設計方針は place.get...component.test.ts のコメントおよび
 * .claude/docs/testing-conventions.md §コンポーネントテスト を参照）。
 *
 * ## シナリオテーブル
 *
 * | #     | seed                              | リクエスト条件      | 期待                                   |
 * |-------|------------------------------------|----------------------|-----------------------------------------|
 * | CAL-1 | JRA重賞1件（未フラグ）              | 正常（jra, 期間指定） | count=1, isFlagged=false                |
 * | CAL-2 | JRA重賞1件 + JRA未勝利1件（フラグ有）| 正常                  | count=2, フラグ有はisFlagged=true         |
 * | CAL-3 | JRA未勝利1件（フラグ無し）           | 正常                  | count=0（shouldIncludeInCalendarで除外） |
 * | CAL-4 | 空                                  | 正常                  | count=0（200）                          |
 * | CAL-5 | -                                   | 不正な raceType       | 400 BadRequest                          |
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
import { toJstISOString, validateLocationCode } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import { RaceFactory } from '../../../../../tests/shared/factories';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

interface CalendarGetResponseBody {
    count: number;
    calendars: { raceId: string; isFlagged: boolean }[];
}

describe('コンポーネントテスト: Calendar GET Router → Controller → Usecase → Repository → InMemory D1', () => {
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

    /** race テーブル（+ JRA の場合は race_condition）へ1件挿入する */
    const insertRace = async (
        race: ReturnType<typeof RaceFactory.create>,
    ): Promise<void> => {
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
        if (race.raceType === 'jra') {
            await db.insert(schema.raceCondition).values({
                raceId: race.raceId,
                distance: 2000,
                surfaceType: '芝',
            });
        }
    };

    const insertFlag = async (raceId: string): Promise<void> => {
        await db.insert(schema.calendarFlag).values({ raceId, label: 'メモ' });
    };

    it('CAL-1: 重賞レース1件（未フラグ）_isFlagged:falseで1件返却されること', async () => {
        // Arrange
        const race = RaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('05'),
            overrides: { raceGrade: 'GⅠ' },
        });
        await insertRace(race);

        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/calendar?${params.toString()}`);
        const body = (await response.json()) as CalendarGetResponseBody;

        expect(response.status).toBe(200);
        expect(body.count).toBe(1);
        expect(body.calendars[0].raceId).toBe(race.raceId);
        expect(body.calendars[0].isFlagged).toBe(false);
    });

    it('CAL-2: 重賞1件+フラグ付き未勝利1件_2件返却されフラグ状態が反映されること', async () => {
        // Arrange
        const gradedRace = RaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('05'),
            raceNumber: 1,
            overrides: { raceGrade: 'GⅠ' },
        });
        const flaggedRace = RaceFactory.create({
            datetime: new Date('2026-04-26T11:00:00+09:00'),
            locationCode: validateLocationCode('05'),
            raceNumber: 2,
            overrides: { raceGrade: '未勝利' },
        });
        await insertRace(gradedRace);
        await insertRace(flaggedRace);
        await insertFlag(flaggedRace.raceId);

        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/calendar?${params.toString()}`);
        const body = (await response.json()) as CalendarGetResponseBody;

        expect(body.count).toBe(2);
        const flaggedEntry = body.calendars.find(
            (c) => c.raceId === flaggedRace.raceId,
        );
        const gradedEntry = body.calendars.find(
            (c) => c.raceId === gradedRace.raceId,
        );
        expect(flaggedEntry?.isFlagged).toBe(true);
        expect(gradedEntry?.isFlagged).toBe(false);
    });

    it('CAL-3: フラグなしの未勝利のみ_shouldIncludeInCalendarで除外されcount0になること', async () => {
        // Arrange
        const race = RaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('05'),
            overrides: { raceGrade: '未勝利' },
        });
        await insertRace(race);

        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/calendar?${params.toString()}`);
        const body = (await response.json()) as CalendarGetResponseBody;

        expect(response.status).toBe(200);
        expect(body.count).toBe(0);
    });

    it('CAL-4: 空DB_count0を返すこと', async () => {
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/calendar?${params.toString()}`);
        const body = (await response.json()) as CalendarGetResponseBody;

        expect(response.status).toBe(200);
        expect(body.count).toBe(0);
        expect(body.calendars).toHaveLength(0);
    });

    it('CAL-5: 不正なraceType_400を返すこと', async () => {
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'invalid-type',
        });
        const response = await requestApi(d1, `/calendar?${params.toString()}`);

        expect(response.status).toBe(400);
    });
});
