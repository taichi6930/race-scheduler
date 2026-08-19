import type { ReleaseNote } from '@race-schedule/core';

/**
 * 更新履歴（release_note）管理 Usecase インターフェース。
 * frontには表示されない、分割元の非公開リポジトリ（race-schedule）分も
 * 含む全リリースノートを運用者が確認するための画面向け。
 */
export interface IReleaseNotesUsecase {
    /** 全リリースノート（非公開リポジトリ分を含む）を公開日時の新しい順で返す。 */
    list: () => Promise<ReleaseNote[]>;
}
