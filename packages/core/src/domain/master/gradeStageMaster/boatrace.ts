import { RaceType } from '../../model/valueObject/raceType';
import type { StageAliasEntry, StagePriorityEntry } from './types';

/** BOATRACE のステージ表記ゆれ一覧。 */
export const BOATRACE_STAGE_ALIAS_LIST: readonly StageAliasEntry[] = [
    {
        stage: '優勝戦',
        stageByWebSite: ['優勝戦'],
        raceType: RaceType.BOATRACE,
    },
    {
        stage: '準優勝戦',
        stageByWebSite: ['準優勝戦'],
        raceType: RaceType.BOATRACE,
    },
    {
        stage: '一般戦',
        stageByWebSite: ['一般戦'],
        raceType: RaceType.BOATRACE,
    },
];

/** BOATRACE の (grade, stage) 単位の優先度一覧。 */
export const BOATRACE_STAGE_PRIORITY_LIST: readonly StagePriorityEntry[] = [
    {
        grade: ['SG'],
        stage: '優勝戦',
        raceType: RaceType.BOATRACE,
        priority: 9,
        description: 'SGの最終日に行われる決勝レース。',
    },
    {
        grade: ['SG'],
        stage: '準優勝戦',
        raceType: RaceType.BOATRACE,
        priority: 0,
        description: 'SGの準決勝レース。決勝進出を目指す重要なレース。',
    },
    {
        grade: ['SG'],
        stage: '一般戦',
        raceType: RaceType.BOATRACE,
        priority: 0,
        description: 'SGの一般戦。',
    },
];
