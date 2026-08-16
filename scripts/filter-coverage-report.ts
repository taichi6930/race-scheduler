#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Display coverage exclusion summary
 *
 * Usage: bun scripts/filter-coverage-report.ts
 *
 * This script displays which files were excluded from coverage.
 * Note: Bun generates text/lcov reports (no JSON/HTML natively),
 * so actual filtering happens at display time.
 * lcov.info は scripts/test-gap-analysis.ts の解析入力およびローカルの HTML 変換（genhtml）に利用できる。
 */

console.log(
    `📊 Coverage: **/test/mock/** and **/test/common/** are shown but not enforced (100% required for production code only).`,
);
console.log(
    `📊 Per-file coverage table is omitted by default (TOK-045). Run "bun run test:verbose" for the full text breakdown, or "bun run test:gap" for a gap-only summary.`,
);
