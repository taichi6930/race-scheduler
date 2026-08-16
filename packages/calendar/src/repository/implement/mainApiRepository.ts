import type {
    CalendarFilterParams,
    CalendarFlagEntity,
    RaceEntity,
} from '@race-schedule/core';
import { DI_TOKENS } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IMainApiGateway } from '../../gateway/interface/IMainApiGateway';
import type { IMainApiRepository } from '../interface/IMainApiRepository';

/**
 * メインAPI（@race-schedule/api）から同期元データを取得するリポジトリのHTTP実装
 * @remarks
 * MainApiGateway（HTTP通信の詳細）へ委譲する薄いアダプタ。
 * Usecase が Gateway を直接注入しないための層境界を提供する。
 * PERF-138: 変換・分岐を一切持たない委譲のみのクラスのため、@LogAllMethods による
 * ログ出力（開始/終了/経過時間計測、date-fnsのformat呼び出し等）はリクエスト毎に
 * 発生するオーバーヘッドの割に付加価値が薄く、ログ対象から除外している。
 */
@injectable()
export class MainApiRepository implements IMainApiRepository {
    public constructor(
        @inject(DI_TOKENS.MainApiGateway)
        private readonly mainApiGateway: IMainApiGateway,
    ) {}

    public async fetchRaceList(
        filter: CalendarFilterParams,
    ): Promise<RaceEntity[]> {
        return this.mainApiGateway.fetchRaceList({
            startDate: filter.startDate,
            finishDate: filter.finishDate,
            raceTypeList: filter.raceTypeList,
        });
    }

    public async fetchCalendarFlagList(): Promise<CalendarFlagEntity[]> {
        return this.mainApiGateway.fetchCalendarFlagList();
    }
}
