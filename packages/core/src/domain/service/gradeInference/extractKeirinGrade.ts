import type { RaceStage } from '../../model/valueObject/raceStage';
import { extractGradeByPatterns } from './extractGradeByPatterns';

/**
 * KEIRIN のグレード判定表（判定順序を厳守）。
 *
 * KEIRIN で実際に存在するグレードは GP・GⅠ・GⅡ・GⅢ・FⅠ・FⅡ のみ（gradeMaster.ts参照）。
 * SG・PGⅠ は BOATRACE/AUTORACE 側のグレードであり、KEIRIN には存在しないため含めない。
 */
const KEIRIN_GRADE_PATTERNS: readonly (readonly [RegExp, string])[] = [
    [/GP|ＧＰ/, 'GP'],
    [/FⅠ|F1|ＦⅠ|ＦI/, 'FⅠ'],
    [/FⅡ|F2|ＦⅡ|ＦII/, 'FⅡ'],
    [/GⅠ|G1|ＧⅠ/, 'GⅠ'],
    [/GⅡ|G2|ＧⅡ/, 'GⅡ'],
    [/GⅢ|G3|ＧⅢ/, 'GⅢ'],
];

/**
 * KEIRINのグレードをテキストから抽出する。見つからなければ undefined を返す。
 * @param text - 判定対象の文字列
 * @returns 判定されたグレード、見つからない場合は undefined
 */
export const extractKeirinGradeFromText = (text: string): string | undefined =>
    extractGradeByPatterns(text, KEIRIN_GRADE_PATTERNS, undefined);

/**
 * KEIRINのレースグレードを、レース名・ステージ・開催日による特殊ケースを
 * 加味して確定する。
 * @param raceName - 決定済みのレース名
 * @param baseGrade - h2要素等から抽出したベースのグレード
 * @param raceStage - レースステージ
 * @param raceDate - 開催日
 * @returns 確定したレースグレード
 */
export const extractKeirinRaceGrade = (
    raceName: string,
    baseGrade: string,
    raceStage: RaceStage,
    raceDate: Date,
): string => {
    // ヤンググランプリはGⅡ
    if (raceStage === 'SA混合ヤンググランプリ') {
        return 'GⅡ';
    }
    // 女子オールスター競輪は2025年以降GⅠ
    if (raceName.includes('女子オールスター競輪')) {
        return raceDate.getFullYear() >= 2025 ? 'GⅠ' : 'FⅡ';
    }
    // ガールズケイリンフェスティバルはFⅡ
    if (raceName.includes('ガールズケイリンフェスティバル')) {
        return 'FⅡ';
    }
    // 寺内大吉記念杯競輪はFⅠ
    if (raceName.includes('寺内大吉記念杯競輪')) {
        return 'FⅠ';
    }
    return baseGrade;
};
