-- Migration 0012: NAR の location_code を1桁から2桁（ゼロ埋め）に統一
-- 変換前: '1', '2', '3', '4', '7', '8' など1桁
-- 変換後: '01', '02', '03', '04', '07', '08' など2桁
--
-- LocationCodeSchema が /^\d{2}$/ を要求するが、
-- NAR の一部コードが1桁のままDBに保存されていたため
-- place / race テーブルの両方を修正する。
--
-- '1' と '01' が同じ (race_type, date_time) で混在する場合があるため、
-- 先に1桁の重複レコードを削除してからフォーマット変換を行う。
--
-- ROLLBACK: 重複行のDELETEを伴うため元の行数に戻せず、UPDATEによる巻き戻しも
--   「元が1桁だった行」の情報が失われるため不可能。戻す場合はバックアップ
--   からのリストアのみ（README.md「破壊的マイグレーション追加時の運用ルール」参照）。

-- ====================
-- place テーブル: 2桁版が既に存在する1桁レコードを削除
-- ====================
DELETE FROM place
WHERE race_type = 'nar'
  AND length(location_code) = 1
  AND location_code GLOB '[0-9]'
  AND EXISTS (
    SELECT 1 FROM place p2
    WHERE p2.race_type = place.race_type
      AND p2.date_time = place.date_time
      AND p2.location_code = printf('%02d', CAST(place.location_code AS INTEGER))
  );

-- ====================
-- place テーブル: 残りの1桁 location_code をゼロ埋め
-- ====================
UPDATE place
SET location_code = printf('%02d', CAST(location_code AS INTEGER)),
    updated_at    = CURRENT_TIMESTAMP
WHERE race_type = 'nar'
  AND length(location_code) = 1
  AND location_code GLOB '[0-9]';

-- ====================
-- race テーブル: 2桁版が既に存在する1桁レコードを削除
-- ====================
DELETE FROM race
WHERE race_type = 'nar'
  AND length(location_code) = 1
  AND location_code GLOB '[0-9]'
  AND EXISTS (
    SELECT 1 FROM race r2
    WHERE r2.race_type = race.race_type
      AND r2.date_time = race.date_time
      AND r2.location_code = printf('%02d', CAST(race.location_code AS INTEGER))
  );

-- ====================
-- race テーブル: 残りの1桁 location_code をゼロ埋め
-- ====================
UPDATE race
SET location_code = printf('%02d', CAST(location_code AS INTEGER)),
    updated_at    = CURRENT_TIMESTAMP
WHERE race_type = 'nar'
  AND length(location_code) = 1
  AND location_code GLOB '[0-9]';
