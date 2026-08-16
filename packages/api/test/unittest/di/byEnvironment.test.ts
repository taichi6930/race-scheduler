import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
/**
 * initializeDIByEnvironment テスト
 *
 * DrizzleGateway は Drizzle 化により本番・インメモリ両方で同一クラスを登録する
 * （実データの向き先は EnvStore.env.DB の差し替えで切り替わる）ため、
 * ここでは各分岐で initializeDIByEnvironment が例外なく完走し、
 * DrizzleGateway が解決できることを検証する。
 *
 * ## デシジョンテーブル（initializeDIByEnvironment）
 *
 * | #    | process.env.USE_IN_MEMORY_DB | isUseInMemoryDB() | 期待                                  |
 * |------|------------------------------|-------------------|---------------------------------------|
 * | T-01 | 'true'                       | true              | インメモリDB分岐を通り DrizzleGateway が解決できる |
 * | T-02 | 未設定                       | false             | D1（本番）分岐を通り DrizzleGateway が解決できる   |
 */
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { initializeDIByEnvironment } from '../../../src/di';
import { DrizzleGateway } from '../../../src/gateway/implement/drizzleGateway';

describe('initializeDIByEnvironment', () => {
    let originalUseInMemoryDB: string | undefined;

    beforeEach(() => {
        originalUseInMemoryDB = process.env.USE_IN_MEMORY_DB;
        container.clearInstances();
    });

    afterEach(() => {
        // 環境変数を復元
        if (originalUseInMemoryDB === undefined) {
            Reflect.deleteProperty(process.env, 'USE_IN_MEMORY_DB');
        } else {
            process.env.USE_IN_MEMORY_DB = originalUseInMemoryDB;
        }
        // コンテナをモジュール読み込み時の既定（D1）状態へ戻し、後続テストへの汚染を防ぐ
        Reflect.deleteProperty(process.env, 'USE_IN_MEMORY_DB');
        container.clearInstances();
        initializeDIByEnvironment();
    });

    it('[T-01] USE_IN_MEMORY_DB=trueの場合_インメモリDB分岐で初期化すること', () => {
        // Arrange
        process.env.USE_IN_MEMORY_DB = 'true';

        // Act
        initializeDIByEnvironment();

        // Assert
        const gateway = container.resolve(DI_TOKENS.DrizzleGateway);
        expect(gateway).toBeInstanceOf(DrizzleGateway);
    });

    it('[T-02] USE_IN_MEMORY_DB未設定の場合_D1（本番）分岐で初期化すること', () => {
        // Arrange
        Reflect.deleteProperty(process.env, 'USE_IN_MEMORY_DB');

        // Act
        initializeDIByEnvironment();

        // Assert
        const gateway = container.resolve(DI_TOKENS.DrizzleGateway);
        expect(gateway).toBeInstanceOf(DrizzleGateway);
    });
});
