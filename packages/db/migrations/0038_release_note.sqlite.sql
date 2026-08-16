-- release_note テーブル: 更新履歴（What's New画面）用のリリースノート
--
-- race-schedule（旧統合リポジトリ）のprivate化に伴い、front（WhatsNewScreen）が
-- GitHub Releases APIを匿名で直接fetchする既存方式では、private化後にrace-schedule側の
-- 過去リリース（v1.x）が参照できなくなる。GitHub Release自体は正の情報源として残すが、
-- frontが読む先はこのテーブル（DB経由のAPI）へ切り替える。
--
-- body には GitHub Release と同じMarkdown本文をそのまま保存する。front側の
-- パースロジック（release_note_parser.dart）はカテゴリ見出しをMarkdownから抽出する
-- 既存実装のままで動くため、frontのモデル・パース処理は変更不要（取得元のURLのみ変更）。
--
-- source_repo はどちらのリポジトリ由来か（'race-schedule' | 'race-scheduler'）を
-- 記録する。バックフィル・今後の運用いずれも `scripts/release/` から書き込む。
--
-- ROLLBACK: DROP TABLE IF EXISTS release_note;
-- tag_name は race-schedule / race-scheduler で独立採番されており重複しうる
-- （実例: 両リポジトリとも分割区切りとして v2.0.0 を採番している）ため、
-- 一意性は (tag_name, source_repo) の組で担保する（tag_name単体にはUNIQUEを付けない）。
CREATE TABLE IF NOT EXISTS release_note (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name TEXT NOT NULL,
    name TEXT,
    body TEXT,
    published_at TEXT,
    draft INTEGER NOT NULL DEFAULT 0,
    prerelease INTEGER NOT NULL DEFAULT 0,
    source_repo TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_release_note_tag_source ON release_note(tag_name, source_repo);
CREATE INDEX IF NOT EXISTS idx_release_note_published_at ON release_note(published_at);
