/**
 * DI Infrastructure層テスト
 *
 * インフラストラクチャ層のDI設定が正しく登録されることを検証します。
 *
 * テスト対象：
 * - DrizzleGateway の登録（本番用とインメモリ用）
 *
 * @remarks
 * P2-1（test-quality-audit.md）: `registerInfrastructureForInMemory`のnamed testが
 * `toBeDefined()`+`typeof==='object'`のDI「劇場」テストだったため`toBeInstanceOf(DrizzleGateway)`
 * へ強化。また、旧デシジョンテーブル（DT-1/DT-2）がnamed testと完全に同一の検証内容だったため、
 * 表はnamed testへの参照のみとし重複するテスト本体は削除した。
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { EnvStore } from '@race-schedule/core';
import { container } from 'tsyringe';

import {
    registerInfrastructure,
    registerInfrastructureForInMemory,
} from '../../../src/di/infrastructure';
import { DrizzleGateway } from '../../../src/gateway/implement/drizzleGateway';
import type { IDrizzleGateway } from '../../../src/gateway/interface/IDrizzleGateway';

describe('DI Infrastructure層', () => {
    beforeEach(() => {
        container.clearInstances();
    });

    describe('registerInfrastructureForInMemory', () => {
        it('インメモリDB用のDrizzleGatewayが登録されること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';

            registerInfrastructureForInMemory();

            const drizzleGateway =
                container.resolve<IDrizzleGateway>('DrizzleGateway');
            expect(drizzleGateway).toBeInstanceOf(DrizzleGateway);
        });

        it('複数回呼び出しても安全であること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';
            registerInfrastructureForInMemory();
            registerInfrastructureForInMemory();

            const drizzleGateway =
                container.resolve<IDrizzleGateway>('DrizzleGateway');
            expect(drizzleGateway).toBeInstanceOf(DrizzleGateway);
        });
    });

    describe('registerInfrastructure', () => {
        afterEach(() => {
            EnvStore.reset();
        });

        it('本番用のDrizzleGatewayが具象クラスとして登録されること', () => {
            registerInfrastructure();

            const drizzleGateway =
                container.resolve<IDrizzleGateway>('DrizzleGateway');
            expect(drizzleGateway).toBeInstanceOf(DrizzleGateway);
        });

        it('EnvStore未設定のままdbを参照するとEnvStore未設定エラーで確定的に失敗すること', () => {
            // Arrange: EnvStore.setEnv() が行われていない状態を明示的に作る
            EnvStore.reset();
            registerInfrastructure();
            const drizzleGateway =
                container.resolve<IDrizzleGateway>('DrizzleGateway');

            // Act & Assert: 登録自体は成功するが、実際の利用時に確定的なエラーで失敗する
            expect(() => drizzleGateway.db).toThrow('EnvStore.env is not set');
        });
    });

    /**
     * DI Infrastructure層 デシジョンテーブル
     *
     * | # | モード | コンポーネント | 登録後 | 型チェック | 期待値 |
     * |----|--------|---------|--------|--------|--------|
     * | 1 | InMemory | DrizzleGateway | ✓ | ✓ | DrizzleGatewayのインスタンス（`registerInfrastructureForInMemory` のnamed testで検証） |
     * | 2 | InMemory | 複数登録呼び出し | ✓ | ✓ | safe（同上「複数回呼び出しても安全であること」で検証） |
     * | 3 | Prod | DrizzleGateway | ✓ | ✓ | DrizzleGatewayのインスタンス（`registerInfrastructure` 直後のテストで検証） |
     * | 4 | Prod | EnvStore未設定でdb参照 | - | - | `EnvStore.env is not set` で確定的にthrow（同上） |
     *
     * P2-1（test-quality-audit.md）: 以前はこの表に対応する専用テスト（DT-1/DT-2）が
     * 上のnamed testと完全に同一の検証内容で重複していたため削除し、表は参照のみとした。
     */
});
