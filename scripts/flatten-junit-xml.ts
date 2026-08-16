#!/usr/bin/env bun
/**
 * flatten-junit-xml.ts
 *
 * `bun test --reporter=junit` が出力する JUnit XML は、ネストした describe を
 * ネストした `<testsuite>` としてそのまま出力する（例:
 * `<testsuites><testsuite><testsuite><testcase/></testsuite></testsuite></testsuites>`）。
 * この入れ子構造は標準的な JUnit XML（Surefire/Ant系: `<testsuites>` 直下の
 * `<testsuite>` が `<testcase>` を直接持つフラット構造）を前提とする下流ツール
 * （Allure・dorny/test-reporter 等）では正しく解釈されず、0件として扱われる
 * （実機検証済み）。
 *
 * 本スクリプトは generate-test-report.ts の JUnit パーサ（`parseJUnitFile`）を再利用して
 * 入れ子構造を一度ツリーに展開し、describe階層をテストケース名に畳み込んだ
 * フラットな `<testsuites><testsuite><testcase/></testsuite></testsuites>` を再出力する。
 *
 * 副次効果: bun の JUnit レポーターは特定の条件下でテスト名中のマルチバイト文字を
 * 破損させることがある（it.each のテンプレート値展開まわりの既知不具合と推測、
 * 例: "・" の3バイトUTF-8シーケンスが2バイトに欠落する）。`parseJUnitFile` は
 * 生バイトを厳密パースせず `readFileSync(path, 'utf8')` の寛容なデコード
 * （不正シーケンスは U+FFFD へ置換）を経由するため、本スクリプトを通すことで
 * 不正なUTF-8バイト列も同時に正規化される（Allure/dorny側の厳密XMLパーサが
 * 不正バイトで丸ごと読み込み失敗するのを防ぐ）。
 *
 * 使い方:
 *   bun scripts/flatten-junit-xml.ts <input.xml> <output.xml>
 *
 * 入力ファイルが存在しない場合は何もせず終了する（レイヤー未実行時のスキップと同じ扱い）。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TestNode } from './generate-test-report';
import { parseJUnitFile } from './generate-test-report';

const escapeXml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

interface FlatCase {
    describePath: string[];
    name: string;
    status: 'pass' | 'fail' | 'skip';
    timeMs: number;
}

const flattenNode = (
    node: TestNode,
    describePath: string[],
    out: FlatCase[],
): void => {
    if (node.kind === 'case') {
        out.push({
            describePath,
            name: node.name,
            status: node.status,
            timeMs: node.timeMs,
        });
        return;
    }
    const nextPath = node.name ? [...describePath, node.name] : describePath;
    for (const child of node.children) flattenNode(child, nextPath, out);
};

const buildFlatXml = (inputPath: string): string => {
    const files = parseJUnitFile(inputPath);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n';
    for (const file of files) {
        const cases: FlatCase[] = [];
        flattenNode(file.root, [], cases);
        const failures = cases.filter((c) => c.status === 'fail').length;
        const skipped = cases.filter((c) => c.status === 'skip').length;
        const totalTime = cases.reduce((sum, c) => sum + c.timeMs, 0) / 1000;
        xml += `  <testsuite name="${escapeXml(file.relPath)}" tests="${cases.length}" failures="${failures}" skipped="${skipped}" time="${totalTime.toFixed(3)}">\n`;
        for (const c of cases) {
            const fullName = [...c.describePath, c.name].join(' > ');
            xml += `    <testcase name="${escapeXml(fullName)}" classname="${escapeXml(file.relPath)}" time="${(c.timeMs / 1000).toFixed(3)}">\n`;
            if (c.status === 'fail')
                xml += '      <failure message="failed" />\n';
            if (c.status === 'skip') xml += '      <skipped />\n';
            xml += '    </testcase>\n';
        }
        xml += '  </testsuite>\n';
    }
    xml += '</testsuites>\n';
    return xml;
};

const main = (): void => {
    const [inputPath, outputPath] = process.argv.slice(2);
    if (!inputPath || !outputPath) {
        console.error(
            'Usage: bun scripts/flatten-junit-xml.ts <input.xml> <output.xml>',
        );
        process.exit(1);
    }
    if (!existsSync(inputPath)) {
        console.log(`skip: ${inputPath} not found`);
        return;
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, buildFlatXml(inputPath));
    console.log(`wrote ${outputPath}`);
};

if (import.meta.main) {
    main();
}

export { buildFlatXml };
