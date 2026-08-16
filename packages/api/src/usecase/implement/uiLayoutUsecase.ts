import type {
    RaceDetailUi,
    RaceDetailUiConfig,
    RaceId,
    RaceType,
} from '@race-schedule/core';
import {
    DI_TOKENS,
    LogAllMethods,
    resolveRaceDetailUi,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IRaceRepository } from '../../repository/interface/IRaceRepository';
import type { IUiLayoutRepository } from '../../repository/interface/IUiLayoutRepository';
import type { IUiLayoutUsecase } from '../interface/IUiLayoutUsecase';
import {
    layoutKeyFor,
    resolveStoredOrDefaultConfig,
} from './uiLayoutResolution';

/**
 * レイアウト構成 Usecase（race-detail-sdui-design.md 参照）。
 *
 * 解決順序: D1（ui_layout テーブル）に行があればその構成が最優先。無ければ
 * コード内既定構成（{@link buildDefaultRaceDetailConfig}）を使う。
 * `RaceUsecase.fetchRaceDetailUi`（front向け読み取り）と同じ解決順序
 * （{@link resolveStoredOrDefaultConfig}）を、管理画面向けの読み取り・
 * 書き込み・プレビューとして提供する。
 */
@LogAllMethods
@injectable()
export class UiLayoutUsecase implements IUiLayoutUsecase {
    public constructor(
        @inject(DI_TOKENS.UiLayoutRepository)
        private readonly uiLayoutRepository: IUiLayoutRepository,
        @inject(DI_TOKENS.RaceRepository)
        private readonly raceRepository: IRaceRepository,
    ) {}

    public getConfig(raceType: RaceType): Promise<RaceDetailUiConfig> {
        return resolveStoredOrDefaultConfig(this.uiLayoutRepository, raceType);
    }

    public async saveConfig(
        raceType: RaceType,
        config: RaceDetailUiConfig,
    ): Promise<void> {
        await this.uiLayoutRepository.upsert(layoutKeyFor(raceType), config);
    }

    public async previewConfig(
        config: RaceDetailUiConfig,
        raceId: RaceId,
    ): Promise<RaceDetailUi | null> {
        const raceEntity = await this.raceRepository.fetchByRaceId(raceId);
        if (!raceEntity) {
            return null;
        }
        const players = await this.raceRepository.fetchRacePlayers(raceId);
        return resolveRaceDetailUi(raceEntity, players, config);
    }
}
