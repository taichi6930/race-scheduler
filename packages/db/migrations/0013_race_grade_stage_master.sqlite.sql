-- レースグレード・ステージマスタテーブル
CREATE TABLE IF NOT EXISTS race_grade_stage_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade TEXT NOT NULL, -- グレード（例: 'GⅠ', 'FⅠ', 'SG'）。1レコードに1グレード
    stage TEXT NOT NULL, -- 正規化されたステージ名（例: 'S級決勝', 'A級ファイナル'）
    race_type TEXT NOT NULL, -- レース種別（例: 'KEIRIN', 'AUTORACE', 'BOATRACE'）
    priority INTEGER NOT NULL DEFAULT 0, -- 優先度（0〜10。値が大きいほど重要）
    description TEXT NOT NULL DEFAULT '', -- ステージの説明文
    is_enabled INTEGER NOT NULL DEFAULT 1, -- 有効フラグ（1: 有効, 0: 無効）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grade, stage, race_type)
);

-- グレード・レース種別での検索用インデックス
CREATE INDEX IF NOT EXISTS idx_race_grade_stage_master_grade ON race_grade_stage_master(grade);
CREATE INDEX IF NOT EXISTS idx_race_grade_stage_master_race_type ON race_grade_stage_master(race_type);
CREATE INDEX IF NOT EXISTS idx_race_grade_stage_master_stage ON race_grade_stage_master(stage);

-- updated_at自動更新トリガー
CREATE TRIGGER IF NOT EXISTS trg_race_grade_stage_master_updated_at
AFTER UPDATE ON race_grade_stage_master
FOR EACH ROW
BEGIN
    UPDATE race_grade_stage_master SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- レースグレード・ステージWebサイト表記テーブル（stageByWebSite の正規化）
CREATE TABLE IF NOT EXISTS race_grade_stage_master_website (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    master_id INTEGER NOT NULL REFERENCES race_grade_stage_master(id) ON DELETE CASCADE,
    stage_by_website TEXT NOT NULL, -- Webサイト上の表記（例: 'Ｓ級決勝', 'Ｓ級ＧＰ'）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(master_id, stage_by_website)
);

-- master_id での検索用インデックス
CREATE INDEX IF NOT EXISTS idx_race_grade_stage_master_website_master_id ON race_grade_stage_master_website(master_id);

-- updated_at自動更新トリガー
CREATE TRIGGER IF NOT EXISTS trg_race_grade_stage_master_website_updated_at
AFTER UPDATE ON race_grade_stage_master_website
FOR EACH ROW
BEGIN
    UPDATE race_grade_stage_master_website SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
