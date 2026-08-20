/**
 * メインAPI（@race-schedule/api）の `GET /auth/participants` が返す1行分。
 * api側の `ParticipantRow`（`packages/api/src/repository/interface/IAuthRepository.ts`）
 * と同じ形のレスポンスJSONを表す、admin側で見たDTO（パッケージ境界を越えて型を
 * 共有しないため個別に定義している。`dto/featureFlagStatus.ts`と同じ方針）。
 *
 * 1人が複数credential（複数端末）を持つ場合はuserIdが同じ行が複数返る想定。
 * admin側ではグルーピングせずそのまま行ごとに表示する（YAGNI）。
 */
export interface ParticipantSummary {
    userId: string;
    nickname: string;
    /** 招待発行時に運用者が入力したメモ（本人には見せない）。未設定ならnull */
    inviteMemo: string | null;
    credentialId: string;
    deviceLabel: string;
    /** ISO 8601形式の文字列。未ログインならnull */
    lastUsedAt: string | null;
    /** ISO 8601形式の文字列（ユーザー作成日時＝参加日時） */
    userCreatedAt: string;
}
