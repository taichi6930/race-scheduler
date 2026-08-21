import type { JoinRequestSummary } from '../../dto/joinRequest';

/**
 * 参加リクエスト一覧・承認/却下 Usecase インターフェース。
 */
export interface IJoinRequestsUsecase {
    /** 承認待ち（pending状態）の参加リクエスト一覧を返す。 */
    list: () => Promise<JoinRequestSummary[]>;

    /**
     * 参加リクエストを承認する（招待トークンが発行される）。
     * @param id - 承認対象のリクエストID
     */
    approve: (id: string) => Promise<void>;

    /**
     * 参加リクエストを却下する。
     * @param id - 却下対象のリクエストID
     */
    reject: (id: string) => Promise<void>;
}
