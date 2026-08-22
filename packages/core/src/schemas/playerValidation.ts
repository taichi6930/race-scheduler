import { z } from 'zod';

import { type PlayerEntity, PlayerEntitySchema } from '../entity/playerEntity';
import { ValidationError } from '../utilities/validationError';
import { formatZodIssues } from './common';

/**
 * #29: プレイヤーの基本フィールド定義（upsertとDBの行スキーマで共有）
 */
export const playerBaseFieldsSchema = {
    race_type: z.string().min(1, 'race_type is required'),
    player_no: z.union([z.string(), z.number()]),
    player_name: z.string().min(1, 'player_name is required'),
};

/**
 * PlayerEntityのアップサートスキーマ
 * JSON入力のsnake_caseフィールドをcamelCaseへ変換した上で、
 * PlayerEntitySchema（domain）にpipeして検証する。
 * place/race の parsePlaceEntityUpsert / parseRaceEntityUpsert と同様、
 * 「入力パース」と「domain検証」を1つのZodスキーマに集約する。
 */
const PlayerEntityUpsertItemSchema = z
    .object({
        ...playerBaseFieldsSchema,
        player_no: z
            .union([z.string(), z.number()])
            .transform((value) => value.toString())
            .refine((value) => value.length > 0, 'player_no is required'),
        priority: z.coerce.number().int('priority must be an integer'),
    })
    .strict()
    .transform((data) => ({
        raceType: data.race_type,
        playerNo: data.player_no,
        playerName: data.player_name,
        priority: data.priority,
    }))
    .pipe(PlayerEntitySchema);

const playerEntityUpsertSchema = z.union([
    PlayerEntityUpsertItemSchema,
    z.array(PlayerEntityUpsertItemSchema).min(1, '配列は1件以上必要です'),
]);

/**
 * バリデーション失敗時にthrowするメッセージを解決する。
 * 通常のzod検証失敗では issues は常に1件以上を持つため、空配列側
 * （'Invalid request body'）は実運用では到達しない防御的な既定値だが、
 * テストで直接検証できるよう独立関数として export している。
 * @param issues - ZodErrorのissues配列
 * @returns throwするメッセージ文字列
 */
export const resolvePlayerValidationMessage = (issues: z.ZodIssue[]): string =>
    issues.length > 0 ? formatZodIssues(issues) : 'Invalid request body';

/**
 * PlayerEntityのアップサートペイロード（単一 or 配列）を検証してパースする
 * @param body - リクエストボディ（単一オブジェクトまたは配列）
 * @returns domain検証済みのPlayerEntity配列
 */
export const parsePlayerEntityUpsert = (body: unknown): PlayerEntity[] => {
    const result = playerEntityUpsertSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(
            resolvePlayerValidationMessage(result.error.issues),
        );
    }

    return Array.isArray(result.data) ? result.data : [result.data];
};
