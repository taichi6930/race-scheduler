-- Web Push 通知（タブを閉じていても届く発走前通知）の購読・予約テーブル
-- aidlc-docs/web-push/inception/application-design/web-push-design.md 参照
--
-- push_subscription: ブラウザ1つ（1 Service Worker 購読）= 1行
CREATE TABLE IF NOT EXISTS push_subscription (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_push_subscription_updated_at
AFTER UPDATE ON push_subscription
FOR EACH ROW
BEGIN
    UPDATE push_subscription SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- push_notification_request: 発火予約（購読 × レース、クライアントが本文込みで登録）
CREATE TABLE IF NOT EXISTS push_notification_request (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    race_id TEXT NOT NULL,
    fire_at_ms INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    sent_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_push_notification_request_updated_at
AFTER UPDATE ON push_notification_request
FOR EACH ROW
BEGIN
    UPDATE push_notification_request SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- 期限到来分の抽出（ディスパッチ）用インデックス
CREATE INDEX IF NOT EXISTS idx_push_notification_request_due
ON push_notification_request (sent_at, fire_at_ms);

-- 購読ID単位で予約を引くためのインデックス（購読削除時のカスケード削除に使用）
CREATE INDEX IF NOT EXISTS idx_push_notification_request_subscription
ON push_notification_request (subscription_id);
