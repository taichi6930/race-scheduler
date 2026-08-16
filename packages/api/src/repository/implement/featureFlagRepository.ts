import { appLogger, DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { eq, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

import { featureFlag } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type {
    FeatureFlagRow,
    IFeatureFlagRepository,
} from '../interface/IFeatureFlagRepository';

/** Drizzle が返す feature_flag 行（camelCase）の型検証スキーマ。 */
const featureFlagRowSchema = z.object({
    flagKey: z.string(),
    enabled: z.union([z.number(), z.boolean()]),
    updatedAt: z.string(),
});

/**
 * 機能フラグ（feature_flag テーブル）リポジトリのDB実装。
 */
@LogAllMethods
@injectable()
export class FeatureFlagRepository implements IFeatureFlagRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    /**
     * DB行をFeatureFlagRowへ変換する。バリデーションエラー時はwarnログを出しnullを返す
     * （他リポジトリの list() と同様、1行の変換失敗で全体を失敗させない）。
     * @param row - DB から返された生の feature_flag 行
     */
    private parseFeatureFlagRow(
        row: Record<string, unknown>,
    ): FeatureFlagRow | null {
        const validationResult = featureFlagRowSchema.safeParse(row);
        if (!validationResult.success) {
            appLogger.warn(
                `[FeatureFlagRepository] Skipping invalid feature_flag row: ${validationResult.error.message}`,
            );
            return null;
        }
        const { flagKey, enabled, updatedAt } = validationResult.data;
        return { flagKey, enabled: Number(enabled) === 1, updatedAt };
    }

    public async list(): Promise<FeatureFlagRow[]> {
        const rows = await this.drizzleGateway.db
            .select({
                flagKey: featureFlag.flagKey,
                enabled: featureFlag.enabled,
                updatedAt: featureFlag.updatedAt,
            })
            .from(featureFlag);

        return rows
            .map((row) => this.parseFeatureFlagRow(row))
            .filter((row): row is FeatureFlagRow => row !== null);
    }

    public async get(flagKey: string): Promise<boolean | undefined> {
        const rows = await this.drizzleGateway.db
            .select({
                flagKey: featureFlag.flagKey,
                enabled: featureFlag.enabled,
                updatedAt: featureFlag.updatedAt,
            })
            .from(featureFlag)
            .where(eq(featureFlag.flagKey, flagKey))
            .limit(1);

        const row = rows[0];
        if (row === undefined) {
            return;
        }
        return this.parseFeatureFlagRow(row)?.enabled;
    }

    public async upsert(flagKey: string, enabled: boolean): Promise<void> {
        const enabledValue = enabled ? 1 : 0;
        await this.drizzleGateway.db
            .insert(featureFlag)
            .values({ flagKey, enabled: enabledValue })
            .onConflictDoUpdate({
                target: featureFlag.flagKey,
                set: {
                    enabled: enabledValue,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }
}
