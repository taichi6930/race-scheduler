-- Migration 0042: WebAuthnのchallengeを一時保持するテーブル
--
-- 登録/ログインはそれぞれ options生成→verify の2往復のHTTPリクエストに
-- またがるため、その間サーバーが発行したchallengeを一時的に持つ必要がある
-- （KVを使わずD1のみで完結させる。0039のsession/inviteと同じ設計方針）。
-- purpose='register'時はinvite_tokenを保持し、verify時に招待の有効性を再確認する。
-- 1回のoptions/verify往復でしか使わない使い捨ての値のため、verify成功/失敗を問わず
-- 消費時に削除する（リプレイ防止）。expires_atを過ぎた行は定期清掃を必須とせず
-- （verify側で期限切れなら拒否するため安全側には倒れる）、行数も小さい。
--
-- ROLLBACK: DROP TABLE IF EXISTS webauthn_challenge;

CREATE TABLE IF NOT EXISTS webauthn_challenge (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    purpose TEXT NOT NULL,
    invite_token TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
