/**
 * FavoriteController のデシジョンテーブル
 *
 * | #    | メソッド | 状況                     | 期待 |
 * | ---- | -------- | -------------------------- | ---- |
 * | T-01 | fetch    | 未ログイン                 | 401  |
 * | T-02 | fetch    | 正常系                     | 200  |
 * | T-03 | fetch    | usecaseが例外              | 500  |
 * | T-04 | add      | 未ログイン                 | 401  |
 * | T-05 | add      | bodyが不正                 | 400  |
 * | T-06 | add      | raceIdの形式が不正         | 400  |
 * | T-07 | add      | 正常系                     | 200  |
 * | T-08 | remove   | 未ログイン                 | 401  |
 * | T-09 | remove   | 正常系                     | 200  |
 */

import { describe, expect, it, mock } from 'bun:test';
import { runWithCurrentUserId } from '@race-schedule/core';
import 'reflect-metadata';

import { FavoriteController } from '../../../src/controller/favoriteController';
import type { IFavoriteUsecase } from '../../../src/usecase/interface/IFavoriteUsecase';

const buildUsecase = (
    overrides?: Partial<IFavoriteUsecase>,
): IFavoriteUsecase =>
    ({
        fetch: mock(() => Promise.resolve(['jra202604260501'])),
        add: mock(() => Promise.resolve()),
        remove: mock(() => Promise.resolve()),
        ...overrides,
    }) as IFavoriteUsecase;

const jsonRequest = (body: unknown): Request =>
    new Request('http://localhost/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

describe('FavoriteController', () => {
    describe('fetch', () => {
        it('[T-01] 未ログインの場合401を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await controller.fetch();

            expect(res.status).toBe(401);
        });

        it('[T-02] 正常系で200とraceIds一覧を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.fetch(),
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { raceIds: string[] };
            expect(body.raceIds).toEqual(['jra202604260501']);
            expect(usecase.fetch).toHaveBeenCalledWith('user-1');
        });

        it('[T-03] usecaseが例外を投げた場合500を返すこと', async () => {
            const usecase = buildUsecase({
                fetch: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new FavoriteController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.fetch(),
            );

            expect(res.status).toBe(500);
        });
    });

    describe('add', () => {
        it('[T-04] 未ログインの場合401を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await controller.add(
                jsonRequest({ raceId: 'jra202604260501' }),
            );

            expect(res.status).toBe(401);
        });

        it('[T-05] bodyが不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.add(jsonRequest({})),
            );

            expect(res.status).toBe(400);
        });

        it('[T-06] raceIdの形式が不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.add(jsonRequest({ raceId: 'invalid' })),
            );

            expect(res.status).toBe(400);
            expect(usecase.add).not.toHaveBeenCalled();
        });

        it('[T-07] 正常系で200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.add(jsonRequest({ raceId: 'jra202604260501' })),
            );

            expect(res.status).toBe(200);
            expect(usecase.add).toHaveBeenCalledWith(
                'user-1',
                'jra202604260501',
            );
        });
    });

    describe('remove', () => {
        it('[T-08] 未ログインの場合401を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await controller.remove(
                jsonRequest({ raceId: 'jra202604260501' }),
            );

            expect(res.status).toBe(401);
        });

        it('[T-09] 正常系で200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new FavoriteController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.remove(jsonRequest({ raceId: 'jra202604260501' })),
            );

            expect(res.status).toBe(200);
            expect(usecase.remove).toHaveBeenCalledWith(
                'user-1',
                'jra202604260501',
            );
        });
    });
});
