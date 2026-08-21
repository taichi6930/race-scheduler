-- Migration 0044: 招待なしの参加リクエスト（承認制の自己申請フロー）
--
-- join_request: 招待コードを持たないユーザーがfrontから直接送る参加リクエスト。
--   status='pending'で作成され、admin側の承認/却下でstatusが更新される。
--   承認時にinvite_tokenへ発行済みの招待トークンを紐付け、リクエスト側は
--   その値を使って既存の招待登録フロー（/auth/register/options→verify）を
--   自動で継続する（パスキー自体はこの時点ではまだ作られていない）。
--
-- ROLLBACK: DROP TABLE IF EXISTS join_request;

CREATE TABLE IF NOT EXISTS join_request (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    invite_token TEXT REFERENCES invite(token),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_join_request_status ON join_request(status);
