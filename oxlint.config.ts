import { defineConfig } from 'oxlint';

// anti-slop（https://github.com/dmmulroy/anti-slop）を tools/oxlint/anti-slop/ にベンダリングし、
// 15ルールをすべて有効化する。Biome/ESLintでは検出できない「低根拠・低シグナルな実装パターン」
// （型アサーションの不正な連鎖・unknown/objectの濫用など）を担当する3つ目のリンター。
export default defineConfig({
    ignorePatterns: [
        '.claude/**',
        'tools/oxlint/anti-slop/**',
        'packages/*/test/**',
        'packages/*/dist/**',
        'node_modules/**',
        '**/.wrangler/tmp/**',
        'private/**',
    ],
    jsPlugins: [
        { name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
    ],
    rules: {
        'anti-slop/no-chained-type-assertions': 'error',
        'anti-slop/no-conditional-empty-object-spread': 'error',
        'anti-slop/no-known-value-widening': 'warn',
        'anti-slop/no-module-mocking': 'warn',
        'anti-slop/no-object-parameters': 'error',
        'anti-slop/no-reflect-apply': 'warn',
        'anti-slop/no-reflect-get': 'warn',
        'anti-slop/no-runtime-typeof': 'warn',
        'anti-slop/no-shape-in-symbol-names': 'error',
        'anti-slop/no-unknown-parameters': 'warn',
        'anti-slop/no-unknown-returns': 'error',
        'anti-slop/no-unknown-type-aliases': 'warn',
        'anti-slop/no-unsafe-dictionary-type': 'error',
        'anti-slop/no-widen-then-assert': 'warn',
        'anti-slop/require-safety-comment-for-type-assertion': 'warn',
    },
});
