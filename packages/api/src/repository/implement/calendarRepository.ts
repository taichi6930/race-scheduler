import {
    appLogger,
    type CalendarFlagEntity,
    CalendarFlagEntitySchema,
    DI_TOKENS,
    formatZodIssues,
    LogAllMethods,
    type RaceId,
} from '@race-schedule/core';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

import { calendarFlag } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { ICalendarRepository } from '../interface/ICalendarRepository';
import { chunkArray } from '../utility/chunkArray';
import { hasFilterValues } from '../utility/queryFilterHelpers';
import { D1_MAX_BIND_VARS } from '../utility/upsertChunk';

/**
 * fetchFlaggedRaceIds の IN 句チャンクサイズ。
 * @remarks
 * raceId 1件につき IN 句のバインド変数1件のみを消費するため、
 * D1_MAX_BIND_VARS をそのままチャンクサイズとして使う。
 * raceRepository.fetchWatchedRaceIds と同様、NAR/KEIRIN 等で raceIds が
 * 100件を超えるとD1のバインド変数上限超過になりうるため分割する（Issue #2350）。
 */
const FLAGGED_RACE_IDS_CHUNK_SIZE = D1_MAX_BIND_VARS;

/**
 * Drizzle が返す calendar_flag 行（camelCase）の型検証スキーマ
 *
 * RaceMapper / PlaceMapper / PlayerMapper の raw 行検証様式に倣い、生 DB 行を
 * 検証してから使用する。label は DB スキーマ上 NOT NULL だが、他マッパーと同様
 * 「現状キャストで通っていた値をすべて許容する」permissiveな定義とし、
 * null/undefined も受け入れて既定値（空文字）へフォールバックする。
 */
const calendarFlagRowSchema = z.object({
    raceId: z.string(),
    label: z.string().nullish(),
});

type CalendarFlagRow = z.infer<typeof calendarFlagRowSchema>;

/**
 * DBから返された行の label が未設定（NULL/undefined）かどうかを判定する。
 * 呼び出し側の三項演算子に埋め込むと複合条件（||）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param value - row.label の値
 */
const isLabelValueMissing = (value: unknown): boolean =>
    value === null || value === undefined;

/**
 * 生 DB 行を検証する（RaceMapper / PlaceMapper / PlayerMapper の様式に準拠）。
 * @param row - Drizzle から返された生の calendar_flag 行
 */
const validateCalendarFlagRow = (
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- Drizzleから返る生DB行をZodで検証する前の中間表現のため、Record<string, unknown>が正しい
    row: Record<string, unknown>,
): CalendarFlagRow => {
    const rowValidationResult = calendarFlagRowSchema.safeParse(row);
    if (!rowValidationResult.success) {
        throw new Error(
            `Invalid calendar_flag data from gateway: ${formatZodIssues(rowValidationResult.error.issues)}`,
        );
    }
    return rowValidationResult.data;
};

/**
 * 組み立てた rawEntity をスキーマで検証し、CalendarFlagEntity として返す。
 * @param rawEntity - 組み立て済みの検証前エンティティ
 */
const buildValidatedCalendarFlagEntity = (
    rawEntity: unknown,
): CalendarFlagEntity => {
    const validationResult = CalendarFlagEntitySchema.safeParse(rawEntity);
    if (!validationResult.success) {
        throw new Error(
            `Invalid calendar_flag data from gateway: ${formatZodIssues(validationResult.error.issues)}`,
        );
    }
    return validationResult.data;
};

/**
 * Drizzle が返す calendar_flag 行（camelCase）をEntityに変換し、同時にスキーマで検証
 */
const CalendarFlagMapper = {
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- validateCalendarFlagRowと同じ、検証前の生DB行
    toEntity(row: Record<string, unknown>): CalendarFlagEntity {
        const validatedRow = validateCalendarFlagRow(row);

        const rawEntity = {
            raceId: validatedRow.raceId,
            label: isLabelValueMissing(validatedRow.label)
                ? ''
                : String(validatedRow.label),
        };

        return buildValidatedCalendarFlagEntity(rawEntity);
    },
};

/**
 * 指定レース（カレンダー登録フラグ）リポジトリのDB実装
 * @remarks
 * race テーブルとは独立した calendar_flag テーブルを操作する。
 * スクレイピングによる race の再作成・削除に影響されず、
 * ユーザーが付けた「常にカレンダー登録したい」という指定意思を永続化する。
 */
@LogAllMethods
@injectable()
export class CalendarRepository implements ICalendarRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    /**
     * fetchFlaggedRaceIds の1チャンク分（raceId最大 FLAGGED_RACE_IDS_CHUNK_SIZE件）を取得する。
     * @param raceIdChunk - 絞り込み対象の raceId チャンク
     */
    private async fetchFlaggedRaceIdsChunk(
        raceIdChunk: string[],
    ): Promise<{ raceId: string }[]> {
        return this.drizzleGateway.db
            .select({ raceId: calendarFlag.raceId })
            .from(calendarFlag)
            .where(inArray(calendarFlag.raceId, raceIdChunk));
    }

    /**
     * D1のバインド変数上限（100件）を超えないよう、raceIdsをチャンク分割して
     * 並列にクエリする（Issue #2350）。
     * @param raceIds - 絞り込み対象の raceId 一覧
     */
    public async fetchFlaggedRaceIds(
        raceIds: readonly string[],
    ): Promise<Set<string>> {
        if (!hasFilterValues(raceIds)) return new Set();

        const chunks = chunkArray([...raceIds], FLAGGED_RACE_IDS_CHUNK_SIZE);
        const chunkResults = await Promise.all(
            chunks.map((chunk) => this.fetchFlaggedRaceIdsChunk(chunk)),
        );
        return new Set(chunkResults.flat().map((row) => row.raceId));
    }

    /**
     * DB行をCalendarFlagEntityへ変換する。バリデーションエラー時はwarnログを出しnullを返す。
     * @remarks
     * RaceRepository.mapRaceRowSafely と同様、1行の変換失敗で list() 全体を
     * 失敗させず、不正な行のみスキップして呼び出し元へは正常な行だけを返す。
     * @param row - DB から返された生の calendar_flag 行
     */
    private mapCalendarFlagRowSafely(
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- validateCalendarFlagRowと同じ、検証前の生DB行
        row: Record<string, unknown>,
    ): CalendarFlagEntity | null {
        try {
            return CalendarFlagMapper.toEntity(row);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            appLogger.warn(
                `[CalendarRepository.list] Skipping invalid calendar_flag row: ${message}`,
            );
            return null;
        }
    }

    public async list(): Promise<CalendarFlagEntity[]> {
        const rows = await this.drizzleGateway.db
            .select({ raceId: calendarFlag.raceId, label: calendarFlag.label })
            .from(calendarFlag)
            .orderBy(desc(calendarFlag.createdAt));

        // Gateway からのデータを検証しながら Entity に変換。
        // バリデーションエラーが発生した行はスキップして警告のみ出す
        // （他マッパー[RaceMapper]の list/fetch と同じ「失敗行のみ除外」方針）。
        return rows
            .map((row) => this.mapCalendarFlagRowSafely(row))
            .filter((entity): entity is CalendarFlagEntity => entity !== null);
    }

    public async add(raceId: RaceId, label: string): Promise<void> {
        await this.drizzleGateway.db
            .insert(calendarFlag)
            .values({ raceId, label })
            .onConflictDoUpdate({
                target: calendarFlag.raceId,
                set: { label, updatedAt: sql`CURRENT_TIMESTAMP` },
            });
    }

    public async remove(raceId: RaceId): Promise<void> {
        await this.drizzleGateway.db
            .delete(calendarFlag)
            .where(eq(calendarFlag.raceId, raceId));
    }
}
