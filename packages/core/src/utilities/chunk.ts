import type { UpsertApiResponse } from '../dto/upsertApiResponse';
import { createEmptyUpsertResult } from './upsertResult';

/**
 * 配列を chunkSize 件ずつのチャンクに分割する
 * @param items 分割対象の配列
 * @param chunkSize 1チャンクの最大件数
 * @returns チャンクの配列
 */
export const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
};

/**
 * 複数チャンクの UpsertApiResponse を1つに集計する
 * @param responses 各チャンクのレスポンス
 * @returns 集計後の UpsertApiResponse
 */
export const mergeUpsertApiResponses = (
    responses: UpsertApiResponse[],
): UpsertApiResponse =>
    responses.reduce<UpsertApiResponse>(
        (accumulated, response) => ({
            successCount: accumulated.successCount + response.successCount,
            failureCount: accumulated.failureCount + response.failureCount,
            failures: [...accumulated.failures, ...response.failures],
        }),
        createEmptyUpsertResult(),
    );

/**
 * チャンクサイズとして使用できない値（NaN・0以下）かどうかを判定する。
 * 呼び出し側にインライン展開すると複合条件（||）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param parsed 解析済みの数値
 * @returns チャンクサイズとして不正であれば true
 */
const isInvalidChunkSize = (parsed: number): boolean =>
    Number.isNaN(parsed) || parsed <= 0;

/**
 * 環境変数からチャンクサイズを取得する。
 * 未設定・数値として解釈できない値・0以下の場合は defaultValue にフォールバックする
 * （不正値で黙って壊れない方針）。
 * @param envVarName 参照する環境変数名
 * @param defaultValue フォールバック値
 * @returns チャンクサイズ
 */
export const resolveChunkSize = (
    envVarName: string,
    defaultValue: number,
): number => {
    const raw = process.env[envVarName];
    const parsed = raw === undefined ? defaultValue : Number.parseInt(raw);
    if (isInvalidChunkSize(parsed)) {
        return defaultValue;
    }
    return parsed;
};
