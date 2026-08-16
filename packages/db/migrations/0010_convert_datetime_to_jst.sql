-- Migration 0010: date_time カラムを UTC → JST ISO 8601 形式に変換
-- 変換前: 2026-01-31T15:00:00.000Z（UTC）
-- 変換後: 2026-02-01T00:00:00+09:00（JST）
--
-- SQLite の DATETIME は文字列として保存されているため、
-- UTC の末尾 'Z' を検出して +09:00 のオフセットを適用する。
-- すでに +09:00 形式のデータはスキップする。
--
-- ROLLBACK: 変換後は「元々Z形式だった行」と「元から+09:00形式だった行」を
--   区別する情報が失われるため、UPDATEによる巻き戻しは行えない。戻す場合は
--   バックアップからのリストアのみ（README.md「破壊的マイグレーション追加時の
--   運用ルール」参照）。

-- ====================
-- place テーブル
-- ====================
UPDATE place
SET date_time = strftime('%Y-%m-%dT%H:%M:%S+09:00',
    datetime(
        REPLACE(date_time, 'Z', ''),
        '+9 hours'
    )
),
updated_at = CURRENT_TIMESTAMP
WHERE date_time LIKE '%Z';

-- ====================
-- race テーブル
-- ====================
UPDATE race
SET date_time = strftime('%Y-%m-%dT%H:%M:%S+09:00',
    datetime(
        REPLACE(date_time, 'Z', ''),
        '+9 hours'
    )
),
updated_at = CURRENT_TIMESTAMP
WHERE date_time LIKE '%Z';
