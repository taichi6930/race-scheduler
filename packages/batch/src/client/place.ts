/**
 * 開催場情報取得の共通モジュール
 *
 * メインAPI（client/main.ts）とスクレイピングAPI（client/scraping.ts）で
 * ベースURL・一部クエリパラメータ以外がほぼ同一だった /place 取得処理を集約する。
 */

import type { PlaceEntity } from '@race-schedule/core';
import {
    validatePlaceEntity,
    withServiceAuthHeader,
} from '@race-schedule/core';
import { z } from 'zod';

import { LIGHT_FETCH_TIMEOUT_MS } from '../constants';
import { fetchWithTimeout } from './http';

/** /place レスポンス全体の緩い形状検証（個々の要素は {@link parseRawPlace} が検証する） */
const placeListResponseSchema = z.record(z.string(), z.unknown());

/** JSON 応答内の1件分の生レコード（`datetime` が文字列で届く想定） */
interface RawPlaceRecord {
    datetime?: unknown;
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- HTTPレスポンスをvalidatePlaceEntity（Zod）で検証する前の生JSON中間表現のため、unknownが正直な型
    [key: string]: unknown;
}

const isRecord = (value: unknown): value is RawPlaceRecord =>
    typeof value === 'object' && value !== null;

const hasStringDatetime = (
    raw: unknown,
): raw is RawPlaceRecord & { datetime: string } =>
    isRecord(raw) && typeof raw.datetime === 'string';

/**
 * JSONレスポンスの `datetime`（文字列）を `Date` に変換した上で
 * `validatePlaceEntity`（Zod）で検証し、`PlaceEntity` を得る。
 * @param raw - レスポンス配列の1要素（unknown）
 */
const parseRawPlace = (raw: unknown): PlaceEntity => {
    if (hasStringDatetime(raw)) {
        return validatePlaceEntity({
            ...raw,
            datetime: new Date(raw.datetime),
        });
    }
    return validatePlaceEntity(raw);
};

/**
 * /place 取得時のクエリパラメータ
 */
interface FetchPlaceListParams {
    /** 開始日（YYYY-MM-DD形式） */
    startDate: string;
    /** 終了日（YYYY-MM-DD形式） */
    finishDate: string;
    /** レース種別（クエリ raceTypeList に設定） */
    raceTypeList: string;
    /** JRA などで開催日情報の付与を要求する場合に true（付与時のみクエリを追加） */
    isDisplayPlaceHeldDays?: boolean;
}

/**
 * 指定したベースURLの /place エンドポイントから開催場情報を取得する。
 *
 * メイン/スクレイピング双方で共通の
 * 「/place に startDate/finishDate/raceTypeList を積み、
 *  response.places ?? response.placeList ?? [] を取り出す」処理を集約する。
 *
 * このエンドポイントはDBから既存データを返すだけの読み取り専用処理であり、
 * スクレイピング系エンドポイントのような重い処理を伴わないため、
 * デフォルトの5分（FETCH_TIMEOUT_MS）ではなく短いタイムアウト
 * （LIGHT_FETCH_TIMEOUT_MS）を指定する（PERF-080）。
 * @param baseUrl リクエスト先のベースURL（メイン or スクレイピング）
 * @param params 取得条件（開始日・終了日・レース種別・開催日情報の要否）
 * @returns 開催場エンティティのリスト
 */
export async function fetchPlaceList(
    baseUrl: string,
    params: FetchPlaceListParams,
): Promise<PlaceEntity[]> {
    const url = new URL('/place', baseUrl);
    url.searchParams.set('startDate', params.startDate);
    url.searchParams.set('finishDate', params.finishDate);
    url.searchParams.set('raceTypeList', params.raceTypeList);
    if (params.isDisplayPlaceHeldDays) {
        url.searchParams.set('isDisplayPlaceHeldDays', 'true');
    }

    const response = await fetchWithTimeout(
        url,
        placeListResponseSchema,
        { headers: withServiceAuthHeader() },
        LIGHT_FETCH_TIMEOUT_MS,
    );
    const rawList = response.places ?? response.placeList ?? [];
    if (!Array.isArray(rawList)) {
        throw new TypeError(
            `fetchPlaceList: unexpected response shape from ${url.href} (places/placeList is not an array)`,
        );
    }
    return rawList.map((raw: unknown) => parseRawPlace(raw));
}
