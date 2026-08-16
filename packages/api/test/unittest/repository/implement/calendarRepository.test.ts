/**
 * calendarRepository.test.ts - CalendarRepository ユニットテスト
 *
 * Drizzle化に伴い、SQL文字列のモックではなく bun:sqlite ベースの
 * インメモリD1（createInMemoryD1Database）に対して実際にクエリを実行する形へ変更した
 * （drizzle のクエリビルダはコンパイル時に組み立てられるため、
 * SQL文字列の呼び出し検証では実質的な検証にならないため）。
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: fetchFlaggedRaceIds(raceIds)
 * | ケース | DB状態 | 引数raceIds | 期待値 |
 * |--------|--------|-------------|--------|
 * | F1 | 複数行 | 全行のraceIdを含む | raceIdのSet |
 * | F2 | 空 | 任意 | 空のSet |
 * | F3 | 複数行 | 一部のraceIdのみ（PERF-179） | 指定raceIdに絞ったSet（IN句相当） |
 * | F4 | 複数行 | 空配列 | DBに問い合わせず空のSet |
 * | F5 | チャンクサイズ(100件)超の行 | 101件のraceId | チャンク分割されても全件Setに含まれる（Issue #2350） |
 *
 * ### メソッド: list()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | L1 | 有効な行複数件 | Array[CalendarFlagEntity]（created_at降順） |
 * | L2 | label が空文字 | label='' として扱う |
 * | L3 | 無効な行（raceId形式不正）のみ | 当該行はスキップされ、空配列を返す（warnログ、PERF-106） |
 * | L4 | labelありの行とlabelが空文字の行が混在する複数行 | 各行のraceId/labelがDB行の順序通りに変換される |
 * | L5 | 有効な行と無効な行（raceId形式不正）が混在 | 無効な行のみスキップされ、有効な行はそのまま返る（PERF-106） |
 *
 * ### メソッド: add()
 * | ケース | 入力 | 期待値 |
 * |--------|------|--------|
 * | A1 | 新規raceId | 1行INSERTされる |
 * | A2 | 既存raceId | labelが更新される（ON CONFLICT DO UPDATE） |
 *
 * ### メソッド: remove()
 * | ケース | 入力 | 期待値 |
 * |--------|------|--------|
 * | R1 | raceId | 該当行が削除される |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { validateRaceId } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { CalendarRepository } from '../../../../src/repository/implement/calendarRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

describe('CalendarRepository', () => {
    let repository: CalendarRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new CalendarRepository(drizzleGateway);
    });

    afterEach(() => {
        // クリーンアップ不要（各テストで新しいインメモリDBを作成するため）
    });

    describe('fetchFlaggedRaceIds', () => {
        // F1: 複数行・全行のraceIdを引数に渡す → raceIdのSetを返す
        it('F1: 複数行のraceIdからSetを構築する', async () => {
            await db.insert(schema.calendarFlag).values([
                { raceId: 'nar202601010202', label: '' },
                { raceId: 'jra202601010501', label: '' },
            ]);

            const result = await repository.fetchFlaggedRaceIds([
                'nar202601010202',
                'jra202601010501',
            ]);

            expect(result).toEqual(
                new Set(['nar202601010202', 'jra202601010501']),
            );
        });

        // F2: 結果が空の場合は空のSetを返す
        it('F2: 結果が空の場合は空のSetを返す', async () => {
            const result = await repository.fetchFlaggedRaceIds([
                'nar202601010202',
            ]);

            expect(result).toEqual(new Set());
        });

        // F3: DBには複数行あるが、引数raceIdsで絞られたものだけがSetに含まれる
        it('F3: 引数raceIdsに含まれるraceIdのみに絞ったSetを返す（PERF-179）', async () => {
            await db.insert(schema.calendarFlag).values([
                { raceId: 'nar202601010202', label: '' },
                { raceId: 'jra202601010501', label: '' },
                { raceId: 'keirin202601010601', label: '' },
            ]);

            const result = await repository.fetchFlaggedRaceIds([
                'jra202601010501',
                'keirin202601010601',
            ]);

            expect(result).toEqual(
                new Set(['jra202601010501', 'keirin202601010601']),
            );
        });

        // F4: 空配列を渡した場合はDBに問い合わせず空のSetを返す
        it('F4: 引数raceIdsが空配列の場合はDBに問い合わせず空のSetを返す', async () => {
            await db.insert(schema.calendarFlag).values({
                raceId: 'nar202601010202',
                label: '',
            });

            const result = await repository.fetchFlaggedRaceIds([]);

            expect(result).toEqual(new Set());
        });

        // F5: チャンクサイズ(100件)を超えるraceIds → チャンク分割されても全件検出する
        // (D1のバインド変数上限超過でクエリ全体が失敗しないことの回帰テスト。Issue #2350)
        it('F5: チャンクサイズ(100件)を超えるraceIdsを渡してもチャンク分割して全件検出する', async () => {
            const raceIds = Array.from(
                { length: 101 },
                (_, i) => `keirin2025010111${String(i).padStart(3, '0')}`,
            );
            await db
                .insert(schema.calendarFlag)
                .values(raceIds.map((raceId) => ({ raceId, label: '' })));

            const result = await repository.fetchFlaggedRaceIds(raceIds);

            expect(result).toEqual(new Set(raceIds));
        });
    });

    describe('list', () => {
        // L1: 有効な行複数件 → CalendarFlagEntity配列を返す（created_at降順）
        it('L1: 有効な行からCalendarFlagEntity配列を返す', async () => {
            await db.insert(schema.calendarFlag).values({
                raceId: 'nar202601010202',
                label: '一口:テスト号',
            });

            const result = await repository.list();

            expect(result).toEqual([
                {
                    raceId: validateRaceId('nar202601010202'),
                    label: '一口:テスト号',
                },
            ]);
        });

        // L2: label が空文字 → 空文字として扱う
        it('L2: labelが空文字の場合は空文字として扱う', async () => {
            await db
                .insert(schema.calendarFlag)
                .values({ raceId: 'nar202601010202', label: '' });

            const result = await repository.list();

            expect(result).toEqual([
                { raceId: validateRaceId('nar202601010202'), label: '' },
            ]);
        });

        // L3: 無効な行（raceId形式不正）のみ → 当該行はスキップされ、空配列を返す（PERF-106）
        it('L3: raceId形式が不正な行はスキップされ空配列を返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            await db
                .insert(schema.calendarFlag)
                .values({ raceId: 'invalid-race-id', label: '' });

            const result = await repository.list();

            expect(result).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        // L4: labelありの行とlabelが空文字の行が混在する複数行
        // → 単一行のみのL1/L2では検知できない「他行の変換結果に引きずられて
        //   labelが上書きされる」類のバグを、複数行かつラベル種別が異なる
        //   リストで各行の中身と順序を明示的に検証する
        it('L4: labelありとlabelが空文字の行が混在するとき各行を順序通りに変換する', async () => {
            // created_at を明示的にずらし、created_at DESC の並び順を決定的にする
            await db.insert(schema.calendarFlag).values({
                raceId: 'nar202601010202',
                label: '一口:テスト号',
                createdAt: '2026-01-01T00:00:01+09:00',
            });
            await db.insert(schema.calendarFlag).values({
                raceId: 'jra202601010501',
                label: '',
                createdAt: '2026-01-01T00:00:02+09:00',
            });
            await db.insert(schema.calendarFlag).values({
                raceId: 'keirin202601011101',
                label: '応援:選手A',
                createdAt: '2026-01-01T00:00:03+09:00',
            });

            const result = await repository.list();

            expect(result).toEqual([
                {
                    raceId: validateRaceId('keirin202601011101'),
                    label: '応援:選手A',
                },
                { raceId: validateRaceId('jra202601010501'), label: '' },
                {
                    raceId: validateRaceId('nar202601010202'),
                    label: '一口:テスト号',
                },
            ]);
        });

        // L5: 有効な行と無効な行（raceId形式不正）が混在
        // → 無効な行のみスキップされ、有効な行はそのまま返る（PERF-106）
        it('L5: 有効な行と無効な行が混在するとき無効な行のみスキップし有効な行を返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            await db.insert(schema.calendarFlag).values({
                raceId: 'nar202601010202',
                label: '一口:テスト号',
                createdAt: '2026-01-01T00:00:01+09:00',
            });
            await db.insert(schema.calendarFlag).values({
                raceId: 'invalid-race-id',
                label: '不正な行',
                createdAt: '2026-01-01T00:00:02+09:00',
            });

            const result = await repository.list();

            expect(result).toEqual([
                {
                    raceId: validateRaceId('nar202601010202'),
                    label: '一口:テスト号',
                },
            ]);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                    '[CalendarRepository.list] Skipping invalid calendar_flag row',
                ),
            );
            consoleSpy.mockRestore();
        });
    });

    describe('add', () => {
        // A1: 新規raceId → 1行INSERTされる
        it('A1: 新規raceIdの場合は1行INSERTされる', async () => {
            await repository.add(
                validateRaceId('nar202601010202'),
                '一口:テスト号',
            );

            const rows = await db.select().from(schema.calendarFlag);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                raceId: 'nar202601010202',
                label: '一口:テスト号',
            });
        });

        // A2: 既存raceId → labelが更新される（ON CONFLICT DO UPDATE）
        it('A2: 既存raceIdの場合はlabelが更新される', async () => {
            await repository.add(validateRaceId('nar202601010202'), '旧ラベル');

            await repository.add(validateRaceId('nar202601010202'), '新ラベル');

            const rows = await db.select().from(schema.calendarFlag);
            expect(rows).toHaveLength(1);
            expect(rows[0].label).toBe('新ラベル');
        });
    });

    describe('remove', () => {
        // R1: raceId → 該当行が削除される
        it('R1: 指定raceIdの行が削除される', async () => {
            await db
                .insert(schema.calendarFlag)
                .values({ raceId: 'nar202601010202', label: '' });

            await repository.remove(validateRaceId('nar202601010202'));

            const rows = await db.select().from(schema.calendarFlag);
            expect(rows).toHaveLength(0);
        });
    });
});
