#!/usr/bin/env bun
/**
 * strip-html-comments.ts
 *
 * production向けビルド成果物のHTMLから `<!-- ... -->` コメントを全て除去する。
 * `packages/front/web/index.html` にはtest/production共通で開発者向けの注記コメント
 * （二重管理箇所の警告等）が残っているが、production配信物としてはユーザーに
 * 見せる必要が無いため、ビルド後の `build/web/index.html` に対してのみ適用する
 * （ソースの `web/index.html` 自体は変更しない）。
 *
 * `<!DOCTYPE html>` はコメント（`<!--` 始まり）ではないため対象外。
 *
 * 使い方:
 *   bun scripts/strip-html-comments.ts <file> [<file> ...]
 */

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * HTML文字列からコメント（`<!-- ... -->`）を全て除去する。
 *
 * 1回の置換だけでは、除去後に前後のテキストが結合して新たな `<!--...-->` が
 * 再構成される場合（例: 入れ子状の `<!--<!---->-->`）に取りこぼしうる
 * （CodeQL `js/incomplete-multi-character-sanitization`）。変化が無くなるまで
 * 繰り返すことで、どのような入れ子・結合パターンでも確実に除去する。
 * @param html - 対象のHTML文字列
 */
export function stripHtmlComments(html: string): string {
    let current = html;
    let previous: string;
    do {
        previous = current;
        current = previous.replace(/<!--[\s\S]*?-->/g, '');
    } while (current !== previous);
    return current;
}

if (import.meta.main) {
    const files = process.argv.slice(2);

    if (files.length === 0) {
        // eslint-disable-next-line no-console
        console.error(
            '使い方: bun scripts/strip-html-comments.ts <file> [<file> ...]',
        );
        process.exit(1);
    }

    for (const file of files) {
        const original = readFileSync(file, 'utf8');
        writeFileSync(file, stripHtmlComments(original));
        // eslint-disable-next-line no-console
        console.log(`✅ HTMLコメントを除去しました: ${file}`);
    }
}
