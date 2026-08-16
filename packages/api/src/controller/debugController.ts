import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IDebugUsecase } from '../usecase/interface/IDebugUsecase';

/**
 * デバッグエンドポイント（`GET /debug/database`）用のコントローラー。
 */
@LogAllMethods
@injectable()
export class DebugController {
    public constructor(
        @inject(DI_TOKENS.DebugUsecase)
        private readonly usecase: IDebugUsecase,
    ) {}

    /**
     * D1 の race / race_condition 件数を返す。
     * 本番の D1 環境では DB 件数が認証なしで露出してしまうため、
     * in-memory DB 使用時（開発・テスト環境）のみ実処理する。
     * @param isUseInMemoryDb - in-memory DB 使用フラグ（呼び出し元の router が
     *   `c.env` から判定して渡す）
     * @returns データベース情報を含むレスポンス
     */
    public async database(isUseInMemoryDb: boolean): Promise<Response> {
        if (!isUseInMemoryDb) {
            return json({ success: false, message: 'Not Found' }, 404);
        }
        try {
            const counts = await this.usecase.countRaceAndRaceCondition();
            return json({ success: true, ...counts }, 200);
        } catch (error) {
            return handleControllerError(error, 'DebugController.database');
        }
    }
}
