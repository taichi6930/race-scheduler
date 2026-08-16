-- Migration 0020: place_held_day の未使用インデックス削除（PERF-058）
-- held_times/held_day_times はコードベース全体でSELECT列挙・UPSERT書き込みにのみ使われ
-- WHERE/ORDER BYでの絞り込みには一度も使われていない（0017と同型の書き込みコストのみ問題）。
DROP INDEX IF EXISTS idx_place_held_day_held_times;
DROP INDEX IF EXISTS idx_place_held_day_held_day_times;
