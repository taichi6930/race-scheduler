/**
 * メインAPI（@race-schedule/api）の `GET /auth/join-requests` が返す1行分。
 * api側の `JoinRequestRecord`（`packages/api/src/repository/interface/IAuthRepository.ts`）
 * のうち、pending状態の行から管理画面が実際に使う項目だけを持つ、admin側で見た
 * DTO（パッケージ境界を越えて型を共有しないため個別に定義している。
 * `dto/participant.ts`と同じ方針）。
 */
export interface JoinRequestSummary {
    id: string;
    nickname: string;
}
