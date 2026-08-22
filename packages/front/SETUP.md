# Frontend Setup Guide

このドキュメントは、@race-schedule/front のセットアップ手順を説明します。

## 前提条件

- Flutter 3.11.3 以上
- Dart 3.11.3 以上
- iOS: Xcode 14.0 以上（macOS 11 以上）
- Android: Android Studio + SDK 21 以上
- Web: Chrome / Firefox

## 開発環境セットアップ

### 1. パッケージのセットアップ

プロジェクトルートから依存パッケージをインストール：

```bash
cd packages/front
flutter pub get
```

### 2. コード生成

freezed と json_serializable を使用したコード生成：

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

### 3. 環境変数設定

`.env` ファイルを作成：

```bash
cp .env.example .env
```

ローカル開発用に API URL を設定：

```
API_BASE_URL=http://localhost:8787
```

### 4. APIサーバーの起動

別のターミナルで API サーバーを起動：

```bash
# packages/api ディレクトリ
cd ../api
bun run dev
```

これで API が `http://localhost:8787` で利用可能になります。

## 開発サーバーの起動

### iOS シミュレータで起動

```bash
flutter run -d iPhone
```

### Android エミュレータで起動

```bash
flutter run -d android
```

### Web（Chrome）で起動

```bash
flutter run -d chrome

# または
flutter run -d web-server
```

ブラウザが自動で起動し、`http://localhost:????` でアプリにアクセスできます。

**ルート `package.json` のショートカットを使う場合**: `bun run front:dev` は
deploy済みのtest環境API（`https://race-schedule-test.tn-product.workers.dev`）を
既定で参照する。test環境のCORS許可オリジンに `localhost:8080` が含まれていないため、
`--web-browser-flag "--disable-web-security"`（ブラウザのCORS検証を丸ごと無効化する
フラグ）を付けて回避している（QDEV-03）。ローカルAPI（上記手順4）へ向ける場合は、
CORS検証を無効化しない `bun run front:dev:local` を使うこと（ローカルAPIの既定CORS許可
オリジンに `localhost:8080` が含まれているため、フラグ無しで動作する）。

## ビルド

### Web ビルド（Cloudflare Pages 用）

```bash
flutter build web --release
```

ビルド結果は `build/web/` に出力されます。

#### 環境別アイコン（favicon / PWAアイコン）

`web/favicon.png` と `web/icons/Icon-*.png` は、どの環境で動いているか一目で分かるように環境ごとに色分けされている。実体は `web/icons/env/{production,test,development,local}/` に格納されており、CI（`deploy-front-reusable.yml`）がデプロイ対象環境に応じてビルド直前に本体へコピーする。

- **production**: リボン無し（本番用のクリーンなアイコン）
- **test**: オレンジの "TEST" リボン
- **development**: 緑の "DEV" リボン
- **local**: 紫の "LOCAL" リボン（`git checkout` 直後の既定値もこれ）

ローカルで別環境のアイコン見た目を確認したい場合は、`web/icons/env/<environment>/` の中身を手動で `web/favicon.png` / `web/icons/` へコピーすればよい（コミットはしないこと）。アイコンを再生成・調整したい場合は Chromium（Playwright）でHTML/CSSをスクリーンショットする方式で作成しているため、デザインソース（HTML/CSS）は本チケットの作業用に一時生成したものであり、リポジトリには生成済みPNGのみを保持している。

### iOS ビルド

```bash
flutter build ios --release
```

### Android ビルド

```bash
flutter build apk --release
# または
flutter build appbundle --release
```

## テスト

### ユニットテスト実行

```bash
flutter test
```

### 統合テスト実行

```bash
flutter test integration_test/
```

## Lintチェック

```bash
flutter analyze
```

## トラブルシューティング

### ポート競合エラー

開発サーバーがポート競合を起こす場合：

```bash
flutter run -d chrome --web-port 5175
```

### API接続エラー

以下を確認してください：

1. `.env` で `API_BASE_URL` が正しく設定されているか
2. バックエンド API が起動しているか
3. CORS 設定が適切か（API側の `CORS_ALLOWED_ORIGINS` を確認）

### パッケージが見つからない

コード生成をやり直す：

```bash
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
```

### ビルドエラー

キャッシュをクリア：

```bash
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
```

## 詳細ドキュメント

- [README.md](README.md) - パッケージ概要
- [ARCHITECTURE.md](ARCHITECTURE.md) - アーキテクチャ詳細
