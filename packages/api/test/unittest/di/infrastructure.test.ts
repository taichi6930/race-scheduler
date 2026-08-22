/**
 * DI Infrastructure層テスト
 *
 * インフラストラクチャ層のDI設定が正しく登録されることを検証します。
 *
 * テスト対象：
 * - DrizzleGateway, WebPushGateway, ScrapingApiGateway の登録
 * - 本番環境用（registerInfrastructure）とインメモリ用（registerInfrastructureForInMemory）の両方
 * - Singleton lifecycle の確認（複数回 resolve で同一インスタンスを返すこと）
 *
 * @remarks
 * P2-1（test-quality-audit.md）: `registerInfrastructureForInMemory`のnamed testが
 * `toBeDefined()`+`typeof==='object'`のDI「劇場」テストだったため`toBeInstanceOf(DrizzleGateway)`
 * へ強化。また、旧デシジョンテーブル（DT-1/DT-2）がnamed testと完全に同一の検証内容だったため、
 * 表はnamed testへの参照のみとし重複するテスト本体は削除した。
 *
 * API-8: WebPushGateway, ScrapingApiGateway の登録と singleton 確認テストを追加。
 * 各ゲートウェイについて `toBeInstanceOf()` による型検証と、複数回 resolve による
 * singleton 検証を行う。
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DI_TOKENS, EnvStore } from '@race-schedule/core';
import { container } from 'tsyringe';

import {
    registerInfrastructure,
    registerInfrastructureForInMemory,
} from '../../../src/di/infrastructure';
import { DrizzleGateway } from '../../../src/gateway/implement/drizzleGateway';
import { ScrapingApiGateway } from '../../../src/gateway/implement/scrapingApiGateway';
import { WebPushGateway } from '../../../src/gateway/implement/webPushGateway';
import type { IDrizzleGateway } from '../../../src/gateway/interface/IDrizzleGateway';
import type { IScrapingApiGateway } from '../../../src/gateway/interface/IScrapingApiGateway';
import type { IWebPushGateway } from '../../../src/gateway/interface/IWebPushGateway';

describe('DI Infrastructure層', () => {
    beforeEach(() => {
        container.clearInstances();
    });

    describe('registerInfrastructureForInMemory', () => {
        it('インメモリDB用のDrizzleGatewayが登録されること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';

            registerInfrastructureForInMemory();

            const drizzleGateway = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );
            expect(drizzleGateway).toBeInstanceOf(DrizzleGateway);
        });

        it('インメモリDB用のWebPushGatewayが登録されること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';

            registerInfrastructureForInMemory();

            const webPushGateway = container.resolve<IWebPushGateway>(
                DI_TOKENS.WebPushGateway,
            );
            expect(webPushGateway).toBeInstanceOf(WebPushGateway);
        });

        it('インメモリDB用のScrapingApiGatewayが登録されること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';

            registerInfrastructureForInMemory();

            const scrapingApiGateway = container.resolve<IScrapingApiGateway>(
                DI_TOKENS.ScrapingApiGateway,
            );
            expect(scrapingApiGateway).toBeInstanceOf(ScrapingApiGateway);
        });

        it('複数回呼び出しても安全であること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';
            registerInfrastructureForInMemory();
            registerInfrastructureForInMemory();

            const drizzleGateway = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );
            expect(drizzleGateway).toBeInstanceOf(DrizzleGateway);
        });

        it('DrizzleGatewayはsingletonとして登録されること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';
            registerInfrastructureForInMemory();

            const first = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );
            const second = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );
            expect(first).toBe(second);
        });

        it('WebPushGatewayはsingletonとして登録されること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';
            registerInfrastructureForInMemory();

            const first = container.resolve<IWebPushGateway>(
                DI_TOKENS.WebPushGateway,
            );
            const second = container.resolve<IWebPushGateway>(
                DI_TOKENS.WebPushGateway,
            );
            expect(first).toBe(second);
        });

        it('ScrapingApiGatewayはsingletonとして登録されること', () => {
            process.env.USE_IN_MEMORY_DB = 'true';
            registerInfrastructureForInMemory();

            const first = container.resolve<IScrapingApiGateway>(
                DI_TOKENS.ScrapingApiGateway,
            );
            const second = container.resolve<IScrapingApiGateway>(
                DI_TOKENS.ScrapingApiGateway,
            );
            expect(first).toBe(second);
        });
    });

    describe('registerInfrastructure', () => {
        afterEach(() => {
            EnvStore.reset();
        });

        it('本番用のDrizzleGatewayが具象クラスとして登録されること', () => {
            registerInfrastructure();

            const drizzleGateway = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );
            expect(drizzleGateway).toBeInstanceOf(DrizzleGateway);
        });

        it('本番用のWebPushGatewayが具象クラスとして登録されること', () => {
            registerInfrastructure();

            const webPushGateway = container.resolve<IWebPushGateway>(
                DI_TOKENS.WebPushGateway,
            );
            expect(webPushGateway).toBeInstanceOf(WebPushGateway);
        });

        it('本番用のScrapingApiGatewayが具象クラスとして登録されること', () => {
            registerInfrastructure();

            const scrapingApiGateway = container.resolve<IScrapingApiGateway>(
                DI_TOKENS.ScrapingApiGateway,
            );
            expect(scrapingApiGateway).toBeInstanceOf(ScrapingApiGateway);
        });

        it('DrizzleGatewayはsingletonとして登録されること', () => {
            registerInfrastructure();

            const first = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );
            const second = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );
            expect(first).toBe(second);
        });

        it('WebPushGatewayはsingletonとして登録されること', () => {
            registerInfrastructure();

            const first = container.resolve<IWebPushGateway>(
                DI_TOKENS.WebPushGateway,
            );
            const second = container.resolve<IWebPushGateway>(
                DI_TOKENS.WebPushGateway,
            );
            expect(first).toBe(second);
        });

        it('ScrapingApiGatewayはsingletonとして登録されること', () => {
            registerInfrastructure();

            const first = container.resolve<IScrapingApiGateway>(
                DI_TOKENS.ScrapingApiGateway,
            );
            const second = container.resolve<IScrapingApiGateway>(
                DI_TOKENS.ScrapingApiGateway,
            );
            expect(first).toBe(second);
        });

        it('EnvStore未設定のままdbを参照するとEnvStore未設定エラーで確定的に失敗すること', () => {
            // Arrange: EnvStore.setEnv() が行われていない状態を明示的に作る
            EnvStore.reset();
            registerInfrastructure();
            const drizzleGateway = container.resolve<IDrizzleGateway>(
                DI_TOKENS.DrizzleGateway,
            );

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
