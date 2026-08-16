import type { StageAliasList } from '../../master/gradeStageMaster';
import type { RaceStage } from '../../model/valueObject/raceStage';
import { StageMap } from '../../model/valueObject/raceStage';
import { RaceType } from '../../model/valueObject/raceType';

/**
 * AUTORACEのレースステージを抽出
 * @param raceSummaryInfoChild - 判定対象のテキスト
 * @param list - ステージ表記ゆれ判定表（省略時はデフォルトのマスタを使用）
 * @returns 判定されたステージ、見つからない場合は null
 */
export const extractAutoraceRaceStage = (
    raceSummaryInfoChild: string,
    list?: typeof StageAliasList,
): RaceStage | null => {
    const stageEntries = Object.entries(StageMap(RaceType.AUTORACE, list));
    for (const [pattern, stage] of stageEntries) {
        if (new RegExp(pattern).test(raceSummaryInfoChild)) {
            return stage;
        }
    }
    return null;
};
