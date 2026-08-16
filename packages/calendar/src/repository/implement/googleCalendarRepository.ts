import type { CalendarUpsertResult } from '@race-schedule/core';
import {
    appLogger,
    buildCalendarEventId,
    type CalendarDataEntity,
    type CalendarFilterParams,
    convertRaceEntityToCalendarEvent,
    createEmptyCalendarUpsertResult,
    createErrorMessage,
    DI_TOKENS,
    LogAllMethods,
    type RaceEntity,
    type RaceId,
    type RaceType,
} from '@race-schedule/core';
import type { calendar_v3 } from 'googleapis';
import { inject, injectable } from 'tsyringe';

import type { IGoogleCalendarGateway } from '../../gateway/interface/IGoogleCalendarGateway';
import type { ICalendarRepository } from '../interface/ICalendarRepository';
import { filterDisplayableAndConvert } from '../utility/calendarEventMapper';
import { hasEventContentChanged } from '../utility/eventContentDiff';
import { runRateLimited } from '../utility/runRateLimited';
import {
    buildStaleEventLookups,
    type CleanseStaleEventsContext,
    groupRaceEntitiesByRaceType,
    selectStaleEvents,
} from '../utility/staleEventResolver';

/** Google Calendar API の同時実行数（~5req/s のレート制限に対応） */
const GOOGLE_CALENDAR_CONCURRENCY = 3;
/** Google Calendar API のチャンク間待機ミリ秒 */
const GOOGLE_CALENDAR_RATE_LIMIT_DELAY_MS = 1000;
/**
 * cleanseStaleEvents の raceType 単位の同時実行数（PERF-071）。
 * raceType 1件の処理内部でも GOOGLE_CALENDAR_CONCURRENCY 件が並列実行されるため、
 * ここは低めの値にして総同時リクエスト数（この値 × GOOGLE_CALENDAR_CONCURRENCY）を
 * upsert 側と同程度に抑える
 */
const GOOGLE_CALENDAR_RACE_TYPE_CONCURRENCY = 2;

/**
 * Google Calendar API のエラーが「対象イベントが存在しない（404）」ことを示すかを判定する。
 * @remarks
 * `GoogleCalendarGateway` は非2xxレスポンスを `Google Calendar API error: ${status} ...`
 * という文言のErrorとして投げる（型付きのステータスコードを持たないため文字列判定になる）。
 * @param error - `fetchCalendarData` が投げた例外
 */
const isEventNotFoundError = (error: unknown): boolean =>
    error instanceof Error && error.message.includes('404');

/**
 * successCount（insertedCount + updatedCount + deletedCount）を反映した
 * CalendarUpsertResult を組み立てる。
 *
 * upsert/cleanseStaleEvents はそれぞれ result を逐次ミューテートして集計するため、
 * successCount は最終的な件数が確定する呼び出し元の return 直前でのみ計算する。
 * @param result - insertedCount/updatedCount/deletedCount が確定した集計結果
 */
const withSuccessCount = (
    result: CalendarUpsertResult,
): CalendarUpsertResult => ({
    ...result,
    successCount:
        result.insertedCount + result.updatedCount + result.deletedCount,
});

/**
 * Date を YYYY-MM-DD 文字列へ変換する（fetch / cleanseStaleEvents で重複していた定義を集約）
 * @param d
 */
const dateToString = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Date に n 日加算した新しい Date を返す
 * @param d
 * @param n
 */
const addDays = (d: Date, n: number): Date => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
};

/**
 * Googleカレンダー用リポジトリ
 * @remarks
 * Repository層はgateway（Google Calendar API）からのデータを検証し、
 * 正しい型のEntityだけをusecaseに返す。
 * 引数（RaceEntity等）はdomain層で検証済みの型を受け取る前提で実装する。
 */
@LogAllMethods
@injectable()
export class GoogleCalendarRepository implements ICalendarRepository {
    private readonly gateway: IGoogleCalendarGateway;

    /**
     * raceType ごとの「現在の Google Calendar イベント」を id をキーとした Map で
     * 保持するインスタンス内キャッシュ（1リクエストの寿命でのみ有効）。
     * upsert が既存イベント確認のために取得した結果を cleanseStaleEvents 側でも
     * 再利用し、同じ raceType に対する重複GETを避けるために使う（PERF-072/073）。
     * リポジトリ自体はDIでtransient登録されており、リクエストを跨いで
     * 状態が残ることは無い。
     */
    private readonly currentEventsCache = new Map<
        RaceType,
        Map<string, calendar_v3.Schema$Event>
    >();

    public constructor(
        @inject(DI_TOKENS.CalendarGateway) gateway: IGoogleCalendarGateway,
    ) {
        this.gateway = gateway;
    }

    /**
     * raceType 1件分の現在の Google Calendar イベントを、id をキーとした Map で取得する。
     * 同一インスタンス内で同じ raceType に対して2回目以降呼ばれた場合はキャッシュを返す。
     * @param raceType - 対象のレース種別
     * @param startDate - 取得期間の開始日
     * @param finishDate - 取得期間の終了日
     * @returns イベントIDをキーとした現在のイベント Map
     */
    private async getOrFetchEventMap(
        raceType: RaceType,
        startDate: Date,
        finishDate: Date,
    ): Promise<Map<string, calendar_v3.Schema$Event>> {
        const cached = this.currentEventsCache.get(raceType);
        if (cached) {
            return cached;
        }

        const events = await this.gateway.fetchCalendarDataList(
            raceType,
            startDate,
            finishDate,
        );
        const eventMap = new Map<string, calendar_v3.Schema$Event>();
        for (const event of events) {
            if (event.id != null) {
                eventMap.set(event.id, event);
            }
        }
        this.currentEventsCache.set(raceType, eventMap);
        return eventMap;
    }

    /**
     * 指定したイベントIDの最新状態を単発GETで確認する。存在しない（404）場合は null を返す。
     * @remarks
     * CONC-02: `saveEventData` の新規作成直前に、キャッシュ（eventMap）ではなく
     * 実際のGoogle Calendarへ問い合わせて再確認するために使う。
     * @param raceType - 対象のレース種別
     * @param eventId - 確認対象のイベントID
     */
    private async fetchExistingEventOrNull(
        raceType: RaceType,
        eventId: string,
    ): Promise<calendar_v3.Schema$Event | null> {
        try {
            return await this.gateway.fetchCalendarData(raceType, eventId);
        } catch (error) {
            if (isEventNotFoundError(error)) return null;
            throw error;
        }
    }

    /**
     * 変換済み eventData を既存イベントの有無に応じて更新または新規作成し、result に反映する。
     * 既存イベントと内容に差分が無い場合は updateCalendarData（PUT）呼び出し自体を
     * 省略する（PERF-076）。この場合も同期は成功しているため updatedCount は加算する
     * （呼び出し元から見た集計結果は差分の有無に関わらず変化しない）。
     * 実際に insert/update した内容は eventMap にも反映し、cleanseStaleEvents が
     * 同じ raceType のキャッシュを再利用した際に post-upsert の状態を見られるようにする
     * （PERF-073）。
     * @param raceType - 対象のレース種別
     * @param eventData - 変換済みの Google Calendar Event
     * @param existingEvent - 既存イベント（無ければ null）
     * @param result - 集計結果（ミューテートして返す）
     * @param eventMap - raceType 1件分の現在のイベント Map（ミューテートして返す）
     */
    private async saveEventData(
        raceType: RaceType,
        eventData: calendar_v3.Schema$Event & { id: string },
        existingEvent: calendar_v3.Schema$Event | null,
        result: CalendarUpsertResult,
        eventMap: Map<string, calendar_v3.Schema$Event>,
    ): Promise<void> {
        if (existingEvent) {
            if (hasEventContentChanged(eventData, existingEvent)) {
                await this.gateway.updateCalendarData(raceType, eventData);
                eventMap.set(eventData.id, eventData);
            }
            result.updatedCount++;
            return;
        }

        // CONC-02: eventMapはこのRepositoryインスタンス生成時点のスナップショットのため、
        // 同一raceTypeへの重複するsync呼び出しが近接して走ると、両方が「存在しない」と
        // 判断して同じイベントを二重作成しうる（TOCTOU）。新規作成の直前に単発GETで
        // 再確認し、その間に他プロセスが先に作成済みだった場合は更新へ切り替える。
        const freshExisting = await this.fetchExistingEventOrNull(
            raceType,
            eventData.id,
        );
        if (freshExisting) {
            if (hasEventContentChanged(eventData, freshExisting)) {
                await this.gateway.updateCalendarData(raceType, eventData);
                eventMap.set(eventData.id, eventData);
            } else {
                eventMap.set(eventData.id, freshExisting);
            }
            result.updatedCount++;
            return;
        }

        // 新規作成
        const createdEventId = await this.gateway.insertCalendarData(
            raceType,
            eventData,
        );
        if (!createdEventId) {
            // Google Calendar が使えない場合はエラーとして記録
            throw new Error(
                'Google Calendar API not available in this environment',
            );
        }
        result.insertedCount++;
        eventMap.set(eventData.id, eventData);
    }

    /**
     * 単一のイベントを登録または更新する
     * @param raceEntity - レースエンティティ
     * @param eventMap - 事前取得済みの「現在のGoogle Calendarイベント」Map
     * （raceType単位で1回だけ取得したものを全エンティティで使い回す。PERF-072/073）
     * @returns 登録・更新結果
     */
    private async upsertSingleEvent(
        raceEntity: RaceEntity,
        eventMap: Map<string, calendar_v3.Schema$Event>,
    ): Promise<CalendarUpsertResult> {
        const result = createEmptyCalendarUpsertResult();

        try {
            // RaceEntity を Google Calendar Event 形式に変換
            const eventData = convertRaceEntityToCalendarEvent(raceEntity);
            // status: confirmed を付与（新規登録・更新共通）
            eventData.extendedProperties ??= {};
            eventData.extendedProperties.private ??= {};
            eventData.extendedProperties.private.status = 'confirmed';

            // イベントIDで事前取得済みMapから既存イベントの有無を確認
            const existingEvent = eventMap.get(eventData.id) ?? null;

            await this.saveEventData(
                raceEntity.raceType,
                eventData,
                existingEvent,
                result,
                eventMap,
            );
        } catch (error) {
            result.failureCount++;
            result.failures.push({
                id: raceEntity.raceId,
                reason: createErrorMessage('GoogleCalendarRepository', error),
            });
        }

        return result;
    }

    /**
     * stale イベントをチャンク単位（API レート制限対応）で削除し、result に集計を反映する。
     * @param raceType - 対象のレース種別
     * @param staleEvents - 削除対象イベント一覧
     * @param result - 集計結果（ミューテートして返す）
     */
    private async deleteStaleEvents(
        raceType: RaceType,
        staleEvents: (calendar_v3.Schema$Event & { id: string })[],
        result: CalendarUpsertResult,
    ): Promise<void> {
        await runRateLimited(
            staleEvents,
            {
                concurrency: GOOGLE_CALENDAR_CONCURRENCY,
                delayMs: GOOGLE_CALENDAR_RATE_LIMIT_DELAY_MS,
            },
            (event) => this.gateway.deleteCalendarData(raceType, event.id),
            (settledResult, event) => {
                if (settledResult.status === 'fulfilled') {
                    result.deletedCount++;
                } else {
                    result.failureCount++;
                    result.failures.push({
                        id: event.id ?? 'unknown',
                        reason: createErrorMessage(
                            'GoogleCalendarRepository.cleanseStaleEvents',
                            settledResult.reason,
                        ),
                    });
                }
            },
        );
    }

    /**
     * raceType 1件分の現在の Google Calendar イベントを取得する。
     * 同じ raceType・期間で upsert が既に事前取得済みであればそのキャッシュ
     * （post-upsert の状態に更新済み）を再利用し、重複したGETを避ける（PERF-073）。
     * @param raceType - 対象のレース種別
     * @param context - 取得期間（startDate/finishDate）を含むコンテキスト
     */
    private async fetchCurrentEvents(
        raceType: RaceType,
        context: Pick<CleanseStaleEventsContext, 'startDate' | 'finishDate'>,
    ): Promise<calendar_v3.Schema$Event[]> {
        const eventMap = await this.getOrFetchEventMap(
            raceType,
            context.startDate,
            context.finishDate,
        );
        return [...eventMap.values()];
    }

    private async resolveStaleEvents(
        raceType: RaceType,
        context: CleanseStaleEventsContext,
    ): Promise<(calendar_v3.Schema$Event & { id: string })[]> {
        const {
            dateToday,
            dateTomorrow,
            validRaceEntityList,
            fetchedRaceEntityList,
        } = context;

        const currentEvents = await this.fetchCurrentEvents(raceType, context);

        const { expectedIds, coveredPlaceDateKeys } = buildStaleEventLookups(
            validRaceEntityList,
            fetchedRaceEntityList,
        );

        return selectStaleEvents(
            currentEvents,
            coveredPlaceDateKeys,
            expectedIds,
            dateToday,
            dateTomorrow,
        );
    }

    /**
     * 指定raceType 1件分の stale イベントを判定・削除し、result に集計を反映する。
     * fetchCalendarDataList の失敗はここで捕捉し、呼び出し元（他 raceType のループ）へは伝播させない
     * （upsert の allSettled と同様、1 raceType の失敗が他 raceType の処理を止めない方針）。
     * @param raceType - 対象のレース種別
     * @param context - 対象期間・基準日・有効/取得済みレースエンティティ一覧
     * @param result - 集計結果（ミューテートして返す）
     */
    private async cleanseStaleEventsForRaceType(
        raceType: RaceType,
        context: CleanseStaleEventsContext,
        result: CalendarUpsertResult,
    ): Promise<void> {
        try {
            const staleEvents = await this.resolveStaleEvents(
                raceType,
                context,
            );
            await this.deleteStaleEvents(raceType, staleEvents, result);
        } catch (error) {
            // fetchCalendarDataList の失敗は当該 raceType の処理をスキップし、
            // 他の raceType の処理を継続する（upsert の allSettled と同様の方針）
            result.failureCount++;
            result.failures.push({
                id: raceType,
                reason: createErrorMessage(
                    'GoogleCalendarRepository.cleanseStaleEvents',
                    error,
                ),
            });
        }
    }

    /**
     * raceType 1件分のイベントを取得し、表示対象のみフィルタして
     * CalendarDataEntity に変換する。
     * @param raceType - 対象のレース種別
     * @param context - 取得期間・表示判定の基準日
     * @param context.startDate
     * @param context.finishDate
     * @param context.dateToday
     * @param context.dateTomorrow
     * @param context.dateAfterTomorrow
     * @returns 変換済みの CalendarDataEntity 一覧
     */
    private async fetchAndConvertForRaceType(
        raceType: RaceType,
        context: {
            startDate: Date;
            finishDate: Date;
            dateToday: string;
            dateTomorrow: string;
            dateAfterTomorrow: string;
        },
    ): Promise<CalendarDataEntity[]> {
        const eventList = await this.gateway.fetchCalendarDataList(
            raceType,
            context.startDate,
            context.finishDate,
        );

        // Gateway のイベントを表示対象のみフィルタし、CalendarDataEntityに変換・検証
        return filterDisplayableAndConvert(eventList, raceType, context);
    }

    /**
     * upsertSingleEvent の allSettled 結果1件分を result に反映する。
     * @param result - 集計結果（ミューテートして返す）
     * @param raceEntity - 対象のレースエンティティ
     * @param settledResult - upsertSingleEvent の Promise.allSettled 結果
     */
    private applyUpsertSettledResult(
        result: CalendarUpsertResult,
        raceEntity: RaceEntity,
        settledResult: PromiseSettledResult<CalendarUpsertResult>,
    ): void {
        if (settledResult.status === 'fulfilled') {
            const eventResult = settledResult.value;
            result.insertedCount += eventResult.insertedCount;
            result.updatedCount += eventResult.updatedCount;
            result.failureCount += eventResult.failureCount;
            result.failures.push(...eventResult.failures);
            return;
        }
        // Promise が reject された場合
        result.failureCount++;
        result.failures.push({
            id: raceEntity.raceId,
            reason: createErrorMessage(
                'GoogleCalendarRepository',
                settledResult.reason,
            ),
        });
    }

    /**
     * Googleカレンダーからデータを取得する
     * @param params - domain検証済みのフィルターパラメータ（CalendarFilterParams）
     * @returns domain検証済みのカレンダーデータ一覧
     * @remarks
     * paramsの型はdomain層で検証済みのため、ここで再検証しない
     * Gateway からのデータはvalidateCalendarDataEntityで検証してから返す
     */
    public async fetch(
        params: CalendarFilterParams,
    ): Promise<CalendarDataEntity[]> {
        const { startDate, finishDate, raceTypeList } = params;
        const today = new Date(Date.now()); // 実行時の日付
        const dateToday = dateToString(today);
        const dateTomorrow = dateToString(addDays(today, 1));
        const dateAfterTomorrow = dateToString(addDays(today, 2));

        const allEventList: CalendarDataEntity[] = [];
        for (const raceType of raceTypeList) {
            const dtoList = await this.fetchAndConvertForRaceType(raceType, {
                startDate,
                finishDate,
                dateToday,
                dateTomorrow,
                dateAfterTomorrow,
            });
            allEventList.push(...dtoList);
        }
        return allEventList;
    }

    /**
     * カレンダーデータを登録・更新する
     * 既存のイベントIDで検索し、存在しなければ作成、存在すれば更新する
     * 同じ raceType で複数回登録される場合、最後のものだけ処理対象にする
     * @param params - 対象期間・レース種別
     * （raceType単位で現在のイベント一覧を事前取得する際の取得期間として使う。PERF-072）
     * @param raceEntityList - domain検証済みのレースデータ
     * @returns 登録・更新結果
     * @remarks
     * raceEntityListの型（RaceEntity[]）はdomain層で検証済み
     * （mainApiGatewayがHTTP応答をvalidateRaceEntityで検証してから返す）のため、
     * ここで再検証しない
     * Google Calendar API のレート制限に対応するため、Promise.allSettled で並列化
     */
    public async upsert(
        params: CalendarFilterParams,
        raceEntityList: RaceEntity[],
    ): Promise<CalendarUpsertResult> {
        const result = createEmptyCalendarUpsertResult();

        // PERF-072: raceEntity 1件毎に個別GET（fetchCalendarData）していた既存イベント確認を、
        // raceTypeごとに1回のfetchCalendarDataListへ統合し、Mapで使い回す
        await this.prefetchEventMaps(raceEntityList, params);

        // API レート制限に対応するため、チャンク単位で並列処理
        await runRateLimited(
            raceEntityList,
            {
                concurrency: GOOGLE_CALENDAR_CONCURRENCY,
                delayMs: GOOGLE_CALENDAR_RATE_LIMIT_DELAY_MS,
            },
            (raceEntity) =>
                this.upsertSingleEvent(
                    raceEntity,
                    this.currentEventsCache.get(raceEntity.raceType) ??
                        new Map(),
                ),
            (settledResult, raceEntity) =>
                this.applyUpsertSettledResult(
                    result,
                    raceEntity,
                    settledResult,
                ),
        );

        return withSuccessCount(result);
    }

    /**
     * raceEntityList に含まれる raceType ごとに、現在の Google Calendar イベントを
     * 事前に1回だけ取得しキャッシュしておく。
     * @param raceEntityList - 対象のレースエンティティ一覧
     * @param params - 取得期間（startDate/finishDate）を含むフィルターパラメータ
     */
    private async prefetchEventMaps(
        raceEntityList: RaceEntity[],
        params: Pick<CalendarFilterParams, 'startDate' | 'finishDate'>,
    ): Promise<void> {
        const raceTypes = new Set(raceEntityList.map((r) => r.raceType));
        for (const raceType of raceTypes) {
            try {
                await this.getOrFetchEventMap(
                    raceType,
                    params.startDate,
                    params.finishDate,
                );
            } catch {
                // 取得に失敗した場合は既存イベント不明として扱う。
                // 各エンティティは空Mapにより「未存在」として insert を試み、
                // insert 自体が失敗すれば failureCount に記録される
                // （従来の findExistingEvent が例外を「未存在」扱いしていた動作を踏襲）
            }
        }
    }

    /**
     * Google Calendar 上の不要なイベントを削除する
     *
     * 指定期間のカレンダーをスキャンし、validRaceEntityList に含まれない
     * イベントを削除する（例: レース番号変更後の残留イベント）
     * @param params - 対象期間・レース種別
     * @param validRaceEntityList - 有効なレースエンティティ一覧
     * @param fetchedRaceEntityList - 今回DBから実際に取得できたレースエンティティ一覧（フィルタ前）
     */
    public async cleanseStaleEvents(
        params: CalendarFilterParams,
        validRaceEntityList: RaceEntity[],
        fetchedRaceEntityList: RaceEntity[],
    ): Promise<CalendarUpsertResult> {
        const result = createEmptyCalendarUpsertResult();

        const { startDate, finishDate, raceTypeList } = params;
        const today = new Date(Date.now()); // 実行時の日付
        const dateToday = dateToString(today);
        const dateTomorrow = dateToString(addDays(today, 1));

        // PERF-077: raceTypeごとに全件配列をfilterすると raceType数 × 全体件数のオーダーで
        // 走査が重複するため、ループ開始前に1回だけグルーピングしておく
        const validByType = groupRaceEntitiesByRaceType(validRaceEntityList);
        const fetchedByType = groupRaceEntitiesByRaceType(
            fetchedRaceEntityList,
        );

        // PERF-071: raceType 単位の処理は互いに独立しているため、raceType 間のレート制限
        // （GOOGLE_CALENDAR_RACE_TYPE_CONCURRENCY）を守りつつ並列化する（従来は直列実行）。
        // cleanseStaleEventsForRaceType は例外を投げず result へ失敗を記録するため、
        // onResult でのハンドリングは不要
        await runRateLimited(
            raceTypeList,
            {
                concurrency: GOOGLE_CALENDAR_RACE_TYPE_CONCURRENCY,
                delayMs: GOOGLE_CALENDAR_RATE_LIMIT_DELAY_MS,
            },
            (raceType) =>
                this.cleanseStaleEventsForRaceType(
                    raceType,
                    {
                        startDate,
                        finishDate,
                        dateToday,
                        dateTomorrow,
                        validRaceEntityList: validByType.get(raceType) ?? [],
                        fetchedRaceEntityList:
                            fetchedByType.get(raceType) ?? [],
                    },
                    result,
                ),
            () => {
                // no-op: cleanseStaleEventsForRaceType 内で result へ反映済み
            },
        );

        return withSuccessCount(result);
    }

    /**
     * raceId を指定してカレンダーイベントを1件削除する
     * @param raceType - 対象のレース種別
     * @param raceId - 削除対象のレースID（domain検証済みのRaceId型）
     */
    public async deleteById(raceType: RaceType, raceId: RaceId): Promise<void> {
        const eventId = buildCalendarEventId(raceId);
        try {
            await this.gateway.deleteCalendarData(raceType, eventId);
        } catch (error) {
            // イベントが元々存在しない場合を含め、削除失敗は警告のみに留める
            // （フラグ解除自体はDB操作として既に完了しているため、カレンダー側の不整合で失敗扱いにしない）
            appLogger.warn(
                createErrorMessage(
                    'GoogleCalendarRepository.deleteById',
                    error,
                ),
            );
        }
    }
}
