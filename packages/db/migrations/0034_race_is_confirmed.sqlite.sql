-- Migration 0034: レースの確定/未確定フラグ追加
-- 開催情報がまだ公式に確定しておらず、運用者が過去の開催パターンから
-- 推測して先行登録している未来のレースを front 側で見分けられるようにする。
--
-- 既存行はデフォルトで確定（1）扱いとしたうえで、開催日が「今日から7日後」より
-- 先の行だけを一括で未確定（0）に倒す（運用者ヒアリング: 直近1週間程度は確定情報だが
-- それ以降は憶測で入力しているとのこと。厳密な判定はできないためこの閾値で妥協する）。
--
-- ROLLBACK: 本マイグレーションはUPDATEを伴うため OPS-02 の対象。
--   本マイグレーション適用直後に限り、以下で厳密に巻き戻せる
--   （このUPDATEの条件そのものが逆条件になるため、0009〜0012と異なり
--   変換前後の区別が失われない）。ただし適用後に is_confirmed を手動で
--   変更した行がある場合はその変更も失われるため、その場合はバックアップからの
--   リストアを使うこと。
--     UPDATE race SET is_confirmed = 1
--     WHERE date_time > strftime('%Y-%m-%dT%H:%M:%S+09:00', datetime('now', '+9 hours', '+7 days'));
--     ALTER TABLE race DROP COLUMN is_confirmed;
ALTER TABLE race ADD COLUMN is_confirmed INTEGER NOT NULL DEFAULT 1;

UPDATE race
SET is_confirmed = 0
WHERE date_time > strftime('%Y-%m-%dT%H:%M:%S+09:00', datetime('now', '+9 hours', '+7 days'));
