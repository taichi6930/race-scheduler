-- player_watch テーブル: ユーザーが登録した注目選手
-- （このテーブルに登録された選手が出走するレースを、自動的に注目レースとして
-- 扱うための起点。aidlc-docs/inception/application-design/keirin-player-data-design.md §4.4 参照）
--
-- calendar_flagと同じ位置づけで、race/player/race_player（スクレイピングが
-- 所有し再取得のたびに上書き・削除される）とは独立させる。
-- このテーブルはスクレイピング経路から一切書き込まない。
--
-- priorityは現状 0(注目しない) / 10(注目する) の二値運用（boolean相当）。
-- 将来「複数の注目選手の中でも優先度に差をつけたい」となったとき、1〜9の
-- 中間値で段階的な重み付けに拡張できる余地を残すため、boolean型ではなく
-- INTEGER・10刻みを採用する。
CREATE TABLE IF NOT EXISTS player_watch (
    race_type TEXT NOT NULL,
    player_no TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 10,
    label TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (race_type, player_no)
);

-- 注目レース導出クエリ（priority > 0 での絞り込み）用
CREATE INDEX IF NOT EXISTS idx_player_watch_priority
ON player_watch (priority);

CREATE TRIGGER IF NOT EXISTS trg_player_watch_updated_at
AFTER UPDATE ON player_watch
FOR EACH ROW
BEGIN
    UPDATE player_watch SET updated_at = CURRENT_TIMESTAMP
    WHERE race_type = NEW.race_type AND player_no = NEW.player_no;
END;
