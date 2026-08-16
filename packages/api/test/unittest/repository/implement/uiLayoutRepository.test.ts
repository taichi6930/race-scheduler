/**
 * uiLayoutRepository.test.ts - UiLayoutRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: get()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | G1 | 該当行あり（有効なJSON） | パース済みのRaceDetailUiConfigを返す |
 * | G2 | 該当行なし | undefined |
 * | G3 | 該当行はあるがJSONとして不正 | undefined（warnログ） |
 * | G4 | 該当行はあるがスキーマ不一致（未知のフィールドキー） | undefined（warnログ） |
 *
 * ### メソッド: upsert()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | U1 | 新規layoutKey | 1行INSERTされる |
 * | U2 | 既存layoutKey | configが更新される（ON CONFLICT DO UPDATE） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { RaceDetailUiConfig } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { UiLayoutRepository } from '../../../../src/repository/implement/uiLayoutRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

const SAMPLE_CONFIG: RaceDetailUiConfig = {
    sections: [
        { type: 'kv', fields: [{ key: 'grade', label: '級・グレード' }] },
        { type: 'links' },
        { type: 'players', title: '出走選手', watchToggle: true },
    ],
};

describe('UiLayoutRepository', () => {
    let repository: UiLayoutRepository;
    let d1: ReturnType<typeof createInMemoryD1Database>;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new UiLayoutRepository(drizzleGateway);
    });

    describe('get', () => {
        // G1: 該当行あり（有効なJSON） → パース済みのRaceDetailUiConfigを返す
        it('G1: 有効なJSONの行がある場合はパース済みの構成を返す', async () => {
            await db.insert(schema.uiLayout).values({
                layoutKey: 'race_detail.keirin',
                config: JSON.stringify(SAMPLE_CONFIG),
            });

            const result = await repository.get('race_detail.keirin');

            expect(result).toEqual(SAMPLE_CONFIG);
        });

        // G2: 該当行なし → undefined
        it('G2: 該当行が無い場合はundefinedを返す', async () => {
            const result = await repository.get('race_detail.keirin');

            expect(result).toBeUndefined();
        });

        // G3: 該当行はあるがJSONとして不正 → undefined（warnログ）
        it('G3: JSONとして不正な場合はundefinedを返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            await db.insert(schema.uiLayout).values({
                layoutKey: 'race_detail.keirin',
                config: 'not-a-json',
            });

            const result = await repository.get('race_detail.keirin');

            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        // G4: スキーマ不一致（未知のフィールドキー） → undefined（warnログ）
        it('G4: スキーマに一致しない場合はundefinedを返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            await db.insert(schema.uiLayout).values({
                layoutKey: 'race_detail.keirin',
                config: JSON.stringify({
                    sections: [{ type: 'kv', fields: [{ key: 'odds' }] }],
                }),
            });

            const result = await repository.get('race_detail.keirin');

            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('upsert', () => {
        // U1: 新規layoutKey → 1行INSERTされる
        it('U1: 新規layoutKeyの場合は1行INSERTされる', async () => {
            await repository.upsert('race_detail.keirin', SAMPLE_CONFIG);

            const rows = await db.select().from(schema.uiLayout);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                layoutKey: 'race_detail.keirin',
                config: JSON.stringify(SAMPLE_CONFIG),
            });
        });

        // U2: 既存layoutKey → configが更新される
        it('U2: 既存layoutKeyの場合はconfigが更新される', async () => {
            await repository.upsert('race_detail.keirin', SAMPLE_CONFIG);
            const updatedConfig: RaceDetailUiConfig = { sections: [] };

            await repository.upsert('race_detail.keirin', updatedConfig);

            const rows = await db.select().from(schema.uiLayout);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                layoutKey: 'race_detail.keirin',
                config: JSON.stringify(updatedConfig),
            });
        });
    });
});
