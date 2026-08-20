-- Migration 0040: player_watch（注目選手）を user 単位のデータへ変更（段階2）
--
-- これまでは全員共通の1セットだった注目選手を、招待された各ユーザーが個別に
-- 持てるようにする。SQLiteはPRIMARY KEYの変更をALTER TABLEでサポートしないため、
-- 標準の「新テーブル作成→コピー→旧テーブル削除→リネーム」手順で行う。
--
-- 【重要・データ影響】このマイグレーションは user テーブル導入前に存在した
-- 既存の player_watch 行を引き継がない（そもそも紐付けるべき user_id が存在しない
-- ため、機械的な引き継ぎ先を用意できない）。0039で自分自身も招待経由で登録し直す
-- 運用のため、影響は「これまで登録していた注目選手を登録し直す」程度に留まる
-- （priorityの再設定のみで済み、他データへの影響は無い）。
--
-- ROLLBACK: user_id列を除いた (race_type, player_no) PKの旧テーブルに戻す場合は
--   本マイグレーションと逆の手順（新テーブル作成→コピー(user_idを無視)→
--   旧テーブル削除→リネーム）を行う。

CREATE TABLE player_watch_new (
    user_id TEXT NOT NULL REFERENCES user(id),
    race_type TEXT NOT NULL,
    player_no TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 10,
    label TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, race_type, player_no)
);

DROP TABLE IF EXISTS player_watch;
ALTER TABLE player_watch_new RENAME TO player_watch;

-- 注目レース導出クエリ（user_id指定 + priority > 0 での絞り込み）用
CREATE INDEX IF NOT EXISTS idx_player_watch_priority
ON player_watch (priority);

CREATE TRIGGER IF NOT EXISTS trg_player_watch_updated_at
AFTER UPDATE ON player_watch
FOR EACH ROW
BEGIN
    UPDATE player_watch SET updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id AND race_type = NEW.race_type AND player_no = NEW.player_no;
END;
