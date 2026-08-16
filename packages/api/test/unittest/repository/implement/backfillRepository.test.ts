/**
 * BackfillRepository テスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件 | 期待される動作 | Coverage |
 * |----|---------|------|----------------|----------|
 * | 1  | syncPlace | 正常系 | ScrapingApiGateway.syncPlaceへそのまま委譲する | Line |
 * | 2  | syncRace | 正常系 | ScrapingApiGateway.syncRaceへそのまま委譲する | Line |
 */

import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import type {
    IScrapingApiGateway,
    ScrapingSyncPlaceResult,
    ScrapingSyncRaceResult,
} from '../../../../src/gateway/interface/IScrapingApiGateway';
import { BackfillRepository } from '../../../../src/repository/implement/backfillRepository';

describe('BackfillRepository', () => {
    it('#1: syncPlace はScrapingApiGateway.syncPlaceへそのまま委譲する', async () => {
        const expected: ScrapingSyncPlaceResult = {
            successCount: 1,
            failureCount: 0,
            failures: [],
            notCachedKeys: [],
        };
        const syncPlaceMock = mock(() => Promise.resolve(expected));
        const gateway: IScrapingApiGateway = {
            syncPlace: syncPlaceMock,
            syncRace: mock(),
        };
        const repository = new BackfillRepository(gateway);

        const params = {
            startDate: new Date('2026-01-01'),
            finishDate: new Date('2026-01-31'),
            raceTypeList: [RaceType.KEIRIN],
            cacheOnly: true,
        };
        const result = await repository.syncPlace(params);

        expect(syncPlaceMock).toHaveBeenCalledWith(params);
        expect(result).toEqual(expected);
    });

    it('#2: syncRace はScrapingApiGateway.syncRaceへそのまま委譲する', async () => {
        const expected: ScrapingSyncRaceResult = {
            successCount: 1,
            failureCount: 0,
            failures: [],
            notCachedPlaceIds: [],
        };
        const syncRaceMock = mock(() => Promise.resolve(expected));
        const gateway: IScrapingApiGateway = {
            syncPlace: mock(),
            syncRace: syncRaceMock,
        };
        const repository = new BackfillRepository(gateway);

        const params = { placeIdList: ['keirin2026010101'], cacheOnly: true };
        const result = await repository.syncRace(params);

        expect(syncRaceMock).toHaveBeenCalledWith(params);
        expect(result).toEqual(expected);
    });
});
