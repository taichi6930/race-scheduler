import { extractGradeByPatterns } from './extractGradeByPatterns';

/**
 * AUTORACE のグレード判定表（判定順序を厳守）。
 */
const AUTORACE_GRADE_PATTERNS: readonly (readonly [RegExp, string])[] = [
    [/SG|ＳＧ/, 'SG'],
    [/GⅠ|G1|ＧⅠ/, 'GⅠ'],
    [/GⅡ|G2|ＧⅡ/, 'GⅡ'],
];

/**
 * AUTORACEのグレードをテキストから抽出する。見つからなければ '開催' を返す。
 * @param text - 判定対象の文字列
 * @returns 判定されたグレード、見つからない場合は '開催'
 */
export const extractAutoraceGradeFromText = (text: string): string =>
    extractGradeByPatterns(text, AUTORACE_GRADE_PATTERNS, '開催');
