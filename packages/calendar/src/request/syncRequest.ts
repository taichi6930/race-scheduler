import { MS_PER_DAY, RaceTypeSchema } from '@race-schedule/core';
import { z } from 'zod';

/**
 * calendar の日付レンジ上限（日数）。`packages/batch/src/validation.ts` の
 * `getMaxRangeDays`（calendar: raceType不問390日）、および scraping 側の同種の防御
 * （`packages/scraping/src/request/dateRangeRaceTypeSchema.ts` の `PLACE_MAX_RANGE_DAYS`）
 * と同じ値（PERF-083）。
 *
 * 従来 batch 層にしか日付レンジの上限検証が無く、calendar 自身は無制限のレンジを
 * 受け付けていた（正当な呼び出し元は batch のみで上限内に収まるが、SEC-022と同じ
 * 理由で実装ミスや異常値送信からも保護する多層防御として calendar 側にも上限を設ける）。
 */
const CALENDAR_MAX_RANGE_DAYS = 390;

/**
 * POST /sync のリクエストボディ zod スキーマ。
 * JSON ボディの日付は文字列で届くため `z.coerce.date()` で変換する。
 */
export const SyncCalendarRequestBodySchema = z
    .object({
        startDate: z.coerce.date(),
        finishDate: z.coerce.date(),
        raceTypeList: z
            .array(RaceTypeSchema)
            .min(1, 'raceTypeListは1つ以上必要です'),
    })
    .refine((data) => data.startDate <= data.finishDate, {
        message: 'startDateはfinishDateを超えてはいけません',
        path: ['startDate', 'finishDate'],
    })
    .refine(
        (data) =>
            data.finishDate.getTime() - data.startDate.getTime() <
            (CALENDAR_MAX_RANGE_DAYS + 1) * MS_PER_DAY,
        {
            message: `startDateからfinishDateまでの期間は${String(CALENDAR_MAX_RANGE_DAYS)}日以内にしてください`,
            path: ['startDate', 'finishDate'],
        },
    );
