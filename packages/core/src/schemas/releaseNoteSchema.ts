import { z } from 'zod';

/**
 * 更新履歴（What's New画面）1件分。GitHub Releases API
 * （`GET /repos/{owner}/{repo}/releases`）と同じフィールド名（snake_case）を使う。
 * front（`ReleaseModel.fromJson`）が元々GitHub APIのこの形をパースする実装のため、
 * `GET /release-notes` のレスポンスをこの形に揃えることでfront側の変更を
 * 「取得先URLのみ」に抑えている。
 */
export const releaseNoteSchema = z.object({
    tag_name: z.string().min(1),
    name: z.string().nullable(),
    body: z.string().nullable(),
    published_at: z.string().nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
});

/** {@link releaseNoteSchema} の推論型 */
export type ReleaseNote = z.infer<typeof releaseNoteSchema>;

/**
 * `POST /release-notes`（サービス間API、autoRelease.ts からの書き込み）リクエストのスキーマ。
 * tag_name は race-schedule / race-scheduler で独立採番されており重複しうるため、
 * どちらのリポジトリ由来かを示す source_repo を必須にする
 * （0038_release_note.sqlite.sql の idx_release_note_tag_source に対応）。
 */
export const releaseNoteWriteSchema = releaseNoteSchema.extend({
    source_repo: z.enum(['race-schedule', 'race-scheduler']),
});

/** {@link releaseNoteWriteSchema} の推論型 */
export type ReleaseNoteWrite = z.infer<typeof releaseNoteWriteSchema>;
