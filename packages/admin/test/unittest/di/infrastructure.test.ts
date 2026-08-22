/**
 * DI Infrastructure層テスト
 *
 * `packages/admin/src/di/infrastructure.ts` の `registerInfrastructure` が
 * MainApiGateway/MainApiRepositoryを正しく登録すること（具象クラスとして
 * 解決できること、singleton lifecycleが効いていること）を検証する。
 *
 * ## デシジョンテーブル
 *
 * | # | 検証対象 | 期待 |
 * |---|---------|------|
 * | T-01 | MainApiGateway | MainApiGatewayの具象インスタンスとして解決される |
 * | T-02 | MainApiRepository | MainApiRepositoryの具象インスタンスとして解決される |
 * | T-03 | MainApiGateway | 複数回resolveしても同一インスタンス（singleton） |
 * | T-04 | MainApiRepository | 複数回resolveしても同一インスタンス（singleton） |
 */
import 'reflect-metadata';

import { beforeEach, describe, expect, it } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerInfrastructure } from '../../../src/di/infrastructure';
import { MainApiGateway } from '../../../src/gateway/implement/mainApiGateway';
import type { IMainApiGateway } from '../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../src/repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../../../src/repository/interface/IMainApiRepository';

describe('DI Infrastructure層', () => {
    beforeEach(() => {
        container.clearInstances();
        registerInfrastructure();
    });

    it('T-01: MainApiGatewayが具象クラスとして登録されること', () => {
        const gateway = container.resolve<IMainApiGateway>(
            DI_TOKENS.MainApiGateway,
        );
        expect(gateway).toBeInstanceOf(MainApiGateway);
    });

    it('T-02: MainApiRepositoryが具象クラスとして登録されること', () => {
        const repository = container.resolve<IMainApiRepository>(
            DI_TOKENS.MainApiRepository,
        );
        expect(repository).toBeInstanceOf(MainApiRepository);
    });

    it('T-03: MainApiGatewayはsingletonとして登録されること（複数回resolveしても同一インスタンス）', () => {
        const first = container.resolve<IMainApiGateway>(
            DI_TOKENS.MainApiGateway,
        );
        const second = container.resolve<IMainApiGateway>(
            DI_TOKENS.MainApiGateway,
        );
        expect(first).toBe(second);
    });

    it('T-04: MainApiRepositoryはsingletonとして登録されること（複数回resolveしても同一インスタンス）', () => {
        const first = container.resolve<IMainApiRepository>(
            DI_TOKENS.MainApiRepository,
        );
        const second = container.resolve<IMainApiRepository>(
            DI_TOKENS.MainApiRepository,
        );
        expect(first).toBe(second);
    });
});
