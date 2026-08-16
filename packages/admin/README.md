# Admin Worker

運用者本人1人だけが使う管理画面（機能フラグ管理など）専用の Cloudflare Worker です。Cloudflare Access（Zero Trust、ダッシュボード側で手動設定）によりホスト名全体が保護されており、許可したメールアドレス以外はホスト名にすら到達できません。

D1・R2 等のストレージには直接アクセスせず、メインAPI（`@race-schedule/api`）の `/internal/feature-flags` をサービス間認証（`X-Service-Auth-Token`）付きで呼び出すプロキシとして機能します。今後、他の管理系機能を追加する場合もこのパッケージへルートを足していく想定です。

設計の背景は [admin-package-design.md](../../aidlc-docs/inception/application-design/admin-package-design.md) を参照してください。

## エンドポイント

このWorker自身は追加の認証を行いません（Cloudflare Accessによる保護が前提のため）。

### GET /health

ヘルスチェック用エンドポイント。

```bash
curl "http://localhost:8790/health"
```

### GET /flags

機能フラグ管理画面のHTML。

### GET /flags/api

登録済み機能フラグの状態一覧をJSONで返す。

### POST /flags/api

指定した機能フラグの値を更新する。

**リクエストボディ:**

```json
{
    "key": "announcement_banner",
    "enabled": true
}
```

## アーキテクチャ

```
Controller層  → HTTPリクエスト/レスポンス処理（GET /flags、GET/POST /flags/api）
    ↓
Usecase層     → FeatureFlagsUsecase（フラグの取得・更新オーケストレーション）
    ↓
Repository層  → MainApiRepository（メインAPIから機能フラグを取得・更新）
    ↓
Gateway層     → MainApiGateway（メインAPIとのHTTP通信）
```

`api`/`calendar` と同じレイヤードアーキテクチャ・tsyringe による DI パターンを踏襲しています。**Usecase は Gateway を直接呼ばず、必ず Repository を経由します**（controller → usecase → repository → gateway の順序。詳細は [.claude/docs/coding-conventions.md](../../.claude/docs/coding-conventions.md) の「レイヤー依存の順序」）。

## ローカル開発

```bash
bun run dev
```

## デプロイ

```bash
bun run deploy:test
bun run deploy:production
```

development環境は対象外です（[admin-package-design.md](../../aidlc-docs/inception/application-design/admin-package-design.md) §2.4参照）。

## 環境変数

| 変数名                | 説明                                              |
| ---------------------- | ------------------------------------------------- |
| `MAIN_API_URL`          | メインAPI（`@race-schedule/api`）のベースURL      |
| `SERVICE_AUTH_TOKEN`    | サービス間認証の共有シークレット（apiと同じ値）    |

セットアップ手順は [SETUP.md](SETUP.md) を参照してください。

## テスト

```bash
bun test
bun test --coverage
```
