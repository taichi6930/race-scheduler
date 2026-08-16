#!/usr/bin/env bun
/**
 * check-miniflare-wrangler-sync.ts
 *
 * ルート package.json に固定した `miniflare` のバージョンが、同じく固定した
 * `wrangler` が内部で要求する `miniflare` のバージョンと一致しているかを検証する
 * （DEP-004対応）。
 *
 * 背景: `wrangler dev` やデプロイは wrangler が内部でバンドルする miniflare/workerd
 * を使う一方、sIT（`bun run test:sit`）は package.json に固定した miniflare を
 * 直接使う。片方だけを更新すると、sIT が検証しているランタイムと実際にデプロイ
 * されるランタイムが乖離し、sIT が green でも本番で異なる挙動になりうる。
 *
 * 使い方:
 *   bun scripts/check-miniflare-wrangler-sync.ts
 *
 * （`bun install` 済みで `node_modules/wrangler/package.json` が存在すること）
 */

/* eslint-disable no-console */
import { readFileSync } from 'node:fs';

interface RootPackageJson {
    devDependencies?: Record<string, string>;
}

interface WranglerPackageJson {
    version?: string;
    dependencies?: Record<string, string>;
}

const rootPkg = JSON.parse(
    readFileSync('package.json', 'utf-8'),
) as RootPackageJson;
const pinnedMiniflare = rootPkg.devDependencies?.miniflare;

if (!pinnedMiniflare) {
    console.error(
        '❌ package.json の devDependencies に miniflare が見つかりません',
    );
    process.exit(1);
}

let wranglerPkg: WranglerPackageJson;
try {
    wranglerPkg = JSON.parse(
        readFileSync('node_modules/wrangler/package.json', 'utf-8'),
    ) as WranglerPackageJson;
} catch {
    console.error(
        '❌ node_modules/wrangler/package.json が見つかりません（bun install が未実行の可能性）',
    );
    process.exit(1);
}

const requiredMiniflare = wranglerPkg.dependencies?.miniflare;

if (!requiredMiniflare) {
    console.error(
        '❌ wrangler の package.json から miniflare の依存バージョンを取得できません（wranglerの内部実装が変わった可能性）',
    );
    process.exit(1);
}

if (pinnedMiniflare !== requiredMiniflare) {
    console.error(
        `❌ miniflare のバージョンが wrangler(${wranglerPkg.version}) の要求と一致していません（DEP-004）\n` +
            `   package.json に固定した miniflare: ${pinnedMiniflare}\n` +
            `   wrangler が内部で要求する miniflare:  ${requiredMiniflare}\n` +
            `   package.json の devDependencies.miniflare を ${requiredMiniflare} に更新してください。`,
    );
    process.exit(1);
}

console.log(
    `✅ miniflare (${pinnedMiniflare}) は wrangler(${wranglerPkg.version}) の要求と一致しています`,
);
