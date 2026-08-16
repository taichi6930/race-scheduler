import { z } from 'zod';

import {
    DATE_STRING_LENGTH,
    ID_SEGMENT_PAD_WIDTH,
} from '../../../constants/idFormat';
import { RaceType } from './raceType';

/**
 * raceIdのzod型定義
 */
export const RaceIdSchema = z
    .string()
    .regex(
        new RegExp(
            String.raw`^(${Object.values(RaceType).join('|')})\d{8}[0-9]{4}$`,
        ),
        `raceIdは「RaceType(${Object.values(RaceType).join(', ')})+yyyymmdd(8桁数字)+location_code(数字2桁)+レース番号(数字2桁)」形式で指定してください 例: jra202501050101`,
    )
    .brand<'RaceId'>();

/**
 * raceIdの型定義（brand付き公称型）
 */
export type RaceId = z.infer<typeof RaceIdSchema>;

/**
 * raceIdのバリデーション関数
 * @param value - raceId
 * @returns - バリデーション済みのraceId
 */
export const validateRaceId = (value: string): RaceId =>
    RaceIdSchema.parse(value);

/**
 * raceId の先頭に含まれる raceType を取り出す。
 * raceId は「RaceType + yyyymmdd(8桁) + location_code(2桁) + race_number(2桁)」形式
 * （{@link RaceIdSchema}）のため、末尾12桁を除いた接頭辞が raceType と一致する。
 * @param raceId - バリデーション済みの raceId
 * @returns raceId に対応する raceType
 * @throws raceId が既知の RaceType で始まらない場合はエラー
 */
export const extractRaceTypeFromRaceId = (raceId: string): RaceType => {
    // yyyymmdd(8) + location_code(2) + race_number(2)
    const RACE_ID_SUFFIX_LENGTH = DATE_STRING_LENGTH + ID_SEGMENT_PAD_WIDTH * 2;
    const prefix = raceId.slice(0, raceId.length - RACE_ID_SUFFIX_LENGTH);
    const raceType = Object.values(RaceType).find((rt) => rt === prefix);
    if (!raceType) {
        throw new Error(`raceIdからraceTypeを特定できません: ${raceId}`);
    }
    return raceType;
};
