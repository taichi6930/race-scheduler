-- Migration 0011: タイムゾーンなし date_time を JST ISO 8601 形式に統一
-- 変換前: 2025-08-01 00:00:00（タイムゾーンなし、実質JST）
-- 変換後: 2025-08-01T00:00:00+09:00（JST ISO 8601）
--
-- 0010 では末尾 'Z'（UTC）のデータを +9h して変換したが、
-- スペース区切りの plain datetime もDBに存在する。
-- これらは既にJST日時なので時刻のシフトは不要、フォーマットのみ変換する。
--
-- ただし、同じ (race_type, location_code) の組み合わせで
-- plain 形式と +09:00 形式の両方が存在する重複レコードがあるため、
-- 先に plain 形式の重複を削除してからフォーマット変換を行う。
--
-- ROLLBACK: 重複行のDELETEを伴うため元の行数に戻せず、UPDATEによる巻き戻しも
--   「元がplain形式だった行」の情報が失われるため不可能。戻す場合はバックアップ
--   からのリストアのみ（README.md「破壊的マイグレーション追加時の運用ルール」参照）。

-- ====================
-- place テーブル: 重複する plain 形式のレコードを削除
-- ====================
DELETE FROM place
WHERE date_time LIKE '% %'
  AND EXISTS (
    SELECT 1 FROM place p2
    WHERE p2.race_type = place.race_type
      AND p2.location_code = place.location_code
      AND p2.date_time = REPLACE(place.date_time, ' ', 'T') || '+09:00'
  );

-- ====================
-- place テーブル: 残りの plain 形式を JST に変換
-- ====================
UPDATE place
SET date_time = REPLACE(date_time, ' ', 'T') || '+09:00',
    updated_at = CURRENT_TIMESTAMP
WHERE date_time NOT LIKE '%+09:00'
  AND date_time NOT LIKE '%Z'
  AND date_time LIKE '% %';

-- ====================
-- race テーブル: 重複する plain 形式のレコードを削除
-- ====================
DELETE FROM race
WHERE date_time LIKE '% %'
  AND EXISTS (
    SELECT 1 FROM race r2
    WHERE r2.race_type = race.race_type
      AND r2.date_time = REPLACE(race.date_time, ' ', 'T') || '+09:00'
  );

-- ====================
-- race テーブル: 残りの plain 形式を JST に変換
-- ====================
UPDATE race
SET date_time = REPLACE(date_time, ' ', 'T') || '+09:00',
    updated_at = CURRENT_TIMESTAMP
WHERE date_time NOT LIKE '%+09:00'
  AND date_time NOT LIKE '%Z'
  AND date_time LIKE '% %';
