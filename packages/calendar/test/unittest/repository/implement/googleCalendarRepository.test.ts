/**
 * googleCalendarRepository.test.ts - GoogleCalendarRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: fetch()
 * | ケース | ゲートウェイ結果 | 期待値 |
 * |--------|------------------|--------|
 * | F1 | JRA 向けイベントリスト | Array[CalendarDataEntity] |
 * | F2 | 空リスト | [] |
 *
 * ### メソッド: upsert()
 * | ケース | 既存イベント（fetchCalendarDataListの結果） | 作成されたイベントID | 期待値 |
 * |--------|-------------------------------------------|------------------|--------|
 * | U1 | Mapに該当IDが無い（空配列） | "new-event-id" | insertedCount++、fetchCalendarDataListは1回だけ呼ばれる（PERF-072） |
 * | U2 | Mapに該当IDがある・内容に差分あり | - | updatedCount++、updateCalendarDataが呼ばれる |
 * | U3 | Mapに該当IDが無い、作成IDが空 | - | failureCount++ |
 * | U4 | insertCalendarDataがreject | - | failureCount++ |
 * | U5 | チャンク >10 エンティティ（同一raceType） | "new-event-id" | 全件insert、fetchCalendarDataListは1回だけ呼ばれる |
 * | U6 | 事前取得（fetchCalendarDataList）自体がthrow | - | 空Map扱いとなりinsertを試みる（従来のfindExistingEvent失敗時の挙動を踏襲） |
 * | U7 | 複数raceTypeのエンティティが混在 | - | raceTypeごとに1回ずつfetchCalendarDataListが呼ばれる |
 * | U8 | Mapに該当IDがある・内容が完全一致 | - | updatedCount++だがupdateCalendarDataは呼ばれない（PERF-076） |
 * | U9 | Mapに該当IDが無いが、新規作成直前の単発GET再確認で見つかる（TOCTOU） | - | insertCalendarDataは呼ばれずupdateCalendarDataが呼ばれ、updatedCount++（CONC-02） |
 * | U10 | Mapに該当IDが無く、再確認GETも404で見つからない | "new-event-id" | 従来通りinsertedCount++（CONC-02、再確認追加後もリグレッション無し） |
 * | U11 | 新規作成直前の再確認GETが404以外のエラーでthrow | - | failureCount++（CONC-02、再確認自体の失敗は個別レースの失敗として扱う） |
 *
 * ### メソッド: cleanseStaleEvents()
 * | ケース | カレンダー上のイベント | 有効レース | 今回取得できた開催場・日付 | 期待値 |
 * |--------|----------------------|-----------|--------------------------|--------|
 * | CS1 | 有効ID + 不要ID（同じ開催場・日付）が混在 | 有効レース1件 | 不要IDと同じ開催場・日付 | deletedCount=1 |
 * | CS2 | 有効IDのみ | 有効レース1件 | 有効IDと同じ開催場・日付 | deletedCount=0 |
 * | CS3 | 不要IDあり、削除 API が throw | なし | 不要IDと同じ開催場・日付 | failureCount++ |
 * | CS4 | fetchCalendarDataList が throw | - | NAR不要IDと同じ開催場・日付 | failureCount++、次の raceType を継続 |
 * | CS8 | 有効セットに無いが未取得の開催場・日付のイベント | 空 | 空（未取得） | 削除しない（判断材料が無いため） |
 * | CS9 | 同一raceTypeの有効レースが複数件 | 有効レース2件（同raceType） | 2件と同じ開催場・日付＋不要ID1件 | deletedCount=1（グルーピングされても正しく判定） |
 *
 * ### upsert → cleanseStaleEvents 連携（PERF-073）
 * | ケース | 条件 | 期待値 |
 * |--------|------|--------|
 * | I1 | 同一raceTypeでupsert後にcleanseStaleEventsを呼ぶ | fetchCalendarDataListは合計1回（再フェッチしない）、post-upsertの内容で判定される |
 * | I2 | upsertで対象外だったraceType（有効レース0件） | cleanseStaleEvents側で独自にfetchCalendarDataListを呼ぶ |
 *
 * ### メソッド: deleteById()
 * | ケース | gateway.deleteCalendarData | 期待値 |
 * |--------|---------------------------|--------|
 * | D1 | 成功 | gatewayをsanitize済みeventIdで呼ぶ（raceIdはRaceId型のため常に無変換。buildCalendarEventIdのサニタイズ自体はcore側calendarEventContent.test.tsのI1/I2で検証済み） |
 * | D2 | throw（イベント未存在等） | 例外を投げず正常終了（警告ログのみ） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    type CalendarFilterParams,
    convertRaceEntityToCalendarEvent,
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import { createMockFn, type Mocked } from '@race-schedule/core/test';
import 'reflect-metadata';
import type { IGoogleCalendarGateway } from '../../../../src/gateway/interface/IGoogleCalendarGateway';
import { GoogleCalendarRepository } from '../../../../src/repository/implement/googleCalendarRepository';

const JRA_ENTITY: RaceEntity = {
    raceId: validateRaceId('jra202501010501'),
    placeId: validatePlaceId('jra2025010105'),
    raceType: RaceType.JRA,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: '有馬記念',
    raceNumber: 1,
    raceCourse: '東京',
    locationCode: validateLocationCode('05'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2000 },
    placeHeldDays: { heldTimes: 3, heldDayTimes: 1 },
};

describe('GoogleCalendarRepository', () => {
    let mockGateway: Mocked<IGoogleCalendarGateway>;
    let repository: GoogleCalendarRepository;

    const originalDateNow = Date.now;
    const freezeDateTo = (iso: string) => {
        Date.now = () => new Date(iso).getTime();
    };

    beforeEach(() => {
        mockGateway = {
            fetchCalendarDataList: createMockFn(async () => []),
            // CONC-02: 新規作成直前の再確認（fetchExistingEventOrNull）で呼ばれる。
            // 既定は「まだ存在しない」を表す404を返す（従来通りinsertへ進む）。
            fetchCalendarData: createMockFn(() =>
                Promise.reject(
                    new Error('Google Calendar API error: 404 Not Found'),
                ),
            ),
            updateCalendarData: createMockFn(async () => {}),
            insertCalendarData: createMockFn(async () => 'new-event-id'),
            deleteCalendarData: createMockFn(async () => {}),
        };
        repository = new GoogleCalendarRepository(mockGateway);
    });

    afterEach(() => {
        Date.now = originalDateNow;
    });

    describe('fetch', () => {
        // F1: CalendarDataEntity[] を返す
        it('F1: gatewayイベントからCalendarDataEntity配列を返す', async () => {
            const params: CalendarFilterParams = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            mockGateway.fetchCalendarDataList.mockResolvedValue([
                {
                    id: 'event-123',
                    summary: '有馬記念',
                    start: { dateTime: '2025-01-01T09:00:00+09:00' },
                    end: { dateTime: '2025-01-01T09:10:00+09:00' },
                    location: '東京競馬場',
                    description: '説明',
                },
            ]);

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('event-123');
            expect(result[0].title).toBe('有馬記念');
        });

        // F2: 空のイベントリスト → [] を返す
        it('F2: gatewayがイベントなしのとき空配列を返す', async () => {
            const params: CalendarFilterParams = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.NAR],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(0);
        });

        it('F3: predicted/confirmed/dateルールでイベントをフィルタする', async () => {
            freezeDateTo('2026-06-01T00:00:00.000Z');
            const params: CalendarFilterParams = {
                startDate: new Date('2026-05-31'),
                finishDate: new Date('2026-06-05'),
                raceTypeList: [RaceType.JRA],
            };

            mockGateway.fetchCalendarDataList.mockResolvedValue([
                {
                    id: 'past-predicted',
                    summary: '過去予測',
                    start: { dateTime: '2026-05-31T09:00:00+09:00' },
                    end: { dateTime: '2026-05-31T09:10:00+09:00' },
                    location: '東京',
                    description: '過去予測イベント',
                    extendedProperties: { private: { status: 'predicted' } },
                },
                {
                    id: 'today-confirmed',
                    summary: '本日確定',
                    start: { dateTime: '2026-06-01T09:00:00+09:00' },
                    end: { dateTime: '2026-06-01T09:10:00+09:00' },
                    location: '東京',
                    description: '本日確定イベント',
                    extendedProperties: { private: { status: 'confirmed' } },
                },
                {
                    id: 'tomorrow-unmarked',
                    summary: '翌日無印',
                    start: { dateTime: '2026-06-02T09:00:00+09:00' },
                    end: { dateTime: '2026-06-02T09:10:00+09:00' },
                    location: '東京',
                    description: '翌日無印イベント',
                },
                {
                    id: 'tomorrow-predicted',
                    summary: '翌日予測',
                    start: { dateTime: '2026-06-02T10:00:00+09:00' },
                    end: { dateTime: '2026-06-02T10:10:00+09:00' },
                    location: '東京',
                    description: '翌日予測イベント',
                    extendedProperties: { private: { status: 'predicted' } },
                },
                {
                    id: 'after-tomorrow-predicted',
                    summary: '翌々日予測',
                    start: { dateTime: '2026-06-03T09:00:00+09:00' },
                    end: { dateTime: '2026-06-03T09:10:00+09:00' },
                    location: '東京',
                    description: '翌々日予測イベント',
                    extendedProperties: { private: { status: 'predicted' } },
                },
            ]);

            const result = await repository.fetch(params);

            expect(result.map((item) => item.id)).toEqual([
                'today-confirmed',
                'after-tomorrow-predicted',
            ]);
        });
    });

    describe('upsert', () => {
        const UPSERT_PARAMS: CalendarFilterParams = {
            startDate: new Date('2025-01-01'),
            finishDate: new Date('2025-01-31'),
            raceTypeList: [RaceType.JRA],
        };

        // U1: Mapに該当IDが無い（デフォルトのfetchCalendarDataListが空配列）→ insertedCount++
        it('U1: イベント未存在時にinsertedCountを増やしfetchCalendarDataListは1回だけ呼ばれる', async () => {
            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.insertedCount).toBe(1);
            expect(result.updatedCount).toBe(0);
            expect(result.deletedCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.fetchCalendarDataList).toHaveBeenCalledTimes(1);
        });

        // U2: Mapに該当IDがある・内容に差分あり → updatedCount++、updateCalendarDataが呼ばれる
        it('U2: イベント既存かつ内容に差分があるときupdatedCountを増やしupdateCalendarDataを呼ぶ', async () => {
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                { id: 'jra202501010501', summary: '既存イベント（差分あり）' },
            ]);

            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.updatedCount).toBe(1);
            expect(result.insertedCount).toBe(0);
            expect(result.deletedCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.updateCalendarData).toHaveBeenCalledTimes(1);
        });

        // U8: Mapに該当IDがある・内容が完全一致 → updatedCount++だがupdateCalendarDataは呼ばれない（PERF-076）
        it('U8: 既存イベントと内容が完全一致するときupdateCalendarDataを呼ばずupdatedCountのみ増やす', async () => {
            const unchangedEventData = {
                ...convertRaceEntityToCalendarEvent(JRA_ENTITY),
                extendedProperties: { private: { status: 'confirmed' } },
            };
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                unchangedEventData,
            ]);

            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.updatedCount).toBe(1);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.updateCalendarData).not.toHaveBeenCalled();
        });

        // U9 (CONC-02): Mapには無いが、新規作成直前の単発GET再確認で既に他プロセスが
        // 作成済みだった場合、insertではなくupdateへ切り替わる（TOCTOU対策）
        it('U9: 新規作成直前の再確認で既存イベントが見つかった場合updateへ切り替わる', async () => {
            const foundByRecheck = {
                id: 'jra202501010501',
                summary: '他プロセスが先に作成したイベント',
            };
            mockGateway.fetchCalendarData.mockResolvedValue(foundByRecheck);

            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.updatedCount).toBe(1);
            expect(result.insertedCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.insertCalendarData).not.toHaveBeenCalled();
            expect(mockGateway.updateCalendarData).toHaveBeenCalledTimes(1);
        });

        // U10 (CONC-02): 再確認GETも404 → 従来通りinsertされる（リグレッション無し）
        it('U10: 再確認GETも404の場合は従来通りinsertされる', async () => {
            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.insertedCount).toBe(1);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.fetchCalendarData).toHaveBeenCalledTimes(1);
        });

        // U11 (CONC-02): 再確認GETが404以外のエラーでthrow → failureCount++
        it('U11: 再確認GETが404以外のエラーでthrowした場合failureCountを増やす', async () => {
            mockGateway.fetchCalendarData.mockRejectedValue(
                new Error('Google Calendar API error: 500 Internal Error'),
            );

            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.failureCount).toBe(1);
            expect(result.insertedCount).toBe(0);
            expect(result.updatedCount).toBe(0);
            expect(mockGateway.insertCalendarData).not.toHaveBeenCalled();
        });

        // U3: insertCalendarData が空文字を返す → failureCount++
        it('U3: insertCalendarDataが空文字を返すときfailureCountを増やす', async () => {
            mockGateway.insertCalendarData.mockResolvedValue('');

            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.failureCount).toBe(1);
            expect(result.insertedCount).toBe(0);
        });

        // U4: Promise が全体的に reject → failureCount++
        it('U4: upsert promiseがrejectされたときfailureCountを増やす', async () => {
            mockGateway.insertCalendarData.mockRejectedValue(
                new Error('API unavailable'),
            );

            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.failureCount).toBe(1);
            expect(result.failures).toHaveLength(1);
        });

        // U5: 10件超のエンティティ → 全件insertされ、fetchCalendarDataListは1回だけ呼ばれる
        it('U5: 10件超のエンティティをチャンクで処理してもfetchCalendarDataListは1回だけ呼ばれる', async () => {
            const entities: RaceEntity[] = Array.from(
                { length: 11 },
                (_, i) => ({
                    ...JRA_ENTITY,
                    raceId: validateRaceId(
                        `jra2025010105${String(i + 1).padStart(2, '0')}`,
                    ),
                    raceNumber: i + 1,
                }),
            );

            const result = await repository.upsert(UPSERT_PARAMS, entities);

            expect(result.insertedCount).toBe(11);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.fetchCalendarDataList).toHaveBeenCalledTimes(1);
        });

        // U6: 事前取得（fetchCalendarDataList）自体がthrow → 空Map扱いでinsertを試みる
        it('U6: 事前取得がthrowしても空Map扱いとしてinsertを試みる', async () => {
            mockGateway.fetchCalendarDataList.mockRejectedValue(
                new Error('network error'),
            );

            const result = await repository.upsert(UPSERT_PARAMS, [JRA_ENTITY]);

            expect(result.insertedCount).toBe(1);
            expect(result.failureCount).toBe(0);
        });

        // U7: 複数raceTypeのエンティティが混在 → raceTypeごとに1回ずつfetchCalendarDataListが呼ばれる
        it('U7: 複数raceTypeが混在してもraceTypeごとに1回ずつ事前取得する', async () => {
            const NAR_ENTITY: RaceEntity = {
                ...JRA_ENTITY,
                raceId: validateRaceId('nar202501010801'),
                placeId: validatePlaceId('nar2025010108'),
                raceType: RaceType.NAR,
                locationCode: validateLocationCode('08'),
            };
            const multiTypeParams: CalendarFilterParams = {
                ...UPSERT_PARAMS,
                raceTypeList: [RaceType.JRA, RaceType.NAR],
            };

            const result = await repository.upsert(multiTypeParams, [
                JRA_ENTITY,
                NAR_ENTITY,
            ]);

            expect(result.insertedCount).toBe(2);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.fetchCalendarDataList).toHaveBeenCalledTimes(2);
        });
    });

    describe('cleanseStaleEvents', () => {
        const PARAMS: CalendarFilterParams = {
            startDate: new Date('2025-01-01'),
            finishDate: new Date('2025-01-31'),
            raceTypeList: [RaceType.JRA],
        };

        // CS1: 有効IDと不要ID（同じ開催場・日付）が混在 → 不要イベントを削除し deletedCount++
        it('CS1: place/dateが対象のとき有効レースにない古いイベントを削除する', async () => {
            // JRA_ENTITY の有効ID は 'jra202501010501'（raceId がそのまま使われる）
            // 'jra202501010502' は同じ開催場・日付の別レース番号（例: 番組変更で消えた枠）
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                { id: 'jra202501010501' }, // 有効なイベント
                { id: 'jra202501010502' }, // 不要なイベント（同じ開催場・日付）
            ]);

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY],
                [JRA_ENTITY], // 今回同じ開催場・日付を取得できている
            );

            expect(result.deletedCount).toBe(1);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.deleteCalendarData).toHaveBeenCalledTimes(1);
        });

        // CS2: 不要イベントなし → deletedCount = 0
        it('CS2: 全イベントが有効なとき何も削除しない', async () => {
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                { id: 'jra202501010501' }, // 有効なイベント
            ]);

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY],
                [JRA_ENTITY],
            );

            expect(result.deletedCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.deleteCalendarData).not.toHaveBeenCalled();
        });

        // CS8: 有効セットに無いが、今回そもそも取得できていない開催場・日付のイベント → 削除しない
        it('CS8: 対象外のplace/date（未スクレイプ）のイベントを削除しない', async () => {
            // 'jra202501020501' は JRA_ENTITY とは別の日付（未取得）のイベント
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                { id: 'jra202501020501' },
            ]);

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [], // 有効セットには無い
                [], // 今回の取得結果にも無い（＝まだスクレイピングされていない可能性）
            );

            expect(result.deletedCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.deleteCalendarData).not.toHaveBeenCalled();
        });

        it('CS5: idが有効でも本日以前のpredictedイベントを削除する', async () => {
            freezeDateTo('2026-06-01T00:00:00.000Z');
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                {
                    id: 'jra202501010501',
                    start: { dateTime: '2026-05-31T09:00:00+09:00' },
                    end: { dateTime: '2026-05-31T09:10:00+09:00' },
                    extendedProperties: { private: { status: 'predicted' } },
                },
            ]);

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY],
                [],
            );

            expect(result.deletedCount).toBe(1);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.deleteCalendarData).toHaveBeenCalledTimes(1);
        });

        it('CS6: idが有効でも翌日の未マークイベントを削除する', async () => {
            freezeDateTo('2026-06-01T00:00:00.000Z');
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                {
                    id: 'jra202501010501',
                    start: { dateTime: '2026-06-02T09:00:00+09:00' },
                    end: { dateTime: '2026-06-02T09:10:00+09:00' },
                },
            ]);

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY],
                [],
            );

            expect(result.deletedCount).toBe(1);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.deleteCalendarData).toHaveBeenCalledTimes(1);
        });

        it('CS7: idが有効なとき本日以前のconfirmedイベントを削除しない', async () => {
            freezeDateTo('2026-06-01T00:00:00.000Z');
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                {
                    id: 'jra202501010501',
                    start: { dateTime: '2026-06-01T09:00:00+09:00' },
                    end: { dateTime: '2026-06-01T09:10:00+09:00' },
                    extendedProperties: { private: { status: 'confirmed' } },
                },
            ]);

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY],
                [],
            );

            expect(result.deletedCount).toBe(0);
            expect(result.failureCount).toBe(0);
            expect(mockGateway.deleteCalendarData).not.toHaveBeenCalled();
        });

        // CS3: deleteCalendarData が throw → failureCount++
        it('CS3: deleteCalendarDataがthrowしたときfailureCountを増やす', async () => {
            // 'jra202501010502' は JRA_ENTITY と同じ開催場・日付の別レース番号（今回取得済み＝削除判定対象）
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                { id: 'jra202501010502' },
            ]);
            mockGateway.deleteCalendarData.mockRejectedValue(
                new Error('API error'),
            );

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [],
                [JRA_ENTITY],
            );

            expect(result.deletedCount).toBe(0);
            expect(result.failureCount).toBe(1);
            expect(result.failures).toHaveLength(1);
        });

        // CS9: 同一raceTypeの有効レースが複数件あっても、グルーピングされ正しく判定される
        it('CS9: 同一raceTypeの有効レースが複数件あっても正しくグルーピングされ判定される', async () => {
            const JRA_ENTITY_2: RaceEntity = {
                ...JRA_ENTITY,
                raceId: validateRaceId('jra202501010502'),
                raceNumber: 2,
            };
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                { id: 'jra202501010501' }, // 有効なイベント
                { id: 'jra202501010502' }, // 有効なイベント
                { id: 'jra202501010503' }, // 不要なイベント（同じ開催場・日付）
            ]);

            const result = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY, JRA_ENTITY_2],
                [JRA_ENTITY, JRA_ENTITY_2],
            );

            expect(result.deletedCount).toBe(1);
            expect(result.failureCount).toBe(0);
        });

        // CS4: fetchCalendarDataList が throw → failureCount++、次の raceType を継続
        it('CS4: fetchCalendarDataListがthrowしたときfailureCountを記録し次のraceTypeへ継続する', async () => {
            const NAR_ENTITY: RaceEntity = {
                ...JRA_ENTITY,
                raceId: validateRaceId('nar202501010801'),
                placeId: validatePlaceId('nar2025010108'),
                raceType: RaceType.NAR,
                locationCode: validateLocationCode('08'),
            };

            // JRA は throw、NAR は正常（同じ開催場・日付の別レース番号＝不要イベントあり）
            mockGateway.fetchCalendarDataList = createMockFn(
                async (raceType: RaceType) => {
                    if (raceType === RaceType.JRA) {
                        throw new Error('API error for JRA');
                    }
                    return [{ id: 'nar202501010802' }];
                },
            );

            const multiTypeParams: CalendarFilterParams = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA, RaceType.NAR],
            };

            const result = await repository.cleanseStaleEvents(
                multiTypeParams,
                [],
                [NAR_ENTITY],
            );

            // JRA が失敗、NAR の不要イベントが削除される
            expect(result.failureCount).toBe(1);
            expect(result.failures).toHaveLength(1);
            expect(result.deletedCount).toBe(1);
        });
    });

    describe('upsert → cleanseStaleEvents 連携（PERF-073: イベント一覧キャッシュの共有）', () => {
        const PARAMS: CalendarFilterParams = {
            startDate: new Date('2025-01-01'),
            finishDate: new Date('2025-01-31'),
            raceTypeList: [RaceType.JRA],
        };

        // 同一インスタンスでupsert→cleanseStaleEventsを呼んだ場合、
        // 同じraceTypeに対するfetchCalendarDataListは1回だけになり（重複GET解消）、
        // かつcleanseStaleEventsはupsertで更新済みの内容（post-upsert状態）を見る。
        it('upsertで確定済みに更新されたイベントはcleanseStaleEventsで再フェッチせず過去日付でも削除されない', async () => {
            freezeDateTo('2026-06-01T00:00:00.000Z');
            // upsert時点ではpredicted・過去日付（本来ならstale判定で削除対象になり得る内容）
            mockGateway.fetchCalendarDataList.mockResolvedValueOnce([
                {
                    id: 'jra202501010501',
                    start: { dateTime: '2020-01-01T09:00:00+09:00' },
                    extendedProperties: { private: { status: 'predicted' } },
                },
            ]);

            const upsertResult = await repository.upsert(PARAMS, [JRA_ENTITY]);

            // 内容に差分がある（status: predicted→confirmed 等）ためupdateCalendarDataが呼ばれる
            expect(upsertResult.updatedCount).toBe(1);
            expect(mockGateway.updateCalendarData).toHaveBeenCalledTimes(1);

            const cleanseResult = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY],
                [JRA_ENTITY],
            );

            // cleanseStaleEvents側では再フェッチしない（fetchCalendarDataListは合計1回のまま）
            expect(mockGateway.fetchCalendarDataList).toHaveBeenCalledTimes(1);
            // post-upsertでstatus:'confirmed'に更新済みのため、過去日付でも削除対象にならない
            expect(cleanseResult.deletedCount).toBe(0);
            expect(cleanseResult.failureCount).toBe(0);
        });

        // upsertで対象外だったraceType（例: 有効レース0件）は、cleanseStaleEvents側で
        // 独自にfetchCalendarDataListを呼ぶ（キャッシュが無ければ通常どおり取得する）
        it('upsertで事前取得されなかったraceTypeはcleanseStaleEvents側で独自に取得する', async () => {
            mockGateway.fetchCalendarDataList.mockResolvedValue([
                { id: 'jra202501010502' }, // 不要なイベント
            ]);

            // 有効レース0件のためupsertはfetchCalendarDataListを呼ばない
            await repository.upsert(PARAMS, []);
            expect(mockGateway.fetchCalendarDataList).not.toHaveBeenCalled();

            const cleanseResult = await repository.cleanseStaleEvents(
                PARAMS,
                [JRA_ENTITY],
                [JRA_ENTITY],
            );

            expect(mockGateway.fetchCalendarDataList).toHaveBeenCalledTimes(1);
            expect(cleanseResult.deletedCount).toBe(1);
        });
    });

    describe('deleteById', () => {
        // D1: 成功 → sanitize済みeventIdでgatewayを呼ぶ
        // raceIdはRaceId型（validateRaceId済み）でのみ受け付けるため、この呼び出し経路では
        // サニタイズ対象文字（大文字・記号）を含む入力は型上渡せない（常に無変換）。
        // buildCalendarEventIdのサニタイズ自体は
        // core/test/unittest/domain/policy/calendarEventContent.test.ts の I1/I2 で
        // 直接検証済み（大文字・記号混在→'-'置換）。
        it('D1: raceIdをsanitizeしたeventIdでgateway.deleteCalendarDataを呼ぶ', async () => {
            await repository.deleteById(
                RaceType.JRA,
                validateRaceId('jra202501010501'),
            );

            expect(mockGateway.deleteCalendarData).toHaveBeenCalledWith(
                RaceType.JRA,
                'jra202501010501',
            );
        });

        // D2: gatewayがthrow → 例外を投げず正常終了する
        it('D2: gatewayがthrowしても例外を投げず正常終了する', async () => {
            mockGateway.deleteCalendarData = createMockFn(async () => {
                throw new Error('event not found');
            });

            await expect(
                repository.deleteById(
                    RaceType.JRA,
                    validateRaceId('jra202501010501'),
                ),
            ).resolves.toBeUndefined();
        });
    });
});
