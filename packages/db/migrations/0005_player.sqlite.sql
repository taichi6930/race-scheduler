-- player テーブル: 選手マスタ情報
CREATE TABLE IF NOT EXISTS player (
    race_type TEXT NOT NULL,         -- レース種別（JRA, NAR, KEIRIN, AUTORACE, BOATRACE）
    player_no TEXT NOT NULL,         -- 選手番号
    player_name TEXT NOT NULL,       -- 選手名
    priority INTEGER NOT NULL,       -- 優先度
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (race_type, player_no)
);

-- インデックス
-- (race_type, player_no) の複合PRIMARY KEYがrace_type単体検索も暗黙にカバーする
-- （SQLiteの複合PKはB-treeとして先頭列race_typeのプレフィックス検索にも使える）ため、
-- idx_player_race_typeは実質的に冗長だが、意図の明示性のため残置する（PERF-056）。
CREATE INDEX IF NOT EXISTS idx_player_race_type ON player(race_type);
CREATE INDEX IF NOT EXISTS idx_player_priority ON player(priority);

-- updated_at自動更新トリガー（レコード更新時に自動で更新日時を変更）
CREATE TRIGGER IF NOT EXISTS trg_player_updated_at
AFTER UPDATE ON player
FOR EACH ROW
BEGIN
    UPDATE player SET updated_at = CURRENT_TIMESTAMP
    WHERE race_type = NEW.race_type AND player_no = NEW.player_no;
END;
