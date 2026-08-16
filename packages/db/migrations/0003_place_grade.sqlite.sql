-- 開催場グレード情報テーブル
CREATE TABLE IF NOT EXISTS place_grade (
    place_id TEXT PRIMARY KEY, -- 開催場ID（RaceType + YYYYMMDD + location_codeの組み合わせ）
    place_grade TEXT NOT NULL, -- 開催場グレード（例: G1, G2, G3, 一般など）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- レコード作成日時
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP -- レコード更新日時
);

-- 開催場グレードでの検索用インデックス
CREATE INDEX IF NOT EXISTS idx_place_grade_place_grade ON place_grade(place_grade);

-- updated_at自動更新トリガー（レコード更新時に自動で更新日時を変更）
CREATE TRIGGER IF NOT EXISTS trg_place_grade_updated_at
AFTER UPDATE ON place_grade
FOR EACH ROW
BEGIN
    UPDATE place_grade SET updated_at = CURRENT_TIMESTAMP
    WHERE place_id = NEW.place_id;
END;
