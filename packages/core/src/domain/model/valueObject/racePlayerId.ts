import { z } from 'zod';

import { RaceType } from './raceType';

/**
 * racePlayerIdのzod型定義
 *
 * raceId（RaceType + yyyymmdd(8桁) + location_code(2桁) + race_number(2桁)）の末尾に
 * 車番(2桁)を付加した形式。枠番ではなく車番を使うのは、枠番は複数車が同一枠を
 * 共有しうる（rowspan）ため一意性が保証されないため（車番はレース内で必ず一意）。
 */
export const RacePlayerIdSchema = z
    .string()
    .regex(
        new RegExp(
            String.raw`^(${Object.values(RaceType).join('|')})\d{8}[0-9]{4}[0-9]{2}$`,
        ),
        `racePlayerIdは「RaceType(${Object.values(RaceType).join(', ')})+yyyymmdd(8桁数字)+location_code(数字2桁)+レース番号(数字2桁)+車番(数字2桁)」形式で指定してください 例: keirin20260802360107`,
    )
    .brand<'RacePlayerId'>();

/**
 * racePlayerIdの型定義（brand付き公称型）
 */
export type RacePlayerId = z.infer<typeof RacePlayerIdSchema>;

/**
 * racePlayerIdのバリデーション関数
 * @param value - racePlayerId
 * @returns - バリデーション済みのracePlayerId
 */
export const validateRacePlayerId = (value: string): RacePlayerId =>
    RacePlayerIdSchema.parse(value);
