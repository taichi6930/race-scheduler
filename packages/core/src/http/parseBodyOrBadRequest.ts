import type { ZodType } from 'zod';

import type { RaceId } from '../domain/model/valueObject/raceId';
import { validateRaceId } from '../domain/model/valueObject/raceId';
import type { ParseResult } from './parseOrBadRequest';
import { badRequest } from './response';

/**
 * 既にパース済みの POST ボディ（unknown）を Zod スキーマで検証し、
 * 失敗時は固定文言の 400 レスポンスへ変換する。
 *
 * `parseOrBadRequest` は `ValidationError` を throw する関数を対象とするが、
 * POST ボディの検証は `schema.safeParse(body)` の成否で判定するため専用のヘルパーとする。
 * calendarController の upsert / flagAdd / flagRemove で重複していた
 * 「safeParse → 失敗なら badRequest(message, 400)」を集約する。
 * @param schema - 検証に使う Zod スキーマ
 * @param body - `await request.json()` 済みの unknown な値
 * @param message - 検証失敗時に返す 400 のメッセージ（省略時は固定文言。呼び出し元12箇所が
 *   同一文言を渡していたため既定値化した）
 * @returns 検証結果（成功時は value、失敗時は 400 レスポンス）
 */
export const parseBodyOrBadRequest = <T>(
    schema: ZodType<T>,
    body: unknown,
    message = 'リクエストボディが不正です',
): ParseResult<T> => {
    const result = schema.safeParse(body);
    if (!result.success) {
        return { ok: false, response: badRequest(message, 400) };
    }
    return { ok: true, value: result.data };
};

/**
 * 生の raceId 文字列を検証し、失敗時は固定文言の 400 レスポンスへ変換する。
 *
 * `validateRaceId` は不正な形式の場合に例外を投げるため、
 * calendarController の flagAdd / flagRemove で重複していた
 * 「try/catch → badRequest(message, 400)」を集約する。
 * @param rawRaceId - 検証対象の raceId 文字列
 * @param message - 検証失敗時に返す 400 のメッセージ（省略時は固定文言。呼び出し元6箇所が
 *   同一文言を渡していたため既定値化した）
 * @returns 検証結果（成功時は RaceId、失敗時は 400 レスポンス）
 */
export const resolveRaceIdOrBadRequest = (
    rawRaceId: string,
    message = 'raceIdの形式が不正です',
): ParseResult<RaceId> => {
    try {
        return { ok: true, value: validateRaceId(rawRaceId) };
    } catch {
        return { ok: false, response: badRequest(message, 400) };
    }
};
