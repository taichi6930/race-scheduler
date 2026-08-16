-- Migration: 0009_delete_invalid_nar_data.sql
-- Purpose: Delete invalid NAR data where location_code >= 35
-- Note: D1 does not support explicit transactions, each DELETE is executed independently
-- ROLLBACK: 破壊的（DELETE）。削除した行の値は失われるため、バックアップからの
--   リストアのみで戻せる（README.md「破壊的マイグレーション追加時の運用ルール」参照）。

-- Delete from race_condition for invalid NAR races
DELETE FROM race_condition
WHERE race_id IN (
  SELECT race_id FROM race
  WHERE LOWER(race_type) = 'nar' 
    AND (CAST(location_code AS INTEGER) >= 35 OR CAST(SUBSTR(race_id, -4, 2) AS INTEGER) >= 35)
);

-- Delete from race_stage for invalid NAR races
DELETE FROM race_stage
WHERE race_id IN (
  SELECT race_id FROM race
  WHERE LOWER(race_type) = 'nar'
    AND (CAST(location_code AS INTEGER) >= 35 OR CAST(SUBSTR(race_id, -4, 2) AS INTEGER) >= 35)
);

-- Delete from race table
DELETE FROM race
WHERE LOWER(race_type) = 'nar'
  AND (CAST(location_code AS INTEGER) >= 35 OR CAST(SUBSTR(race_id, -4, 2) AS INTEGER) >= 35);

-- Delete from place_grade for invalid NAR places
DELETE FROM place_grade
WHERE place_id IN (
  SELECT place_id FROM place
  WHERE LOWER(race_type) = 'nar' AND CAST(location_code AS INTEGER) >= 35
);

-- Delete from place_held_day for invalid NAR places
DELETE FROM place_held_day
WHERE place_id IN (
  SELECT place_id FROM place
  WHERE LOWER(race_type) = 'nar' AND CAST(location_code AS INTEGER) >= 35
);

-- Delete from place table
DELETE FROM place
WHERE LOWER(race_type) = 'nar' AND CAST(location_code AS INTEGER) >= 35;
