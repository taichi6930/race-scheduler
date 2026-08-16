-- Migration 0014: レース情報取得可否カラム追加
-- 開催場・開催日ごとに、レース一覧（RaceList）へのリンクが張られているか
-- （= レース情報を取得可能か）を管理する。主に NAR の月間開催ページ由来。
-- NULL のまま（非該当・レガシーデータ）は「非該当」を表す。
ALTER TABLE place ADD COLUMN is_race_list_available INTEGER;

-- 検索性能向上用インデックス
CREATE INDEX IF NOT EXISTS idx_place_is_race_list_available ON place(is_race_list_available);
