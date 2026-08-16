import { z } from 'zod';

import { RaceType } from './raceType';

/**
 * 枠順の最高値を取得します。
 * @param playerDataList
 * @param raceType - レース種別
 */
export const maxFrameNumber = {
    [RaceType.BOATRACE]: 6,
    [RaceType.AUTORACE]: 8,
    [RaceType.KEIRIN]: 9,
    [RaceType.JRA]: 18,
    [RaceType.NAR]: 16,
    [RaceType.OVERSEAS]: 48,
};

/**
 * PositionNumber zod型定義
 * @param raceType - レース種別
 */
export const PositionNumberSchema: (raceType: RaceType) => z.ZodNumber = (
    raceType,
) => {
    const max = maxFrameNumber[raceType];
    return z
        .number()
        .int()
        .min(1, `枠番は1以上である必要があります`)
        .max(max, `枠番は${max}以下である必要があります`);
};

/**
 * 共通のPositionNumber型定義
 */
export type PositionNumber = z.infer<ReturnType<typeof PositionNumberSchema>>;
