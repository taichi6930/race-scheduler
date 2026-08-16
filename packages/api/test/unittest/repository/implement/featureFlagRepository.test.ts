/**
 * featureFlagRepository.test.ts - FeatureFlagRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: list()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | L1 | 複数行（enabled=1/0が混在） | 全件が正しいboolean値で返る |
 * | L2 | 行なし | 空配列 |
 * | L3 | enabledが数値/真偽値でない不正行のみ | 当該行はスキップされ空配列を返す（warnログ） |
 *
 * ### メソッド: get()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | G1 | 該当行あり（enabled=1） | true |
 * | G2 | 該当行あり（enabled=0） | false |
 * | G3 | 該当行なし | undefined |
 * | G4 | 該当行はあるが不正（enabledが文字列） | undefined |
 *
 * ### メソッド: upsert()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | U1 | 新規key | 1行INSERTされる |
 * | U2 | 既存key | enabled/updatedAtが更新される（ON CONFLICT DO UPDATE） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { FeatureFlagRepository } from '../../../../src/repository/implement/featureFlagRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

describe('FeatureFlagRepository', () => {
    let repository: FeatureFlagRepository;
    let d1: ReturnType<typeof createInMemoryD1Database>;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new FeatureFlagRepository(drizzleGateway);
    });

    describe('list', () => {
        // L1: 複数行（enabled=1/0が混在） → 全件が正しいboolean値で返る
        it('L1: 複数行がある場合は全件をboolean変換して返す', async () => {
            await db.insert(schema.featureFlag).values([
                { flagKey: 'flag_on', enabled: 1 },
                { flagKey: 'flag_off', enabled: 0 },
            ]);

            const result = await repository.list();

            expect(result).toHaveLength(2);
            expect(result.find((row) => row.flagKey === 'flag_on')).toEqual(
                expect.objectContaining({ flagKey: 'flag_on', enabled: true }),
            );
            expect(result.find((row) => row.flagKey === 'flag_off')).toEqual(
                expect.objectContaining({
                    flagKey: 'flag_off',
                    enabled: false,
                }),
            );
        });

        // L2: 行なし → 空配列
        it('L2: 行が無い場合は空配列を返す', async () => {
            const result = await repository.list();

            expect(result).toEqual([]);
        });

        // L3: enabledが不正な行のみ → スキップされ空配列（warnログ）
        it('L3: enabledが数値/真偽値でない不正行はスキップされ空配列を返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            await d1.exec(
                "INSERT INTO feature_flag (flag_key, enabled) VALUES ('bad_flag', 'not-a-number')",
            );

            const result = await repository.list();

            expect(result).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('get', () => {
        // G1: 該当行あり（enabled=1） → true
        it('G1: enabled=1の行がある場合はtrueを返す', async () => {
            await db
                .insert(schema.featureFlag)
                .values({ flagKey: 'flag_on', enabled: 1 });

            const result = await repository.get('flag_on');

            expect(result).toBe(true);
        });

        // G2: 該当行あり（enabled=0） → false
        it('G2: enabled=0の行がある場合はfalseを返す', async () => {
            await db
                .insert(schema.featureFlag)
                .values({ flagKey: 'flag_off', enabled: 0 });

            const result = await repository.get('flag_off');

            expect(result).toBe(false);
        });

        // G3: 該当行なし → undefined
        it('G3: 該当行が無い場合はundefinedを返す', async () => {
            const result = await repository.get('missing_flag');

            expect(result).toBeUndefined();
        });

        // G4: 該当行はあるが不正 → undefined
        it('G4: enabledが不正な行の場合はundefinedを返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            await d1.exec(
                "INSERT INTO feature_flag (flag_key, enabled) VALUES ('bad_flag', 'not-a-number')",
            );

            const result = await repository.get('bad_flag');

            expect(result).toBeUndefined();
            consoleSpy.mockRestore();
        });
    });

    describe('upsert', () => {
        // U1: 新規key → 1行INSERTされる
        it('U1: 新規keyの場合は1行INSERTされる', async () => {
            await repository.upsert('new_flag', true);

            const rows = await db.select().from(schema.featureFlag);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                flagKey: 'new_flag',
                enabled: 1,
            });
        });

        // U2: 既存key → enabled/updatedAtが更新される
        it('U2: 既存keyの場合はenabledが更新される', async () => {
            await repository.upsert('existing_flag', false);

            await repository.upsert('existing_flag', true);

            const rows = await db.select().from(schema.featureFlag);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                flagKey: 'existing_flag',
                enabled: 1,
            });
        });
    });
});
