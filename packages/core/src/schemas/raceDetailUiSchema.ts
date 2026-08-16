import { z } from 'zod';

import { RacePlayerEntitySchema } from '../entity/racePlayerEntity';

/**
 * Server-Driven UI: `GET /ui/race-detail` のkvセクション1行。
 */
export const raceDetailKvRowSchema = z.object({
    label: z.string(),
    value: z.string(),
});

/**
 * Server-Driven UI: `GET /ui/race-detail` のlinksセクション1件
 * （`RaceLink` と同じ形。frontはこのまま外部リンクボタンとして描画する）。
 */
export const raceDetailLinkItemSchema = z.object({
    label: z.string(),
    url: z.string().url(),
});

/**
 * Server-Driven UI: `GET /ui/race-detail` のセクション1件。
 * `type` で判別する discriminated union。front は未知の `type` を
 * スキップして残りのセクションを描画する（race-detail-sdui-design.md §1.1）。
 */
export const raceDetailUiSectionSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('kv'),
        rows: z.array(raceDetailKvRowSchema),
    }),
    z.object({
        type: z.literal('links'),
        items: z.array(raceDetailLinkItemSchema),
    }),
    z.object({
        type: z.literal('players'),
        title: z.string(),
        watchToggle: z.boolean(),
        rows: z.array(RacePlayerEntitySchema),
    }),
]);

/**
 * Server-Driven UI: `GET /ui/race-detail` のレスポンス全体のUIスキーマ。
 * `schemaVersion` は将来セクション種別を拡張する際、frontの解釈可否を判定する
 * ために予約している（現時点ではv1のみ。`announcementSchema` と同じ考え方）。
 */
export const raceDetailUiSchema = z.object({
    schemaVersion: z.literal(1),
    sections: z.array(raceDetailUiSectionSchema),
});

/** {@link raceDetailUiSchema} の推論型 */
export type RaceDetailUi = z.infer<typeof raceDetailUiSchema>;
