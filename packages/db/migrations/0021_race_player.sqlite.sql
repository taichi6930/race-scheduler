-- race_player テーブル: 出走表のスナップショット（レースに誰が出走したか）
-- aidlc-docs/inception/application-design/keirin-player-data-design.md 参照
--
-- race_player_id は raceId + carNumber(2桁) の合成ID（composeRacePlayerId）。
-- 枠番ではなく車番で合成するのは、枠番はrowspanで複数車が共有し一意性が
-- 無いため（車番はレース内で必ず一意）。
-- player_name は出走表に印字されていた時点のスナップショットを保存する
-- （改姓等があっても、当時のレースには当時の名前が残る設計）。
-- race/race_stage/race_conditionと同様、スクレイピング（scraping）が所有し、
-- 再取得のたびに上書き・削除されてよい。
CREATE TABLE IF NOT EXISTS race_player (
    race_player_id TEXT NOT NULL PRIMARY KEY,
    race_id TEXT NOT NULL,
    race_type TEXT NOT NULL,
    car_number INTEGER NOT NULL,
    frame_number INTEGER NOT NULL,
    player_no TEXT NOT NULL,
    player_name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 「この選手が出走するレース」の逆引き（注目レース判定の主クエリ）
CREATE INDEX IF NOT EXISTS idx_race_player_player
ON race_player (race_type, player_no, race_id);

-- race_id単位での絞り込み・削除（staleRacePruner連動）用
CREATE INDEX IF NOT EXISTS idx_race_player_race_id
ON race_player (race_id);

CREATE TRIGGER IF NOT EXISTS trg_race_player_updated_at
AFTER UPDATE ON race_player
FOR EACH ROW
BEGIN
    UPDATE race_player SET updated_at = CURRENT_TIMESTAMP
    WHERE race_player_id = NEW.race_player_id;
END;
