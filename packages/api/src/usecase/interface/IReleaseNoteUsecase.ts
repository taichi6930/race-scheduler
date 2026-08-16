import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';

/**
 * ReleaseNote UseCase Interface（更新履歴、What's New画面向け）
 */
export interface IReleaseNoteUsecase {
    /** draft・prereleaseを含む全リリースノートを、公開日時の新しい順で返す。 */
    list: () => Promise<ReleaseNote[]>;

    /** リリースノート1件をupsertする（autoRelease.tsからのサービス間書き込み）。 */
    upsert: (note: ReleaseNoteWrite) => Promise<void>;
}
