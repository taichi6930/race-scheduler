import { z } from 'zod';

import { RACE_DETAIL_FIELD_KEYS } from '../domain/policy/raceDetailUi/fieldCatalog';

/**
 * レース詳細セクション構成（`RaceDetailUiConfig`）の保存・admin入力向けzodスキーマ。
 *
 * `RaceDetailUi`（`raceDetailUiSchema.ts`、解決済みレスポンス）とは異なり、値そのもの
 * ではなく {@link RACE_DETAIL_FIELD_KEYS} のキーへの参照のみを持つ
 * （race-detail-sdui-design.md §1.2）。管理画面から保存されるJSON・D1から読み出した
 * JSONのいずれもこのスキーマで検証してから使う。未知のフィールドキーは
 * `z.enum` により拒否される。
 */
export const raceDetailUiConfigSchema = z.object({
    sections: z.array(
        z.discriminatedUnion('type', [
            z.object({
                type: z.literal('kv'),
                fields: z.array(
                    z.object({
                        key: z.enum(RACE_DETAIL_FIELD_KEYS),
                        label: z.string().min(1).optional(),
                    }),
                ),
            }),
            z.object({ type: z.literal('links') }),
            z.object({
                type: z.literal('players'),
                title: z.string().min(1),
                watchToggle: z.boolean(),
            }),
        ]),
    ),
});

/** {@link raceDetailUiConfigSchema} の推論型（`RaceDetailUiConfig` と構造的に一致）。 */
export type RaceDetailUiConfigInput = z.infer<typeof raceDetailUiConfigSchema>;
