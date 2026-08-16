-- Migration 0035: race_stage の確定/未確定フラグ追加
-- ステージテキストが stageByWebSite の既知マスタに一致しなかった行（原文ママの
-- 仮登録）を判別するためのフラグ。0034_race_is_confirmed.sqlite.sql と異なり、
-- 既存行はすべてマスタ一致済みのデータのため、事後 UPDATE によるバックフィルは
-- 不要（DEFAULT 1 のみでよい）。
--
-- ROLLBACK: 本マイグレーションは列追加のみ（UPDATEを伴わない）ため、
--   ALTER TABLE race_stage DROP COLUMN is_confirmed; で単純に巻き戻せる。
ALTER TABLE race_stage ADD COLUMN is_confirmed INTEGER NOT NULL DEFAULT 1;
