-- data_quality_warning_log テーブル: データ品質警告の蓄積ログ
--
-- API側のマッピング処理（例: PlaceRepository.fetch でスキーマ検証に失敗した行を
-- スキップする際）が、リクエストを失敗させずにログするだけでなく、後から
-- まとめて確認できるよう記録するためのテーブル。api Worker の scheduled ハンドラ
-- （既存の Cloudflare エラー監視と同じ1時間おきcron）がこのテーブルを直近ウィンドウ
-- （時間範囲）でCOUNTし、1件以上あればGitHub Issueを作成/追記、0件なら
-- （既存Issueがあれば）Closeする。
--
-- source はどの箇所からの記録かを識別する（例: 'place_mapper'）。将来同様の
-- スキップ処理を他のマッパー（race_mapper 等）にも展開する際、同じテーブル・
-- 同じ通知ロジックを source 違いで再利用できるようにする狙い。
--
-- 行の削除は行わない（時間ウィンドウでの集計のみに使うため、古い行はそのまま
-- 履歴として残ってよい。将来的に肥大化が問題になれば別途保持期間ポリシーを検討する）。
CREATE TABLE IF NOT EXISTS data_quality_warning_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_quality_warning_log_created_at ON data_quality_warning_log(created_at);
CREATE INDEX IF NOT EXISTS idx_data_quality_warning_log_source ON data_quality_warning_log(source);
