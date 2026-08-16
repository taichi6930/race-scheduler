# Node.jsバージョン管理ガイド

このプロジェクトでは、Node.jsのバージョンを`.nvmrc`ファイルで一元管理しています。

## バージョンの確認

現在のNode.jsバージョンは`.nvmrc`ファイルで確認できます：

```bash
cat .nvmrc
```

## 開発環境でのセットアップ

### nvmを使用する場合

```bash
# プロジェクトルートで実行
nvm use

# 指定バージョンがインストールされていない場合
nvm install
```

### その他のNode.jsバージョンマネージャー

- **nodenv**: 自動的に`.nvmrc`を読み込みます
- **asdf**: `.tool-versions`ファイルを作成するか、`.nvmrc`プラグインを使用
- **volta**: `volta pin node@$(cat .nvmrc)` を実行

## CI/CD環境

GitHub Actionsでは、Node.jsを使うワークフロー・アクション（`.github/actions/setup-workspace/action.yml`・`deploy-front-reusable.yml`のwrangler CLIセットアップ）が`.nvmrc`を自動的に読み込むように設定されています：

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
      node-version-file: '.nvmrc'
```

### Bunのバージョン管理（Node.jsとは別軸）

このプロジェクトの実行・テストは主に **Bun** で行われ、Bunのバージョンは`.nvmrc`ではなく`package.json`の`packageManager`フィールド（例: `bun@1.3.14`）で管理されています。CIでは`oven-sh/setup-bun@v2`が`bun-version-file: package.json`でこれを読み込みます。Bunバージョンを更新する場合は`package.json`の`packageManager`を書き換えてください（`.nvmrc`はNode.jsのみが対象）。

#### ローカル環境でのBunバージョンチェック（DEP-025）

npm/yarnにおける[corepack](https://nodejs.org/api/corepack.html)のような、`packageManager`
フィールドと実行中のBunバージョンの不一致を自動検知・強制する仕組みはBun自体にはまだ無く、
本プロジェクトでもそれを強制するフックは組み込んでいない。ローカル環境でバージョンがずれて
いないかは、開発者自身が以下のコマンドで手動確認する。

```bash
# 実行中のBunバージョンを確認
bun --version

# package.jsonが要求するバージョンと比較（一致していなければ切り替え/再インストールが必要）
node -e "console.log(require('./package.json').packageManager)"
```

ズレを検知した場合は、[bun upgrade](https://bun.sh/docs/installation#upgrading)や、`mise`/`asdf`
等の複数バージョン管理ツールで`packageManager`に記載されたバージョンへ切り替える。ローカルの
Bunバージョンがずれたまま`bun install`すると、`bun.lock`のフォーマットが意図せず更新される
おそれがあるため（CIは`--frozen-lockfile`で固定バージョンのBunを使うため気づきにくい）、
`git diff bun.lock`で差分が無いことをコミット前に確認する運用を推奨する。

## Node.jsバージョンの更新手順

Node.jsバージョンを更新する場合は、以下の手順に従ってください：

### 1. `.nvmrc`ファイルを更新

```bash
echo "24.3.0" > .nvmrc
```

### 2. `package.json`の`engines.node`を更新

`.nvmrc`と一致するように更新します：

```json
{
    "engines": {
        "node": ">=24.3.0 <25.0.0"
    }
}
```

### 3. 動作確認

```bash
# 新しいバージョンを使用
nvm use

# 依存関係を再インストール
bun install

# テストを実行
bun test

# Lintとtype-checkを実行
bun run pre-commit
```

### 4. コミットとプッシュ

```bash
git add .nvmrc package.json bun.lock
git commit -m "chore: Update Node.js to $(cat .nvmrc)"
git push
```

### 5. CI/CDの動作確認

プルリクエストのCI/CDチェックが全て通ることを確認してください。

## トラブルシューティング

### ローカル環境でNode.jsバージョンが異なる

```bash
# 現在のバージョンを確認
node -v

# .nvmrcのバージョンに切り替え
nvm use

# または強制的にインストール
nvm install $(cat .nvmrc)
nvm use
```

### CI/CDでバージョンエラーが発生

1. `.nvmrc`ファイルが正しくコミットされているか確認
2. GitHub Actionsのキャッシュをクリアしてから再実行
3. `package.json`の`engines.node`と`.nvmrc`が一致しているか確認

## 参考リンク

- [Node.js リリーススケジュール](https://github.com/nodejs/release#release-schedule)
- [nvm ドキュメント](https://github.com/nvm-sh/nvm)
- [actions/setup-node ドキュメント](https://github.com/actions/setup-node)
