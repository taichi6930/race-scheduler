/**
 * | No | パラメータ例/ボディ例                    | Usecase戻り値                | 期待される動作             |
 * |----|-------------------------------------------|-------------------------------|----------------------------|
 * | 1  | get:全パラメータ有効                     | player1件                     | 200+players=1              |
 * | 2  | get:raceType欠落                          | -                              | 400                        |
 * | 3  | get:usecase例外                           | -                              | 500                        |
 * | 4  | post:正常payload（単一オブジェクト）      | successCount=1のUpsertResult  | 200+successCount=1        |
 * | 5  | post:payload不正                          | -                              | 400                        |
 * | 6  | post:usecase例外                          | -                              | 500                        |
 * | 7  | post:一部失敗                             | failureCount=1のUpsertResult  | 200+failureCount=1        |
 * | 8  | post:配列payload（複数選手の一括upsert）  | successCount=2のUpsertResult  | 200+successCount=2、usecase.upsertへ2件のPlayerEntity配列で渡る |
 * | 9  | post:空配列payload（[]）                  | -                              | 400（配列側に`.min(1)`制約が追加され、place/raceと対称になった。#2001で修正済み） |
 */
import {
    createEmptyUpsertResult,
    type PlayerEntity,
} from '@race-schedule/core';
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';

import { PlayerController } from '../../../src/controller/playerController';
import type { IPlayerUsecase } from '../../../src/usecase/interface/IPlayerUsecase';

interface MockPlayerUsecase {
    fetch: Mock<IPlayerUsecase['fetch']>;
    upsert: Mock<IPlayerUsecase['upsert']>;
}

const createMockUsecase = (
    overrides: Partial<MockPlayerUsecase> = {},
): MockPlayerUsecase => ({
    fetch: mock(() => Promise.resolve([])),
    upsert: mock(() => Promise.resolve(createEmptyUpsertResult())),
    ...overrides,
});

interface PlayersResponseBody {
    players: unknown[];
}

interface UpsertResultResponseBody {
    successCount: number;
    failureCount: number;
    failures: { db: string; id: string; reason: string }[];
}

describe('api/controller/PlayerController', () => {
    it('getPlayerEntityList returns players', async () => {
        const mockData: PlayerEntity[] = [
            {
                raceType: 'jra',
                playerNo: '1',
                playerName: 'Taro',
                priority: 1,
            },
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
        });
        const controller = new PlayerController(usecase);
        const params = new URLSearchParams({
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(200);
        const body = (await res.json()) as PlayersResponseBody;
        expect(body.players).toHaveLength(1);
    });

    it('postUpsertPlayer rejects invalid payload', async () => {
        const usecase = createMockUsecase();
        const controller = new PlayerController(usecase);
        const req = new Request('http://localhost/player', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when raceType missing', async () => {
        const usecase = createMockUsecase();
        const controller = new PlayerController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 500 when usecase throws', async () => {
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new PlayerController(usecase);
        const params = new URLSearchParams({
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(500);
    });

    it('postUpsertPlayer success returns 200 and UpsertResult', async () => {
        const usecase = createMockUsecase({
            upsert: mock(() =>
                Promise.resolve({
                    successCount: 1,
                    failureCount: 0,
                    failures: [],
                }),
            ),
        });
        const controller = new PlayerController(usecase);
        const payload = {
            race_type: 'jra',
            player_no: '1',
            player_name: 'Taro',
            priority: 1,
        };
        const req = new Request('http://localhost/player', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(200);
        const body = (await res.json()) as UpsertResultResponseBody;
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);
    });

    it('postUpsertPlayer partial failure returns 200 and failureCount', async () => {
        const usecase = createMockUsecase({
            upsert: mock(() =>
                Promise.resolve({
                    successCount: 0,
                    failureCount: 1,
                    failures: [{ db: 'player', id: '1', reason: 'DB failure' }],
                }),
            ),
        });
        const controller = new PlayerController(usecase);
        const payload = {
            race_type: 'jra',
            player_no: '1',
            player_name: 'Taro',
            priority: 1,
        };
        const req = new Request('http://localhost/player', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(200);
        const body = (await res.json()) as UpsertResultResponseBody;
        expect(body.failureCount).toBe(1);
        expect(body.failures[0].reason).toBe('DB failure');
    });

    it('postUpsertPlayer array payload upserts multiple players in bulk', async () => {
        const upsertMock: Mock<IPlayerUsecase['upsert']> = mock(() =>
            Promise.resolve({
                successCount: 2,
                failureCount: 0,
                failures: [],
            }),
        );
        const usecase = createMockUsecase({
            upsert: upsertMock,
        });
        const controller = new PlayerController(usecase);
        const payload = [
            {
                race_type: 'jra',
                player_no: '1',
                player_name: 'Taro',
                priority: 1,
            },
            {
                race_type: 'jra',
                player_no: '2',
                player_name: 'Jiro',
                priority: 2,
            },
        ];
        const req = new Request('http://localhost/player', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(200);
        const body = (await res.json()) as UpsertResultResponseBody;
        expect(body.successCount).toBe(2);
        // 配列payloadの各要素がPlayerEntityへ変換され、usecase.upsertへ
        // 2件のPlayerEntity配列として渡されることを確認する（一括upsertの検証）
        expect(upsertMock).toHaveBeenCalledTimes(1);
        const [calledEntityList] = upsertMock.mock.calls[0];
        expect(calledEntityList).toHaveLength(2);
        expect(calledEntityList[0].playerNo).toBe('1');
        expect(calledEntityList[1].playerNo).toBe('2');
    });

    it('postUpsertPlayer empty array payload is rejected with 400', async () => {
        // playerUpsertPayloadSchema（packages/core/src/schemas/playerValidation.ts）の配列側に
        // `.min(1, '配列は1件以上必要です')` が追加され、place/raceと対称になった（#2001で修正済み）。
        // 空配列 [] はバリデーションで弾かれ、usecase.upsertは呼ばれず400を返す。
        const upsertMock: Mock<IPlayerUsecase['upsert']> = mock(() =>
            Promise.resolve(createEmptyUpsertResult()),
        );
        const usecase = createMockUsecase({
            upsert: upsertMock,
        });
        const controller = new PlayerController(usecase);
        const req = new Request('http://localhost/player', {
            method: 'POST',
            body: JSON.stringify([]),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('postUpsertPlayer returns 500 when usecase throws', async () => {
        const usecase = createMockUsecase({
            upsert: mock(() => Promise.reject(new Error('db'))),
        });
        const controller = new PlayerController(usecase);
        const payload = {
            race_type: 'jra',
            player_no: '1',
            player_name: 'Taro',
            priority: 1,
        };
        const req = new Request('http://localhost/player', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(500);
    });
});
