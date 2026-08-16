import {
    appLogger,
    type CalendarFilterParams,
    type CalendarUpsertResult,
    createEmptyCalendarUpsertResult,
    createErrorMessage,
    DI_TOKENS,
    LogAllMethods,
    type RaceEntity,
    sanitizeError,
    shouldIncludeInCalendar,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { ICalendarRepository } from '../../repository/interface/ICalendarRepository';
import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { ICalendarSyncUsecase } from '../interface/ICalendarSyncUsecase';

/**
 * カレンダー同期に関する業務ロジック（Usecase）
 * @remarks
 * apiパッケージの `CalendarUsecase.upsert` と同等のフィルタリング・Upsertロジックを、
 * メインAPI（`@race-schedule/api`）からHTTP経由で取得したレース・フラグ情報に対して行う。
 * D1への直接アクセスは行わない（api = D1唯一のアクセス点という方針に従う）。
 * 同期元データの取得は MainApiRepository を、Google Calendar への反映は
 * CalendarRepository を経由する（Usecase は Gateway を直接触らない）。
 */
@LogAllMethods
@injectable()
export class CalendarSyncUsecase implements ICalendarSyncUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
        @inject(DI_TOKENS.CalendarRepository)
        private readonly calendarRepository: ICalendarRepository,
    ) {}

    /**
     * メインAPIからレース一覧・カレンダーフラグを取得し、カレンダー登録対象のみに絞り込む。
     * @param params - 取得対象期間・レース種別
     * @returns 取得した全レース一覧と、カレンダー登録対象に絞り込んだレース一覧
     */
    private async fetchFilteredRaceEntityList(
        params: CalendarFilterParams,
    ): Promise<{
        raceEntityList: RaceEntity[];
        filteredRaceEntityList: RaceEntity[];
    }> {
        // PERF-070: レース一覧取得とカレンダーフラグ取得は互いに依存しないため、
        // 直列awaitではなくPromise.allで並列実行しメインAPIへの往復時間を短縮する。
        const [raceEntityList, flags] = await Promise.all([
            this.mainApiRepository.fetchRaceList(params),
            this.mainApiRepository.fetchCalendarFlagList(),
        ]);
        const flaggedRaceIds = new Set(flags.map((flag) => flag.raceId));

        const filteredRaceEntityList = raceEntityList.filter((raceEntity) =>
            shouldIncludeInCalendar(raceEntity, flaggedRaceIds),
        );

        return { raceEntityList, filteredRaceEntityList };
    }

    /**
     * upsert・cleanseStaleEvents の結果を1つの CalendarUpsertResult に統合する。
     * @param upsertResult - upsert の実行結果
     * @param cleanseResult - cleanseStaleEvents の実行結果
     */
    private combineSyncResults(
        upsertResult: CalendarUpsertResult,
        cleanseResult: CalendarUpsertResult,
    ): CalendarUpsertResult {
        return {
            successCount:
                upsertResult.insertedCount +
                upsertResult.updatedCount +
                cleanseResult.deletedCount,
            insertedCount: upsertResult.insertedCount,
            updatedCount: upsertResult.updatedCount,
            deletedCount: cleanseResult.deletedCount,
            failureCount:
                upsertResult.failureCount + cleanseResult.failureCount,
            failures: [...upsertResult.failures, ...cleanseResult.failures],
        };
    }

    /**
     * 単一の失敗理由からなる CalendarUpsertResult（全滅扱い）を組み立てる。
     * `upsert`/`cleanseStaleEvents` は本来ほぼ全ての失敗を internal に
     * per-item try/catch で吸収し例外を投げない設計だが、想定外の例外
     * （バグ・OOM等）が発生した場合に備え、usecase 層でも捕捉して
     * もう一方の呼び出し結果を握りつぶさないようにする（OBS-008）。
     * @param stepLabel - 失敗したステップ名（'upsert' | 'cleanseStaleEvents'）
     * @param error - キャッチした例外
     * @returns 全件失敗として扱う CalendarUpsertResult
     */
    private buildFailedStepResult(
        stepLabel: string,
        error: unknown,
    ): CalendarUpsertResult {
        appLogger.error(
            `CalendarSyncUsecase.sync: ${stepLabel} が想定外の例外で失敗しました`,
            sanitizeError(error),
        );
        const result = createEmptyCalendarUpsertResult();
        result.failureCount = 1;
        result.failures.push({
            id: stepLabel,
            reason: createErrorMessage(
                `CalendarSyncUsecase.sync.${stepLabel}`,
                error,
            ),
        });
        return result;
    }

    public async sync(
        params: CalendarFilterParams,
    ): Promise<CalendarUpsertResult> {
        const { raceEntityList, filteredRaceEntityList } =
            await this.fetchFilteredRaceEntityList(params);

        let upsertResult: CalendarUpsertResult;
        try {
            upsertResult = await this.calendarRepository.upsert(
                params,
                filteredRaceEntityList,
            );
        } catch (error) {
            upsertResult = this.buildFailedStepResult('upsert', error);
        }

        let cleanseResult: CalendarUpsertResult;
        try {
            cleanseResult = await this.calendarRepository.cleanseStaleEvents(
                params,
                filteredRaceEntityList,
                raceEntityList,
            );
        } catch (error) {
            cleanseResult = this.buildFailedStepResult(
                'cleanseStaleEvents',
                error,
            );
        }

        return this.combineSyncResults(upsertResult, cleanseResult);
    }
}
