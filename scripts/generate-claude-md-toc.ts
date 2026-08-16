#!/usr/bin/env bun
/**
 * generate-claude-md-toc.ts
 *
 * AIEFF-059対応: `CLAUDE.md` および `.claude/docs/` 配下の規約ドキュメント群は見出し数が
 * 多くなりがちだが目次を手書きで維持できていないファイルが多い。見出し（`##`/`###`）から
 * 目次（Markdownリンク一覧）を生成する。安全のため、対象ファイルに
 * `<!-- toc:start -->`/`<!-- toc:end -->` のマーカーコメントが既にある場合のみ
 * `--write` で書き換える。マーカーが無いファイルは生成結果を標準出力するだけに留め、
 * ドキュメントを無断で書き換えない。
 *
 * 使い方:
 *   bun scripts/generate-claude-md-toc.ts <file>             # 生成結果を標準出力
 *   bun scripts/generate-claude-md-toc.ts <file> --write      # マーカー間を書き換え
 */

import { readFileSync, writeFileSync } from 'node:fs';

export interface Heading {
    level: 2 | 3;
    text: string;
}

export const TOC_START_MARKER = '<!-- toc:start -->';
export const TOC_END_MARKER = '<!-- toc:end -->';

/**
 * Markdown本文から `##`/`###` 見出しを抽出する（コードフェンス内・目次マーカー間は除外）
 * @param content - Markdownファイルの内容
 * @returns 出現順の見出し配列
 */
export function extractHeadings(content: string): Heading[] {
    const headings: Heading[] = [];
    let inFence = false;
    let inToc = false;
    for (const line of content.split('\n')) {
        if (line.trimStart().startsWith('```')) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        if (line.includes(TOC_START_MARKER)) {
            inToc = true;
            continue;
        }
        if (line.includes(TOC_END_MARKER)) {
            inToc = false;
            continue;
        }
        if (inToc) {
            continue;
        }
        const match = /^(##|###)\s+(.+)$/.exec(line.trim());
        if (!match) {
            continue;
        }
        headings.push({
            level: match[1].length === 2 ? 2 : 3,
            text: match[2].trim(),
        });
    }
    return headings;
}

/**
 * 見出しテキストを GitHub 風のアンカースラグへ変換する
 * @param text - 見出しテキスト（`` ` `` 等の装飾記法を含みうる）
 * @returns アンカースラグ
 */
export function slugify(text: string): string {
    const stripped = text.replace(/[`*_]/g, '');
    return stripped
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-_]/gu, '')
        .replace(/-+/g, '-');
}

/**
 * 見出し一覧から目次の Markdown 行を組み立てる
 * @param headings - `extractHeadings` の出力
 * @returns 目次の Markdown 文字列（マーカー行を含む）
 */
export function buildToc(headings: Heading[]): string {
    const lines = headings.map((h) => {
        const indent = h.level === 3 ? '    ' : '';
        return `${indent}- [${h.text}](#${slugify(h.text)})`;
    });
    return [TOC_START_MARKER, ...lines, TOC_END_MARKER].join('\n');
}

/**
 * マーカー間の目次を書き換える（マーカーが無ければ元の内容をそのまま返す）
 * @param content - 元の Markdown 内容
 * @param toc - `buildToc` の出力
 * @returns 書き換え後の内容
 */
export function replaceTocSection(content: string, toc: string): string {
    const start = content.indexOf(TOC_START_MARKER);
    const end = content.indexOf(TOC_END_MARKER);
    if (start === -1 || end === -1 || end < start) {
        return content;
    }
    const before = content.slice(0, start);
    const after = content.slice(end + TOC_END_MARKER.length);
    return `${before}${toc}${after}`;
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    const filePath = args.find((a) => !a.startsWith('--'));
    const shouldWrite = args.includes('--write');

    if (!filePath) {
        // eslint-disable-next-line no-console
        console.error(
            '使い方: bun scripts/generate-claude-md-toc.ts <file> [--write]',
        );
        process.exit(1);
    }

    const content = readFileSync(filePath, 'utf8');
    const toc = buildToc(extractHeadings(content));

    if (!shouldWrite) {
        // eslint-disable-next-line no-console
        console.log(toc);
        process.exit(0);
    }

    const hasMarkers =
        content.includes(TOC_START_MARKER) && content.includes(TOC_END_MARKER);
    if (!hasMarkers) {
        // eslint-disable-next-line no-console
        console.error(
            `⚠️  ${filePath} に ${TOC_START_MARKER}/${TOC_END_MARKER} マーカーが無いため --write をスキップしました（生成結果は標準出力のみ）。`,
        );
        // eslint-disable-next-line no-console
        console.log(toc);
        process.exit(0);
    }

    writeFileSync(filePath, replaceTocSection(content, toc));
    // eslint-disable-next-line no-console
    console.log(`✅ ${filePath} の目次を更新しました`);
}
