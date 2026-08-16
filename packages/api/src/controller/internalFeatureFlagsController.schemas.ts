import { z } from 'zod';

/** `POST /internal/feature-flags`（機能フラグの更新）リクエストのスキーマ。 */
export const FeatureFlagsUpdateRequestSchema = z.object({
    key: z.string().min(1),
    enabled: z.boolean(),
});
