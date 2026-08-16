/**
 * MainApiRepository テスト
 *
 * ## デシジョンテーブル
 *
 * | #  | 条件                          | 期待される動作                                             | Coverage |
 * |----|-------------------------------|------------------------------------------------------------|----------|
 * | 1  | fetchRaceList 呼び出し        | gateway.fetchRaceList に期間・種別を渡して委譲し結果を返す  | Line     |
 * | 2  | fetchCalendarFlagList 呼び出し | gateway.fetchCalendarFlagList へ委譲し結果を返す           | Line     |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';
import type {
    CalendarFilterParams,
    CalendarFlagEntity,
    RaceEntity,
} from '@race-schedule/core';
import { RaceType } from '@race-schedule/core';
import { RaceFactory } from '../../../../../../tests/shared/factories';
import type { IMainApiGateway } from '../../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../../src/repository/implement/mainApiRepository';

const FILTER: CalendarFilterParams = {
    startDate: new Date('2026-01-01T00:00:00+09:00'),
    finishDate: new Date('2026-01-31T00:00:00+09:00'),
    raceTypeList: [RaceType.JRA],
};

const createRepository = (
    raceEntityList: RaceEntity[] = [],
    flagList: CalendarFlagEntity[] = [],
) => {
    const mainApiGateway: IMainApiGateway = {
        fetchRaceList: mock(() => Promise.resolve(raceEntityList)),
        fetchCalendarFlagList: mock(() => Promise.resolve(flagList)),
    };

    return {
        mainApiGateway,
        repository: new MainApiRepository(mainApiGateway),
    };
};

describe('MainApiRepository', () => {
    it('#1: fetchRaceListはgatewayへ期間・種別を渡して委譲し結果を返す', async () => {
        const race = RaceFactory.create();
        const { mainApiGateway, repository } = createRepository([race]);

        const result = await repository.fetchRaceList(FILTER);

        expect(mainApiGateway.fetchRaceList).toHaveBeenCalledWith({
            startDate: FILTER.startDate,
            finishDate: FILTER.finishDate,
            raceTypeList: FILTER.raceTypeList,
        });
        expect(result).toEqual([race]);
    });

    it('#2: fetchCalendarFlagListはgatewayへ委譲し結果を返す', async () => {
        const race = RaceFactory.create();
        const flag: CalendarFlagEntity = {
            raceId: race.raceId,
            label: 'メモ',
        };
        const { mainApiGateway, repository } = createRepository([], [flag]);

        const result = await repository.fetchCalendarFlagList();

        expect(mainApiGateway.fetchCalendarFlagList).toHaveBeenCalled();
        expect(result).toEqual([flag]);
    });
});
