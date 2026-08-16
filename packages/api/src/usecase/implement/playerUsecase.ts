import type {
    PlayerEntity,
    SearchPlayerFilterParamsInput,
    UpsertResult,
} from '@race-schedule/core';
import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IPlayerRepository } from '../../repository/interface/IPlayerRepository';
import type { IPlayerUsecase } from '../interface/IPlayerUsecase';
import { CrudUsecase } from './crudUsecase';

/**
 * Player UseCase実装
 */
@LogAllMethods
@injectable()
export class PlayerUsecase
    extends CrudUsecase<PlayerEntity, SearchPlayerFilterParamsInput>
    implements IPlayerUsecase
{
    public constructor(
        @inject(DI_TOKENS.PlayerRepository)
        playerRepository: IPlayerRepository,
    ) {
        super(playerRepository);
    }

    /**
     * 選手データを取得
     * @param searchPlayerFilter - domain検証済みのフィルターパラメータ
     */
    public fetch(
        searchPlayerFilter: SearchPlayerFilterParamsInput,
    ): Promise<PlayerEntity[]> {
        return this.doFetch(searchPlayerFilter);
    }

    /**
     * 選手データを登録/更新
     * @param entityList - domain検証済みのPlayerEntityリスト
     */
    public upsert(entityList: PlayerEntity[]): Promise<UpsertResult> {
        return this.doUpsert(entityList);
    }
}
