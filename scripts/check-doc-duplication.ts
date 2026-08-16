#!/usr/bin/env bun
/**
 * check-doc-duplication.ts
 *
 * `.claude/docs/` と `.claude/skills/` の間で3行以上一致する重複ブロックを検出する
 * （TOK-016）。同一規約が複数ファイルに書き写され、片方だけ更新されて食い違う
 * ドリフト（例: 「`as any` 禁止」が coding-conventions / testing-conventions /
 * testing-standards skill の3箇所に存在する等）を機械的に洗い出す下準備。
 *
 * 検出のみを行い、単一ソース化するかどうかの判断（TOK-019）は行わない。
 *
 * 使い方:
 *   bun scripts/check-doc-duplication.ts              # 人間向け表示
 *   bun scripts/check-doc-duplication.ts --json        # JSON出力
 *   bun scripts/check-doc-duplication.ts --target=aidlc-docs/inception
 *                                                       # 既定2ディレクトリに加え、指定ディレクトリ
 *                                                       # （ROOTからの相対パス）も検出対象に加える
 *                                                       # （TOK-042。複数指定可、繰り返し可）
 */

/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { walkDir } from './lib/walkDir';

const ROOT = process.cwd();
const DEFAULT_TARGET_DIRS = [
    join(ROOT, '.claude/docs'),
    join(ROOT, '.claude/skills'),
];

/** 何行連続で一致すれば重複と見なすか */
const WINDOW_SIZE = 3;

/** この文字数未満の窓（3行分の結合テキスト）はノイズとして無視する */
const MIN_SIGNIFICANT_CHARS = 20;

/** Markdownの装飾行（テーブル区切り・水平線）のみで構成される行かどうか */
const isDecorativeLine = (line: string): boolean =>
    /^[-=|\s:]+$/.test(line) && line.trim() !== '';

interface DocFile {
    relPath: string;
    lines: string[];
}

interface WindowMatch {
    file: string;
    line: number;
}

interface RawPairMatch {
    fileA: string;
    startA: number;
    fileB: string;
    startB: number;
}

interface DuplicateBlock {
    fileA: string;
    startA: number;
    fileB: string;
    startB: number;
    lineCount: number;
    preview: string;
}

const toRelPath = (absPath: string): string =>
    relative(ROOT, absPath).split(sep).join('/');

/**
 * 対象ディレクトリ配下の全 `.md` ファイルを行単位で読み込む。
 * @param extraDirs `DEFAULT_TARGET_DIRS` に追加で検出対象にするディレクトリ（絶対パス）
 */
function collectDocFiles(extraDirs: string[] = []): DocFile[] {
    const files = [...DEFAULT_TARGET_DIRS, ...extraDirs].flatMap((dir) =>
        walkDir(dir, (full) => full.endsWith('.md')),
    );
    return files.map((absPath) => ({
        relPath: toRelPath(absPath),
        lines: readFileSync(absPath, 'utf8').split('\n'),
    }));
}

/**
 * 窓（WINDOW_SIZE行分）が比較に値する内容かどうかを判定する。
 * 空行や装飾行のみの窓、短すぎる窓はノイズとして除外する。
 * @param windowLines 判定対象の行配列
 */
function isSignificantWindow(windowLines: string[]): boolean {
    const trimmed = windowLines.map((line) => line.trim());
    if (trimmed.every((line) => line === '' || isDecorativeLine(line))) {
        return false;
    }
    return trimmed.join('').length >= MIN_SIGNIFICANT_CHARS;
}

/**
 * 全ファイルから重複検出用の窓（WINDOW_SIZE行の連続ブロック）を抽出し、
 * 正規化テキスト（署名）でグルーピングする。
 * @param docFiles collectDocFiles の結果
 */
function buildWindowIndex(docFiles: DocFile[]): Map<string, WindowMatch[]> {
    const index = new Map<string, WindowMatch[]>();
    for (const doc of docFiles) {
        for (let i = 0; i <= doc.lines.length - WINDOW_SIZE; i += 1) {
            const windowLines = doc.lines
                .slice(i, i + WINDOW_SIZE)
                .map((line) => line.trim());
            if (!isSignificantWindow(windowLines)) continue;

            const signature = windowLines.join('\n');
            const matches = index.get(signature) ?? [];
            matches.push({ file: doc.relPath, line: i + 1 });
            index.set(signature, matches);
        }
    }
    return index;
}

/**
 * 署名ごとの一致箇所から、異なるファイル間のペアをすべて洗い出す。
 * @param index buildWindowIndex の結果
 */
function extractPairMatches(index: Map<string, WindowMatch[]>): RawPairMatch[] {
    const pairs: RawPairMatch[] = [];
    for (const matches of index.values()) {
        for (let i = 0; i < matches.length; i += 1) {
            for (let j = i + 1; j < matches.length; j += 1) {
                const a = matches[i];
                const b = matches[j];
                if (a.file === b.file) continue;
                const [fileA, startA, fileB, startB] =
                    a.file < b.file
                        ? [a.file, a.line, b.file, b.line]
                        : [b.file, b.line, a.file, a.line];
                pairs.push({ fileA, startA, fileB, startB });
            }
        }
    }
    return pairs;
}

/**
 * 隣接するペア一致（開始行が両ファイルとも1ずつずれているだけの窓）を
 * 1つの連続ブロックへ統合する。WINDOW_SIZE行ずつスライドして生成した窓は
 * 重複部分が多いため、そのまま出すと同じ重複が何十行分も個別に列挙されてしまう。
 * @param pairs extractPairMatches の結果
 */
function mergeContiguousBlocks(pairs: RawPairMatch[]): DuplicateBlock[] {
    const sorted = [...pairs].sort((x, y) => {
        if (x.fileA !== y.fileA) return x.fileA < y.fileA ? -1 : 1;
        if (x.fileB !== y.fileB) return x.fileB < y.fileB ? -1 : 1;
        if (x.startA !== y.startA) return x.startA - y.startA;
        return x.startB - y.startB;
    });

    const blocks: DuplicateBlock[] = [];
    for (const pair of sorted) {
        const last = blocks.at(-1);
        if (
            last &&
            last.fileA === pair.fileA &&
            last.fileB === pair.fileB &&
            last.startA + (last.lineCount - WINDOW_SIZE + 1) === pair.startA &&
            last.startB + (last.lineCount - WINDOW_SIZE + 1) === pair.startB
        ) {
            last.lineCount += 1;
            continue;
        }
        blocks.push({
            fileA: pair.fileA,
            startA: pair.startA,
            fileB: pair.fileB,
            startB: pair.startB,
            lineCount: WINDOW_SIZE,
            preview: '',
        });
    }
    return blocks;
}

/** 重複ブロックの先頭行（プレビュー用）を埋める */
function fillPreviews(
    blocks: DuplicateBlock[],
    docFiles: DocFile[],
): DuplicateBlock[] {
    const byPath = new Map(docFiles.map((doc) => [doc.relPath, doc]));
    return blocks.map((block) => {
        const doc = byPath.get(block.fileA);
        const preview = doc?.lines[block.startA - 1]?.trim() ?? '';
        return { ...block, preview };
    });
}

/**
 * 検出済み重複ブロック一覧を組み立てる（walk → index → 抽出 → 統合の一連の流れ）。
 * @param extraDirs `DEFAULT_TARGET_DIRS` に追加で検出対象にするディレクトリ（絶対パス）
 */
function detectDuplicateBlocks(extraDirs: string[] = []): DuplicateBlock[] {
    const docFiles = collectDocFiles(extraDirs);
    const index = buildWindowIndex(docFiles);
    const pairs = extractPairMatches(index);
    const blocks = mergeContiguousBlocks(pairs);
    return fillPreviews(blocks, docFiles).sort(
        (a, b) => b.lineCount - a.lineCount,
    );
}

/** `--target=<relPath>` 形式の引数から、ROOTからの相対パスを絶対パスへ解決した一覧を取り出す */
function parseExtraTargetDirs(args: string[]): string[] {
    return args
        .filter((arg) => arg.startsWith('--target='))
        .map((arg) => join(ROOT, arg.slice('--target='.length)));
}

function main(): void {
    const args = process.argv.slice(2);
    const isJson = args.includes('--json');
    const extraDirs = parseExtraTargetDirs(args);

    const blocks = detectDuplicateBlocks(extraDirs);

    if (isJson) {
        process.stdout.write(`${JSON.stringify({ blocks }, null, 2)}\n`);
        return;
    }

    const targetLabel = [
        '.claude/docs',
        '.claude/skills',
        ...extraDirs.map((dir) => toRelPath(dir)),
    ].join('・');
    console.log(
        `\n🔍 ドキュメント重複検出（${targetLabel}、${WINDOW_SIZE}行以上一致、${blocks.length}件）`,
    );
    console.log('━'.repeat(60));
    if (blocks.length === 0) {
        console.log('   ✅ 重複ブロックは検出されませんでした');
    }
    for (const block of blocks.slice(0, 30)) {
        console.log(
            `\n   ${block.fileA}:${block.startA} ⇔ ${block.fileB}:${block.startB}（${block.lineCount}行）`,
        );
        console.log(`     "${block.preview}"`);
    }
    if (blocks.length > 30) {
        console.log(`\n   ... and ${blocks.length - 30} more`);
    }
    console.log('');
}

if (import.meta.main) {
    main();
}

export type { DocFile, DuplicateBlock, RawPairMatch, WindowMatch };
export {
    buildWindowIndex,
    detectDuplicateBlocks,
    extractPairMatches,
    isSignificantWindow,
    mergeContiguousBlocks,
    WINDOW_SIZE,
};
