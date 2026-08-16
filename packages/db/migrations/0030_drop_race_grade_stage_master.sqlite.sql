-- Migration 0030: 未使用のレースグレード・ステージマスタテーブルを削除
-- race_grade_stage_master / race_grade_stage_master_website は
-- 0013で追加されたが、一度もINSERTのseedが行われず、かつ唯一の読み取り元
-- （scraping WorkerのgetRaceGradeAndStageList）にはD1バインディング自体が
-- 存在しなかったため、常にTS定数へフォールバックし続ける実質デッドコードだった
-- （docs/tasks/TASK_LIST.md #115参照）。TS定数（packages/core/src/domain/master/）を
-- 唯一の正典とすることを確定し、使われていないD1側のテーブルを削除する。
DROP TABLE IF EXISTS race_grade_stage_master_website;
DROP TABLE IF EXISTS race_grade_stage_master;
