-- player_history テーブル: 選手属性の変更を検知したときだけ追記するログ
-- aidlc-docs/inception/application-design/keirin-player-data-design.md §4.5 参照
--
-- 追記専用（消さない）。observed_atは変更を検知したスクレイピング日時、
-- sourceは情報源（既定はoddspark）。
-- 将来、遡及的な情報を持つ情報源（公式選手名簿等）が加わったら、この表に
-- valid_from/valid_toを追加してバイテンポラルへ移行できる余地を残す
-- （既存行はvalid_from=observed_atとみなせるため、データを壊さず移行できる）。
CREATE TABLE IF NOT EXISTS player_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    race_type TEXT NOT NULL,
    player_no TEXT NOT NULL,
    attribute TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    observed_at DATETIME NOT NULL,
    source TEXT NOT NULL DEFAULT 'oddspark',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_player_history_player
ON player_history (race_type, player_no, observed_at);
