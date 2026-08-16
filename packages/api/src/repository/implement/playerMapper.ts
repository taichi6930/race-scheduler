import {
    createErrorMessage,
    formatZodIssues,
    type PlayerEntity,
    validatePlayerEntity,
} from '@race-schedule/core';
import { z } from 'zod';

/**
 * Drizzle が返す player 行（camelCase）のRawデータ検証スキーマ
 * @remarks
 * schema.ts の列定義（text/integer）で型は概ね保証されるが、
 * PlaceMapper/RaceMapper と同様に「現状キャストで通っていた値をすべて許容する」
 * permissive な定義を維持し、防御的な検証として残す。
 */
const playerRowSchema = z.object({
    raceType: z.string().min(1, 'raceType is required'),
    playerNo: z.union([z.string(), z.number()]),
    playerName: z.string().min(1, 'playerName is required'),
    priority: z.union([z.string(), z.number()]),
    term: z.union([z.string(), z.number()]).nullish(),
    branch: z.string().nullish(),
});

/**
 * row.term が未設定（NULL/undefined、player_keirinとのLEFT JOIN不一致）
 * かどうかを判定する。呼び出し側の三項演算子に埋め込むと複合条件（||）になる
 * ため、単独でテストできる名前付き関数として切り出す
 * （calendarRepository.tsのisLabelValueMissingと同じ様式）。
 * @param value - row.term の値
 */
const isTermValueMissing = (
    value: string | number | null | undefined,
): boolean => value === null || value === undefined;

/**
 * Drizzle が返す player 行（camelCase）をEntityに変換し、同時にスキーマで検証
 */
export const PlayerMapper = {
    /**
     * 生DBのPlayer行データをPlayerEntityに変換する
     * @param row - Drizzleから返された生のPlayer行
     * @returns 検証済みのPlayerEntity
     */
    toEntity(row: unknown): PlayerEntity {
        const validationResult = playerRowSchema.safeParse(row);
        if (!validationResult.success) {
            throw new Error(
                `Invalid player data from gateway: ${formatZodIssues(validationResult.error.issues)}`,
            );
        }

        const validatedRow = validationResult.data;

        try {
            return validatePlayerEntity({
                raceType: validatedRow.raceType,
                playerNo: String(validatedRow.playerNo),
                playerName: validatedRow.playerName,
                priority: Number(validatedRow.priority),
                term: isTermValueMissing(validatedRow.term)
                    ? undefined
                    : Number(validatedRow.term),
                branch: validatedRow.branch ?? undefined,
            });
        } catch (error) {
            const message = createErrorMessage('PlayerMapper', error);
            throw new Error(`Failed to validate PlayerEntity: ${message}`, {
                cause: error,
            });
        }
    },
};
