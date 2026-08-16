-- Migration 0026: push_subscription へ連続失敗回数カラムを追加（OBS-024）
-- VAPID鍵ローテーション後の古いendpoint等、恒久的に失敗し続ける購読が
-- 上限なくリトライされ検知されない問題への対応。送信失敗のたびに
-- インクリメントし、送信成功でリセットする（usecase側で更新）。
-- 一定回数（PushUsecase.MAX_CONSECUTIVE_FAILURES）を超えた購読は
-- removeWithDependentRequestsで削除し、無限リトライを止める。
ALTER TABLE push_subscription ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0;
