import type { StageAliasList } from '../../master/gradeStageMaster';
import type { RaceStage } from '../../model/valueObject/raceStage';
import { StageMap } from '../../model/valueObject/raceStage';
import { RaceType } from '../../model/valueObject/raceType';

/**
 * KEIRINのレースステージを抽出
 *
 * 要素全体のテキストをホワイトスペースで分割し、各トークンを StageMap と完全一致で照合する。
 * 正規表現による部分一致は避ける（未知ステージが既存パターンに誤マッチする偽陽性を防ぐため）。
 * @param text - 判定対象のテキスト
 * @param list - ステージ表記ゆれ判定表（省略時はデフォルトのマスタを使用）
 * @returns 判定されたステージ、見つからない場合は null
 */
export const extractKeirinRaceStage = (
    text: string,
    list?: typeof StageAliasList,
): RaceStage | null => {
    const stageMap = StageMap(RaceType.KEIRIN, list);
    for (const token of text.split(/\s+/)) {
        const stage = stageMap[token];
        if (stage !== undefined) return stage;
    }
    return null;
};
