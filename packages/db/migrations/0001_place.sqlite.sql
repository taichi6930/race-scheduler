-- Migration 0001: 開催場情報テーブル
-- 開催場ごとの基本情報（ID, 種別, 日時, 場所コード）を管理
CREATE TABLE IF NOT EXISTS place (
    place_id TEXT PRIMARY KEY,         -- 開催場ID（RaceType + YYYYMMDD + location_code）
    race_type TEXT NOT NULL,           -- レース種別（例: 競馬, 競輪, 競艇, オート）
    date_time DATETIME NOT NULL,       -- 開催日時（YYYY-MM-DD HH:MM:SS）
    location_code TEXT NOT NULL,       -- 開催場コード
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 作成日時
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP  -- 更新日時
);

-- 開催場の一意性を担保する複合UNIQUEインデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_place_unique_race_type_date_time_location_code
    ON place(race_type, date_time, location_code);

-- 検索性能向上用インデックス
CREATE INDEX IF NOT EXISTS idx_place_race_type ON place(race_type);
CREATE INDEX IF NOT EXISTS idx_place_location_code ON place(location_code);
CREATE INDEX IF NOT EXISTS idx_place_date_time ON place(date_time);

-- 複合条件検索用インデックス
CREATE INDEX IF NOT EXISTS idx_place_race_type_date_time_location_code
    ON place(race_type, date_time, location_code);

-- レコード更新時にupdated_atを自動更新するトリガー
CREATE TRIGGER IF NOT EXISTS trg_place_updated_at
AFTER UPDATE ON place
FOR EACH ROW
BEGIN
    UPDATE place SET updated_at = CURRENT_TIMESTAMP
    WHERE place_id = NEW.place_id;
END;
