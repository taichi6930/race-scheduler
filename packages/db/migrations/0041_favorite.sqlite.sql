-- Migration 0041: お気に入りレースをサーバー側(user単位)へ移行（段階2）
--
-- これまでfrontの端末ローカル(SharedPreferences)にのみ保存していたお気に入りを、
-- サーバー側でuser単位に保存する。race_idは既存のraceテーブルのPKと同じ形式の
-- 文字列だが、フロントは削除済み過去レースのIDも一時的に保持しうるため
-- （race_idの形式検証はAPI側で行い、race側への外部キー制約は付けない。
-- calendar_flagと同じ「参照先の削除を気にしない」設計）。
--
-- ROLLBACK: DROP TABLE IF EXISTS favorite;

CREATE TABLE IF NOT EXISTS favorite (
    user_id TEXT NOT NULL REFERENCES user(id),
    race_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, race_id)
);
