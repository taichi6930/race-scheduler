/**
 * メインAPI（@race-schedule/api）の `POST /auth/invite` が返す結果。
 * api側の `issueInvite` の戻り値（`packages/api/src/usecase/interface/IAuthUsecase.ts`）
 * と同じ形のレスポンスJSONを表す、admin側で見たDTO（`dto/featureFlagStatus.ts`と同じ方針）。
 */
export interface InviteIssueResult {
    token: string;
}
