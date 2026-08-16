import { RaceType } from '../../model/valueObject/raceType';
import type { StageAliasEntry, StagePriorityEntry } from './types';

/** AUTORACE のステージ表記ゆれ一覧。 */
export const AUTORACE_STAGE_ALIAS_LIST: readonly StageAliasEntry[] = [
    {
        stage: '優勝戦',
        stageByWebSite: ['優勝戦'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: 'SS王座決定戦',
        stageByWebSite: ['ＳＳ王座決定戦'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '準々決勝戦',
        stageByWebSite: ['準々決勝戦', '準々決勝戦Ａ', '準々決勝戦Ｂ'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '一般戦',
        stageByWebSite: [
            'キノコオープン枠番抽選',
            'ＭＡＸ鈴木ＯＰ枠番抽選',
            'ＧＰオープン　枠番抽選',
            'ＧＰ　飯塚バトル',
            '一般戦',
            'ナイトレース開幕戦',
            '一般オープン',
            'オッズパーク杯開幕戦',
            '浜松記念オープン',
            '浜松ＶＳ飯塚',
            '東スポ選抜',
            '東スポ特別',
        ],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '特別選抜戦',
        stageByWebSite: ['特別選抜戦'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '選抜戦',
        stageByWebSite: ['選抜戦'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '特別一般戦',
        stageByWebSite: ['特別一般戦', '特別一般戦Ａ', '特別一般戦Ｂ'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: 'グレードレース７',
        stageByWebSite: ['Ｇレース７一般戦', 'Ｇレース７', 'グレードレース７'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: 'オーバル特別',
        stageByWebSite: ['オーバル特別'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '予選',
        stageByWebSite: [
            '予選',
            'ムーンライトＣＣ開幕戦',
            'オートレースＧＰ開幕戦',
        ],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '選抜予選',
        stageByWebSite: ['選抜予選'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '準決勝戦',
        stageByWebSite: ['準決勝戦', '準決勝戦Ａ', '準決勝戦Ｂ'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: '最終予選',
        stageByWebSite: ['最終予選'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: 'SSトライアル戦',
        stageByWebSite: ['ＳＳトライアル戦'],
        raceType: RaceType.AUTORACE,
    },
    {
        stage: 'SS順位決定戦',
        stageByWebSite: ['ＳＳ順位決定戦'],
        raceType: RaceType.AUTORACE,
    },
];

/** AUTORACE の (grade, stage) 単位の優先度一覧。 */
export const AUTORACE_STAGE_PRIORITY_LIST: readonly StagePriorityEntry[] = [
    {
        grade: ['SG'],
        stage: '優勝戦',
        raceType: RaceType.AUTORACE,
        priority: 9,
        description: 'SGの最終日に行われる決勝レース。',
    },
    {
        grade: ['SG'],
        stage: 'SS王座決定戦',
        raceType: RaceType.AUTORACE,
        priority: 9,
        description:
            'SGのスーパースター王座決定戦。上位16人のトライアル戦上位8人による決勝戦。',
    },
    {
        grade: ['特GⅠ', 'GⅠ'],
        stage: '優勝戦',
        raceType: RaceType.AUTORACE,
        priority: 7,
        description: '特GⅠ・GⅠの最終日に行われる決勝レース。',
    },
    {
        grade: ['特GⅠ', 'GⅠ'],
        stage: '準々決勝戦',
        raceType: RaceType.AUTORACE,
        priority: 5,
        description:
            '特GⅠ・GⅠの準々決勝レース。準決勝進出を目指す重要なレース。',
    },
    {
        grade: ['GⅠ'],
        stage: '一般戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'GⅠの一般戦。',
    },
    {
        grade: ['SG'],
        stage: '特別選抜戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの特別選抜レース。決勝進出を目指す重要なレース。',
    },
    {
        grade: ['SG'],
        stage: '選抜戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの選抜レース。',
    },
    {
        grade: ['SG'],
        stage: '特別一般戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの特別一般戦。',
    },
    {
        grade: ['SG'],
        stage: '一般戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの一般戦。',
    },
    {
        grade: ['SG'],
        stage: 'グレードレース７',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGのグレードレースの7R。大きなレースではない。',
    },
    {
        grade: ['SG'],
        stage: 'オーバル特別',
        raceType: RaceType.AUTORACE,
        priority: 9,
        description: 'SGのオーバル特別レース。',
    },
    {
        grade: ['SG'],
        stage: '予選',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの予選レース。',
    },
    {
        grade: ['SG'],
        stage: '選抜予選',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの選抜予選レース。',
    },
    {
        grade: ['SG'],
        stage: '準決勝戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの準決勝戦。',
    },
    {
        grade: ['SG'],
        stage: '最終予選',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'SGの最終予選。',
    },
    {
        grade: ['SG'],
        stage: 'SSトライアル戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description: 'スーパースター王座決定戦の予選。上位16人のトライアル戦。',
    },
    {
        grade: ['SG'],
        stage: 'SS順位決定戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description:
            'SGのスーパースター王座決定戦における敗者戦（上位16人トライアル戦下位8人）。',
    },
    {
        grade: ['開催'],
        stage: '一般戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description:
            '無格付（開催）の一般戦。「〜開幕戦」「〜オープン」等、決勝・準決勝を伴わない通常開催のレースの表記ゆれ（Issue #2228）。',
    },
    {
        grade: ['GⅡ'],
        stage: '一般戦',
        raceType: RaceType.AUTORACE,
        priority: 0,
        description:
            'GⅡ開催（浜松記念）の一般戦。開催名を冠したオープン戦・対抗戦形式のレースの表記ゆれ（Issue #2228）。',
    },
];
