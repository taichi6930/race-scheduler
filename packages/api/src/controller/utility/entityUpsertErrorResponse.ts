import { badRequest, json, ValidationError } from '@race-schedule/core';

/**
 * upsert 系 Controller（Place/Race/Player）の「リクエストボディ検証失敗」を共通レスポンスへ変換する。
 * PlaceController.upsert で個別実装されていたエラー変換ロジックを共通化し、RaceController/PlayerController にも適用する。
 * - ValidationError が配列要素の index を持つ場合、errors 配列（{ index, reason }）付きの 400 を返す
 * - それ以外の ValidationError は badRequest(message, status) を返す
 * - 予期しない Error は badRequest(message) を返す
 * @param error - パース関数（parsePlaceEntityUpsert/parseRaceEntityUpsert 等）が throw した例外
 */
export const entityUpsertParseErrorResponse = (error: unknown): Response => {
    if (error instanceof ValidationError) {
        const index = error.index;
        if (index !== undefined) {
            return json(
                {
                    status: 400,
                    message: error.message,
                    errors: [{ index, reason: error.message }],
                },
                400,
            );
        }
        return badRequest(error.message, error.status);
    }
    // その他の予期しないエラー
    const message =
        error instanceof Error ? error.message : 'Invalid request body';
    return badRequest(message);
};
