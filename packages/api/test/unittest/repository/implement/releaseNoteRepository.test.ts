/**
 * releaseNoteRepository.test.ts - ReleaseNoteRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: findAll()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | F1 | 該当行なし | 空配列 |
 * | F2 | 複数行あり | published_atの新しい順で、GitHub互換のsnake_case形状で返す |
 * | F3 | draft/prereleaseが1（true） | draft/prereleaseがtrueに変換される |
 * | F4 | published_atがNULL | 変換なしでnullのまま返す（SQLiteのDESC順ではNULLは最後） |
 *
 * ### メソッド: upsert()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | U1 | 該当行なし | 新規行が作成される |
 * | U2 | 同じ(tag_name, source_repo)の行が既にある | 既存行が上書きされる（行数は増えない） |
 * | U3 | tag_nameは同じだがsource_repoが異なる行がある | 別行として新規作成される（衝突しない） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import type { ReleaseNoteWrite } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { ReleaseNoteRepository } from '../../../../src/repository/implement/releaseNoteRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

describe('ReleaseNoteRepository', () => {
    let repository: ReleaseNoteRepository;
    let d1: ReturnType<typeof createInMemoryD1Database>;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new ReleaseNoteRepository(drizzleGateway);
    });

    describe('findAll', () => {
        // F1: 該当行なし → 空配列
        it('F1: 行が無い場合は空配列を返す', async () => {
            const result = await repository.findAll();

            expect(result).toEqual([]);
        });

        // F2: 複数行あり → published_atの新しい順で、GitHub互換の形状で返す
        it('F2: 複数行ある場合はpublished_atの新しい順で返す', async () => {
            await db.insert(schema.releaseNote).values([
                {
                    tagName: 'v1.0.0',
                    name: 'v1.0.0',
                    body: '古いリリース',
                    publishedAt: '2026-01-01T00:00:00Z',
                    sourceRepo: 'race-schedule',
                },
                {
                    tagName: 'v2.0.0',
                    name: 'v2.0.0',
                    body: '新しいリリース',
                    publishedAt: '2026-08-16T00:00:00Z',
                    sourceRepo: 'race-scheduler',
                },
            ]);

            const result = await repository.findAll();

            expect(result).toEqual([
                {
                    tag_name: 'v2.0.0',
                    name: 'v2.0.0',
                    body: '新しいリリース',
                    published_at: '2026-08-16T00:00:00Z',
                    draft: false,
                    prerelease: false,
                    source_repo: 'race-scheduler',
                },
                {
                    tag_name: 'v1.0.0',
                    name: 'v1.0.0',
                    body: '古いリリース',
                    published_at: '2026-01-01T00:00:00Z',
                    draft: false,
                    prerelease: false,
                    source_repo: 'race-schedule',
                },
            ]);
        });

        // F3: draft/prereleaseが1（true） → draft/prereleaseがtrueに変換される
        it('F3: draft/prereleaseが1の場合はtrueに変換される', async () => {
            await db.insert(schema.releaseNote).values({
                tagName: 'v2.1.0-rc1',
                name: null,
                body: null,
                publishedAt: '2026-08-20T00:00:00Z',
                draft: 1,
                prerelease: 1,
                sourceRepo: 'race-scheduler',
            });

            const result = await repository.findAll();

            expect(result).toEqual([
                {
                    tag_name: 'v2.1.0-rc1',
                    name: null,
                    body: null,
                    published_at: '2026-08-20T00:00:00Z',
                    draft: true,
                    prerelease: true,
                    source_repo: 'race-scheduler',
                },
            ]);
        });

        // F4: published_atがNULL → 変換なしでnullのまま返す
        it('F4: published_atがNULLの場合はnullのまま返す', async () => {
            await db.insert(schema.releaseNote).values({
                tagName: 'v0.0.1',
                sourceRepo: 'race-schedule',
            });

            const result = await repository.findAll();

            expect(result[0]?.published_at).toBeNull();
        });
    });

    describe('upsert', () => {
        // U1: 該当行なし → 新規行が作成される
        it('U1: 該当行が無い場合は新規行を作成する', async () => {
            const note: ReleaseNoteWrite = {
                tag_name: 'v1.0.0',
                name: 'v1.0.0',
                body: '本文',
                published_at: '2026-08-01T00:00:00Z',
                draft: false,
                prerelease: false,
                source_repo: 'race-schedule',
            };

            await repository.upsert(note);

            const result = await repository.findAll();
            expect(result).toEqual([
                {
                    tag_name: 'v1.0.0',
                    name: 'v1.0.0',
                    body: '本文',
                    published_at: '2026-08-01T00:00:00Z',
                    draft: false,
                    prerelease: false,
                    source_repo: 'race-schedule',
                },
            ]);
        });

        // U2: 同じ(tag_name, source_repo)の行が既にある → 既存行が上書きされる
        it('U2: 同じtag_name-source_repoの行が既にある場合は上書きする', async () => {
            const note: ReleaseNoteWrite = {
                tag_name: 'v1.0.0',
                name: 'v1.0.0',
                body: '初版',
                published_at: '2026-08-01T00:00:00Z',
                draft: false,
                prerelease: false,
                source_repo: 'race-schedule',
            };
            await repository.upsert(note);

            await repository.upsert({ ...note, body: '更新後の本文' });

            const result = await repository.findAll();
            expect(result).toHaveLength(1);
            expect(result[0]?.body).toBe('更新後の本文');
        });

        // U3: tag_nameは同じだがsource_repoが異なる → 別行として新規作成される
        it('U3: tag_nameが同じでsource_repoが異なる場合は別行として作成する', async () => {
            const base: ReleaseNoteWrite = {
                tag_name: 'v2.0.0',
                name: 'v2.0.0',
                body: null,
                published_at: null,
                draft: false,
                prerelease: false,
                source_repo: 'race-schedule',
            };
            await repository.upsert(base);

            await repository.upsert({ ...base, source_repo: 'race-scheduler' });

            const result = await repository.findAll();
            expect(result).toHaveLength(2);
        });
    });
});
