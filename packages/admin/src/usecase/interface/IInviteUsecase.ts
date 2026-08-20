import type { InviteIssueResult } from '../../dto/invite';

/**
 * 招待発行 Usecase インターフェース。
 */
export interface IInviteUsecase {
    /**
     * 招待を新規発行する。
     * @param memo - 運用者専用の管理メモ（本人には見せない）。無ければnull
     * @returns 発行された招待トークン
     */
    issueInvite: (memo: string | null) => Promise<InviteIssueResult>;
}
