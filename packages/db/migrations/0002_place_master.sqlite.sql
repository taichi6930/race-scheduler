
-- 開催場マスター情報テーブル
CREATE TABLE IF NOT EXISTS place_master (
	race_type TEXT NOT NULL,         -- レース種別
	course_code_type TEXT NOT NULL,  -- コースコード種別
	place_name TEXT NOT NULL,        -- 開催場名
	place_code TEXT NOT NULL,        -- 開催場コード
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 作成日時
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新日時
	PRIMARY KEY (race_type, course_code_type, place_name)
);

-- updated_at自動更新トリガー（レコード更新時に自動で更新日時を変更）
CREATE TRIGGER IF NOT EXISTS trg_place_master_updated_at
AFTER UPDATE ON place_master
FOR EACH ROW
BEGIN
    UPDATE place_master SET updated_at = CURRENT_TIMESTAMP
    WHERE race_type = NEW.race_type AND course_code_type = NEW.course_code_type AND place_name = NEW.place_name;
END;
