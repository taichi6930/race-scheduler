import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseOrBadRequest,
    parsePlayerEntityUpsert,
    parseQueryParams,
    searchPlayerFilterParamsSchema,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IPlayerUsecase } from '../usecase/interface/IPlayerUsecase';
import { runEntityUpsert } from './utility/runEntityUpsert';

/**
 * Controller層：外部入力（HTTPリクエスト）をdomain層の検証関数に通し、
 * domain検証済みの型をusecaseに送る。検証ロジック自体はdomain層（Zodスキーマ）が持つ。
 */
@LogAllMethods
@injectable()
export class PlayerController {
    public constructor(
        @inject(DI_TOKENS.PlayerUsecase)
        private readonly usecase: IPlayerUsecase,
    ) {}

    /**
     * 選手データを取得する
     * @param searchParams URLクエリパラメータ
     * @returns 選手データを含むレスポンス
     * @remarks
     * クエリパラメータをdomainのZodスキーマ（searchPlayerFilterParamsSchema）で検証する
     */
    public async get(searchParams: URLSearchParams): Promise<Response> {
        try {
            // domainのZodスキーマで入力パラメータを検証
            // ValidationError は badRequest に変換し、それ以外は外側 try に委ねる
            const parsed = parseOrBadRequest(() =>
                parseQueryParams(searchPlayerFilterParamsSchema, searchParams),
            );
            if (!parsed.ok) return parsed.response;
            const filter = parsed.value;

            // ここで filter は SearchPlayerFilterParamsInput型（domain検証済み）が保証されている
            const playerEntityList = await this.usecase.fetch(filter);

            return json({
                count: playerEntityList.length,
                players: playerEntityList,
            });
        } catch (error) {
            return handleControllerError(error, 'PlayerController.get');
        }
    }

    /**
     * 選手登録/更新
     * @param request POSTリクエスト（body: 選手エンティティ配列）
     * @returns upsert結果を含むレスポンス
     * @remarks
     * domainのZodスキーマ（parsePlayerEntityUpsert）でリクエストボディを検証し、
     * domain検証済みのPlayerEntityListをusecaseに送る
     */
    public async upsert(request: Request): Promise<Response> {
        return runEntityUpsert(
            request,
            parsePlayerEntityUpsert,
            (entityList) => this.usecase.upsert(entityList),
            'PlayerController.upsert',
        );
    }
}
