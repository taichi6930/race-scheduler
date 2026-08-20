/**
 * race.get.controller.usecase.repository.component.test.ts
 *
 * API-1 ~ API-14: GET /race エンドポイントのコンポーネントテスト
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 * （`requestApi` ヘルパー経由。詳細・設計方針は place.get...component.test.ts のコメントおよび
 * .claude/docs/testing-conventions.md §コンポーネントテスト を参照）。
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
    SERVICE_AUTH_HEADER,
    toJstISOString,
    validateLocationCode,
} from '@race-schedule/core';
import { eq } from 'drizzle-orm';
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

/**
 * GET /race・/race/calendar-event・/race/players はいずれも service-or-session
 * のため、サービス間認証ヘッダーを既定で付与する。
 */
const AUTH_HEADERS = { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN };

/**
 * インメモリD1（Drizzle経由）へ 1 件のレースを投入する
 * （JRAはrace_conditionも、raceStageを持つ場合はrace_stageも投入）
 */
const insertRace = async (
    db: DrizzleD1Database<typeof schema>,
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

    // JRA レースには race_condition が必須
    if (race.raceType === 'jra') {
        await db.insert(schema.raceCondition).values({
            raceId: race.raceId,
            distance: 2000,
            surfaceType: '芝',
        });
    }

    // KEIRIN/AUTORACE/BOATRACE等の機械式競技は race_stage に別テーブルで格納される
    if (race.raceStage) {
        await db.insert(schema.raceStage).values({
            raceId: race.raceId,
            raceStage: race.raceStage,
            isConfirmed: race.raceStageConfirmed === false ? 0 : 1,
        });
    }
};

describe('コンポーネントテスト: Race GET Router → Controller → Usecase → Repository → InMemory D1', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;

    beforeAll(() => {
        // 環境変数を設定して InMemory D1 を使用するモード
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        // 環境変数を復元
        restoreEnv();
    });

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        // コンテナをリセット
        container.clearInstances();
    });

    /**
     * API-1: 基本取得
     * 1件のレースを INSERT した後、GET リクエストで取得できることを確認
     */
    it('API-1: 基本取得 - 1件のレースを取得', async () => {
        // Arrange
        const race = RaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('05'), // 東京
        });
        await insertRace(db, race);

        // Act: GET /race リクエストを送る
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });

        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const text = await response.text();
        const responseBody = text ? JSON.parse(text) : {};

        // Assert: レスポンスを検証
        expect(response.status).toBe(200);
        expect(responseBody.count).toBe(1);
        expect(responseBody.races).toHaveLength(1);
        expect(responseBody.races[0]).toMatchObject({
            raceId: race.raceId,
            raceType: race.raceType,
            raceName: race.raceName,
        });
    });

    /**
     * API-2: 複数件取得
     * 3件のレースを INSERT し、全て取得でき、日付の昇順ソートが機能することを確認
     */
    it('API-2: 複数件取得 - 3件を日付昇順で取得', async () => {
        // Arrange
        const baseDate = new Date('2026-04-26T10:00:00+09:00');
        const races = [
            RaceFactory.create({
                datetime: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000), // +2時間
                raceNumber: 1,
            }),
            RaceFactory.create({
                datetime: new Date(baseDate.getTime()), // 基準時刻
                raceNumber: 2,
            }),
            RaceFactory.create({
                datetime: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000), // +4時間
                raceNumber: 3,
            }),
        ];
        for (const race of races) {
            await insertRace(db, race);
        }

        // Act: GET リクエスト
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            count: number;
            races: { raceNumber: number; datetime: string }[];
        };

        // Assert: 3件取得でき、日付昇順（基準時刻=2番, +2時間=1番, +4時間=3番の順）
        expect(responseBody.count).toBe(3);
        expect(responseBody.races.map((r) => r.raceNumber)).toEqual([2, 1, 3]);
    });

    /**
     * API-3: 日付フィルタ
     * 複数の日付のレースを用意し、日付範囲フィルタで正確に検索できることを確認
     */
    it('API-3: 日付フィルタ - 指定範囲内のみ取得', async () => {
        // Arrange
        const races = [
            RaceFactory.create({
                datetime: new Date('2026-04-25T10:00:00+09:00'),
                raceNumber: 1,
            }),
            RaceFactory.create({
                datetime: new Date('2026-04-26T10:00:00+09:00'),
                raceNumber: 2,
            }),
            RaceFactory.create({
                datetime: new Date('2026-04-27T10:00:00+09:00'),
                raceNumber: 3,
            }),
            RaceFactory.create({
                datetime: new Date('2026-04-28T10:00:00+09:00'),
                raceNumber: 4,
            }),
        ];
        for (const race of races) {
            await insertRace(db, race);
        }

        // Act: 2026-04-26 ～ 2026-04-27 で検索
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            count: number;
            races: unknown[];
        };

        // Assert: 2件のみ取得（4/26 と 4/27）
        expect(responseBody.count).toBe(2);
        expect(responseBody.races).toHaveLength(2);
    });

    /**
     * API-4: 複合フィルタ
     * raceTypeList と locationList の AND フィルタが機能することを確認
     */
    it('API-4: 複合フィルタ - raceType + location で取得', async () => {
        // Arrange
        const races = [
            RaceFactory.create({
                raceType: 'jra',
                locationCode: validateLocationCode('05'), // JRA 東京
                raceNumber: 1,
            }),
            RaceFactory.create({
                raceType: 'jra',
                locationCode: validateLocationCode('06'), // JRA 阪神
                raceNumber: 2,
            }),
            RaceFactory.create({
                raceType: 'nar',
                locationCode: validateLocationCode('01'), // NAR 北見
                raceNumber: 3,
            }),
        ];
        for (const race of races) {
            await insertRace(db, race);
        }

        // Act: JRA & 東京（05） で検索
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
            locationList: '05',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            count: number;
            races: { raceType: string; locationCode: string }[];
        };

        // Assert: JRA & 東京 の 1件のみ
        expect(responseBody.count).toBe(1);
        expect(responseBody.races).toHaveLength(1);
        expect(responseBody.races[0]).toMatchObject({
            raceType: 'jra',
            locationCode: validateLocationCode('05'),
        });
    });

    /**
     * API-5: 空結果処理
     * 条件に該当するレースがない場合、正常に空配列を返す
     */
    it('API-5: 空結果処理 - 該当なしで空配列を返す', async () => {
        // Arrange
        const race = RaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('05'),
        });
        await insertRace(db, race);

        // Act: 存在しない日付で検索（2026-05-01）
        const params = new URLSearchParams({
            startDate: '2026-05-01',
            finishDate: '2026-05-02',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            count: number;
            races: unknown[];
        };

        // Assert: 200 で空配列を返す
        expect(response.status).toBe(200);
        expect(responseBody.count).toBe(0);
        expect(responseBody.races).toHaveLength(0);
    });

    /**
     * API-6: 機械式競技のisCalendarSpecified
     * race_stage テーブル（別テーブル・LEFT JOIN）経由のステージ情報が
     * isCalendarSpecified判定（グレード×ステージ優先度）に正しく反映されることを確認する。
     */
    it('API-6: KEIRINのGⅠ・S級一次予選（負け戦）はDB往復後もisCalendarSpecified=false', async () => {
        // Arrange
        const race = RaceFactory.create({
            raceType: 'keirin',
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('43'),
            overrides: { raceGrade: 'GⅠ', raceStage: 'S級一次予選' },
        });
        await insertRace(db, race);

        // Act
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'keirin',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            races: { isCalendarSpecified: boolean }[];
        };

        // Assert: グレード単体ではisSpecifiedだが、priority<6のため false
        expect(response.status).toBe(200);
        expect(responseBody.races).toHaveLength(1);
        expect(responseBody.races[0].isCalendarSpecified).toBe(false);
    });

    /**
     * API-7: 未対応ステージの仮登録レース（raceStageConfirmed:false）は
     * 公開fetch（GET /race・GET /race/calendar-event）から除外され、
     * マスタ一致後の再アップサート（is_confirmed=1への更新）で復帰することを確認する。
     */
    it('API-7: 仮登録（raceStageConfirmed:false）のレースはGET /raceから除外され、確定後は復帰する', async () => {
        // Arrange
        const race = RaceFactory.create({
            raceType: 'keirin',
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('43'),
            overrides: { raceStage: '謎ステージ', raceStageConfirmed: false },
        });
        await insertRace(db, race);

        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'keirin',
        });

        // Act 1: 仮登録のままGET /race
        const beforeResponse = await requestApi(
            d1,
            `/race?${params.toString()}`,
            { headers: AUTH_HEADERS },
        );
        const beforeBody = (await beforeResponse.json()) as {
            count: number;
            races: unknown[];
        };

        // Act 2: 仮登録のままGET /race/calendar-event（raceIdを知っていても除外される）
        const calendarEventParams = new URLSearchParams({
            raceId: race.raceId,
        });
        const beforeCalendarResponse = await requestApi(
            d1,
            `/race/calendar-event?${calendarEventParams.toString()}`,
            { headers: AUTH_HEADERS },
        );

        // Assert 1: 一覧・単発取得の両方から除外される
        expect(beforeBody.count).toBe(0);
        expect(beforeBody.races).toHaveLength(0);
        expect(beforeCalendarResponse.status).toBe(404);

        // Act 3: マスタ一致後の再スクレイピング相当（upsertでis_confirmed=1に更新）
        await db
            .update(schema.raceStage)
            .set({ raceStage: 'S級決勝', isConfirmed: 1 })
            .where(eq(schema.raceStage.raceId, race.raceId));

        const afterResponse = await requestApi(
            d1,
            `/race?${params.toString()}`,
            { headers: AUTH_HEADERS },
        );
        const afterBody = (await afterResponse.json()) as {
            count: number;
            races: { raceStage?: string }[];
        };

        // Assert 2: 確定後は復帰し、更新後のraceStageが返る
        expect(afterBody.count).toBe(1);
        expect(afterBody.races[0].raceStage).toBe('S級決勝');
    });

    /**
     * API-9: バリデーション
     * 不正な日付範囲（startDate > finishDate）でリクエストした場合、
     * 現在のスキーマには日付範囲の検証が実装されていないため、
     * 200 で空配列が返される（将来的な実装で 400 エラーになることが期待される）
     */
    it('API-9: バリデーション - 不正な日付範囲の処理', async () => {
        // Act: startDate > finishDate という不正な日付範囲でリクエスト
        const params = new URLSearchParams({
            startDate: '2026-05-02',
            finishDate: '2026-05-01',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            count: number;
            races: unknown[];
        };

        // Assert: 現在のスキーマには startDate <= finishDate の検証がないため、
        // 200 で空配列が返される（バリデーションが実装されれば 400 エラーになる）
        expect(response.status).toBe(200);
        expect(responseBody.races).toHaveLength(0);
    });

    /**
     * API-10: タイムゾーン処理
     * JST でのレース時刻が UTC 環境でも正確に JST として返却されることを確認
     */
    it('API-10: タイムゾーン処理 - JST での日時が正確に返却される', async () => {
        // Arrange
        // JST 2026-04-26 10:00:00 でレースを作成
        const race = RaceFactory.create({
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            raceNumber: 1,
        });
        await insertRace(db, race);

        // Act: GET リクエスト
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-26',
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            races: { datetime: string }[];
        };

        // Assert: 返却された datetime が JST フォーマットで 2026-04-26T10:00:00+09:00 であることを確認
        expect(responseBody.races).toHaveLength(1);
        expect(responseBody.races[0].datetime).toBe(
            '2026-04-26T10:00:00+09:00',
        );
    });

    /**
     * API-11: 大量データ取得
     * 500件以上のレースを INSERT してパフォーマンスを検証
     * （テスト実行時間が 3 秒以内であることを確認）
     */
    it('API-11: 大量データ取得 - 500件以上のレースを効率的に検索', async () => {
        // Arrange
        // 500 件のレースを生成して INSERT
        const raceCount = 500;
        const baseDateMs = new Date('2026-04-26T10:00:00+09:00').getTime();

        for (let i = 0; i < raceCount; i++) {
            // 50 日間にわたってレースを分散
            const dayOffset = Math.floor(i / 10) % 50;
            const race = RaceFactory.create({
                datetime: new Date(
                    baseDateMs + dayOffset * 24 * 60 * 60 * 1000,
                ),
                raceNumber: (i % 10) + 1, // 1-10 の範囲
            });
            await insertRace(db, race);
        }

        // Act: GET リクエスト（広い日付範囲で全件取得）- 実行時間を測定
        const startTime = performance.now();
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-06-14', // 50 日間
            raceTypeList: 'jra',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const endTime = performance.now();
        const elapsedMs = endTime - startTime;

        const responseBody = (await response.json()) as {
            count: number;
            races: unknown[];
        };

        // Assert:
        // 1. 500 件全件が取得できること
        //    （dayOffset = floor(i / 10) % 50 は i が 0〜499 の範囲では
        //     floor(i / 10) が 0〜49 に収まり %50 では折り返さないため、
        //     raceNumber(1-10) との組み合わせで raceId が全件一意になり upsert の
        //     上書きによる欠落が起きない。日付レンジ（2026-04-26〜2026-06-14 の
        //     50日間）も全dayOffsetを包含するため、日付フィルタで除外される行も
        //     無い。実測でも常に500件が返ることを確認済みのため、決定的な値に固定する）
        // 2. レスポンス時間が 3000ms 以内
        expect(responseBody.count).toBe(500);
        expect(elapsedMs).toBeLessThan(3000);
    });

    /**
     * API-12: 冪等性
     * 同じリクエストを 2 回実行して、同じ結果が返されることを確認
     * （キャッシュされているかどうかではなく、データが変更されないことを検証）
     */
    it('API-12: 冪等性 - 同一リクエストで同一結果が返される', async () => {
        // Arrange
        const races = [
            RaceFactory.create({
                datetime: new Date('2026-04-26T10:00:00+09:00'),
                raceNumber: 1,
            }),
            RaceFactory.create({
                datetime: new Date('2026-04-26T14:00:00+09:00'),
                raceNumber: 2,
            }),
            RaceFactory.create({
                datetime: new Date('2026-04-27T10:00:00+09:00'),
                raceNumber: 3,
            }),
        ];
        for (const race of races) {
            await insertRace(db, race);
        }

        // Act: 同じリクエストを 2 回実行
        const params = new URLSearchParams({
            startDate: '2026-04-26',
            finishDate: '2026-04-27',
            raceTypeList: 'jra',
        });

        const response1 = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody1 = (await response1.json()) as {
            count: number;
            races: unknown[];
        };

        const response2 = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody2 = (await response2.json()) as {
            count: number;
            races: unknown[];
        };

        // Assert: 2 回のリクエストで同一の結果が返される
        expect(responseBody1.count).toBe(responseBody2.count);
        expect(responseBody1.count).toBe(3);
        expect(JSON.stringify(responseBody1.races)).toBe(
            JSON.stringify(responseBody2.races),
        );
    });

    /**
     * API-13: カレンダーイベントプレビュー取得（GET /race/calendar-event）
     *
     * Controller → Usecase → Repository → InMemory D1 を通し、実DBに保存された
     * place_held_day（開催回数・日数）が正しく結合され、calendar Workerが実際に
     * Google Calendarへ登録する内容（発走時刻・netkeiba/YouTubeリンク）と
     * 同一の説明文が組み立てられることを確認する。
     */
    it('API-13: カレンダーイベントプレビュー取得 - 実DBのplace_held_dayを結合して説明文を組み立てる', async () => {
        // Arrange
        const race = RaceFactory.create({
            raceType: 'jra',
            datetime: new Date('2026-07-25T10:20:00+09:00'),
            locationCode: validateLocationCode('04'), // 新潟
            raceNumber: 2,
            overrides: { raceName: '2歳新馬', raceGrade: '新馬' },
        });
        await insertRace(db, race);
        await db.insert(schema.placeHeldDay).values({
            placeId: race.placeId,
            heldTimes: 2,
            heldDayTimes: 1,
        });

        // Act
        const params = new URLSearchParams({ raceId: race.raceId });
        const response = await requestApi(
            d1,
            `/race/calendar-event?${params.toString()}`,
            { headers: AUTH_HEADERS },
        );
        const responseBody = (await response.json()) as {
            summary: string;
            description: string;
            location: string;
            links: { label: string; url: string }[];
        };

        // Assert
        expect(response.status).toBe(200);
        expect(responseBody.summary).toBe('2歳新馬');
        expect(responseBody.location).toBe('新潟競馬場');
        expect(responseBody.description).toContain('発走: 10:20');
        expect(responseBody.description).toContain('レース情報(netkeiba)');
        expect(responseBody.description).toContain('レース動画(netkeiba)');
        expect(responseBody.description).toContain('レース映像（公式YouTube）');
        expect(responseBody.links.map((link) => link.label)).toEqual([
            'レース情報(netkeiba)',
            'レース動画(netkeiba)',
            'レース映像（公式YouTube）',
        ]);
    });

    /**
     * API-14: カレンダーイベントプレビュー取得 - 該当レースなし
     */
    it('API-14: カレンダーイベントプレビュー取得 - 該当レースが存在しない場合404を返す', async () => {
        // Act: DBに何も投入せずリクエスト
        const params = new URLSearchParams({ raceId: 'jra202607250499' });
        const response = await requestApi(
            d1,
            `/race/calendar-event?${params.toString()}`,
            { headers: AUTH_HEADERS },
        );

        // Assert
        expect(response.status).toBe(404);
    });

    /**
     * API-15: isWatched付与（KPLAYER-07）
     * race_player + player_watch(priority>0) を実DBに投入し、GET /race のレスポンスに
     * isWatchedが正しく反映されること（controller→usecase→repositoryの配線確認）。
     */
    it('API-15: 注目選手が出走するレースはisWatched=trueで返る', async () => {
        // Arrange
        const race = RaceFactory.create({
            raceType: 'keirin',
            datetime: new Date('2026-08-02T10:00:00+09:00'),
            locationCode: validateLocationCode('36'),
            raceNumber: 1,
        });
        await insertRace(db, race);
        await db.insert(schema.racePlayer).values({
            racePlayerId: `${race.raceId}01`,
            raceId: race.raceId,
            raceType: 'keirin',
            carNumber: 1,
            frameNumber: 1,
            playerNo: '014833',
            playerName: '高久保雄介',
        });
        await db.insert(schema.playerWatch).values({
            raceType: 'keirin',
            playerNo: '014833',
            priority: 10,
        });

        // Act
        const params = new URLSearchParams({
            startDate: '2026-08-02',
            finishDate: '2026-08-03',
            raceTypeList: 'keirin',
        });
        const response = await requestApi(d1, `/race?${params.toString()}`, {
            headers: AUTH_HEADERS,
        });
        const responseBody = (await response.json()) as {
            races: { isWatched: boolean }[];
        };

        // Assert
        expect(response.status).toBe(200);
        expect(responseBody.races).toHaveLength(1);
        expect(responseBody.races[0].isWatched).toBe(true);
    });

    /**
     * API-16: 出走選手一覧取得（GET /race/players、KPLAYER-07）
     * race_player + player_keirin を実DBに投入し、車番昇順・期別/府県付きで
     * 返ることを確認する（controller→usecase→repositoryの配線確認）。
     */
    it('API-16: 出走選手一覧を車番昇順で取得できる', async () => {
        // Arrange
        const race = RaceFactory.create({
            raceType: 'keirin',
            datetime: new Date('2026-08-02T10:00:00+09:00'),
            locationCode: validateLocationCode('36'),
            raceNumber: 1,
        });
        await insertRace(db, race);
        await db.insert(schema.playerKeirin).values({
            playerNo: '014833',
            term: 100,
            branch: '京都',
        });
        await db.insert(schema.racePlayer).values([
            {
                racePlayerId: `${race.raceId}02`,
                raceId: race.raceId,
                raceType: 'keirin',
                carNumber: 2,
                frameNumber: 2,
                playerNo: '014834',
                playerName: '梁島邦友',
            },
            {
                racePlayerId: `${race.raceId}01`,
                raceId: race.raceId,
                raceType: 'keirin',
                carNumber: 1,
                frameNumber: 1,
                playerNo: '014833',
                playerName: '高久保雄介',
            },
        ]);

        // Act
        const params = new URLSearchParams({ raceId: race.raceId });
        const response = await requestApi(
            d1,
            `/race/players?${params.toString()}`,
            { headers: AUTH_HEADERS },
        );
        const responseBody = (await response.json()) as {
            raceId: string;
            players: {
                carNumber: number;
                playerName: string;
                term?: number;
                branch?: string;
            }[];
        };

        // Assert
        expect(response.status).toBe(200);
        expect(responseBody.raceId).toBe(race.raceId);
        expect(responseBody.players.map((p) => p.carNumber)).toEqual([1, 2]);
        expect(responseBody.players[0]).toMatchObject({
            playerName: '高久保雄介',
            term: 100,
            branch: '京都',
        });
        expect(responseBody.players[1]).toMatchObject({
            playerName: '梁島邦友',
        });
    });
});
