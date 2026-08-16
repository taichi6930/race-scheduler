-- Migration 0037: push_subscription.updated_at へのインデックス追加
-- （SEC-053、未使用購読の経過期間ベース削除）
--
-- PushSubscriptionRepository.purgeStale が updated_at を条件にした削除を
-- 定期実行（1日1回、api/src/scheduled.ts の DATA_FRESHNESS_CRON）するため、
-- フルスキャンを避けるインデックスを追加する。
--
-- ROLLBACK: DROP INDEX IF EXISTS idx_push_subscription_updated_at;
CREATE INDEX IF NOT EXISTS idx_push_subscription_updated_at
ON push_subscription (updated_at);
