import type {
    CalendarFilterParams,
    RaceEntity,
    RaceType,
} from '@race-schedule/core';
import {
    convertRaceEntityToCalendarEvent,
    derivePlaceDateKey,
    isCalendarEventDeleteTarget,
} from '@race-schedule/core';
import type { calendar_v3 } from 'googleapis';

/**
 * stale イベント判定まわりのロジック。
 * `GoogleCalendarRepository` から削除対象判定の詳細を切り離すために独立させたモジュール。
 */

/** cleanseStaleEventsForRaceType に渡す raceType 横断のコンテキスト。 */
export interface CleanseStaleEventsContext
    extends Pick<CalendarFilterParams, 'startDate' | 'finishDate'> {
    dateToday: string;
    dateTomorrow: string;
    validRaceEntityList: RaceEntity[];
    fetchedRaceEntityList: RaceEntity[];
}

/**
 * status/date 条件によりイベントが物理削除対象かを判定する。
 * 判定条件そのものは isCalendarEventDeleteTarget（domain/policy/eventVisibility）に集約されている。
 * @param event - 判定対象のイベント
 * @param dateToday - 基準日（YYYY-MM-DD）
 * @param dateTomorrow - 基準日の翌日
 */
export const isDeleteTargetByStatusAndDate = (
    event: calendar_v3.Schema$Event,
    dateToday: string,
    dateTomorrow: string,
): boolean => {
    const start = event.start?.dateTime ?? event.start?.date;
    if (!start) return false;

    const eventDate = start.slice(0, 10); // YYYY-MM-DD
    const status = event.extendedProperties?.private?.status ?? '';

    return isCalendarEventDeleteTarget(
        eventDate,
        status,
        dateToday,
        dateTomorrow,
    );
};

/**
 * イベントが削除対象（stale）かを判定する。
 * 「id が確定していて、かつ (取得済みの開催場・日付に含まれるが有効セットに無い) または
 * (status/date 条件による削除対象)」を満たす場合に true。
 * 呼び出し側の filter に埋め込むとネストした複合条件になるため、単独テスト可能な関数として切り出す。
 * @param event - 判定対象のイベント
 * @param coveredPlaceDateKeys - 今回DBから取得できた「開催場・日付」キー集合
 * @param expectedIds - 有効なイベントID集合
 * @param isDeleteTargetByStatusAndDate - status/date による削除対象判定関数
 */
export const isStaleEvent = (
    event: calendar_v3.Schema$Event,
    coveredPlaceDateKeys: Set<string>,
    expectedIds: Set<string>,
    isDeleteTargetByStatusAndDate: (event: calendar_v3.Schema$Event) => boolean,
): boolean =>
    event.id != null &&
    ((coveredPlaceDateKeys.has(event.id.slice(0, -2)) &&
        !expectedIds.has(event.id)) ||
        isDeleteTargetByStatusAndDate(event));

/**
 * currentEvents のうち削除対象（stale）のイベントだけを抽出する。
 * @param currentEvents - 現在の Google Calendar イベント一覧
 * @param coveredPlaceDateKeys - 今回DBから取得できた「開催場・日付」キー集合
 * @param expectedIds - 有効なイベントID集合
 * @param dateToday - 基準日（YYYY-MM-DD）
 * @param dateTomorrow - 基準日の翌日（YYYY-MM-DD）
 * @returns 削除対象イベント（id が確定しているもののみ）
 */
export const selectStaleEvents = (
    currentEvents: calendar_v3.Schema$Event[],
    coveredPlaceDateKeys: Set<string>,
    expectedIds: Set<string>,
    dateToday: string,
    dateTomorrow: string,
): (calendar_v3.Schema$Event & { id: string })[] =>
    // 削除対象:
    // 1) 今回DBから確定情報を取得できた開催場・日付のイベントで、かつ有効セットに含まれないもの
    //    （未取得の開催場・日付は判断材料が無いため対象外。例: 年始に暫定登録した将来レース）
    // 2) status/date 条件により物理削除対象のイベント
    currentEvents.filter((event): event is typeof event & { id: string } =>
        isStaleEvent(event, coveredPlaceDateKeys, expectedIds, (targetEvent) =>
            isDeleteTargetByStatusAndDate(targetEvent, dateToday, dateTomorrow),
        ),
    );

/**
 * raceEntityList を raceType ごとにグループ化する。
 * cleanseStaleEvents が raceType ごとに buildStaleEventLookups を呼ぶ際、
 * 全件配列を毎回 filter すると raceType数 × 全体件数のオーダーで走査が重複するため、
 * ループ開始前に1回だけグルーピングしておくために使う（PERF-077）。
 * @param raceEntityList - グループ化対象のレースエンティティ一覧
 * @returns raceType をキーとしたレースエンティティ一覧の Map
 */
export const groupRaceEntitiesByRaceType = (
    raceEntityList: RaceEntity[],
): Map<RaceType, RaceEntity[]> => {
    const grouped = new Map<RaceType, RaceEntity[]>();
    for (const raceEntity of raceEntityList) {
        const list = grouped.get(raceEntity.raceType);
        if (list) {
            list.push(raceEntity);
        } else {
            grouped.set(raceEntity.raceType, [raceEntity]);
        }
    }
    return grouped;
};

/**
 * 「有効なイベントID集合」と「今回DBから取得できた開催場・日付キー集合」を構築する。
 * @param validRaceEntityListForType - 対象raceTypeの有効なレースエンティティ一覧
 * （呼び出し側で groupRaceEntitiesByRaceType 済みのものを渡す想定）
 * @param fetchedRaceEntityListForType - 対象raceTypeで今回DBから実際に取得できたレースエンティティ一覧
 * （フィルタ前。呼び出し側で groupRaceEntitiesByRaceType 済みのものを渡す想定）
 * @returns 有効イベントID集合・開催場日付キー集合
 */
export const buildStaleEventLookups = (
    validRaceEntityListForType: RaceEntity[],
    fetchedRaceEntityListForType: RaceEntity[],
): { expectedIds: Set<string>; coveredPlaceDateKeys: Set<string> } => {
    // このraceTypeで有効なイベントIDセットを構築(決定論的に計算可能)
    const expectedIds = new Set(
        validRaceEntityListForType.map(
            (r) => convertRaceEntityToCalendarEvent(r).id,
        ),
    );

    // 今回DBから実際に取得できた「開催場・日付」のキー集合
    // （raceId は raceType+日付+開催場コード+レース番号 の形式のため、
    // 末尾2桁のレース番号を除いた部分をキーとして使う）
    const coveredPlaceDateKeys = new Set(
        fetchedRaceEntityListForType.map((r) => derivePlaceDateKey(r.raceId)),
    );

    return { expectedIds, coveredPlaceDateKeys };
};
