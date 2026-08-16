#!/usr/bin/env bun
/**
 * check-pubspec-lockfile-drift.ts
 *
 * AIEFF-069対応: `packages/front/pubspec.yaml` を手編集した後に `flutter pub get`
 * （lockfile再生成）を忘れると、宣言した依存が `pubspec.lock` に反映されないまま
 * ズレた状態で放置されうる。直接依存（`dependencies:`/`dev_dependencies:`）が
 * `pubspec.lock` に `direct main`/`direct dev` として存在し、かつロック済みバージョンが
 * `pubspec.yaml` のバージョン制約を満たしているかを機械的に検証する（読み取り専用）。
 *
 * 対応範囲: `^x.y.z`（caret）と完全一致バージョンのみ判定する。`sdk:`/`path:`/`git:`
 * 等のホスト外依存や複合レンジ（`>=1.0.0 <2.0.0` 等）は判定対象外としてスキップ報告する
 * （誤検知よりスキップを優先する設計）。
 *
 * 使い方:
 *   bun scripts/check-pubspec-lockfile-drift.ts [pubspec.yamlのディレクトリ]
 *   （省略時は packages/front）
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DriftIssue {
    name: string;
    kind: 'missing-in-lock' | 'transitive-only' | 'version-mismatch';
    detail: string;
}

interface LockEntry {
    version: string;
    dependency: string;
}

/**
 * `pubspec.yaml` の `dependencies:`/`dev_dependencies:` から
 * 単純なバージョン制約（`name: ^x.y.z` 形式）を持つ直接依存のみ抽出する
 * @param yamlContent - pubspec.yaml の内容
 * @returns パッケージ名 → バージョン制約文字列
 */
export function parseYamlDirectDependencies(
    yamlContent: string,
): Map<string, string> {
    const result = new Map<string, string>();
    const lines = yamlContent.split('\n');
    let inTargetSection = false;
    for (const rawLine of lines) {
        if (/^(dependencies|dev_dependencies):\s*$/.test(rawLine)) {
            inTargetSection = true;
            continue;
        }
        if (!inTargetSection) {
            continue;
        }
        // 0-indentの新しいトップレベルキーが来たらセクション終了
        if (/^\S/.test(rawLine)) {
            inTargetSection = false;
            continue;
        }
        const match = /^ {2}([\w.]+):\s*(\S.*)?$/.exec(rawLine);
        if (!match) {
            continue;
        }
        const [, name, value] = match;
        if (!value) {
            // `flutter:` の下に `sdk: flutter` が続く形式など、行内に制約が無いものはスキップ
            continue;
        }
        result.set(name, value.trim());
    }
    return result;
}

/**
 * `pubspec.lock` の `packages:` から各パッケージの解決バージョンと依存種別を抽出する
 * @param lockContent - pubspec.lock の内容
 * @returns パッケージ名 → { version, dependency }
 */
export function parseLockPackages(lockContent: string): Map<string, LockEntry> {
    const result = new Map<string, LockEntry>();
    const lines = lockContent.split('\n');
    let currentName: string | null = null;
    let currentDependency = '';
    let currentVersion = '';
    const flush = (): void => {
        if (currentName) {
            result.set(currentName, {
                dependency: currentDependency,
                version: currentVersion,
            });
        }
    };
    for (const rawLine of lines) {
        const nameMatch = /^ {2}([\w.]+):\s*$/.exec(rawLine);
        if (nameMatch) {
            flush();
            currentName = nameMatch[1];
            currentDependency = '';
            currentVersion = '';
            continue;
        }
        const depMatch = /^ {4}dependency:\s*"?([\w ]+?)"?\s*$/.exec(rawLine);
        if (depMatch) {
            currentDependency = depMatch[1].trim();
            continue;
        }
        const versionMatch = /^ {4}version:\s*"?([\w.+-]+)"?\s*$/.exec(rawLine);
        if (versionMatch) {
            currentVersion = versionMatch[1];
        }
    }
    flush();
    return result;
}

/**
 * バージョン文字列（`x.y.z`、ビルド識別子は無視）を比較用タプルに変換する
 * @param version - バージョン文字列
 * @returns [major, minor, patch]
 */
function toTuple(version: string): [number, number, number] {
    const core = version.split('+')[0];
    const [major, minor, patch] = core
        .split('.')
        .map((n) => Number.parseInt(n, 10) || 0);
    return [major, minor, patch];
}

/**
 * バージョンタプルを比較する
 * @param a - 比較対象1
 * @param b - 比較対象2
 * @returns a<b なら負、a>b なら正、等しければ0
 */
function compareTuples(
    a: [number, number, number],
    b: [number, number, number],
): number {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) {
            return a[i] - b[i];
        }
    }
    return 0;
}

/**
 * ロック済みバージョンが `pubspec.yaml` の制約を満たすか判定する
 * @param lockedVersion - pubspec.lock 上のバージョン
 * @param constraint - pubspec.yaml 上の制約文字列
 * @returns 判定結果。対応外の制約構文は `null`（スキップ対象）を返す
 */
export function satisfiesConstraint(
    lockedVersion: string,
    constraint: string,
): boolean | null {
    if (/^\d+\.\d+\.\d+/.test(constraint)) {
        return compareTuples(toTuple(lockedVersion), toTuple(constraint)) === 0;
    }
    const caretMatch = /^\^(\d+)\.(\d+)\.(\d+)/.exec(constraint);
    if (!caretMatch) {
        return null;
    }
    const [, majorStr, minorStr] = caretMatch;
    const major = Number.parseInt(majorStr, 10);
    const minor = Number.parseInt(minorStr, 10);
    const lower = toTuple(constraint.slice(1));
    const upper: [number, number, number] =
        major > 0 ? [major + 1, 0, 0] : [0, minor + 1, 0];
    const locked = toTuple(lockedVersion);
    return (
        compareTuples(locked, lower) >= 0 && compareTuples(locked, upper) < 0
    );
}

/**
 * 直接依存とロックファイルの整合性を突き合わせる
 * @param yamlDeps - `parseYamlDirectDependencies` の出力
 * @param lockPackages - `parseLockPackages` の出力
 * @returns ドリフト検出結果（問題が無ければ空配列）
 */
export function checkDrift(
    yamlDeps: Map<string, string>,
    lockPackages: Map<string, LockEntry>,
): DriftIssue[] {
    const issues: DriftIssue[] = [];
    for (const [name, constraint] of yamlDeps) {
        const entry = lockPackages.get(name);
        if (!entry) {
            issues.push({
                name,
                kind: 'missing-in-lock',
                detail: `pubspec.yamlに宣言されているが pubspec.lock に存在しない（制約: ${constraint}）`,
            });
            continue;
        }
        if (!entry.dependency.startsWith('direct')) {
            issues.push({
                name,
                kind: 'transitive-only',
                detail: `pubspec.lockでは transitive 扱い（direct として記録されていない）`,
            });
            continue;
        }
        const ok = satisfiesConstraint(entry.version, constraint);
        if (ok === false) {
            issues.push({
                name,
                kind: 'version-mismatch',
                detail: `pubspec.lock=${entry.version} が pubspec.yaml の制約 ${constraint} を満たさない`,
            });
        }
    }
    return issues;
}

if (import.meta.main) {
    const targetDir =
        process.argv[2] ?? join(import.meta.dir, '..', 'packages', 'front');
    const yamlContent = readFileSync(join(targetDir, 'pubspec.yaml'), 'utf8');
    const lockContent = readFileSync(join(targetDir, 'pubspec.lock'), 'utf8');

    const issues = checkDrift(
        parseYamlDirectDependencies(yamlContent),
        parseLockPackages(lockContent),
    );

    if (issues.length === 0) {
        // eslint-disable-next-line no-console
        console.log(
            '✅ pubspec.yaml と pubspec.lock の間にドリフトは検出されませんでした',
        );
        process.exit(0);
    }

    // eslint-disable-next-line no-console
    console.log(`⚠️  ${issues.length} 件のドリフトを検出しました:`);
    for (const issue of issues) {
        // eslint-disable-next-line no-console
        console.log(`   - [${issue.kind}] ${issue.name}: ${issue.detail}`);
    }
    process.exit(1);
}
