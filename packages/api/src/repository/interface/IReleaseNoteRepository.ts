import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';

/**
 * 更新履歴（`release_note` テーブル）リポジトリインターフェース。
 */
export interface IReleaseNoteRepository {
    /**
     * draft・prerelease を含む全リリースノートを、公開日時（`published_at`）の
     * 新しい順で返す。draft・prereleaseの除外は呼び出し元（front互換の挙動を踏襲）。
     */
    findAll: () => Promise<ReleaseNote[]>;

    /**
     * (tag_name, source_repo) が一致する既存行があれば更新、無ければ新規作成する。
     * autoRelease.ts からのサービス間書き込み（再実行時の冪等性を担保するため upsert）。
     */
    upsert: (note: ReleaseNoteWrite) => Promise<void>;
}
