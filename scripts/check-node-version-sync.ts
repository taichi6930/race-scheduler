#!/usr/bin/env bun
/**
 * check-node-version-sync.ts (QSYNC-09)
 *
 * Node.jsのメジャーバージョンは`.nvmrc`（一次情報源、`.claude/docs/ci-conventions.md`
 * DEP-001）・`package.json`の`engines.node`・`package.json`の`devDependencies['@types/node']`
 * の3箇所に手書きで重複しており、`.nvmrc`だけ更新して他2箇所を更新し忘れても
 * 機械的には検知されなかった。3箇所のメジャーバージョンが一致することを検証する。
 *
 * 併せて、`.github/dependabot.yml`に`@types/node`のmajorバンプを無視するignoreルールが
 * 残っていることも確認する（DEP-001対応時にこのルールごと消してしまうと、
 * engines.nodeより先にdependabotが`@types/node`のmajor更新PRを出してしまう）。
 *
 * 使い方: bun scripts/check-node-version-sync.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const NVMRC_PATH = join(import.meta.dir, '../.nvmrc');
const PACKAGE_JSON_PATH = join(import.meta.dir, '../package.json');
const DEPENDABOT_PATH = join(import.meta.dir, '../.github/dependabot.yml');

interface PackageJson {
    engines?: { node?: string };
    devDependencies?: { '@types/node'?: string };
}

/**
 * バージョン文字列の先頭からメジャーバージョン番号を抽出する。
 * `24` `>=24.0.0 <25.0.0` `^24.13.3` のいずれの形式にも対応する
 * （最初に現れる数値をメジャーバージョンとみなす）。
 * @param raw - バージョンを含む文字列
 * @returns メジャーバージョン番号。数値が見つからない場合は null
 */
export function extractMajorVersion(raw: string): number | null {
    const match = raw.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : null;
}

/**
 * `.nvmrc`・`package.json`（engines.node / @types/node）の3箇所から
 * メジャーバージョンを抽出する。
 * @param nvmrcContent - `.nvmrc`の内容
 * @param packageJson - パースした`package.json`
 * @returns 3箇所それぞれのメジャーバージョン（抽出できなければ null）
 */
export function extractVersions(
    nvmrcContent: string,
    packageJson: PackageJson,
): {
    nvmrc: number | null;
    enginesNode: number | null;
    typesNode: number | null;
} {
    return {
        nvmrc: extractMajorVersion(nvmrcContent),
        enginesNode: packageJson.engines?.node
            ? extractMajorVersion(packageJson.engines.node)
            : null,
        typesNode: packageJson.devDependencies?.['@types/node']
            ? extractMajorVersion(packageJson.devDependencies['@types/node'])
            : null,
    };
}

/**
 * 3箇所のメジャーバージョンが一致しない場合、不一致メッセージの一覧を返す。
 * @param versions - {@link extractVersions} の戻り値
 * @returns 不一致メッセージの一覧（一致していれば空配列）
 */
export function findVersionMismatches(versions: {
    nvmrc: number | null;
    enginesNode: number | null;
    typesNode: number | null;
}): string[] {
    const entries: [string, number | null][] = [
        ['.nvmrc', versions.nvmrc],
        ['package.json engines.node', versions.enginesNode],
        ["package.json devDependencies['@types/node']", versions.typesNode],
    ];
    const messages: string[] = [];
    for (const [label, value] of entries) {
        if (value === null) {
            messages.push(`${label}: メジャーバージョンを抽出できませんでした`);
        }
    }
    const found = entries
        .map(([, value]) => value)
        .filter((value): value is number => value !== null);
    const allMatch = found.every((value) => value === found[0]);
    if (!allMatch) {
        for (const [label, value] of entries) {
            messages.push(
                `${label}: ${value === null ? '(抽出失敗)' : String(value)}`,
            );
        }
    }
    return messages;
}

if (import.meta.main) {
    const nvmrcContent = readFileSync(NVMRC_PATH, 'utf-8');
    // SAFETY: このリポジトリ自身の package.json を読むだけであり、engines/devDependenciesは任意項目として ?. で扱う
    const packageJson = JSON.parse(
        readFileSync(PACKAGE_JSON_PATH, 'utf-8'),
    ) as PackageJson;
    const dependabotContent = readFileSync(DEPENDABOT_PATH, 'utf-8');

    const versions = extractVersions(nvmrcContent, packageJson);
    const mismatches = findVersionMismatches(versions);

    const hasTypesNodeIgnoreRule = /@types\/node[\s\S]*?semver-major/.test(
        dependabotContent,
    );

    if (mismatches.length > 0) {
        console.error(
            '❌ Node.jsメジャーバージョンが .nvmrc / package.json 間で一致していません:',
        );
        for (const message of mismatches) {
            console.error(`  - ${message}`);
        }
        console.error(
            '  .claude/docs/ci-conventions.md の「Node バージョン固定の更新タイミング（DEP-001）」に従い、3箇所を揃えてください。',
        );
        process.exit(1);
    }

    if (!hasTypesNodeIgnoreRule) {
        console.error(
            '❌ .github/dependabot.yml に @types/node のmajorバンプを無視するignoreルールが見つかりません。' +
                'engines.nodeを更新する前にdependabotがmajor更新PRを出してしまう可能性があります。',
        );
        process.exit(1);
    }

    console.log(
        `✅ Node.jsメジャーバージョン v${String(versions.nvmrc)} が .nvmrc / package.json で一致し、` +
            'dependabotの@types/node major除外ルールも存在します。',
    );
}
