-- player_autorace テーブル: オートレース固有の選手属性（拠点/LG）
-- aidlc-docs/inception/application-design/keirin-player-data-design.md §4.3 参照
-- （「他競技を載せるときは player_jra / player_boatrace を同様に追加する」の方針に従い、
-- KEIRIN向けに設計されたplayer_keirinと同型の兄弟テーブルとしてAUTORACE向けに追加する）
--
-- race_stage/race_conditionと同じ「競技によって有無が変わる兄弟テーブル」の
-- 流儀に合わせ、EAVではなく競技固有の列を持つテーブルとして分離する。
-- race_type はAUTORACE固定のため列を持たない。
-- AUTORACEの出走表HTMLには期別に相当する情報が無いため、term列は持たない
-- （player_keirinとの違い）。
-- スクレイピング（scraping）が所有し、再取得のたびに上書きされてよい。
CREATE TABLE IF NOT EXISTS player_autorace (
    player_no TEXT NOT NULL PRIMARY KEY,
    branch TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_player_autorace_updated_at
AFTER UPDATE ON player_autorace
FOR EACH ROW
BEGIN
    UPDATE player_autorace SET updated_at = CURRENT_TIMESTAMP
    WHERE player_no = NEW.player_no;
END;
