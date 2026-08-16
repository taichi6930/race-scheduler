# Security Policy

## Supported Versions

セキュリティ対応は以下のバージョンで提供します。

| Version        | Status               | セキュリティ対応   |
| -------------- | -------------------- | ------------------ |
| 0.1.x (latest) | 開発版（Beta/Alpha） | :white_check_mark: |
| < 0.1          | 非推奨               | :x:                |

> `package.json` の `version` は現在 `0.y.z` 系列（1.0.0 未リリース）。GA（`1.x.x`）に到達したら
> 本表を更新し、`0.y.z` 系列の扱いをそのタイミングで見直す。

## Security Update Policy

- **通常のアップデート**: 随時リリース
- **セキュリティ修正**: Dependabot による自動検知 → 自動で PR 作成 → レビュー後マージ
- **クリティカル脆弱性**: 緊急対応

## Dependency Management

- `Dependabot` により依存パッケージを 24 時間ごとに監視
- セキュリティアラート検知時は自動で修正 PR を作成
- CI/CD パイプラインで全テスト合格を確認後にマージ

## Security Practices

### 開発時

- TypeScript + ESLint による厳密な型チェック（`any` 禁止）
- Pre-commit フック: 型チェック・Lint・フォーマット検証

### 本番環境

- HTTPS 強制（Cloudflare Workers）
- CORS ポリシー設定
- Cloudflare DDoS 保護
- 入力値検証（Zod による型検証）
- ログのサニタイズ（機密情報を除外）

## Reporting a Vulnerability

セキュリティ脆弱性を発見した場合：

1. **報告方法**: GitHub Security Advisory で報告してください
    - リポジトリ → Security tab → "Report a vulnerability"

2. **対応フロー**:
    - 24 時間以内: 初期確認と返信
    - 修正版公開後: 脆弱性情報を公開（30 日以内）

## Known Security Issues

**サービス間認証（J-1）は実装完了済み**（全 Worker が `X-Service-Auth-Token` による
deny-by-default 認証で保護されている。契約は [`docs/specs/SPEC-API-001.md`](./docs/specs/SPEC-API-001.md)
が `status: active` として管理）。Web Push 購読の所有権検証（J-4）を含む残タスクは
継続対応中です。個別の未修正項目の詳細は、悪用を助長しないよう本ファイルには記載せず、
GitHub Security Advisory（非公開）で管理しています。

強化の設計と実装計画は公開しています（修正方法の共有は透明性として有益なため）:

- [`aidlc-docs/inception/application-design/service-auth-design.md`](./aidlc-docs/inception/application-design/service-auth-design.md)
  — サービス間認証の設計（実装完了）
- [`aidlc-docs/inception/application-design/push-ownership-design.md`](./aidlc-docs/inception/application-design/push-ownership-design.md)
  — Web Push 購読の所有権検証（対応中）
- [`docs/specs/SPEC-API-001.md`](./docs/specs/SPEC-API-001.md) — 認証の契約（仕様レジストリ）
- 残タスクの一覧は [`docs/tasks/BACKLOG.md`](./docs/tasks/BACKLOG.md) §J（セキュリティ）を参照

## Security Findings の取り扱い方針

本リポジトリは公開されています。セキュリティ上の指摘を記録する際は次に従ってください。

- **未修正の脆弱性の再現手順・悪用可能性の具体は、公開ファイル（README / BACKLOG / Issue 等）に書かない。**
  GitHub Security Advisory の非公開ドラフトに置く。
- 公開バックログ（`docs/tasks/BACKLOG.md` §J）には **ID・区分・対応状況のみ**を残す。
- 修正方法を記した設計ドキュメントの公開は問題ない。ただし
  **実トークン値・実際の内部ホスト名・攻撃手順は書かない**。

---

**最終更新**: 2026 年 7 月 29 日
