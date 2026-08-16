#!/bin/bash
# Cloudflare Workers secrets設定スクリプト
# 使用方法: ./scripts/setup-secrets.sh [test|production|development]

set -e

ENV=${1:-test}

if [[ "$ENV" != "test" && "$ENV" != "production" && "$ENV" != "development" ]]; then
    echo "Usage: $0 [test|production|development]"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
DEV_VARS_FILE="$API_DIR/.dev.vars"

if [[ ! -f "$DEV_VARS_FILE" ]]; then
    echo "Error: .dev.vars file not found at $DEV_VARS_FILE"
    echo "Please create .dev.vars file with required secrets."
    exit 1
fi

echo "Setting up Cloudflare Workers secrets for env: $ENV"
echo "Reading secrets from: $DEV_VARS_FILE"
echo ""

# 必要なsecrets一覧
# Google Calendar関連のsecretsは@race-schedule/calendar Workerへ移設済みのため対象外
# api は D1 のみを使い R2 には接続しないため、R2関連secretsは対象外（scraping Workerのみが使用）
SECRETS=(
    "VAPID_PUBLIC_KEY"
    "VAPID_PRIVATE_KEY"
    "VAPID_SUBJECT"
    "PUSH_DISPATCH_TOKEN"
)

cd "$API_DIR"

for SECRET_NAME in "${SECRETS[@]}"; do
    # .dev.varsから値を取得（最初の1行のみ、重複を防ぐため -m 1 を使用）
    SECRET_VALUE=$(grep -m 1 "^${SECRET_NAME}=" "$DEV_VARS_FILE" | cut -d'=' -f2-)

    if [[ -z "$SECRET_VALUE" ]]; then
        echo "Warning: $SECRET_NAME not found in .dev.vars, skipping..."
        continue
    fi

    # 重複チェック：同じキーが複数行ないか確認
    DUPLICATE_COUNT=$(grep -c "^${SECRET_NAME}=" "$DEV_VARS_FILE" || true)
    if [[ $DUPLICATE_COUNT -gt 1 ]]; then
        echo "⚠️  Warning: $SECRET_NAME appears $DUPLICATE_COUNT times in .dev.vars (using first occurrence)"
    fi

    echo "Setting $SECRET_NAME..."
    # printf '%s' を使用して \n などのエスケープシーケンスをそのまま保持
    printf '%s' "$SECRET_VALUE" | wrangler secret put "$SECRET_NAME" --env "$ENV"
done

echo ""
echo "Done! Secrets have been set for env: $ENV"
echo ""
echo "Verify with: wrangler secret list --env $ENV"
