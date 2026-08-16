import { MS_PER_DAY, RaceTypeSchema } from '@race-schedule/core';
import { z } from 'zod';

/**
 * raceTypeList フィールドのスキーマ（1件以上必須）。
 * `packages/scraping/src/request/dateRangeRaceTypeSchema.ts` の
 * `raceTypeListField` と同じ形（コアの内部限定 `raceTypeListField` は
 * publicに export されていないため、各Workerパッケージ側で定義する）。
 */
const raceTypeListField = z
    .array(RaceTypeSchema)
    .min(1, 'raceTypeListは1つ以上必要です');

/**
 * バックフィル（R2キャッシュのみでの再同期）の日付レンジ上限（日数）。
 * SEC-022（scraping側 `PLACE_MAX_RANGE_DAYS`）と同じ考え方で、フロント
 * （認証を持たない公開エンドポイント）からの異常に広い範囲指定から多層防御する。
 */
const BACKFILL_MAX_RANGE_DAYS = 400;

/**
 * `POST /internal/backfill/place` ・ `POST /internal/backfill/race` 共通のリクエストボディ
 * zod スキーマ。JSON ボディの日付は文字列で届くため `z.coerce.date()` で変換する。
 */
export const BackfillRequestBodySchema = z
    .object({
        startDate: z.coerce.date(),
        finishDate: z.coerce.date(),
        raceTypeList: raceTypeListField,
    })
    .refine((data) => data.startDate <= data.finishDate, {
        message: 'startDateはfinishDateを超えてはいけません',
        path: ['startDate', 'finishDate'],
    })
    .refine(
        (data) =>
            data.finishDate.getTime() - data.startDate.getTime() <=
            BACKFILL_MAX_RANGE_DAYS * MS_PER_DAY,
        {
            message: `日付レンジは${BACKFILL_MAX_RANGE_DAYS}日以内で指定してください`,
            path: ['startDate', 'finishDate'],
        },
    );
