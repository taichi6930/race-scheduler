#!/usr/bin/env bun
/**
 * check-generated-dirs-excluded.ts
 *
 * 生成物ディレクトリ（`coverage/` `test-report/` `.dart_tool/` `build/` `.wrangler/`）が
 * `.gitignore` で除外されていることを検証する（TOK-062）。`.gitignore` 済みでも
 * worktree に生成物が残っていると、Glob/Read が誤って生成物を探索対象に含めてしまう
 * 事故要因になるため、除外設定そのものの欠落を機械的に検知する。
 *
 * 探索対象ツール（Claude Code の Glob 等）の除外設定は本リポジトリには `.gitignore` しか
 * 存在しない（`.claudeignore` / `.rgignore` 等の専用ファイルは無い）。`Bun.Glob` の
 * scan は既定で `.gitignore` を尊重するため（本スクリプトの動作でも確認済み）、
 * `.gitignore` への記載が唯一かつ十分な一次情報源となる。
 *
 * 読み取り専用の診断スクリプト。副作用は無い。
 *
 * 使い方:
 *   bun scripts/check-generated-dirs-excluded.ts
 */

/* eslint-disable no-console */
import { readFileSync } from 'node:fs';

/** 除外されているべき生成物ディレクトリ（末尾スラッシュ無しの名前で管理） */
const EXPECTED_DIRS = [
    'coverage',
    'test-report',
    '.dart_tool',
    'build',
    '.wrangler',
];

/**
 * `.gitignore` の1行が対象ディレクトリ名を除外パターンとして含むかを判定する。
 * 先頭・末尾の `/` やコメント・空行を考慮した緩やかな一致判定（例:
 * `coverage/` `/build/` `.dart_tool/` のいずれも一致する）。
 * @param line - `.gitignore` の1行
 * @param dirName - 判定対象のディレクトリ名（例: `coverage`）
 * @returns 一致すれば true
 */
const lineMatchesDir = (line: string, dirName: string): boolean => {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
        return false;
    }
    const normalized = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
    return normalized === dirName;
};

/**
 * `.gitignore` ファイル群を走査し、対象ディレクトリ名が1件でも除外指定されているかを判定する。
 * @param gitignorePaths - 走査対象の `.gitignore` パス一覧
 * @param dirName - 判定対象のディレクトリ名
 * @returns 一致した `.gitignore` のパス（無ければ undefined）
 */
const findMatchingGitignore = (
    gitignorePaths: string[],
    dirName: string,
): string | undefined => {
    for (const path of gitignorePaths) {
        let content: string;
        try {
            content = readFileSync(path, 'utf-8');
        } catch {
            continue;
        }
        if (content.split('\n').some((line) => lineMatchesDir(line, dirName))) {
            return path;
        }
    }
    return undefined;
};

const main = async (): Promise<void> => {
    const gitignoreGlob = new Bun.Glob('**/.gitignore');
    const gitignorePaths = await Array.fromAsync(
        gitignoreGlob.scan({ cwd: '.', dot: true }),
    );

    if (gitignorePaths.length === 0) {
        console.error(
            '❌ .gitignore が1件も見つかりません（リポジトリ構成の異常の可能性）',
        );
        process.exit(1);
    }

    const missing: string[] = [];
    for (const dirName of EXPECTED_DIRS) {
        const matched = findMatchingGitignore(gitignorePaths, dirName);
        if (!matched) {
            missing.push(dirName);
        }
    }

    if (missing.length > 0) {
        console.error(
            `❌ 以下の生成物ディレクトリが .gitignore に見つかりません（探索対象に混入する事故要因）:\n` +
                `   ${missing.join(', ')}\n` +
                `   いずれかの .gitignore（ルートまたは packages/*/.gitignore）に追加してください。`,
        );
        process.exit(1);
    }

    console.log(
        `✅ 生成物ディレクトリ（${EXPECTED_DIRS.join(', ')}）はすべて .gitignore（${gitignorePaths.length}件を走査）で除外されています`,
    );
};

await main();
