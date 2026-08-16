/**
 * スクレイピングAPI通信モジュール
 * scraping Worker の同期エンドポイント（POST /sync/place, /sync/race）を呼び出し、
 * メインAPIへの登録までを scraping 側に委譲する。
 *
 * 従来は GET /place, /race でスクレイピング結果（生データ）を取得し、
 * batch 側で DTO → Entity 変換・ID 生成・メインAPI Upsert を行っていたが、
 * scraping 自身が Entity（ID込み）を生成してメインAPIへ Upsert する
 * sync エンドポイントに一本化し、batch 側の変換ロジックを不要にした。
 */

import type { PlaceHeldDays, UpsertApiResponse } from '@race-schedule/core';
import {
    chunkArray,
    mergeUpsertApiResponses,
    resolveChunkSize,
    upsertResultSchema,
    withServiceAuthHeader,
} from '@race-schedule/core';
import type { ZodType } from 'zod';

import { getApiConfig } from '../types';
import { fetchWithTimeout } from './http';

/**
 * `/sync/race` 1回のPOSTで送信する開催場IDの最大件数のデフォルト値（PERF-182）。
 *
 * scraping Worker は開催場1件につき複数のレースページをスクレイピングするため、
 * `placeIdList` が長いほど1リクエストあたりのサブリクエスト数・処理時間が積み上がり、
 * Cloudflare Workers のサブリクエスト数上限やタイムアウトに達するリスクが増える。
 * メインAPI側チャンク分割（`MainApiGateway.postInChunks`、PERF-084）と同じ
 * 「環境変数でデプロイのみ調整できるようにする」方針を踏襲し、実際の処理時間分布が
 * 判明次第チューニングすることを想定した控えめな初期値とする。
 */
const DEFAULT_RACE_SYNC_CHUNK_SIZE = 10;

/**
 * `/sync/race` 1回のPOSTで送信する開催場IDの最大件数を取得する。
 * @returns 1回のPOSTで送信する開催場IDの最大件数
 */
function getRaceSyncChunkSize(): number {
    return resolveChunkSize(
        'SCRAPING_RACE_SYNC_CHUNK_SIZE',
        DEFAULT_RACE_SYNC_CHUNK_SIZE,
    );
}

/**
 * メインAPIへJSONボディをPOSTする共通ヘルパー
 * @template T レスポンスの型
 * @param path スクレイピングAPIのパス（例: '/sync/place'）
 * @param body 送信するJSONボディ（JSON.stringifyされる）
 * @param schema レスポンスボディを検証するZodスキーマ
 * @returns スキーマ検証済みのレスポンスボディ
 */
async function postJson<T>(
    path: string,
    body: unknown,
    schema: ZodType<T>,
): Promise<T> {
    const config = getApiConfig();
    const url = new URL(path, config.scrapingApiUrl);
    return fetchWithTimeout<T>(url, schema, {
        method: 'POST',
        headers: withServiceAuthHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
    });
}

/**
 * scraping Worker に開催場情報のスクレイピング＋メインAPI登録を依頼する。
 * @param raceType レース種別（JRA/NAR/KEIRINなど）
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param finishDate 終了日（YYYY-MM-DD形式）
 * @returns 登録結果（成功数・失敗数・失敗詳細）
 */
export async function syncScrapingPlaceList(
    raceType: string,
    startDate: string,
    finishDate: string,
): Promise<UpsertApiResponse> {
    return postJson<UpsertApiResponse>(
        '/sync/place',
        {
            startDate,
            finishDate,
            raceTypeList: [raceType],
        },
        upsertResultSchema,
    );
}

/**
 * scraping Worker に、期間指定でNARのレース情報のスクレイピング＋メインAPI登録を依頼する。
 *
 * `place`データを介してplaceIdを事前計算する必要が無い（NARのrace同期は月間CSV1本に
 * 全開催場・全日程が既に含まれているため）。scraping側が対象期間のCSVから
 * 実際にレースがある（開催場, 日）を直接列挙し、取得・パース・メインAPIへの
 * Upsertまで1リクエストで完結させる（`POST /sync/race` の期間指定モード、
 * scraping側 `SyncRaceByDateRangeSchema` 参照）。これにより`place`データの
 * 欠落・不整合の影響を受けずにNARのrace同期を完結できる。
 * @param startDate 開始日（YYYY-MM-DD形式、この日を含む）
 * @param finishDate 終了日（YYYY-MM-DD形式、この日を含む）
 * @returns 登録結果（成功数・失敗数・失敗詳細）
 */
export async function syncScrapingNarRaceByDateRange(
    startDate: string,
    finishDate: string,
): Promise<UpsertApiResponse> {
    return postJson<UpsertApiResponse>(
        '/sync/race',
        { raceType: 'nar', startDate, finishDate },
        upsertResultSchema,
    );
}

/**
 * placeIdList のうち、指定チャンクに含まれるIDだけを残した placeHeldDaysMap を作る
 * @param placeIdChunk 対象チャンクの開催場IDリスト
 * @param placeHeldDaysMap 開催場の開催回数・開催日数の情報マップ（全件）
 * @returns チャンクに含まれるIDのみへ絞り込んだマップ
 */
function pickPlaceHeldDaysForChunk(
    placeIdChunk: string[],
    placeHeldDaysMap: Record<string, PlaceHeldDays>,
): Record<string, PlaceHeldDays> {
    const chunkMap: Record<string, PlaceHeldDays> = {};
    for (const placeId of placeIdChunk) {
        const heldDays = placeHeldDaysMap[placeId];
        if (heldDays) {
            chunkMap[placeId] = heldDays;
        }
    }
    return chunkMap;
}

/**
 * scraping Worker にレース情報のスクレイピング＋メインAPI登録を依頼する。
 *
 * `placeIdList` が {@link getRaceSyncChunkSize} を超える場合、開催場数分の
 * スクレイピングを1リクエストへ一括負担させずに済むよう、チャンクへ分割し直列に
 * POSTする（PERF-182）。メインAPI側チャンク分割（PERF-084）と同様、scraping Worker
 * への負荷集中を避けるためあえて並列化しない。1チャンクでも送信に失敗した場合は
 * `postJson`/`fetchWithTimeout` の既存方針どおり例外をそのまま呼び出し元へ伝播させる
 * （部分成功セマンティクスは導入しない）。
 * @param placeIdList 開催場IDリスト
 * @param placeHeldDaysMap 開催場の開催回数・開催日数の情報マップ
 * @returns 登録結果（成功数・失敗数・失敗詳細）
 */
export async function syncScrapingRaceList(
    placeIdList: string[],
    placeHeldDaysMap: Record<string, PlaceHeldDays> = {},
): Promise<UpsertApiResponse> {
    const chunkSize = getRaceSyncChunkSize();
    if (placeIdList.length <= chunkSize) {
        return postJson<UpsertApiResponse>(
            '/sync/race',
            { placeIdList, placeHeldDaysMap },
            upsertResultSchema,
        );
    }

    const chunks = chunkArray(placeIdList, chunkSize);
    const responses: UpsertApiResponse[] = [];
    for (const placeIdChunk of chunks) {
        responses.push(
            await postJson<UpsertApiResponse>(
                '/sync/race',
                {
                    placeIdList: placeIdChunk,
                    placeHeldDaysMap: pickPlaceHeldDaysForChunk(
                        placeIdChunk,
                        placeHeldDaysMap,
                    ),
                },
                upsertResultSchema,
            ),
        );
    }
    return mergeUpsertApiResponses(responses);
}
