import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { count } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { race, raceCondition } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type {
    DatabaseTableCounts,
    IDebugRepository,
} from '../interface/IDebugRepository';

@LogAllMethods
@injectable()
export class DebugRepository implements IDebugRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async countRaceAndRaceCondition(): Promise<DatabaseTableCounts> {
        // PERF-044: race/race_conditionの件数取得は互いに依存しないため、
        // 直列awaitではなくPromise.allで並列実行しラウンドトリップ時間を短縮する。
        const [[raceCountResult], [raceConditionCountResult]] =
            await Promise.all([
                this.drizzleGateway.db.select({ count: count() }).from(race),
                this.drizzleGateway.db
                    .select({ count: count() })
                    .from(raceCondition),
            ]);

        return {
            raceCount: raceCountResult?.count ?? 0,
            raceConditionCount: raceConditionCountResult?.count ?? 0,
        };
    }
}
