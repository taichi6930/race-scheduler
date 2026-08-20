-- Migration 0039: パスキー(WebAuthn)認証の基盤テーブル4つを追加
-- （招待制のクローズドサービス化。設計の経緯はPRの本文を参照）
--
-- user: 招待を消費して登録した参加者。nicknameは本人が登録時に入力する。
-- credential: WebAuthnの公開鍵（1人が複数端末分持てる）。秘密鍵は端末外に出ないため
--   ここに保存するのは公開鍵のみ。device_labelはaaguid/user_agentから自動サジェストした
--   初期値を本人が編集できる表示専用の項目（認証判定には一切使わない）。
-- invite: 管理者(admin)が発行する使い捨ての招待。memoは管理者専用のメモで本人には見せない。
-- session: ログイン後のセッション。1ユーザー1トークンではなく1ログインごとに1行
--   （複数端末から同時ログインできる）。expires_atはAPIリクエストのたびに
--   「今+7日」へ更新するスライディングウィンドウ方式（7日操作が無ければ失効）。
--
-- ROLLBACK: DROP TABLE IF EXISTS session; DROP TABLE IF EXISTS invite;
--   DROP TABLE IF EXISTS credential; DROP TABLE IF EXISTS user;
--   （外部キーを持つ側から先に削除する）

CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credential (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id),
    public_key BLOB NOT NULL,
    sign_count INTEGER NOT NULL DEFAULT 0,
    aaguid TEXT,
    user_agent TEXT,
    device_label TEXT NOT NULL,
    last_used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credential_user_id ON credential(user_id);

CREATE TABLE IF NOT EXISTS invite (
    token TEXT PRIMARY KEY,
    memo TEXT,
    expires_at DATETIME NOT NULL,
    used_by_user_id TEXT REFERENCES user(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id),
    credential_id TEXT NOT NULL REFERENCES credential(id),
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- リクエストのたびに token で検索するため、expires_at側の範囲検索用に
-- 複合インデックスは張らない（PRIMARY KEYのtoken単体検索で十分）。
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
