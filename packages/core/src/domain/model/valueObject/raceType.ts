import { z } from 'zod';

/**
 * レースタイプの列挙型
 */
export const RaceType = {
    JRA: 'jra', // 中央競馬
    NAR: 'nar', // 地方競馬
    KEIRIN: 'keirin', // 競輪
    OVERSEAS: 'overseas', // 海外競馬
    AUTORACE: 'autorace', // オートレース
    BOATRACE: 'boatrace', // ボートレース
} as const;

/**
 * RaceTypeの型定義
 */
export type RaceType = (typeof RaceType)[keyof typeof RaceType];

/** zodスキーマ：RaceType */
export const RaceTypeSchema = z.enum([
    RaceType.JRA,
    RaceType.NAR,
    RaceType.KEIRIN,
    RaceType.OVERSEAS,
    RaceType.AUTORACE,
    RaceType.BOATRACE,
]);

/**
 * RaceTypeのバリデーション
 * @param value
 */
export const validateRaceType = (value: string): RaceType => {
    const normalized = value.toLowerCase();
    try {
        return RaceTypeSchema.parse(normalized);
    } catch {
        throw new Error(`Invalid race_type: ${value}`);
    }
};

/**
 * 指定したレース種別が、レース種別のリストに含まれているかを判定するユーティリティ関数
 * @param raceType - 判定対象のレース種別
 * @param raceTypeList - レース種別のリスト
 * @returns 指定したレース種別が、レース種別のリストに含まれている場合はtrue、そうでない場合はfalse
 */
export const isIncludedRaceType = (
    raceType: RaceType,
    raceTypeList: RaceType[],
): boolean => raceTypeList.includes(raceType); // raceTypeが配列に含まれているか判定するユーティリティ関数
