-- feature_flag テーブル: 機能フラグの本番展開制御
-- （aidlc-docs/inception/application-design/feature-flag-design.md 参照）
--
-- Server-Driven UI (SDUI) 機能等を、環境ごとに個別ON/OFFできるようにするための
-- テーブル。行が存在すればその enabled 値が最優先で使われ、行が無いキーは
-- 各 Worker の wrangler.toml 環境変数（FEATURE_XXX_ENABLED）の値を既定値として使う
-- （feature-flag-design.md §2「解決順序」）。
--
-- flag_key はアプリケーションコード側で定義する識別子（例:
-- 'announcement_banner'）で、外部キー的な参照先は持たない（機能フラグの追加・削除は
-- コードとテーブル行が独立して増減してよい設計のため）。
CREATE TABLE IF NOT EXISTS feature_flag (
    flag_key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_feature_flag_updated_at
AFTER UPDATE ON feature_flag
FOR EACH ROW
BEGIN
    UPDATE feature_flag SET updated_at = CURRENT_TIMESTAMP
    WHERE flag_key = NEW.flag_key;
END;
