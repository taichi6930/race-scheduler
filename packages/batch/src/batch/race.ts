/**
 * レース情報バッチ処理
 * 開催場情報を含めて区分し、scraping Worker にレース情報のスクレイピング＋
 * メインAPIへのUpsertを依頼する
 *
 * 処理フロー：
 * 1. 開催場情報を決定（メインAPI優先、フォールバックでスクレイピングAPI）
 *    - サービス間の情報を突き合わせる調整ロジックのため batch に残す
 *    - NARのみ、この手順自体を行わない（月間CSVから期間内の開催場×日を
 *      直接列挙できるため。{@link runRaceBatch} 参照）
 * 2. scraping Worker の同期エンドポイント（POST /sync/race）に
 *    レース情報のスクレイピング＋メインAPIへのUpsertを依頼
 */

import type { PlaceHeldDays, PlaceId } from '@race-schedule/core';
import {
    appLogger,
    generatePlaceId,
    isPlaceWithoutRaceList,
    type PlaceEntity,
    RaceType,
    validateLocationCode,
} from '@race-schedule/core';
import { eachMonthOfInterval, parse, startOfMonth } from 'date-fns';

import { fetchMainPlaceList } from '../client/main';
import {
    syncScrapingNarRaceByDateRange,
    syncScrapingRaceList,
} from '../client/scraping';
import type { BatchConfig } from '../types';
import { reportUpsertFailuresOrThrow } from '../utility/upsertResultReporter';

interface PlaceInfo {
    placeId: PlaceId;
    placeHeldDays?: PlaceEntity['placeHeldDays'];
}

/**
 * OVERSEAS 向けに、期間内の月ごとの placeId を直接生成してマップを構築する。
 * @param startDate 期間開始日（yyyy-MM-dd）
 * @param finishDate 期間終了日（yyyy-MM-dd）
 * @returns placeId をキーとした開催場情報のマップ
 */
function buildOverseasPlaceInfoMap(
    startDate: string,
    finishDate: string,
): Map<PlaceId, PlaceInfo> {
    const map = new Map<PlaceId, PlaceInfo>();
    const start = parse(startDate, 'yyyy-MM-dd', new Date());
    const finish = parse(finishDate, 'yyyy-MM-dd', new Date());
    const months = eachMonthOfInterval({ start, end: finish }).map((d: Date) =>
        startOfMonth(d),
    );
    for (const date of months) {
        const placeId = generatePlaceId(
            RaceType.OVERSEAS,
            date,
            validateLocationCode('01'),
        );
        map.set(placeId, { placeId });
    }
    return map;
}

/**
 * メインAPIの開催場一覧のうち、レース情報取得対象となるものだけをマップへ追加する。
 * NAR/KEIRIN/AUTORACE は、開催場一覧ページにレース一覧へのリンクがまだ無い日
 * （isRaceListAvailable === false）を除外する。true / undefined（非該当・レガシー）
 * は従来通り取得対象とする。
 * @param map 追加先のマップ（placeId をキーとした開催場情報）
 * @param mainPlaces メインAPIから取得した開催場一覧
 * @param raceType レース種別
 */
function addEligibleMainPlaces(
    map: Map<PlaceId, PlaceInfo>,
    mainPlaces: PlaceEntity[],
    raceType: RaceType,
): void {
    for (const place of mainPlaces) {
        if (
            isPlaceWithoutRaceList({
                raceType,
                isRaceListAvailable: place.isRaceListAvailable,
            })
        ) {
            continue;
        }
        map.set(place.placeId, {
            placeId: place.placeId,
            placeHeldDays: place.placeHeldDays,
        });
    }
}

/**
 * メインAPIから開催場一覧を取得してマップを構築する（OVERSEAS以外）。
 * メインAPIがエラー・空の場合は空のマップを返す（スクレイピングAPIへのフォールバックはしない）。
 * @param config バッチ実行設定（レース種別・期間）
 * @returns placeId をキーとした開催場情報のマップ
 */
async function buildMainApiPlaceInfoMap(
    config: BatchConfig,
): Promise<Map<PlaceId, PlaceInfo>> {
    const { raceType, startDate, finishDate } = config;
    const map = new Map<PlaceId, PlaceInfo>();

    try {
        const mainPlaces = await fetchMainPlaceList(
            raceType,
            startDate,
            finishDate,
        );
        if (mainPlaces.length > 0) {
            addEligibleMainPlaces(map, mainPlaces, raceType);
            return map;
        }
        // JRA は placeHeldDays がメインAPIからしか取得できないため、フォールバックしない
        if (raceType === RaceType.JRA) {
            return map;
        }
    } catch (error) {
        // Main API エラー時は空のマップを返す（制御フローは不変、握り潰していた例外をログ化）
        appLogger.error(
            `buildPlaceInfoMap: メインAPI 開催場取得に失敗したため空のマップを返します (raceType=${raceType}, startDate=${startDate}, finishDate=${finishDate})`,
            error,
        );
        return map;
    }

    // Main API がエラー / 空の場合、map は空のまま返す。
    return map;
}

/**
 * 開催場名 → 開催場情報のマップを構築する（メイン API 優先、フォールバックでスクレイピング API）。
 * NARはここに含まれない（{@link runRaceBatch} が別経路で処理する）。
 * @param config バッチ実行設定（レース種別・期間）
 * @returns 開催場名をキーとした開催場情報のマップ
 */
async function buildPlaceInfoMap(
    config: BatchConfig,
): Promise<Map<PlaceId, PlaceInfo>> {
    if (config.raceType === RaceType.OVERSEAS) {
        return buildOverseasPlaceInfoMap(config.startDate, config.finishDate);
    }
    return buildMainApiPlaceInfoMap(config);
}

/**
 * レース情報バッチを実行
 *
 * NARのみ、`place`データを介さず期間指定でscraping Workerへ直接依頼する
 * （月間CSV1本に全開催場・全日程が既に含まれているため、`place`に問い合わせて
 * placeId一覧を事前計算する必要が無い。詳細は
 * `syncScrapingNarRaceByDateRange` のJSDoc参照）。これにより、`place`データの
 * 欠落・不整合（例: 日付ズレにより特定日の開催場一覧が丸ごと欠落する）が
 * あってもNARのraceだけは正しく同期できる。
 * @param config バッチ実行設定（レース種別、開始日、終了日）
 * @returns メインAPIへの登録に成功したレース数
 * @throws API通信エラー、またはレースの同期に1件以上失敗した場合（OBS-027）
 */
export async function runRaceBatch(config: BatchConfig): Promise<number> {
    if (config.raceType === RaceType.NAR) {
        const result = await syncScrapingNarRaceByDateRange(
            config.startDate,
            config.finishDate,
        );
        return reportUpsertFailuresOrThrow('Race sync', result);
    }

    const placeInfoMap = await buildPlaceInfoMap(config);
    if (placeInfoMap.size === 0) {
        appLogger.info('No places found, skipping');
        return 0;
    }

    const placeIdList = placeInfoMap.keys().toArray();
    const placeHeldDaysMap: Record<string, PlaceHeldDays> = {};
    for (const info of placeInfoMap.values()) {
        if (info.placeHeldDays) {
            placeHeldDaysMap[info.placeId] = info.placeHeldDays;
        }
    }

    const result = await syncScrapingRaceList(placeIdList, placeHeldDaysMap);
    return reportUpsertFailuresOrThrow('Race sync', result);
}
