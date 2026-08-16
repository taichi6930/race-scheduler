import {
    appLogger,
    DI_TOKENS,
    LogAllMethods,
    type RaceDetailUiConfig,
    raceDetailUiConfigSchema,
} from '@race-schedule/core';
import { eq, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { uiLayout } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { IUiLayoutRepository } from '../interface/IUiLayoutRepository';

/**
 * レイアウト構成（ui_layout テーブル）リポジトリのDB実装。
 */
@LogAllMethods
@injectable()
export class UiLayoutRepository implements IUiLayoutRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async get(
        layoutKey: string,
    ): Promise<RaceDetailUiConfig | undefined> {
        const rows = await this.drizzleGateway.db
            .select({ config: uiLayout.config })
            .from(uiLayout)
            .where(eq(uiLayout.layoutKey, layoutKey))
            .limit(1);

        const row = rows[0];
        if (row === undefined) {
            return;
        }

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(row.config);
        } catch {
            appLogger.warn(
                `[UiLayoutRepository] Skipping invalid JSON for layoutKey="${layoutKey}"`,
            );
            return;
        }

        const validationResult = raceDetailUiConfigSchema.safeParse(parsedJson);
        if (!validationResult.success) {
            appLogger.warn(
                `[UiLayoutRepository] Skipping invalid ui_layout row for layoutKey="${layoutKey}": ${validationResult.error.message}`,
            );
            return;
        }
        return validationResult.data;
    }

    public async upsert(
        layoutKey: string,
        config: RaceDetailUiConfig,
    ): Promise<void> {
        const configJson = JSON.stringify(config);
        await this.drizzleGateway.db
            .insert(uiLayout)
            .values({ layoutKey, config: configJson })
            .onConflictDoUpdate({
                target: uiLayout.layoutKey,
                set: {
                    config: configJson,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }
}
