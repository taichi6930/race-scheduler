import { RaceTypeSchema, raceDetailUiConfigSchema } from '@race-schedule/core';
import { z } from 'zod';

/** `POST /internal/ui-layout`（構成の保存）リクエストのスキーマ。 */
export const UiLayoutSaveRequestSchema = z.object({
    raceType: RaceTypeSchema,
    config: raceDetailUiConfigSchema,
});

/** `POST /internal/ui-layout/preview`（保存せずに解決結果を返す）リクエストのスキーマ。 */
export const UiLayoutPreviewRequestSchema = z.object({
    config: raceDetailUiConfigSchema,
    raceId: z.string().min(1),
});
