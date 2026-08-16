-- 指定レース（ユーザーがグレードに関係なくカレンダー登録したいレース）のフラグテーブル
-- race テーブルとは独立させる（スクレイピングの pruneStaleRaces で race 側が
-- 消える/再作成されても、ユーザーが付けた指定意思は消えないようにするため）
CREATE TABLE IF NOT EXISTS calendar_flag (
    race_id TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_calendar_flag_updated_at
AFTER UPDATE ON calendar_flag
FOR EACH ROW
BEGIN
    UPDATE calendar_flag SET updated_at = CURRENT_TIMESTAMP
    WHERE race_id = NEW.race_id;
END;
