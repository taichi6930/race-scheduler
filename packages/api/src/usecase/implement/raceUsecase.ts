import type {
    RaceDetailUi,
    RaceEntity,
    RaceId,
    RacePlayerEntity,
    SearchRaceFilterParamsInput,
} from '@race-schedule/core';
import {
    buildRaceLinks,
    convertRaceEntityToCalendarEvent,
    DI_TOKENS,
    LogAllMethods,
    resolveRaceDetailUi,
    type UpsertResult,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IRaceRepository } from '../../repository/interface/IRaceRepository';
import type { IUiLayoutRepository } from '../../repository/interface/IUiLayoutRepository';
import type {
    CalendarEventPreview,
    IRaceUsecase,
} from '../interface/IRaceUsecase';
import { CrudUsecase } from './crudUsecase';
import { resolveStoredOrDefaultConfig } from './uiLayoutResolution';

/**
 * レース情報取得ユースケース実装
 */
@LogAllMethods
@injectable()
export class RaceUsecase
    extends CrudUsecase<RaceEntity, SearchRaceFilterParamsInput>
    implements IRaceUsecase
{
    public constructor(
        @inject(DI_TOKENS.RaceRepository)
        private readonly raceRepository: IRaceRepository,
        @inject(DI_TOKENS.UiLayoutRepository)
        private readonly uiLayoutRepository: IUiLayoutRepository,
    ) {
        super(raceRepository);
    }

    /**
     * レース情報を取得
     * @param searchRaceFilterParams - domain検証済みのフィルターパラメータ
     */
    public fetch(
        searchRaceFilterParams: SearchRaceFilterParamsInput,
    ): Promise<RaceEntity[]> {
        return this.doFetch(searchRaceFilterParams);
    }

    /**
     * レース情報を登録/更新
     * @param entityList - domain検証済みのRaceEntityリスト
     */
    public upsert(entityList: RaceEntity[]): Promise<UpsertResult> {
        return this.doUpsert(entityList);
    }

    /**
     * raceIdを指定して、そのレースをカレンダーに登録する際のイベント内容を取得する。
     * @param raceId - 取得対象のraceId
     */
    public async fetchCalendarEvent(
        raceId: RaceId,
    ): Promise<CalendarEventPreview | null> {
        const raceEntity = await this.raceRepository.fetchByRaceId(raceId);
        if (!raceEntity) {
            return null;
        }
        const { summary, description, location, start, end } =
            convertRaceEntityToCalendarEvent(raceEntity);
        return {
            summary,
            description,
            location,
            start,
            end,
            links: buildRaceLinks(raceEntity),
        };
    }

    /**
     * 指定した raceId のうち、注目選手が出走しているものの集合を取得する
     * @param raceIds - 絞り込み対象の raceId 一覧
     */
    public fetchWatchedRaceIds(
        raceIds: readonly string[],
    ): Promise<Set<string>> {
        return this.raceRepository.fetchWatchedRaceIds(raceIds);
    }

    /**
     * raceIdを指定して、そのレースの出走選手一覧を取得する
     * @param raceId - 取得対象のraceId
     */
    public fetchRacePlayers(raceId: RaceId): Promise<RacePlayerEntity[]> {
        return this.raceRepository.fetchRacePlayers(raceId);
    }

    /**
     * raceIdを指定して、レース詳細画面向けのセクション型UIスキーマを取得する。
     * D1（ui_layout テーブル）に保存済みの構成があればそれを、無ければ
     * コード内既定構成を使う（{@link resolveStoredOrDefaultConfig}、
     * race-detail-sdui-design.md §1.3）。
     * @param raceId - 取得対象のraceId
     */
    public async fetchRaceDetailUi(
        raceId: RaceId,
    ): Promise<RaceDetailUi | null> {
        const raceEntity = await this.raceRepository.fetchByRaceId(raceId);
        if (!raceEntity) {
            return null;
        }
        const players = await this.raceRepository.fetchRacePlayers(raceId);
        const config = await resolveStoredOrDefaultConfig(
            this.uiLayoutRepository,
            raceEntity.raceType,
        );
        return resolveRaceDetailUi(raceEntity, players, config);
    }
}
