import type { z } from 'zod';

import { makeRaceTypeScopedStringSchema } from '../../../utilities/makeRaceTypeScopedStringSchema';
import { buildRaceTypeIndexedCache } from '../../../utilities/raceTypeIndexedCache';
import { StageAliasList } from '../../master/gradeStageMaster';
import type { RaceType } from './raceType';
import { isIncludedRaceType } from './raceType';

/**
 * ステージ リスト
 * @param raceType - レース種別
 * @param list - 使用するデータソース（省略時は TS 定数を使用）
 */
const RaceStageList: (
    raceType: RaceType,
    list?: typeof StageAliasList,
) => Set<string> = (raceType, list = StageAliasList) =>
    new Set(
        list
            .filter((item) => isIncludedRaceType(item.raceType, [raceType]))
            .map((item) => item.stage),
    );

/**
 * RaceStageのzod型定義
 * @param raceType - レース種別
 */
export const RaceStageSchema = makeRaceTypeScopedStringSchema(
    RaceStageList,
    (raceType) => `${raceType}の開催ステージではありません`,
);

/**
 * HTML表記・oddspark表記の両方をカバーするステージ名マップ
 *
 * extractAutoraceRaceStage/extractKeirinRaceStage 等からレース1件ごとに呼ばれるため、
 * raceType 単位で結果をメモ化し、マスタ（最大100件規模）の再走査を避ける（PERF-096）。
 * @param raceType - レース種別
 * @param list - 使用するデータソース（省略時は TS 定数を使用）
 */
export const StageMap: (
    raceType: RaceType,
    list?: typeof StageAliasList,
) => Record<string, RaceStage> = buildRaceTypeIndexedCache(
    (raceType, list = StageAliasList) =>
        Object.fromEntries(
            list.flatMap((item) => {
                if (!isIncludedRaceType(item.raceType, [raceType])) {
                    return [];
                }

                return item.stageByWebSite.map((stageByOddspark) => [
                    stageByOddspark,
                    item.stage,
                ]);
            }),
        ),
);

/**
 * RaceStageの型定義
 */
export type RaceStage = z.infer<ReturnType<typeof RaceStageSchema>>;
