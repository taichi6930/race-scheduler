import {
    createEmptyUpsertResult,
    fetchWithTimeout,
    withServiceAuthHeader,
} from '@race-schedule/core';
import { injectable } from 'tsyringe';

import { getScrapingApiUrl } from '../../utility/scrapingApiConfig';
import type {
    IScrapingApiGateway,
    ScrapingSyncPlaceParams,
    ScrapingSyncPlaceResult,
    ScrapingSyncRaceParams,
    ScrapingSyncRaceResult,
} from '../interface/IScrapingApiGateway';

/**
 * 1回の POST /sync/race で送信する placeId の最大件数。
 * scraping側の `SyncRaceRequestBodySchema`（`placeIdList.max(500)`）に合わせる。
 */
const SYNC_RACE_CHUNK_SIZE = 500;

/**
 * scraping APIへJSONボディをPOSTする共通ヘルパー
 * @template T レスポンスの型
 * @param path スクレイピングAPIのパス（例: '/sync/place'）
 * @param body 送信するJSONボディ（JSON.stringifyされる）
 * @returns パースされたレスポンスボディ
 */
const postJson = async <T>(path: string, body: unknown): Promise<T> => {
    const url = new URL(path, getScrapingApiUrl());
    return fetchWithTimeout<T>(url, {
        method: 'POST',
        headers: withServiceAuthHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
    });
};

/**
 * 配列を chunkSize 件ずつのチャンクに分割する
 * @param items 分割対象の配列
 * @param chunkSize 1チャンクの最大件数
 * @returns チャンクの配列
 */
const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
};

/**
 * 複数チャンクの ScrapingSyncRaceResult を1つに集計する
 * @param responses 各チャンクのレスポンス
 * @returns 集計後の ScrapingSyncRaceResult
 */
const mergeSyncRaceResults = (
    responses: ScrapingSyncRaceResult[],
): ScrapingSyncRaceResult =>
    responses.reduce<ScrapingSyncRaceResult>(
        (accumulated, response) => ({
            successCount: accumulated.successCount + response.successCount,
            failureCount: accumulated.failureCount + response.failureCount,
            failures: [...accumulated.failures, ...response.failures],
            notCachedPlaceIds: [
                ...accumulated.notCachedPlaceIds,
                ...response.notCachedPlaceIds,
            ],
        }),
        { ...createEmptyUpsertResult(), notCachedPlaceIds: [] },
    );

/**
 * scraping WorkerのPOST /sync/race・POST /sync/placeを呼び出すゲートウェイ実装。
 * バックフィル機能（api→scraping方向）専用。
 */
@injectable()
export class ScrapingApiGateway implements IScrapingApiGateway {
    public async syncPlace(
        params: ScrapingSyncPlaceParams,
    ): Promise<ScrapingSyncPlaceResult> {
        return postJson<ScrapingSyncPlaceResult>('/sync/place', {
            startDate: params.startDate,
            finishDate: params.finishDate,
            raceTypeList: params.raceTypeList,
            cacheOnly: params.cacheOnly,
        });
    }

    public async syncRace(
        params: ScrapingSyncRaceParams,
    ): Promise<ScrapingSyncRaceResult> {
        if (params.placeIdList.length <= SYNC_RACE_CHUNK_SIZE) {
            return postJson<ScrapingSyncRaceResult>('/sync/race', {
                placeIdList: params.placeIdList,
                placeHeldDaysMap: params.placeHeldDaysMap,
                cacheOnly: params.cacheOnly,
            });
        }

        const chunks = chunkArray(params.placeIdList, SYNC_RACE_CHUNK_SIZE);
        const responses: ScrapingSyncRaceResult[] = [];
        for (const chunk of chunks) {
            responses.push(
                await postJson<ScrapingSyncRaceResult>('/sync/race', {
                    placeIdList: chunk,
                    placeHeldDaysMap: params.placeHeldDaysMap,
                    cacheOnly: params.cacheOnly,
                }),
            );
        }
        return mergeSyncRaceResults(responses);
    }
}
