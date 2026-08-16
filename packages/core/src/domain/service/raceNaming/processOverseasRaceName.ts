import { replaceFromCodePoint } from '../../../utilities/format';
import {
    applyReplaceRules,
    type ReplaceRule,
    STAKES_CUP_ABBREVIATIONS,
} from '../../../utilities/replaceRules';
import type { RaceName } from '../../model/valueObject/raceName';

interface OverseasRaceDataForRaceName {
    name: RaceName;
}

const OVERSEAS_RACE_RULES: ReplaceRule[] = [
    ...STAKES_CUP_ABBREVIATIONS.map(
        ({ needle, replacement }): ReplaceRule => ({
            pattern: new RegExp(needle),
            replacement,
        }),
    ),
    { pattern: /サラ系/, replacement: '' },
    { pattern: /（L）/, replacement: '' },
    { pattern: /\(L\)/, replacement: '' },
    { pattern: /\(\)/, replacement: '' },
    { pattern: /ブリーダーズC/, replacement: 'BC' },
    { pattern: /ハンデキャップ/, replacement: 'H' },
];

/**
 * レース情報から、海外レースのレース名を整形する
 * @param raceInfo - レース情報
 * @returns 整形されたレース名
 */
export const processOverseasRaceName = (
    raceInfo: OverseasRaceDataForRaceName,
): string => {
    const normalizedName = replaceFromCodePoint(
        raceInfo.name,
        /[！-＃＄％＆（）＊＋，－．／０-９：；＜＝＞？＠Ａ-Ｚ［＼］＾＿｀ａ-ｚ｛｜｝～]/g,
    );

    // 各ルールは最初の1マッチのみ置換する
    return applyReplaceRules(normalizedName, OVERSEAS_RACE_RULES, {
        firstMatchOnly: true,
    });
};
