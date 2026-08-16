# @race-schedule/front

レーススケジュール管理のFlutterフロントエンドアプリケーション。
モバイル（iOS/Android）とWeb両対応。

## 環境構成

| 環境        | 用途                     | URL                                    |
| ----------- | ------------------------ | -------------------------------------- |
| development | ローカル開発             | http://localhost:8787                  |
| test        | テスト・ステージング環境 | 実URLは `package.json` の `front:dev` が渡す `--dart-define=API_BASE_URL` を参照 |
| production  | 本番環境                 | 実URLは各デプロイワークフロー（`.github/workflows/deploy-*.yml`）が渡す `API_BASE_URL` を参照 |

## アーキテクチャ

フィーチャー単位のレイヤードアーキテクチャ（`features/<name>/{application,presentation}`）
＋ 共通デザインシステム（`design/`）＋ Clean Architecture な Domain/Data 層。
詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照。

### レイヤー構成

- **features/\<name\>/presentation**: 画面・画面固有ウィジェット
- **features/\<name\>/application**: State Management (Riverpod)、フィルタ等のロジック
- **design/**: 色・タイポグラフィ・グレード階層判定・共通ウィジェット
- **notifications/**: レース開始前通知のスケジューリング（MVP）
- **Domain層**: ビジネスロジック、エンティティ、リポジトリインターフェース
- **Data層**: API通信、データ変換、リポジトリ実装

## 主な機能

- ✅ 全公営競技（中央競馬・地方競馬・海外競馬・競輪・オートレース・競艇）を
  発走時刻順の1本のタイムラインに統合表示
- ✅ 月カレンダー表示（重賞のグレード階層を色ドットでマーク）
- ✅ お気に入り登録・発走前通知（モバイルはローカル通知、Webは Web Push で本番稼働）
- ✅ 「重賞のみ」「★ お気に入り」の絞り込みチップ（既定は全開催表示）＋対象競技の個別トグル。
  フィルタ条件は `shared_preferences` でローカル永続化され、アプリ再起動後も保持される
- ✅ 旅程グループ（複数会場をセットで回る組み合わせ）の候補日検出（SPEC-TRIP-001）。
  メインAPI（`@race-schedule/api`）の `GET /place` から開催日を取得し、
  端末上で候補日をマッチングする（バックエンドに専用エンドポイントは無い）
- ✅ 型安全な State Management (Riverpod)

## ローカル開発

### セットアップ

```bash
# 依存パッケージをインストール
flutter pub get

# コード生成（freezed, json_serializable）
flutter pub run build_runner build
```

### 開発サーバー起動

```bash
# iOSシミュレータ
flutter run -d iPhone

# Androidエミュレータ
flutter run -d android

# Web
flutter run -d chrome
```

> **⚠️ セキュリティ注意（SEC-058）**: ルートの `package.json` にある `front:dev` /
> `front:widgetbook` スクリプト（`bun run front:dev` 等）は、上記の `flutter run -d chrome`
> に加えて Chrome を `--web-browser-flag "--disable-web-security"` フラグ付きで起動します。
> これは開発中のローカルAPI（`http://localhost:8787`）へCORS制約なしにアクセスするための
> 開発者端末限定の設定で、CI/本番ビルドには影響しません。ただし**同一オリジンポリシーを
> 無効化したこの Chrome プロファイルのまま一般のWebサイトを閲覧すると、XSS等の攻撃に対して
> 無防備になり危険**です。このプロファイルで通常のWeb閲覧をしないでください（別のブラウザ
> プロファイルを使う、または開発専用のブラウザ/プロファイルを用意することを推奨します）。

バックエンド（`packages/api`）に一切接続せず固定生成データだけでUIを確認したい場合は、
ルートの `package.json` にある `bun run front:mock`（`lib/main_mock.dart` を起動）が使える。
CORS制約のあるAPI呼び出しを行わないため `--disable-web-security` フラグは不要。

### ビルド

```bash
# Web ビルド（Cloudflare Pages 用）
flutter build web

# iOS ビルド
flutter build ios

# Android ビルド
flutter build apk
```

### モックモード（フロントエンド単体プレビュー）

バックエンド（`packages/api`）へ一切接続せず、固定生成データのみでアプリ全体
（タイムライン・カレンダー・お気に入り・旅程グループ・設定）を動作確認できる
エントリポイント。PRレビュー時にバックエンドを起動せずすぐに画面を確認したい
場合や、デザイン変更の見た目確認に使う。

```bash
# Web（推奨・ブラウザですぐ確認できる）
flutter run -t lib/main_mock.dart -d chrome

# iOSシミュレータ / Androidエミュレータでも同様に起動できる
flutter run -t lib/main_mock.dart -d iPhone
```

`lib/core/di/service_locator.dart` の `setupMockDependencies()` が、Repository
より下（Remote DataSource）だけを `lib/core/di/mock/` のフェイク実装へ差し替える。
Repository/UseCase/Provider/UI は本番と同じコードパスを通るため、フィルタ・
お気に入り・カレンダー集計・旅程グループ候補日検出まで含めて本番相当の挙動を
確認できる（過去30日・未来60日分のレース・開催会場データを起動時に決定論的に
生成）。個別ウィジェットの見た目だけを確認したい場合は
[`lib/widgetbook.dart`](lib/widgetbook.dart)（ウィジェットカタログ）も使える。
ローカル起動せずブラウザで見たい場合は、デプロイ済みの
[Widgetbook（https://race-schedule-widgetbook.pages.dev）](https://race-schedule-widgetbook.pages.dev)も利用できる。

## 環境変数

`.env` ファイルを作成：

```bash
cp .env.example .env
```

API URL を設定：

```
API_BASE_URL=http://localhost:8787
```

## デプロイ

### Cloudflare Pages (Web)

```bash
# Web をビルド
flutter build web

# Cloudflare Pages に deploy.yml でデプロイ（自動）
```

### モバイルアプリ

- iOS: App Store Connect を経由
- Android: Google Play Console を経由

## テスト

```bash
# ユニットテスト
flutter test

# 統合テスト
flutter test integration_test/
```

## 依存パッケージ

- `flutter_riverpod`: State Management
- `dio`: HTTP通信
- `freezed_annotation`: 不変クラス生成
- `json_serializable`: JSON シリアライゼーション
- `intl`: 日付フォーマット
- `shimmer`: ローディングUI
- `get_it`: Dependency Injection

### 依存パッケージの更新運用方針

#### ルーティング（`go_router`）の追従方針（DEP-011）

`go_router`は`pubspec.yaml`で`^17.3.0`とキャレット固定しているが、更新頻度が高い
ライブラリのため、キャレット制約だけでは新しいminorバージョンへの追従が遅れがちになる。

- dependabot（`pub`エコシステム、`.github/dependabot.yml`の`/packages/front`エントリ）が
  weekly（毎週水曜）でminor/patchの更新PRを作成するので、**これを追従の一次手段とする**。
  major更新のみ手動確認（後述の一括アップグレード手順）に委ねる。
- `go_router`のmajor更新（例: 17.x → 18.x）は破壊的変更（ルート定義API変更等）を伴い
  やすいため、dependabotのmajor PRは自動マージせず、リリースノートを確認してから
  個別に対応する。

#### コード生成ツールチェーンの一括アップグレード手順（DEP-012）

`build_runner`/`freezed`・`freezed_annotation`/`json_serializable`・`json_annotation`は
互いにバージョン整合性が必要なコード生成ツールチェーンであり、個別にcaret範囲内で
バラバラに更新すると生成コードの不整合（生成テンプレートの非互換等）を招きうる。
アップグレード時は以下の手順を踏む。

1. `flutter pub outdated` でこれらのパッケージの現在バージョンと最新バージョンを確認する。
2. 関連パッケージ（`build_runner`, `freezed`, `freezed_annotation`, `json_serializable`,
   `json_annotation`）を**同時に**`pubspec.yaml`で更新する（個別更新はしない）。
3. `flutter pub get` → `flutter pub run build_runner build --delete-conflicting-outputs`
   でコード生成をやり直す。
4. 生成された`*.freezed.dart`/`*.g.dart`の差分を確認し（意図しない構造変更が無いか）、
   `flutter test`（widget test含む）が green であることを確認する。
5. `freezed`/`freezed_annotation`のメジャーバージョン更新は本README単体の判断では
   進めない（DEP-009として**needs-approval**扱い。ユーザー承認を得てから着手する）。

#### `flutter_local_notifications`の更新運用（DEP-013）

`flutter_local_notifications`はプラットフォーム別実装（iOS/Android/通知権限まわり）が
多く、OS側の通知ポリシー変更に伴って動作が変わりうるライブラリのため、通常の
dependabot minor/patch更新をそのまま無条件でマージせず、以下を確認してから反映する。

1. 更新前に当該バージョンの[CHANGELOG](https://pub.dev/packages/flutter_local_notifications/changelog)
   を確認し、通知権限・チャンネル設定・Android 14+/iOS最新版向けの挙動変更が
   無いかを確認する。
2. 直近のiOS/Androidの**OSリリースノート**（通知関連のプライバシー・権限変更）も
   合わせて確認する（OS側のポリシー変更がライブラリの新バージョンで追従されて
   いることが多いため）。
3. 実機（またはエミュレータ/シミュレータ）でお気に入り登録→発走前通知の疎通を
   手動確認してからマージする（自動テストではOS通知の実際の表示までは検証
   できないため。`.claude/docs/testing-conventions.md` §9の「自動テストで再現
   しづらい条件分岐は判定ロジックを切り出してテストする」方針に従い、判定
   ロジック自体はUTで担保しつつ、実際の通知表示は手動確認に委ねる）。

## パッケージ構成

```
lib/
├── features/            # 画面（タブ）単位
│   ├── timeline/         # application/ + presentation/
│   ├── calendar/
│   ├── favorites/
│   ├── settings/
│   └── trip_groups/      # 旅程グループ候補日検出（SPEC-TRIP-001）
├── design/              # デザインシステム（トークン・共通ウィジェット）
├── notifications/       # 通知MVP
├── navigation/          # go_router
├── domain/              # ビジネスロジック層
│   ├── entities/
│   ├── repositories/
│   └── usecases/
├── data/                # データ層
│   ├── datasources/
│   ├── models/
│   └── repositories/
├── core/
│   └── di/               # get_it
├── app.dart
├── main.dart
└── widgetbook.dart        # ウィジェットカタログ（flutter run -t lib/widgetbook.dart）
```

詳細な各層の責務・データフロー・テスト戦略は [ARCHITECTURE.md](ARCHITECTURE.md) を参照。

## API エンドポイント

使用している API エンドポイント（`packages/api`）：

- `GET /race` - レース情報を取得
- `GET /place` - 開催場情報を取得（旅程グループの候補日検出にも使用。当初 `GET /race`
  を使っていたが、より軽量なため `GET /place` に切替済み）
- `GET /calendar` - カレンダーイベント取得
- `GET /player` - 選手情報取得

これらは api の `SERVICE_AUTH_EXEMPT_ROUTES` で `front-public` として認証免除されている
（front はブラウザで実行されるため秘密を保持できない）。詳細は
[`docs/specs/SPEC-API-001.md`](../../docs/specs/SPEC-API-001.md)。

詳細は `GET /race/docs`, `GET /place/docs` を参照。

## 詳細ドキュメント

- [SETUP.md](SETUP.md) - セットアップガイド
- [ARCHITECTURE.md](ARCHITECTURE.md) - アーキテクチャ詳細
