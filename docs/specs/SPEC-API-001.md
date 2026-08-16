---
id: SPEC-API-001
title: 書き込み系・Worker間エンドポイントはサービス間認証を必須とし、公開は明示指定のみ許す
status: active
raceType: all
requires:
    - UT
    - Component
    - UAT
targets:
    - packages/core/src/http/serviceAuth.ts
    - packages/core/src/http/serviceAuthMiddleware.ts
    - packages/core/src/utilities/timingSafeEqual.ts
    - packages/api/src/router.ts
    - packages/scraping/src/router.ts
    - packages/calendar/src/router.ts
    - packages/batch/src/router.ts
owner: core
related:
    - aidlc-docs/inception/application-design/service-auth-design.md
---

## 仕様

すべての Worker（api / scraping / calendar / batch）の HTTP エンドポイントは、
**既定でサービス間認証を必須とする（deny-by-default）**。認証を免除するのは、
各 Worker の router に**理由付きで明示列挙されたルートのみ**とする。

### 認証の判定

1. リクエストの `X-Service-Auth-Token` ヘッダの値を取り出す。
2. 環境変数 `SERVICE_AUTH_TOKEN`（現行）と比較する。一致すれば通過。
3. 一致しない場合、`SERVICE_AUTH_TOKEN_PREVIOUS`（ローテーション期間中のみ設定される）と
   比較する。一致すれば通過。
4. いずれとも一致しない場合、`401 Unauthorized` を返す。

### 満たすべき性質

- **フェイルクローズ**: `SERVICE_AUTH_TOKEN` が未設定の場合、
  すべての保護対象リクエストを拒否する（「未設定なら素通し」にしない）。
- **定数時間比較**: トークンの比較は、一致した先頭バイト数や文字列長が
  実行時間に漏れない方法で行う。
- **情報を漏らさない応答**: 401 応答の本文に、拒否の理由
  （トークン未設定・不一致・免除リストの内容など）を含めない。
- **ログにトークンを残さない**: 認証失敗をログに記録する際、
  提示されたトークン値を出力しない。
- **免除は理由付きで明示**: 免除ルートは `method` / `path` / `reason` の組で宣言する。

### 免除区分（reason）

| reason | 意味 |
| --- | --- |
| `front-public` | ブラウザ（front）が呼ぶため秘密を持たせられない |
| `monitoring` | 監視・ヘルスチェック |
| `static-docs` | 静的なドキュメント応答 |
| `cors-preflight` | OPTIONS プリフライト |
| `has-own-auth` | 別の認証機構を既に持つ |
| `pending-user-auth` | ユーザー単位の認可へ移行予定（`push-ownership-design.md`） |

## 受け入れ基準

- 保護対象ルートを正しいトークン付きで呼ぶと処理が実行される。
- 保護対象ルートをトークン無しで呼ぶと 401 が返る。
- 保護対象ルートを誤ったトークンで呼ぶと 401 が返る。
- `SERVICE_AUTH_TOKEN` が未設定の環境では、保護対象ルートが 401 を返す（フェイルクローズ）。
- `SERVICE_AUTH_TOKEN_PREVIOUS` が設定されている間は、旧トークンでも通過する。
- 免除ルート（`GET /health`、front が呼ぶ GET 系など）はトークン無しで通過する。
- OPTIONS プリフライトが認証で拒否されない（CORS が壊れない）。
- 401 応答の本文に拒否理由が含まれない。
- 認証失敗ログに提示トークン値が含まれない。
- **各 Worker に登録されている全ルートが、「免除リストに載っている」か
  「保護対象である」かのいずれかに分類される**（新規ルートの分類漏れを検出する）。
- デプロイ済み環境に対し、保護対象ルートがトークン無しで 401 を返す（UAT）。

## 適合状況（Conformance）

- 2026-07-26 ❌未適合（設計のみ）: 実装未着手。現状は
  `POST /push/dispatch` を除く全エンドポイントが無認証
  （`docs/tasks/BACKLOG.md` §J-1、SEC-001/002/003/004/005/006/030）。
  実装手順は `aidlc-docs/inception/application-design/service-auth-design.md` §5〜§6。
  実装完了時に `status` を `active` に変更し、本欄へ適合所見を追記すること。
- 2026-07-28 ✅適合: Stage 1〜3（SECAUTH-01〜10）の実装により、api / scraping /
  calendar / batch 全 Worker に `requireServiceAuth`（deny-by-default）を適用済み。
  免除ルートは各 router の `SERVICE_AUTH_EXEMPT_ROUTES` に理由付きで明示列挙し、
  「登録済み全ルートが免除リスト/保護対象のいずれかに分類されること」を検証する
  回帰テストを各 Worker の router UT に追加（新ルート追加時の分類漏れを検知）。
  フェイルクローズ・定数時間比較・401本文の理由非開示・ログへのトークン非出力は
  `packages/core/test/unittest/http/{serviceAuth,serviceAuthMiddleware}.test.ts` で
  検証済み。UAT smoke（`tests/uat/smoke/{scraping,calendar}.test.ts`）で
  デプロイ済み環境に対する認証必須化（ヘッダ無し401）も確認する。
  Stage 4（SECAUTH-11）で `BATCH_API_KEY`/`BATCH_SERVICE_URL` を削除し、
  `POST /push/dispatch` の既存トークン比較も `timingSafeEqualString` ベースへ統一した。
