CREATE TABLE IF NOT EXISTS race (
    race_id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    race_type TEXT NOT NULL,
    race_name TEXT NOT NULL DEFAULT '',
    date_time DATETIME NOT NULL,
    location_code TEXT NOT NULL,
    grade TEXT NOT NULL DEFAULT '',
    race_number INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_race_place_id ON race(place_id);
CREATE INDEX IF NOT EXISTS idx_race_race_type ON race(race_type);
CREATE INDEX IF NOT EXISTS idx_race_date_time ON race(date_time);
CREATE INDEX IF NOT EXISTS idx_race_type_date_time ON race(race_type, date_time);

CREATE TRIGGER IF NOT EXISTS trg_race_updated_at
AFTER UPDATE ON race
FOR EACH ROW
BEGIN
    UPDATE race SET updated_at = CURRENT_TIMESTAMP
    WHERE race_id = NEW.race_id;
END;
