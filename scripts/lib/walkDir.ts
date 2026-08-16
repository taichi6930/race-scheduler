/**
 * @file ディレクトリ再帰走査の共通ヘルパー
 *
 * check-doc-duplication.ts / generate-test-report.ts / spec-coverage.ts /
 * test-gap-analysis.ts の4スクリプトにほぼ同一のディレクトリ再帰走査ロジックが
 * 重複していたため共通化した。
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ディレクトリを再帰的に走査し、条件に合致するファイルパスの一覧を返す。
 * readdir/statの失敗（権限エラー・シンボリックリンク切れ等）は無視して走査を続行する。
 * @param dir - 走査対象ディレクトリ
 * @param predicate - ファイルを結果に含めるかどうかの判定関数（省略時は全ファイルを含める）
 * @param acc - 再帰呼び出し用の累積配列（呼び出し側から指定する必要はない）
 * @returns 条件に合致したファイルパスの一覧
 */
export const walkDir = (
    dir: string,
    predicate: (fullPath: string) => boolean = () => true,
    acc: string[] = [],
): string[] => {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return acc;
    }
    for (const name of entries) {
        const full = join(dir, name);
        let stat: ReturnType<typeof statSync>;
        try {
            stat = statSync(full);
        } catch {
            continue;
        }
        if (stat.isDirectory()) {
            walkDir(full, predicate, acc);
        } else if (stat.isFile() && predicate(full)) {
            acc.push(full);
        }
    }
    return acc;
};
