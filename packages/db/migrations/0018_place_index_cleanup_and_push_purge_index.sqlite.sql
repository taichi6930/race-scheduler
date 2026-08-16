-- Migration 0018: placeの重複インデックス削除（PERF-097）・
-- push_notification_request.purgeOld用インデックス追加（PERF-098）

-- idx_place_race_type_date_time_location_code は idx_place_unique_race_type_date_time_location_code
-- （UNIQUE制約）と列構成が完全一致しており、一意性チェックを担うUNIQUE側だけで
-- 検索用途も兼ねられるため、書き込みコストのみ増やしていた非UNIQUE側を削除する。
DROP INDEX IF EXISTS idx_place_race_type_date_time_location_code;

-- purgeOld は fire_at_ms のみでWHEREするが、既存の複合インデックスは
-- 先頭列が sent_at のためprefixとして使えずフルスキャンになっていた。
-- fire_at_ms を先頭にしたインデックスを追加する。
CREATE INDEX IF NOT EXISTS idx_push_notification_request_fire_at_ms
ON push_notification_request (fire_at_ms);
