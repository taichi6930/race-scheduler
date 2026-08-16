import {
    type CalendarFilterParams,
    type CalendarFlagEntity,
    type CalendarRaceEntity,
    DI_TOKENS,
    LogAllMethods,
    type RaceId,
    shouldIncludeInCalendar,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { ICalendarRepository } from '../../repository/interface/ICalendarRepository';
import type { IRaceRepository } from '../../repository/interface/IRaceRepository';
import type { ICalendarUsecase } from '../interface/ICalendarUsecase';

/**
 * カレンダーに関する業務ロジック（Usecase）
 * @remarks
 * apiはD1唯一のアクセス点という方針のもと、Google Calendarへの実際の同期は
 * calendar Workerが担う。このUsecaseはD1（race / calendar_flag）のみを扱い、
 * Google Calendar APIには一切アクセスしない。
 * usecase層の重要な設計原則：
 * - 引数はdomain層で検証済みの型（Zodスキーマ・branded型）を受け取る前提で実装し、
 *   呼び出し元のレイヤーを前提にした再検証は行わない
 * - ビジネスロジック（レースフィルタリング）に集中する
 */
@LogAllMethods
@injectable()
export class CalendarUsecase implements ICalendarUsecase {
    public constructor(
        @inject(DI_TOKENS.RaceRepository)
        private readonly raceRepository: IRaceRepository,
        @inject(DI_TOKENS.CalendarRepository)
        private readonly calendarRepository: ICalendarRepository,
    ) {}

    /**
     * カレンダー掲載対象のレースを、カレンダー登録フラグ・注目選手フラグ付きで取得する
     * @param params - domain検証済みのフィルターパラメータ（CalendarFilterParams）
     * @returns カレンダー掲載対象レースの一覧（isFlagged / isWatched 付き）
     * @remarks
     * shouldIncludeInCalendarルールに基づき、calendar Workerが実際に
     * Google Calendarへ同期する対象と同じ集合を返す。
     * flaggedRaceIds（ユーザーが個別指定したレース）とwatchedRaceIds
     * （注目選手が出走するレース、SPEC-PLAYER-001）は独立したクエリのため並列取得する。
     */
    public async fetch(
        params: CalendarFilterParams,
    ): Promise<CalendarRaceEntity[]> {
        const raceEntityList = await this.raceRepository.fetch(params);
        const raceIds = raceEntityList.map((raceEntity) => raceEntity.raceId);
        const [flaggedRaceIds, watchedRaceIds] = await Promise.all([
            this.calendarRepository.fetchFlaggedRaceIds(raceIds),
            this.raceRepository.fetchWatchedRaceIds(raceIds),
        ]);

        return raceEntityList
            .filter((raceEntity) =>
                shouldIncludeInCalendar(
                    raceEntity,
                    flaggedRaceIds,
                    watchedRaceIds,
                ),
            )
            .map((raceEntity) => ({
                ...raceEntity,
                isFlagged: flaggedRaceIds.has(raceEntity.raceId),
                isWatched: watchedRaceIds.has(raceEntity.raceId),
            }));
    }

    /**
     * 指定レース（カレンダー登録フラグ）の一覧を取得する
     * @returns フラグ付きレースの一覧
     */
    public async listFlags(): Promise<CalendarFlagEntity[]> {
        return this.calendarRepository.list();
    }

    /**
     * レースに指定フラグを追加する（D1保存のみ、Google Calendarへの即時反映は行わない）
     * @param raceId - domain検証済みのRaceId
     * @param label - 任意のメモ
     */
    public async addFlag(raceId: RaceId, label: string): Promise<void> {
        await this.calendarRepository.add(raceId, label);
    }

    /**
     * レースの指定フラグを削除する（D1削除のみ、Google Calendarからの即時削除は行わない）
     * @param raceId - domain検証済みのRaceId
     */
    public async removeFlag(raceId: RaceId): Promise<void> {
        await this.calendarRepository.remove(raceId);
    }
}
