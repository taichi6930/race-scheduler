# race-scheduler

公営競技（JRA・NAR・海外競馬・競輪・オートレース・競艇）のレース情報を取得し、Google Calendar へ同期する Cloudflare Workers ベースのモノレポです。フロントエンド（Flutter）でタイムライン・カレンダー表示、お気に入り登録・発走前通知にも対応するほか、運用者向け管理画面（バックフィル実行・機能フラグ管理・レース詳細レイアウト編集）も提供します。

## クイックスタート

```bash
bun install

# メインAPIをローカルWranglerで起動（ローカルD1使用）
cd packages/api && bun run dev:local
```

`api` は `http://localhost:8787` で利用できます。サービス間認証（`SERVICE_AUTH_TOKEN`）の
設定を含む詳細な手順は [`packages/api/SETUP.md`](packages/api/SETUP.md) を参照してください。

## PR前に何を実行するか

CIが lint / type-check / カバレッジ100%判定まで一通り検証するため、ローカルでは
変更箇所の動作確認（`bun test <file>` 等）だけで十分です。全体の網羅的な検証は
CIに任せてください（詳細方針は [`.claude/docs/ci-conventions.md`](.claude/docs/ci-conventions.md)）。

- `bun run lint:fix` — フォーマット・大半のlintルールの自動修正（Biome + ESLint）
- `bun run type-check` — TypeScriptの型チェック
- `bun run verify` — 上記に加えて全パッケージのテストを実行（CIと同等のフル検証。手元では
  時間がかかるため通常は不要、CIに任せてよい）
- その他の `check:*` スクリプト（循環依存・未使用コード・デザインレイヤー違反等）は
  `package.json` の `scripts` を参照

## ドキュメント

このリポジトリのドキュメントは役割ごとに分かれています。**同じ事実を複数箇所に書かない**方針のため、目的に応じて参照先を使い分けてください。

| 知りたいこと | 参照先 |
| --- | --- |
| プロダクト概要・技術スタック・API仕様・DBスキーマ・テスト戦略・セキュリティ | [`docs/README.md`](docs/README.md) |
| パッケージ構成・アーキテクチャ・開発フロー・Gitフロー・デプロイフロー・環境変数管理 | [`packages/README.md`](packages/README.md) |
| 各パッケージ（admin/api/batch/calendar/core/db/front）固有の詳細 | `packages/<pkg>/README.md`（例: [`packages/admin/README.md`](packages/admin/README.md)） |
| プロダクト仕様のうちテストと紐づけて検証したいもの | [`docs/specs/`](docs/specs/README.md) |
| セキュリティポリシー・脆弱性報告 | [`SECURITY.md`](SECURITY.md) |
| 貢献方法・PR運用のルール | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## 不具合・要望の連絡先

アプリの不具合や機能要望は [GitHub Issues](https://github.com/taichi6930/race-scheduler/issues/new/choose) から報告してください（脆弱性報告は公開Issueではなく [`SECURITY.md`](SECURITY.md) の手順に従ってください）。

## パッケージ構成（概要）

```
packages/
├── core/       # 共有ドメインモデル・ユーティリティ（全パッケージが依存）
├── api/        # メインAPI（Cloudflare Workers + D1）
├── admin/      # 運用者向け管理画面（Cloudflare Workers）
├── batch/      # バッチ処理オーケストレーション（api を含む他Workerと連携）
├── calendar/   # Google Calendar同期ワーカー（Cloudflare Workers）
├── db/         # データベーススキーマ・マイグレーション管理
└── front/      # フロントエンドアプリケーション（Flutter）
```

詳細は [`packages/README.md`](packages/README.md#パッケージ構成) を参照。
