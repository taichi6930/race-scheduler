-- player_keirin テーブル: 競輪固有の選手属性（期別・府県）
-- aidlc-docs/inception/application-design/keirin-player-data-design.md §4.3 参照
--
-- race_stage/race_conditionと同じ「競技によって有無が変わる兄弟テーブル」の
-- 流儀に合わせ、EAVではなく競技固有の列を持つテーブルとして分離する
-- （属性数が事前に判明していて固定であり、型安全規約とEAVが衝突するため）。
-- race_type はKEIRIN固定のため列を持たない。
-- スクレイピング（scraping）が所有し、再取得のたびに上書きされてよい。
CREATE TABLE IF NOT EXISTS player_keirin (
    player_no TEXT NOT NULL PRIMARY KEY,
    term INTEGER NOT NULL,
    branch TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_player_keirin_updated_at
AFTER UPDATE ON player_keirin
FOR EACH ROW
BEGIN
    UPDATE player_keirin SET updated_at = CURRENT_TIMESTAMP
    WHERE player_no = NEW.player_no;
END;
