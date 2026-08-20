/**
 * FavoriteUsecase のデシジョンテーブル
 *
 * | #    | メソッド | 状況   | 期待                         |
 * | ---- | -------- | ------ | ---------------------------- |
 * | T-01 | fetch    | 正常系 | repository.fetchへ委譲       |
 * | T-02 | add      | 正常系 | repository.addへ委譲         |
 * | T-03 | remove   | 正常系 | repository.removeへ委譲      |
 */

import { describe, expect, it, mock } from 'bun:test';
import 'reflect-metadata';

import type { IFavoriteRepository } from '../../../../src/repository/interface/IFavoriteRepository';
import { FavoriteUsecase } from '../../../../src/usecase/implement/favoriteUsecase';

const buildRepository = (
    overrides?: Partial<IFavoriteRepository>,
): IFavoriteRepository =>
    ({
        fetch: mock(() => Promise.resolve([])),
        add: mock(() => Promise.resolve()),
        remove: mock(() => Promise.resolve()),
        ...overrides,
    }) as IFavoriteRepository;

describe('FavoriteUsecase', () => {
    describe('fetch', () => {
        it('[T-01] repository.fetchへ委譲すること', async () => {
            const repository = buildRepository({
                fetch: mock(() => Promise.resolve(['race-1', 'race-2'])),
            });
            const usecase = new FavoriteUsecase(repository);

            const result = await usecase.fetch('user-1');

            expect(result).toEqual(['race-1', 'race-2']);
            expect(repository.fetch).toHaveBeenCalledWith('user-1');
        });
    });

    describe('add', () => {
        it('[T-02] repository.addへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new FavoriteUsecase(repository);

            await usecase.add('user-1', 'race-1');

            expect(repository.add).toHaveBeenCalledWith('user-1', 'race-1');
        });
    });

    describe('remove', () => {
        it('[T-03] repository.removeへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new FavoriteUsecase(repository);

            await usecase.remove('user-1', 'race-1');

            expect(repository.remove).toHaveBeenCalledWith('user-1', 'race-1');
        });
    });
});
