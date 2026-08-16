#!/usr/bin/env node
/**
 * Batch CLI Entry Point
 *
 * 実処理はすべて `batchCli.ts` に集約している。本ファイルは `bun src/cli.ts`
 * として直接起動された場合にのみ `run()` を実行する薄いエントリーポイントに
 * とどめている（`if (import.meta.main)` 分岐はサブプロセス経由でしか実行されず
 * 親プロセスのカバレッジ計測に乗らないため、テスト可能なロジックから分離した）。
 *
 * 使用例:
 *   npx tsx src/cli.ts JRA 2026-01-01 2026-01-31 place
 *   npx tsx src/cli.ts JRA 2026-01-01 2026-01-31 race
 *   npx tsx src/cli.ts JRA 2026-01-01 2026-01-31 all
 */

import { run } from './batchCli';

if (import.meta.main) {
    void run();
}
