import type { DatabaseTableCounts } from '../../repository/interface/IDebugRepository';

/**
 * Debug UseCase Interface
 */
export interface IDebugUsecase {
    countRaceAndRaceCondition: () => Promise<DatabaseTableCounts>;
}
