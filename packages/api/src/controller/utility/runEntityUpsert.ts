import type { UpsertResult } from '@race-schedule/core';
import { handleControllerError, json } from '@race-schedule/core';

import { entityUpsertParseErrorResponse } from './entityUpsertErrorResponse';

/**
 * 「bodyのJSONパース → domainスキーマでのエンティティリスト検証 → usecase.upsert →
 * 200レスポンス」という登録/更新APIの定型処理を共通化する。
 * @param request - POSTリクエスト
 * @param parseUpsert - リクエストボディをdomain検証済みのエンティティリストへ変換する関数
 * @param upsert - usecase側のupsert処理（domain検証済みのエンティティリストを受け取る）
 * @param controllerName - エラーログに使うコントローラ名（例: 'PlayerController.upsert'）
 * @returns 登録/更新結果のレスポンス
 */
export async function runEntityUpsert<TEntity>(
    request: Request,
    parseUpsert: (body: unknown) => TEntity[],
    upsert: (entityList: TEntity[]) => Promise<UpsertResult>,
    controllerName: string,
): Promise<Response> {
    try {
        const body: unknown = await request.json();

        // domainのZodスキーマ（parseUpsert）で入力エンティティリストを検証
        let entityList: TEntity[];
        try {
            entityList = parseUpsert(body);
        } catch (error) {
            return entityUpsertParseErrorResponse(error);
        }

        // domain検証済みのEntityListをusecaseに送る
        const result = await upsert(entityList);
        return json(result, 200);
    } catch (error) {
        return handleControllerError(error, controllerName);
    }
}
