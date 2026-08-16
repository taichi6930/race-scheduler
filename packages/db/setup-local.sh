#!/bin/bash

# ローカルDB開発環境セットアップスクリプト
# このスクリプトはpackages/db配下で実行してください

set -e

echo "🚀 ローカルDB環境のセットアップを開始します..."

# 1. Wranglerがインストールされているか確認
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wranglerがインストールされていません"
    echo "📦 bun install を実行してください"
    exit 1
fi

echo "✅ Wrangler確認完了"

# 2. マイグレーションファイルが存在するか確認
if [ ! -d "./migrations" ]; then
    echo "❌ migrationsディレクトリが見つかりません"
    exit 1
fi

migration_count=$(ls -1 ./migrations/*.sql 2>/dev/null | wc -l)
if [ $migration_count -eq 0 ]; then
    echo "⚠️  マイグレーションファイルが見つかりません"
else
    echo "✅ ${migration_count}個のマイグレーションファイルを検出"
fi

# 3. ローカルDBにマイグレーションを適用
echo "📊 ローカルDBにマイグレーションを適用中..."
bun run migrations:apply:local

echo "✅ マイグレーション適用完了"

# 4. マイグレーション一覧を表示
echo "📋 適用済みマイグレーション一覧:"
bun run migrations:list:local

echo ""
echo "🎉 ローカルDB環境のセットアップが完了しました！"
echo ""
echo "💡 次のコマンドでDBシェルにアクセスできます:"
echo "   bun run db:shell:local"
