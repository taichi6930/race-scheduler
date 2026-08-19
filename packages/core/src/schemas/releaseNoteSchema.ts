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
    // GitHub Releases APIには存在しないfront独自の追加フィールド。front側の
    // 更新履歴画面でどちらのリポジトリ由来か表示する（race-schedule/race-scheduler
    // 分割後、片方だけ見て「どっちのリポジトリのものか分かりにくい」ため）ために
    // optionalで追加する。実際のGitHub APIレスポンスをこのスキーマでパースしても
    // undefinedになるだけで、GitHub API互換という設計意図は壊れない。
    source_repo: z.enum(['race-schedule', 'race-scheduler']).optional(),
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
