#!/usr/bin/env bun
/**
 * find-stale-aidlc-docs.ts
 *
 * `aidlc-docs/` 配下の Markdown が本文中で参照しているコードパス（バッククォート内の
 * `packages/foo/src/bar.ts` や `packages/foo/src/bar.ts:123` のような相対パス・行番号付き
 * 参照）について、参照先ファイルが実在するか・行番号がファイルの行数を超えていないかを
 * 検出する読み取り専用レポートスクリプト（DOC-12）。
 *
 * `check-workflow-hygiene.ts` と同じ静的解析パターン（対象ディレクトリを走査 →
 * 正規表現でパターン抽出 → 集計してレポート）を踏襲する。ドキュメントドリフト
 * （実装が変わってもドキュメントの参照が追随しない）を機械的に検知するのが目的で、
 * ワークフロー健全性チェックと同様にレポートのみで非ブロッキング（常に exit 0）とする。
 *
 * `KNOWN_HISTORICAL_LOGS`（DOC-21）: `audit.md` / `loop-engineering/journal.md` は
 * 追記専用の履歴ログであり、過去エントリが当時の（現在は変わった）パスを記録しているのは
 * 仕様（過去の記録を書き換えない運用のため）。これらは「対応不要」バケットに分離して表示し、
 * 実際に追随漏れが疑われる参照（それ以外のファイル）と混同しないようにする。
 *
 * 使い方:
 *   bun scripts/find-stale-aidlc-docs.ts
 */

/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_DIR = 'aidlc-docs';

/**
 * 追記専用の履歴ログ（過去エントリの参照パスが陳腐化するのは仕様。DOC-21）。
 * ここに列挙したファイルからの検出結果は「対応不要」バケットへ分離する。
 */
const KNOWN_HISTORICAL_LOGS: readonly string[] = [
    'aidlc-docs/audit.md',
    'aidlc-docs/loop-engineering/journal.md',
];

/** docFile が既知の履歴ログかどうかを判定する。 */
export const isKnownHistoricalLog = (docFile: string): boolean =>
    KNOWN_HISTORICAL_LOGS.includes(docFile);

/** バッククォート内のコードパス参照（先頭ディレクトリを限定し誤検知を抑える）。 */
const PATH_REFERENCE_PATTERN =
    /`((?:packages|scripts|tests|docs|aidlc-docs|\.github|\.claude)\/[\w./-]+\.(?:ts|tsx|dart|md|yml|yaml|json))(?::(\d+))?`/g;

interface StaleReference {
    docFile: string;
    referencedPath: string;
    line?: number;
    reason: 'missing-file' | 'line-out-of-range';
}

/** 指定ディレクトリ配下の `.md` ファイルパス一覧を再帰的に集める。 */
const listMarkdownFiles = (dir: string): string[] => {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listMarkdownFiles(fullPath));
        } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }
    return files.sort();
};

/** 参照先ファイルの行数を取得する（存在しない場合は null）。 */
const countLines = (path: string): number | null => {
    if (!existsSync(path) || !statSync(path).isFile()) {
        return null;
    }
    return readFileSync(path, 'utf-8').split('\n').length;
};

/** 1件の参照を検証し、問題があれば StaleReference を返す。 */
const checkReference = (
    docFile: string,
    referencedPath: string,
    lineText: string | undefined,
): StaleReference | null => {
    const totalLines = countLines(referencedPath);
    if (totalLines === null) {
        return { docFile, referencedPath, reason: 'missing-file' };
    }
    if (lineText === undefined) {
        return null;
    }
    const line = Number.parseInt(lineText, 10);
    if (line > totalLines) {
        return { docFile, referencedPath, line, reason: 'line-out-of-range' };
    }
    return null;
};

/** 1つの Markdown ファイルから抽出した全参照を検証する。 */
const checkDocFile = (docFile: string): StaleReference[] => {
    const content = readFileSync(docFile, 'utf-8');
    const results: StaleReference[] = [];
    for (const match of content.matchAll(PATH_REFERENCE_PATTERN)) {
        const [, referencedPath, lineText] = match;
        const stale = checkReference(docFile, referencedPath, lineText);
        if (stale) {
            results.push(stale);
        }
    }
    return results;
};

/** 検出結果を「対応が必要」「既知の履歴ログ（対応不要）」の2バケットに分ける。 */
export const partitionReferences = (
    references: readonly StaleReference[],
): { stale: StaleReference[]; historical: StaleReference[] } => ({
    stale: references.filter((ref) => !isKnownHistoricalLog(ref.docFile)),
    historical: references.filter((ref) => isKnownHistoricalLog(ref.docFile)),
});

if (import.meta.main) {
    const docFiles = listMarkdownFiles(DOCS_DIR);
    const allReferences = docFiles.flatMap((docFile) => checkDocFile(docFile));
    const { stale: staleReferences, historical: historicalReferences } =
        partitionReferences(allReferences);

    console.log(
        `${DOCS_DIR}/ 配下の Markdown ${docFiles.length} 件からコードパス参照を検証しました。`,
    );

    if (staleReferences.length === 0) {
        console.log('✅ 参照切れ・行番号超過は見つかりませんでした。');
    } else {
        console.log(
            `ℹ️  参照に問題がある可能性のある箇所（${staleReferences.length}件）:`,
        );
        for (const ref of staleReferences) {
            const detail =
                ref.reason === 'missing-file'
                    ? '参照先ファイルが存在しません'
                    : `行番号 ${ref.line} がファイルの行数を超えています`;
            console.log(
                `  ${ref.docFile} → \`${ref.referencedPath}\`: ${detail}`,
            );
        }
    }

    if (historicalReferences.length > 0) {
        console.log(
            `📜 既知の履歴ログ内の参照（${historicalReferences.length}件、対応不要）: ` +
                `${KNOWN_HISTORICAL_LOGS.join(', ')} は追記専用ログのため、過去エントリの` +
                'パス陳腐化は仕様です。',
        );
    }
}
