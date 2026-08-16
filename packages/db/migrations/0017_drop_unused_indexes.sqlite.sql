-- Migration 0017: 未使用インデックスの削除（PERF-099/100）
-- どちらのカラムもコードベース全体でWHERE/ORDER BYに使われておらず
-- （SELECT列挙・UPSERT時の書き込みのみ）、書き込みコストのみ発生させていたため削除する。
DROP INDEX IF EXISTS idx_player_priority;
DROP INDEX IF EXISTS idx_place_is_race_list_available;
