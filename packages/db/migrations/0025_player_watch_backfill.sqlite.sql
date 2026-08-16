-- 既存 player.priority (>0) を「注目=true」とみなし、player_watch の
-- 新しい二値表現(priority=10)へ移行する。
-- aidlc-docs/inception/application-design/keirin-player-data-design.md §4.4 参照
--
-- player.priority 列自体の削除は行わない（読み取り側を先に切り替えてからにする、
-- design.md §4.4）。以降 player.priority は読み書きされない列として残るのみ。
INSERT INTO player_watch (race_type, player_no, priority)
SELECT race_type, player_no, 10 FROM player WHERE priority > 0
ON CONFLICT (race_type, player_no) DO NOTHING;
