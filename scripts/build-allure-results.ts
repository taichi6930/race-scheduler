#!/usr/bin/env bun
/**
 * build-allure-results.ts
 *
 * これまで `allure:generate` は「JUnit XMLをフラット化 → allure-commandline generate に
 * そのまま渡す」経路だったが、これだと Allure の Behaviors/Packages タブが機能しない
 * ことが実機検証で判明した：allure-commandline の JUnit XML リーダーは `<testcase>` 内の
 * `<properties>` を Allure の label（epic/feature/story等、Behaviors/Packagesタブの
 * グルーピングに使われる）ではなく「parameters」（テスト詳細画面の付随情報）としてしか
 * 扱わない。Behaviors タブを実データで埋めるには、JUnit XML経由をやめ、Allureのネイティブ
 * 結果フォーマット（`<uuid>-result.json`、`labels` 配列で epic/feature/story/suite/package を
 * 直接指定）で結果を書き出す必要がある。
 *
 * 本スクリプトは generate-test-report.ts の `parseJUnitFile`（describe/it構造への
 * パーサ、既存のHTMLレポート生成でも使っている資産）を再利用し、bun test の
 * JUnit出力から Allure ネイティブ結果ファイルを直接生成する。
 *
 * ラベルの割り当て:
 *   - epic    = レイヤー名（UT/Component/sIT/UAT）→ Behaviors タブの最上位グルーピング
 *   - feature = パッケージ名（core/api/batch/...）→ Behaviors タブの第2階層
 *   - story   = describe階層（例: "outer > inner"）→ Behaviors タブの第3階層
 *   - parentSuite/suite/subSuite = レイヤー/ファイル相対パス/describe階層 → Suites タブの3階層
 *   - package = パッケージ名以下をドット区切りにしたもの → Packages タブのツリー表示
 *   - severity（ALLURE-08, CICD-65。設計書 §7.1）: UAT→`blocker`（デプロイ済み環境への疎通確認、
 *     落ちれば本番影響）、sIT→`critical`（実D1/実R2との結合破壊）、`@spec`タグ付きテスト→
 *     `critical`（`docs/specs/`のレジストリに載る重要仕様）、それ以外→`normal`（既定値）。
 *     レイヤーや`@spec`タグという「リポジトリに実在する根拠」だけで決め、
 *     決め打ちの重要度付けはしない
 *
 * `--events=<jsonl>` オプション（ALLURE-05）: `run-bun-layer-with-inspector.ts` が生成する
 * bun Inspector Protocol のイベント JSONL を渡すと、`lib/allureFromEvents.ts` の相関ルールで
 * 実アサーションメッセージ・テストケース単位の実時刻を使った結果を生成する
 * （`aidlc-docs/inception/application-design/allure-inspector-reporter-design.md` 参照）。
 * **events.jsonl は「任意の付加情報」**（同設計書 §3.2）: 未指定・存在しない・パース不能・
 * JUnit XML の `<testcase>` 件数と一致しない、のいずれかに該当する場合は黙って下記の
 * XML ベースの経路にフォールバックする（挙動は `--events` 導入前と完全に同一になる）。
 *
 * XML のみの経路（`--events` 未指定、またはフォールバック時）の既知の制約: bun test の
 * `--reporter=junit` は失敗の詳細メッセージ・スタックトレースを一切出力しない
 * （`<failure type="AssertionError" />` のように type 属性のみ。実機検証済み）。そのため
 * Categoriesタブ・失敗詳細で表示できるのは type 属性ベースの粗い分類に留まる。
 * Timeline タブ向けの start/stop 時刻も、JUnit XML にはテストケース単位の実時刻が無いため
 * スクリプト実行時刻を起点にした合成値になる。
 *
 * 使い方:
 *   bun scripts/build-allure-results.ts <ut|component|sit|uat> <input.xml> <outputDir> [--events=<events.jsonl>]
 *
 * 入力ファイル（input.xml）が存在しない場合は何もせず終了する（レイヤー未実行時のスキップと同じ扱い）。
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { TestNode } from './generate-test-report';
import {
    determinePackage,
    extractSpecTags,
    parseJUnitFile,
} from './generate-test-report';
import type {
    AllureCaseStatus,
    AllureEventCase,
    AllureStatusDetails,
} from './lib/allureFromEvents';
import { buildCasesFromEvents } from './lib/allureFromEvents';
import type { InspectorEvent } from './lib/bunInspectorClient';

const ROOT = process.cwd();

const EPIC_LABEL_BY_LAYER_ARG: Record<string, string> = {
    ut: 'UT',
    component: 'Component',
    sit: 'sIT',
    uat: 'UAT',
};

interface FlatCase {
    describePath: string[];
    name: string;
    status: 'pass' | 'fail' | 'skip';
    timeMs: number;
    failureType?: string;
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
            failureType: node.failureType,
        });
        return;
    }
    const nextPath = node.name ? [...describePath, node.name] : describePath;
    for (const child of node.children) flattenNode(child, nextPath, out);
};

const toAllureStatus = (
    status: FlatCase['status'],
): AllureEventCase['status'] =>
    status === 'pass' ? 'passed' : status === 'fail' ? 'failed' : 'skipped';

/** `packages/core/test/unittest/foo.test.ts` → `core.test.unittest.foo` のような
 * ドット区切りのJavaパッケージ風文字列に変換する（Packagesタブのツリー表示用）。 */
const toPackageLabel = (relPath: string): string =>
    relPath
        .replace(/^packages\//, '')
        .replace(/\.test\.ts$/, '')
        .split('/')
        .join('.');

const buildHistoryId = (
    layerArg: string,
    relPath: string,
    describePath: string[],
    name: string,
): string =>
    createHash('sha1')
        .update(`${layerArg}:${relPath}#${[...describePath, name].join(' > ')}`)
        .digest('hex');

/** JUnit XML から Allure 書き込み用のケース列を組み立てる（従来からの経路）。 */
const buildXmlCaseInputs = (inputPath: string): AllureEventCase[] => {
    const files = parseJUnitFile(inputPath);
    let cursor = Date.now();
    const inputs: AllureEventCase[] = [];
    for (const file of files) {
        const cases: FlatCase[] = [];
        flattenNode(file.root, [], cases);
        for (const c of cases) {
            const start = cursor;
            const stop = start + c.timeMs;
            cursor = stop;
            inputs.push({
                relPath: file.relPath,
                describePath: c.describePath,
                name: c.name,
                status: toAllureStatus(c.status),
                statusDetails:
                    c.status === 'fail'
                        ? { message: c.failureType ?? 'Failed' }
                        : undefined,
                start,
                stop,
            });
        }
    }
    return inputs;
};

/**
 * `events.jsonl` をパースする。ファイルが無い・1行でもJSONとして壊れている場合は
 * null を返す（呼び出し側でXML経路へフォールバックする）。
 */
const tryParseEventsFile = (eventsPath: string): InspectorEvent[] | null => {
    if (!existsSync(eventsPath)) return null;
    try {
        // SAFETY: bun test --reporter=... が出力する自前フォーマットの events.jsonl であり、
        // 各行の構造は本スクリプトが期待するInspectorEvent形状で固定されている（不正な行はtry/catchでnullにフォールバック）
        return readFileSync(eventsPath, 'utf8')
            .split('\n')
            .filter((line) => line.length > 0)
            .map((line) => JSON.parse(line) as InspectorEvent);
    } catch {
        return null;
    }
};

/**
 * イベント経路のケース列を組み立てる。XML から得られる `<testcase>` 件数と一致しない場合は
 * null を返す（設計書 §5-2 の整合性チェック。件数不一致＝プロトコル変更等で信頼できない証拠）。
 */
const tryBuildEventCaseInputs = (
    eventsPath: string,
    expectedCount: number,
): AllureEventCase[] | null => {
    const events = tryParseEventsFile(eventsPath);
    if (!events) return null;
    const cases = buildCasesFromEvents(events, ROOT);
    if (cases.length !== expectedCount) {
        console.log(
            `[build-allure-results] events(${cases.length})とXML(${expectedCount})の件数が一致しないためXML経路にフォールバックします`,
        );
        return null;
    }
    return cases;
};

/**
 * `relPath` のテストファイルが `@spec` タグを含むか判定する。`extractSpecTags` は
 * ファイル内容を必要とするため、同一ファイルの複数テストケースで無駄な再読み込みを
 * しないよう `cache` に結果を記憶する。
 */
const hasSpecTag = (relPath: string, cache: Map<string, boolean>): boolean => {
    const cached = cache.get(relPath);
    if (cached !== undefined) return cached;
    let result = false;
    try {
        result =
            extractSpecTags(readFileSync(join(ROOT, relPath), 'utf8')).length >
            0;
    } catch {
        result = false;
    }
    cache.set(relPath, result);
    return result;
};

type AllureSeverity = 'blocker' | 'critical' | 'normal';

const determineSeverity = (
    layerArg: string,
    relPath: string,
    specTagCache: Map<string, boolean>,
): AllureSeverity => {
    if (layerArg === 'uat') return 'blocker';
    if (layerArg === 'sit') return 'critical';
    if (hasSpecTag(relPath, specTagCache)) return 'critical';
    return 'normal';
};

/** Allureのネイティブ結果フォーマット（1テストケース分のresult.json）。 */
interface AllureResultJson {
    uuid: string;
    historyId: string;
    name: string;
    fullName: string;
    status: AllureCaseStatus;
    stage: 'finished';
    start: number;
    stop: number;
    labels: { name: string; value: string }[];
    statusDetails?: AllureStatusDetails;
    attachments?: { name: string; source: string; type: string }[];
}

const writeResult = (
    layerArg: string,
    epic: string,
    outputDir: string,
    input: AllureEventCase,
    specTagCache: Map<string, boolean>,
): void => {
    const feature = determinePackage(input.relPath);
    const packageLabel = toPackageLabel(input.relPath);
    const story = input.describePath.join(' > ') || basename(input.relPath);
    const result: AllureResultJson = {
        uuid: randomUUID(),
        historyId: buildHistoryId(
            layerArg,
            input.relPath,
            input.describePath,
            input.name,
        ),
        name: input.name,
        fullName: `${input.relPath}#${story} > ${input.name}`,
        status: input.status,
        stage: 'finished',
        start: input.start,
        stop: input.stop,
        labels: [
            { name: 'epic', value: epic },
            { name: 'feature', value: feature },
            { name: 'story', value: story },
            // Suitesタブの3階層グルーピング（CICD-67）: parentSuite=レイヤー、
            // suite=ファイル相対パス、subSuite=describe階層。describePathが空の場合
            // （describeで囲まれていないトップレベルのit）はsubSuiteを付与しない
            // （AllureはsubSuiteが無ければ単にその階層を省略する）
            { name: 'parentSuite', value: epic },
            { name: 'suite', value: input.relPath },
            { name: 'package', value: packageLabel },
            {
                name: 'severity',
                value: determineSeverity(layerArg, input.relPath, specTagCache),
            },
            ...(input.describePath.length > 0
                ? [{ name: 'subSuite', value: input.describePath.join(' > ') }]
                : []),
        ],
    };
    if (input.statusDetails) result.statusDetails = input.statusDetails;
    if (input.consoleMessages && input.consoleMessages.length > 0) {
        // ALLURE-10: console出力をAllureのattachment（別ファイル+参照）として書き出す。
        // Allureのネイティブ結果フォーマットはattachment本文をresult jsonに直接埋め込まず、
        // 同一ディレクトリの別ファイルをsourceで参照する規約のため、ここでも同様にする。
        const attachmentId = randomUUID();
        const attachmentFileName = `${attachmentId}-attachment.txt`;
        writeFileSync(
            `${outputDir}/${attachmentFileName}`,
            input.consoleMessages.join('\n'),
        );
        result.attachments = [
            {
                name: 'Console output',
                source: attachmentFileName,
                type: 'text/plain',
            },
        ];
    }
    writeFileSync(
        `${outputDir}/${result.uuid}-result.json`,
        JSON.stringify(result),
    );
};

const buildResults = (
    layerArg: string,
    inputPath: string,
    outputDir: string,
    eventsPath?: string,
): number => {
    const epic = EPIC_LABEL_BY_LAYER_ARG[layerArg];
    if (!epic) {
        throw new Error(
            `unknown layer "${layerArg}" (expected one of: ${Object.keys(EPIC_LABEL_BY_LAYER_ARG).join(', ')})`,
        );
    }
    const xmlCaseInputs = buildXmlCaseInputs(inputPath);
    const caseInputs =
        (eventsPath &&
            tryBuildEventCaseInputs(eventsPath, xmlCaseInputs.length)) ||
        xmlCaseInputs;
    const specTagCache = new Map<string, boolean>();
    for (const input of caseInputs)
        writeResult(layerArg, epic, outputDir, input, specTagCache);
    return caseInputs.length;
};

const main = (): void => {
    const rawArgs = process.argv.slice(2);
    const eventsFlag = rawArgs.find((a) => a.startsWith('--events='));
    const eventsPath = eventsFlag?.slice('--events='.length);
    const [layerArg, inputPath, outputDir] = rawArgs.filter(
        (a) => !a.startsWith('--events='),
    );
    if (!layerArg || !inputPath || !outputDir) {
        console.error(
            'Usage: bun scripts/build-allure-results.ts <ut|component|sit|uat> <input.xml> <outputDir> [--events=<events.jsonl>]',
        );
        process.exit(1);
    }
    if (!existsSync(inputPath)) {
        console.log(`skip: ${inputPath} not found`);
        return;
    }
    mkdirSync(outputDir, { recursive: true });
    const written = buildResults(layerArg, inputPath, outputDir, eventsPath);
    console.log(`wrote ${written} allure result(s) for layer "${layerArg}"`);
};

if (import.meta.main) {
    main();
}

export { buildResults, toPackageLabel };
