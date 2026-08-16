import { z } from 'zod';

import { RaceTypeSchema } from '../domain/model/valueObject/raceType';

/**
 * 選手情報を表すエンティティのzod型定義
 *
 * 競馬・競輪などの選手情報を保持します。
 * バリデーションルール：
 * - raceTypeは有効なレース種別である必要があります。
 * - playerNo、playerNameは空でない文字列である必要があります。
 * - priorityは0以上の整数である必要があります。
 */
export const PlayerEntitySchema = z.object({
    /** レース種別（JRA/NAR/KEIRINなど） */
    raceType: RaceTypeSchema,
    /** プレイヤー番号 */
    playerNo: z.string().min(1, 'playerNo must not be empty'),
    /** プレイヤー名 */
    playerName: z.string().min(1, 'playerName must not be empty'),
    /** 優先度 */
    priority: z
        .number()
        .int('priority must be an integer')
        .min(0, 'priority must be non-negative'),
    /** 期別（選手養成所の卒業期。KEIRINのみ、player_keirinから補う。省略可） */
    term: z.number().int().positive('term must be positive').optional(),
    /** 所属（KEIRIN=府県、AUTORACE=拠点/LG。player_keirin/player_autoraceから補う。省略可） */
    branch: z.string().min(1, 'branch must not be empty').optional(),
});

/**
 * PlayerEntityの型定義
 */
export type PlayerEntity = z.infer<typeof PlayerEntitySchema>;

/**
 * PlayerEntityのバリデーション関数
 * @param entity - バリデーション対象のPlayerEntityオブジェクト
 * @returns バリデーション済みのPlayerEntityオブジェクト
 * @throws バリデーションエラーが発生した場合はzodのエラーをスローします。
 */
export const validatePlayerEntity = (entity: unknown): PlayerEntity => {
    return PlayerEntitySchema.parse(entity);
};
