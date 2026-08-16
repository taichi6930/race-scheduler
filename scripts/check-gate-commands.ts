#!/usr/bin/env bun
/**
 * check-gate-commands.ts
 *
 * `.claude/docs/loop-engineering/verify-gate.md` と `recipes.md` に記載された
 * `bun run <script>` コマンドが `package.json` の `scripts` に実在するかを検査する。
 *
 * loop-engineering の各ゲート・detector は package.json のスクリプト名/パスを
 * ドキュメント中の文字列として名前参照している（AUT-08）。スクリプトが改名・削除
 * されるとゲートが無言で失敗（または存在しないコマンドとして即エラー）するため、
 * このチェックで事前に検出する。
 *
 * 使い方:
 *   bun scripts/check-gate-commands.ts
 */

/* eslint-disable no-console */
import { readFileSync } from 'node:fs';

const DOC_FILES = [
    '.claude/docs/loop-engineering/verify-gate.md',
    '.claude/docs/loop-engineering/recipes.md',
];

/** `bun run <script>` パターンからスクリプト名を抽出する正規表現（コロン・ハイフン・アンダースコア対応） */
const BUN_RUN_PATTERN = /bun run ([a-zA-Z][a-zA-Z0-9:_-]*)/g;

/**
 * 指定ドキュメント群から `bun run <script>` で参照されているスクリプト名の集合を抽出する。
 *
 * `.claude/docs/loop-engineering/` はprivateリポジトリ（race-schedule）を指す
 * シンボリックリンクであり、公開リポジトリ（race-scheduler）のCIでは
 * サブモジュールを意図的にチェックアウトしないため（プライベートリポジトリの
 * 認証情報を公開CIに渡さないための設計判断）実体が存在しない。他のツール
 * （Biomeの`.claude/docs`関連ファイルへの警告）と同様、ファイル不在は
 * エラーではなくスキップ対象として扱う。
 * @param docFiles - 走査対象の Markdown ファイルパス配列
 * @returns 参照されているスクリプト名の集合（重複除去済み）
 */
const extractReferencedScripts = (docFiles: string[]): Set<string> => {
    const scripts = new Set<string>();
    for (const file of docFiles) {
        let content: string;
        try {
            content = readFileSync(file, 'utf-8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                continue;
            }
            throw error;
        }
        for (const match of content.matchAll(BUN_RUN_PATTERN)) {
            scripts.add(match[1]);
        }
    }
    return scripts;
};

/**
 * package.json の scripts セクションに定義されたスクリプト名の集合を取得する。
 * @returns package.json 内で定義済みのスクリプト名の集合
 */
const loadDefinedScripts = (): Set<string> => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as {
        scripts?: Record<string, string>;
    };
    return new Set(Object.keys(pkg.scripts ?? {}));
};

const referenced = extractReferencedScripts(DOC_FILES);
const defined = loadDefinedScripts();
const missing = [...referenced].filter((name) => !defined.has(name)).sort();

if (missing.length > 0) {
    console.error(
        `❌ loop-engineering ドキュメントが参照するが package.json に存在しないスクリプト: ${missing.join(', ')}`,
    );
    console.error(
        `   参照元: ${DOC_FILES.join(', ')}\n   package.json の scripts を追加するか、ドキュメント側の記載を修正してください。`,
    );
    process.exit(1);
}

console.log(
    `✅ loop-engineering ドキュメントが参照する ${referenced.size} 件のスクリプトは全て package.json に実在します。`,
);
