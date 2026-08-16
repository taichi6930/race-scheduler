-- Migration 0019: raceのrace_type+location_code+date_timeの複合インデックス追加（PERF-042）
--
-- fetchでは race_type（等価IN）・location_code（等価IN、locationList指定時）を
-- 絞り込んだうえで date_time（範囲BETWEEN）をさらに絞る、という組み合わせが多いが、
-- 既存の idx_race_type_date_time は location_code を含まないため locationList
-- 指定時はインメモリフィルタ頼りになっていた。
--
-- 列順は「等価条件（race_type, location_code）を範囲条件（date_time）より前」に
-- 置く（SQLiteは複合インデックスで、先頭から連続する等価条件までしかインデックスの
-- 絞り込みに使えず、範囲条件以降の列は絞り込みには使われないため）。
CREATE INDEX IF NOT EXISTS idx_race_race_type_location_code_date_time
ON race (race_type, location_code, date_time);
