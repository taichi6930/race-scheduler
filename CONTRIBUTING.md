# Contributing

このリポジトリへの貢献にあたって守るべき主要な決まりをまとめます。詳細は各リンク先を参照してください。

## ブランチ

- 作業用ブランチは必ず **`claude/` で始まる名前**を使ってください（例: `claude/fix-something`）。`fix/xxxx` のような他の prefix は使いません。
- `main` への直接コミットはしないでください。

## Pull Request

- PR は **bot（`race-schedule-bot`）が push を検知して自動的に draft として作成**します。`gh pr create` 等で手動作成しないでください。
- draft の間は主要な CI（lint・型チェック・テスト等）が起動しません。作業が完了したら ready for review に変更してください（この変更が実質的な CI 起動トリガーです）。
- PR には **semver ラベル**（`semver:none` / `semver:patch` / `semver:minor` / `semver:major`）を1つ付与してください。判定基準は [`.claude/skills/release-classification/SKILL.md`](.claude/skills/release-classification/SKILL.md) を参照してください。ラベルはPR本文に書くだけでは効果がなく、実際にGitHub上でラベル付与する必要があります。
- ユーザーに見える変更がある場合は、PR本文に更新履歴カテゴリ（`## 🔧 バックエンドのみ` 等）を記載してください。書式は [`.github/pull_request_template.md`](.github/pull_request_template.md) を参照してください。

## コーディング規約・テスト

- コーディング規約: [`.claude/docs/coding-conventions.md`](.claude/docs/coding-conventions.md)
- テスト記述規約: [`.claude/docs/testing-conventions.md`](.claude/docs/testing-conventions.md)
- CI 規約: [`.claude/docs/ci-conventions.md`](.claude/docs/ci-conventions.md)
- コミット前に `bun run lint` と `bun run type-check` を実行し、エラーがないことを確認してください。

## 脆弱性報告

セキュリティ上の問題は公開 Issue に書かず、[`SECURITY.md`](SECURITY.md) の手順に従って報告してください。

## AI エージェント向けの運用ルール

このリポジトリでは AI エージェント（Claude Code 等）による開発を前提とした詳細な運用ルールを [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) にまとめています。人間の貢献者が参考にする場合もこちらを参照してください。
