-- 競馬レース条件テーブル（JRA/NAR/OVERSEASのみ）
CREATE TABLE IF NOT EXISTS race_condition (
    race_id TEXT PRIMARY KEY, -- レースID（race テーブルの race_id と紐づく）
    distance INTEGER NOT NULL, -- 距離（メートル）
    surface_type TEXT NOT NULL, -- 馬場種別（芝/ダート/障害/AW）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- レコード作成日時
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP -- レコード更新日時
);

-- updated_at自動更新トリガー（レコード更新時に自動で更新日時を変更）
CREATE TRIGGER IF NOT EXISTS trg_race_condition_updated_at
AFTER UPDATE ON race_condition
FOR EACH ROW
BEGIN
    UPDATE race_condition SET updated_at = CURRENT_TIMESTAMP
    WHERE race_id = NEW.race_id;
END;
