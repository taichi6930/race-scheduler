-- Migration 0027: batch実行の排他制御用ロックテーブル追加（CICD-73/CONC-03）
-- batch-all（cron）とbatch-race/place/calendar（手動）の4つの起動経路が
-- Cloudflare Workflowsに統一されるにあたり、従来GitHub Actionsの
-- concurrencyグループが担っていた「同時に1つしか実行しない」制約を
-- D1の単一行ロックで代替する。
-- id=1の1行のみを許可し、workflow_instance_idがNULLのときだけ空き扱いとする。
CREATE TABLE batch_run_lock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workflow_instance_id TEXT,
    started_at TEXT
);

INSERT INTO batch_run_lock (id, workflow_instance_id, started_at)
VALUES (1, NULL, NULL);
