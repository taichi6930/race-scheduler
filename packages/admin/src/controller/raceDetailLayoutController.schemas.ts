import { raceDetailUiConfigSchema } from '@race-schedule/core';
import { z } from 'zod';

/** `POST /race-detail-layout/api`（構成の保存）リクエストのスキーマ。 */
export const RaceDetailLayoutSaveRequestSchema = z.object({
    config: raceDetailUiConfigSchema,
});

/** `POST /race-detail-layout/api/preview`（保存せずに解決結果を返す）リクエストのスキーマ。 */
export const RaceDetailLayoutPreviewRequestSchema = z.object({
    config: raceDetailUiConfigSchema,
    raceId: z.string().min(1),
});
