-- レースステージ情報テーブル
CREATE TABLE IF NOT EXISTS race_stage (
    race_id TEXT PRIMARY KEY, -- レースID（race テーブルの race_id と紐づく）
    race_stage TEXT NOT NULL, -- レースステージ（例: S級決勝, S級準決勝など）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- レコード作成日時
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP -- レコード更新日時
);

-- レースステージでの検索用インデックス
CREATE INDEX IF NOT EXISTS idx_race_stage_race_stage ON race_stage(race_stage);

-- updated_at自動更新トリガー（レコード更新時に自動で更新日時を変更）
CREATE TRIGGER IF NOT EXISTS trg_race_stage_updated_at
AFTER UPDATE ON race_stage
FOR EACH ROW
BEGIN
    UPDATE race_stage SET updated_at = CURRENT_TIMESTAMP
    WHERE race_id = NEW.race_id;
END;
