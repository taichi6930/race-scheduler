-- Migration 0003: 開催日情報テーブル
-- 開催場ごとの開催回数・開催日数などを管理
CREATE TABLE IF NOT EXISTS place_held_day (
    place_id TEXT PRIMARY KEY,         -- 開催場ID（RaceType + YYYYMMDD + location_code）
    held_times INTEGER NOT NULL,       -- 開催回数
    held_day_times INTEGER NOT NULL,   -- 開催日数
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 作成日時
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP  -- 更新日時
);

-- 検索性能向上用インデックス
CREATE INDEX IF NOT EXISTS idx_place_held_day_held_times ON place_held_day(held_times);
CREATE INDEX IF NOT EXISTS idx_place_held_day_held_day_times ON place_held_day(held_day_times);

-- レコード更新時にupdated_atを自動更新するトリガー
CREATE TRIGGER IF NOT EXISTS trg_place_held_day_updated_at
AFTER UPDATE ON place_held_day
FOR EACH ROW
BEGIN
    UPDATE place_held_day SET updated_at = CURRENT_TIMESTAMP
    WHERE place_id = NEW.place_id;
END;
