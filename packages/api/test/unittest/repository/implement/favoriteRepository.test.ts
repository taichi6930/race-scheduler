/**
 * FavoriteRepository のデシジョンテーブル
 *
 * | #    | メソッド | 状況                       | 期待                                 |
 * | ---- | -------- | -------------------------- | ------------------------------------- |
 * | T-01 | fetch    | 複数件登録済み             | userIdに紐づくraceId一覧を返す        |
 * | T-02 | fetch    | 未登録                     | 空配列を返す                          |
 * | T-03 | add      | 正常系                     | fetchで取得できるようになる           |
 * | T-04 | add      | 既に追加済みのraceId       | エラーにならず冪等（重複行にならない） |
 * | T-05 | remove   | 正常系                     | fetchで取得できなくなる               |
 * | T-06 | remove   | 存在しないraceId           | エラーにならない（冪等）              |
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { FavoriteRepository } from '../../../../src/repository/implement/favoriteRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

describe('FavoriteRepository', () => {
    let repository: FavoriteRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(async () => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new FavoriteRepository(drizzleGateway);
        await db
            .insert(schema.user)
            .values({ id: 'user-1', nickname: 'たなか' });
    });

    describe('fetch', () => {
        it('[T-01] 複数件登録済みの場合userIdに紐づくraceId一覧を返すこと', async () => {
            await repository.add('user-1', 'race-1');
            await repository.add('user-1', 'race-2');

            const result = await repository.fetch('user-1');

            expect(result.sort()).toEqual(['race-1', 'race-2']);
        });

        it('[T-02] 未登録の場合空配列を返すこと', async () => {
            const result = await repository.fetch('user-1');

            expect(result).toEqual([]);
        });
    });

    describe('add', () => {
        it('[T-03] 追加後はfetchで取得できるようになること', async () => {
            await repository.add('user-1', 'race-1');

            expect(await repository.fetch('user-1')).toEqual(['race-1']);
        });

        it('[T-04] 既に追加済みのraceIdを再度addしてもエラーにならず冪等であること', async () => {
            await repository.add('user-1', 'race-1');

            await repository.add('user-1', 'race-1');

            expect(await repository.fetch('user-1')).toEqual(['race-1']);
        });
    });

    describe('remove', () => {
        it('[T-05] 削除後はfetchで取得できなくなること', async () => {
            await repository.add('user-1', 'race-1');

            await repository.remove('user-1', 'race-1');

            expect(await repository.fetch('user-1')).toEqual([]);
        });

        it('[T-06] 存在しないraceIdをremoveしてもエラーにならないこと', async () => {
            await repository.remove('user-1', 'no-such-race');

            expect(await repository.fetch('user-1')).toEqual([]);
        });
    });
});
