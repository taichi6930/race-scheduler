import { defineConfig } from 'eslint/config';
import eslintPluginImport from 'eslint-plugin-import';
import { jsdoc } from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import noCompoundCondition from './eslint-rules/no-compound-condition.ts';

// このファイルはBiomeでは代替できない独自ルール・プラグインのみを扱う縮小構成。
// フォーマット・標準lintルール（no-explicit-any、import整理、filename-case、
// レイヤー境界、循環依存、関数行数制限等）はすべて biome.json 側で管理する。
// 詳細: .claude/docs/coding-conventions.md
//
// DEP-007 動作確認記録（2026-07-27）: eslint-plugin-import@2.32.0 は
// メンテナンスが遅い傾向が指摘されているライブラリだが、ESLint v10.7.0の
// flat config（本ファイル）上で `import/no-relative-packages` ルールが
// 問題なく動作することを確認済み（`bunx eslint packages --ext .ts,.tsx` が
// 0 errors で完了し、パッケージ境界違反も正しく検出される）。現時点では
// `eslint-plugin-import-x` 等への切替は不要と判断し、様子見とする。

export default defineConfig([
    // Global ignores for all configuration objects
    {
        name: 'global/ignores',
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.wrangler/tmp/**',
            'packages/*/test/**',
            'packages/*/dist/**',
            'packages/db/scripts/**',
            'packages/front/build/**',
            'packages/front/.dart_tool/**',
            // Service Worker等の素のブラウザJS（serviceworker globalなどTS向けlint対象外）
            'packages/front/web/**',
            '**/*.yaml',
            '**/*.yml',
        ],
    },
    {
        name: 'config/javascript',
        files: ['**/*.mjs', '**/*.cjs'],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        name: 'config/typescript',
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            globals: globals.node,
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: process.cwd(),
                allowDefaultProject: true,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
    },
    // jsdoc procedural config（Biomeにはjsdocチェック相当のルールが無いため残置）
    {
        name: 'jsdoc/recommended-typescript',
        ...jsdoc({
            config: 'flat/recommended-typescript',
        }),
    },
    {
        name: 'race-schedule/typescript-rules',
        files: ['**/*.{ts,tsx}'],
        plugins: {
            import: eslintPluginImport,
        },
        settings: {
            // import/no-relative-packages がパッケージ境界を判定するために
            // モジュール解決（TypeScript resolver）が必要
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                },
            },
        },
        rules: {
            // z.any() は実質 any であり Biome の noExplicitAny の趣旨に反するため禁止。
            // TASK #44（playerRowSchema の z.any()）の再発を防止。
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "CallExpression[callee.object.name='z'][callee.property.name='any']",
                    message:
                        'z.any() は禁止です。z.unknown() や具体的なスキーマを使用してください。',
                },
                {
                    // QJST-04: `new Date('YYYY-MM-DD').toISOString().slice(0, 10)` は
                    // UTC基準の日付になり、JSTの00:00〜09:00の間は前日の日付になる
                    // （QJST-01/02で実際に admin ですり抜けていた不具合と同種）。
                    // JST日付が必要な箇所は core の dateJst.ts（`getJstPart`等）や
                    // `+09:00`オフセット付きのDateパースを使うこと。
                    selector:
                        "CallExpression[callee.property.name='slice'][arguments.0.value=0][arguments.1.value=10][callee.object.callee.property.name='toISOString']",
                    message:
                        'toISOString().slice(0, 10) はUTC基準の日付になりJSTとずれます。JST日付が必要な場合は core の dateJst.ts 等を使ってください。',
                },
            ],
            // 別ワークスペースパッケージの内部 src へ相対パスで侵入することを禁止し、
            // 公開エントリ（@race-schedule/xxx）経由の import を強制する。
            // 例: packages/scraping から `../../../core/src/...` を import すると error。
            // これによりパッケージ境界の破壊（TASK #11 の再発）を静的に防止する。
            // Biomeにはワークスペース解決込みの同等ルールが無いため残置。
            'import/no-relative-packages': 'error',
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'warn',
        },
    },
    // 不要な型アサーション（型を変えない `as X`）を禁止し autofix で除去する。
    // TASK #29（既に string 型のマスタ値への `as string` 等）の再発を防止。
    // 型情報（TypeScriptチェッカー）に依存するtypedルールのため、型合成が発展途上の
    // Biomeでは代替せずESLintに残置。scraping/batch の `res.json()` 系は eslint と tsc
    // で戻り型解釈が食い違い誤検知するため、対象を packages/core/src に限定する。
    {
        name: 'race-schedule/core-no-unnecessary-assertion',
        files: ['packages/core/src/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        },
    },
    // カスタムルール no-compound-condition の登録。
    // if/while/do-while/for/三項演算子の条件式に複合論理演算子（&&/||）を
    // 直接書くことを禁止し、名前付き述語関数・ガード節への分解を強制する
    // （詳細: eslint-rules/no-compound-condition.ts）。Biomeには同等ルールが無いため残置。
    //
    // 既存コードベースの違反箇所（61箇所）はすべて名前付き述語関数へ分解済み。
    // 'error' で有効化しているため、新規の複合条件は lint:check（pre-commit）で
    // ブロックされる。
    {
        name: 'race-schedule/local-rules',
        files: ['packages/*/src/**/*.ts'],
        plugins: {
            local: {
                rules: {
                    'no-compound-condition': noCompoundCondition,
                },
            },
        },
        rules: {
            'local/no-compound-condition': 'error',
        },
    },
]);
