/**
 * isUseInMemoryDb.test.ts - isUseInMemoryDB のユニットテスト
 *
 * ## デシジョンテーブル（isUseInMemoryDB）
 *
 * | #    | env 引数                        | process.env | 期待結果 |
 * |------|---------------------------------|-------------|----------|
 * | T-01 | { USE_IN_MEMORY_DB: 'true' }     | 未設定      | true     |
 * | T-02 | { USE_IN_MEMORY_DB: 'false' }    | 未設定      | false    |
 * | T-03 | 省略（undefined）               | 'true'      | true     |
 * | T-04 | 省略（undefined）               | 未設定      | false    |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { isUseInMemoryDB } from '../../../src/utility/isUseInMemoryDb';

describe('isUseInMemoryDB', () => {
    const original = process.env.USE_IN_MEMORY_DB;

    beforeEach(() => {
        delete process.env.USE_IN_MEMORY_DB;
    });

    afterEach(() => {
        if (original === undefined) {
            delete process.env.USE_IN_MEMORY_DB;
        } else {
            process.env.USE_IN_MEMORY_DB = original;
        }
    });

    it('[T-01] isUseInMemoryDB_env引数がtrue_trueを返すこと', () => {
        // Arrange
        const env = { USE_IN_MEMORY_DB: 'true' };

        // Act
        const result = isUseInMemoryDB(env);

        // Assert
        expect(result).toBe(true);
    });

    it('[T-02] isUseInMemoryDB_env引数がfalse_falseを返すこと', () => {
        // Arrange
        const env = { USE_IN_MEMORY_DB: 'false' };

        // Act
        const result = isUseInMemoryDB(env);

        // Assert
        expect(result).toBe(false);
    });

    it('[T-03] isUseInMemoryDB_env未指定でprocessEnvがtrue_trueを返すこと', () => {
        // Arrange
        process.env.USE_IN_MEMORY_DB = 'true';

        // Act
        const result = isUseInMemoryDB();

        // Assert
        expect(result).toBe(true);
    });

    it('[T-04] isUseInMemoryDB_env未指定でprocessEnv未設定_falseを返すこと', () => {
        // Act
        const result = isUseInMemoryDB();

        // Assert
        expect(result).toBe(false);
    });
});
