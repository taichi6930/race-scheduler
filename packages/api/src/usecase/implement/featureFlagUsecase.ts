import {
    DI_TOKENS,
    EnvStore,
    isEnvFlagTrue,
    LogAllMethods,
    ValidationError,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IFeatureFlagRepository } from '../../repository/interface/IFeatureFlagRepository';
import { FEATURE_FLAG_DEFINITIONS } from '../featureFlagDefinitions';
import type {
    FeatureFlagStatus,
    IFeatureFlagUsecase,
} from '../interface/IFeatureFlagUsecase';

/**
 * 機能フラグ Usecase（feature-flag-design.md 参照）。
 *
 * 解決順序: D1（feature_flag テーブル）に行があればその値が最優先。無ければ
 * `wrangler.toml` の環境変数（`FEATURE_FLAG_DEFINITIONS` の `envVarKey`）を
 * 既定値として使う。これにより、D1へ何も書き込んでいない新環境でも
 * 環境変数の値どおりに動作し、手動INSERTが必須にならない。
 */
@LogAllMethods
@injectable()
export class FeatureFlagUsecase implements IFeatureFlagUsecase {
    public constructor(
        @inject(DI_TOKENS.FeatureFlagRepository)
        private readonly repository: IFeatureFlagRepository,
    ) {}

    public async resolve(key: string): Promise<boolean> {
        const stored = await this.repository.get(key);
        return stored ?? this.resolveEnvDefault(key);
    }

    public async list(): Promise<FeatureFlagStatus[]> {
        const rows = await this.repository.list();
        const rowByKey = new Map(rows.map((row) => [row.flagKey, row]));

        return FEATURE_FLAG_DEFINITIONS.map((definition) => {
            const row = rowByKey.get(definition.key);
            const envDefault = this.resolveEnvDefault(definition.key);
            return {
                key: definition.key,
                label: definition.label,
                storedEnabled: row?.enabled,
                envDefault,
                effectiveEnabled: row?.enabled ?? envDefault,
                updatedAt: row?.updatedAt,
            };
        });
    }

    public async setFlag(key: string, enabled: boolean): Promise<void> {
        const definition = FEATURE_FLAG_DEFINITIONS.find((d) => d.key === key);
        if (definition === undefined) {
            throw new ValidationError(`未知の機能フラグキーです: ${key}`);
        }
        await this.repository.upsert(key, enabled);
    }

    /**
     * D1に行が無いキーの既定値を、対応する環境変数から解決する。
     * @param key - `FEATURE_FLAG_DEFINITIONS` のキー
     */
    private resolveEnvDefault(key: string): boolean {
        const definition = FEATURE_FLAG_DEFINITIONS.find((d) => d.key === key);
        if (definition === undefined) {
            return false;
        }
        return isEnvFlagTrue(definition.envVarKey, EnvStore.env);
    }
}
