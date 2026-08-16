#!/bin/bash
set -euo pipefail

# Path to batch directory
BATCH_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$BATCH_DIR/../.."

echo "=========================================="
echo "   Batch Local Setup"
echo "=========================================="
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ bun is not installed. Please install bun first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
cd "$REPO_ROOT"
bun install

# Type check batch package
echo "🔍 Type checking packages/batch..."
cd "$BATCH_DIR"
bun run type-check

echo ""
echo "=========================================="
echo "   Setup Complete! ✅"
echo "=========================================="
echo ""
echo "🚀 Ready to run batch commands:"
echo ""
echo "   cd packages/batch"
echo "   bun src/cli.ts nar \"2026-03-13\" \"2026-03-14\" place"
echo ""
echo "For more information, see: ./SETUP.md"
