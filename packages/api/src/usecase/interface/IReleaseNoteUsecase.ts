import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';

/**
 * ReleaseNote UseCase Interface（更新履歴、What's New画面向け）
 */
export interface IReleaseNoteUsecase {
    /**
     * draft・prereleaseを含む、公開リポジトリ（race-scheduler）由来のリリースノートのみを
     * 公開日時の新しい順で返す。frontの更新履歴画面（`GET /release-notes`、認証なし）向け。
     * 分割元の非公開リポジトリ（race-schedule）のリリースは含まない
     * （ユーザー依頼: 「非公開の更新は自分だけ見れるようにしたい」）。
     */
    listPublic: () => Promise<ReleaseNote[]>;

    /**
     * リポジトリを問わず全リリースノートを公開日時の新しい順で返す。
     * `packages/admin`（Cloudflare Accessで保護された運用者専用Worker）向け
     * （`GET /internal/release-notes`）。
     */
    listAll: () => Promise<ReleaseNote[]>;

    /** リリースノート1件をupsertする（autoRelease.tsからのサービス間書き込み）。 */
    upsert: (note: ReleaseNoteWrite) => Promise<void>;
}
