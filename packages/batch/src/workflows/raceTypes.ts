/**
 * Workflows 版 batch-all（CICD-73）が対象とする全レース種別。
 * `.github/workflows/batch-all.yml` の schedule 実行時デフォルト
 * （`raceTypes="jra nar keirin autorace boatrace overseas"`）と同一。
 */

import { RaceType } from '@race-schedule/core';

export const ALL_RACE_TYPES_FOR_BATCH: RaceType[] = [
    RaceType.JRA,
    RaceType.NAR,
    RaceType.KEIRIN,
    RaceType.AUTORACE,
    RaceType.BOATRACE,
    RaceType.OVERSEAS,
];
