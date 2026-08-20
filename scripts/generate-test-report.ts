#!/usr/bin/env bun
/**
 * generate-test-report.ts
 *
 * UT/コンポーネント/sIT/E2E/UAT（TSパッケージ）と front（Flutter）の「何がテストされているか」
 * （ファイル一覧・describe/itの構造・デシジョンテーブル・@specタグ）と
 * 「直近の実行結果」（pass/fail/skip・実行時間）を1枚の自己完結HTMLに統合する。
 *
 * spec-coverage.ts / test-gap-analysis.ts の兄弟ツール。あちらが「仕様充足」「カバレッジ%」を
 * 測るのに対し、これは「テストの一覧性・可読性」（何をテストしているかを人間が一目で追える）を
 * 目的とする。
 *
 * 使い方:
 *   bun scripts/generate-test-report.ts run --layers=ut,component   # テストを実行し test-report/raw/ に結果を保存
 *   bun scripts/generate-test-report.ts run --layers=ut,component,sit,uat,front
 *   bun scripts/generate-test-report.ts build                       # raw結果 + 静的ファイル走査 から HTML/JSON を生成
 *
 * run は個々のレイヤーのテストが失敗しても（そのレイヤーの結果を fail として記録した上で）
 * 後続レイヤーの実行・build を止めない。テスト未実行のレイヤーは build 側で
 * 「未実行」として静的一覧のみ表示する。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { walkDir } from './lib/walkDir';
import { runBunLayerWithInspector } from './run-bun-layer-with-inspector';
import type { SpecCoverageReport, Layer as SpecLayer } from './spec-coverage';
import { buildMermaidGraph } from './spec-coverage';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'test-report');
const RAW_DIR = join(OUT_DIR, 'raw');

const LAYERS = ['UT', 'Component', 'sIT', 'E2E', 'UAT', 'Golden'] as const;
type Layer = (typeof LAYERS)[number];

type TestStatus = 'pass' | 'fail' | 'skip';

interface TestCaseNode {
    kind: 'case';
    name: string;
    status: TestStatus;
    timeMs: number;
    /** `<failure type="...">` / `<error type="...">` の type 属性（bun test の junit reporter は
     *  message本文を出力しないため、Allure結果への分類に使える唯一の失敗種別情報）。 */
    failureType?: string;
}
interface TestGroupNode {
    kind: 'group';
    name: string;
    children: TestNode[];
}
type TestNode = TestCaseNode | TestGroupNode;

interface StaticFile {
    relPath: string;
    layer: Layer;
    pkg: string;
    specTags: string[];
    decisionTable: string | null;
}

interface DynamicFile {
    relPath: string;
    root: TestGroupNode;
}

/** テスト結果の pass/fail/skip 件数。 */
interface TestTotals {
    pass: number;
    fail: number;
    skip: number;
}

interface ReportFile extends StaticFile {
    executed: boolean;
    totals: TestTotals;
    root: TestGroupNode | null;
}

interface ReportSummaryCell {
    files: number;
    executedFiles: number;
    pass: number;
    fail: number;
    skip: number;
}

interface Report {
    generatedAt: string;
    files: ReportFile[];
    summary: Record<Layer, Record<string, ReportSummaryCell>>;
    notes: string[];
    hasAllureReport: boolean;
    coverage: CoveragePackage[] | null;
    specCoverage: SpecCoverageReport | null;
}

// ---- レイヤー判定（TS） ----

const TS_LAYER_PATTERNS: ReadonlyArray<readonly [Layer, RegExp]> = [
    ['UT', /^packages\/[^/]+\/test\/unittest\//],
    ['Component', /^packages\/[^/]+\/test\/integration\/component\//],
    ['sIT', /^packages\/[^/]+\/test\/integration\/system\//],
    ['E2E', /^tests\/e2e\/scenarios\//],
    ['UAT', /^tests\/uat\//],
];

// front（Flutter）はレイヤーのディレクトリ規約が異なる（testing-conventions.md 未記載の
// front固有パターン）: unittest→UT, integration/component→Component,
// golden（widgetのビジュアルスナップショット）→Golden（Componentとは別概念のため区別する）
const FRONT_LAYER_PATTERNS: ReadonlyArray<readonly [Layer, RegExp]> = [
    ['UT', /^packages\/front\/test\/unittest\//],
    ['Component', /^packages\/front\/test\/integration\/component\//],
    ['Golden', /^packages\/front\/test\/golden\//],
];

const determineLayer = (relPath: string): Layer | null => {
    for (const [layer, pattern] of [
        ...TS_LAYER_PATTERNS,
        ...FRONT_LAYER_PATTERNS,
    ]) {
        if (pattern.test(relPath)) return layer;
    }
    return null;
};

const determinePackage = (relPath: string): string => {
    const m = /^packages\/([^/]+)\//.exec(relPath);
    return m ? m[1] : 'root';
};

// ---- ユーティリティ ----

const toRelPath = (absPath: string): string =>
    relative(ROOT, absPath).split(sep).join('/');

const decodeXmlEntities = (s: string): string =>
    s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');

// ---- 静的スキャン: TSテストファイル（describe/it構造は実行結果から得るため、ここでは
//      @specタグとデシジョンテーブルのみ抽出する） ----

const extractSpecTags = (content: string): string[] => {
    const matches = [...content.matchAll(/@spec\s+(SPEC-[A-Z]+-\d+)/g)];
    return [...new Set(matches.map((m) => m[1]))];
};

const extractTsDecisionTable = (content: string): string | null => {
    const headerEnd = content.search(/\n(import |describe\()/);
    const header =
        headerEnd === -1 ? content.slice(0, 2000) : content.slice(0, headerEnd);
    const rows = header
        .split('\n')
        .map((l) => /^\s*\*\s?(\|.*\|)\s*$/.exec(l)?.[1])
        .filter((l): l is string => Boolean(l));
    return rows.length >= 2 ? rows.join('\n') : null;
};

const extractDartDecisionTable = (content: string): string | null => {
    const headerEnd = content.search(/\n(import |void main)/);
    const header =
        headerEnd === -1 ? content.slice(0, 2000) : content.slice(0, headerEnd);
    const rows = header
        .split('\n')
        .map((l) => /^\s*\/\/\s?(\|.*\|)\s*$/.exec(l)?.[1])
        .filter((l): l is string => Boolean(l));
    return rows.length >= 2 ? rows.join('\n') : null;
};

const scanStaticFiles = (): StaticFile[] => {
    const roots = [join(ROOT, 'packages'), join(ROOT, 'tests')];
    const files: StaticFile[] = [];
    for (const root of roots) {
        for (const abs of walkDir(root)) {
            const isTs = abs.endsWith('.test.ts');
            const isDart = abs.endsWith('_test.dart');
            if (!isTs && !isDart) continue;
            const relPath = toRelPath(abs);
            const layer = determineLayer(relPath);
            if (!layer) continue;
            const content = readFileSync(abs, 'utf8');
            files.push({
                relPath,
                layer,
                pkg: determinePackage(relPath),
                specTags: isTs ? extractSpecTags(content) : [],
                decisionTable: isTs
                    ? extractTsDecisionTable(content)
                    : extractDartDecisionTable(content),
            });
        }
    }
    return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
};

// ---- JUnit XML パース（bun test --reporter=junit の出力） ----

/** XMLタグの属性名 → 属性値。 */
interface XmlAttrs {
    [name: string]: string;
}

interface XmlTag {
    close: boolean;
    name: string;
    attrs: XmlAttrs;
    selfClose: boolean;
}

const parseAttrs = (attrStr: string): XmlAttrs => {
    const attrs: XmlAttrs = {};
    for (const m of attrStr.matchAll(/([a-zA-Z:_-]+)="([^"]*)"/g)) {
        attrs[m[1]] = decodeXmlEntities(m[2]);
    }
    return attrs;
};

const tokenizeXml = (xml: string): XmlTag[] => {
    const tags: XmlTag[] = [];
    const re = /<(\/?)([\w:-]+)((?:\s+[a-zA-Z:_-]+="[^"]*")*)\s*(\/?)>/g;
    for (const m of xml.matchAll(re)) {
        tags.push({
            close: m[1] === '/',
            name: m[2],
            attrs: parseAttrs(m[3]),
            selfClose: m[4] === '/',
        });
    }
    return tags;
};

const stripCaseIndexPrefix = (name: string): string =>
    name.replace(/^#\d+:\s*/, '');

/**
 * JUnit XMLのタグ列をスタックで走査し、テストファイル（トップレベルtestsuite）ごとの
 * describe/it構造ツリーを構築する
 * @param tags tokenizeXml の出力
 * @returns テストファイルの相対パス（testsuiteのfile/name属性）をキーとしたルートノードのMap
 */
const buildForestFromTags = (tags: XmlTag[]): Map<string, TestGroupNode> => {
    const roots = new Map<string, TestGroupNode>();
    const stack: Array<{
        tag: string;
        node: TestGroupNode | TestCaseNode | null;
    }> = [];

    const currentGroup = (): TestGroupNode | null => {
        for (let i = stack.length - 1; i >= 0; i--) {
            const entry = stack[i];
            if (entry.node && entry.node.kind === 'group') return entry.node;
        }
        return null;
    };

    for (const tag of tags) {
        if (tag.close) {
            stack.pop();
            continue;
        }
        if (tag.name === 'testsuite') {
            const node: TestGroupNode = {
                kind: 'group',
                name: tag.attrs.name ?? '',
                children: [],
            };
            const parent = currentGroup();
            if (parent) parent.children.push(node);
            else roots.set(tag.attrs.file ?? tag.attrs.name ?? node.name, node);
            if (!tag.selfClose) stack.push({ tag: tag.name, node });
        } else if (tag.name === 'testcase') {
            const node: TestCaseNode = {
                kind: 'case',
                name: stripCaseIndexPrefix(tag.attrs.name ?? ''),
                status: 'pass',
                timeMs: Math.round(
                    Number.parseFloat(tag.attrs.time ?? '0') * 1000,
                ),
            };
            currentGroup()?.children.push(node);
            if (!tag.selfClose) stack.push({ tag: tag.name, node });
        } else if (
            (tag.name === 'failure' || tag.name === 'error') &&
            !tag.close
        ) {
            const top = stack[stack.length - 1]?.node;
            if (top && top.kind === 'case') {
                top.status = 'fail';
                top.failureType = tag.attrs.type;
            }
        } else if (tag.name === 'skipped' && !tag.close) {
            const top = stack[stack.length - 1]?.node;
            if (top && top.kind === 'case' && top.status !== 'fail')
                top.status = 'skip';
        } else if (!tag.selfClose) {
            stack.push({ tag: tag.name, node: null });
        }
    }
    return roots;
};

const parseJUnitFile = (path: string): DynamicFile[] => {
    if (!existsSync(path)) return [];
    const xml = readFileSync(path, 'utf8');
    const forest = buildForestFromTags(tokenizeXml(xml));
    return [...forest.entries()].map(([relPath, root]) => ({ relPath, root }));
};

// ---- Flutter JSONライン（flutter test --reporter=json の出力）パース ----

interface FlutterSuite {
    id: number;
    path: string;
}
interface FlutterTest {
    id: number;
    name: string;
    suiteID: number;
    groupIDs: number[];
    hidden?: boolean;
}

const relativizeFrontPath = (absOrRelPath: string): string => {
    const idx = absOrRelPath.indexOf('packages/front/');
    return idx === -1 ? absOrRelPath : absOrRelPath.slice(idx);
};

const insertFlutterCase = (
    root: TestGroupNode,
    groupNames: string[],
    leaf: TestCaseNode,
): void => {
    let cursor = root;
    for (const groupName of groupNames) {
        if (groupName === '') continue;
        // SAFETY: find条件で c.kind === 'group' に絞り込んだ直後のため、見つかった要素は
        // 必ず TestGroupNode（TestGroupNode | TestCaseNode の判別可能union）
        let child = cursor.children.find(
            (c) => c.kind === 'group' && c.name === groupName,
        ) as TestGroupNode | undefined;
        if (!child) {
            child = { kind: 'group', name: groupName, children: [] };
            cursor.children.push(child);
        }
        cursor = child;
    }
    cursor.children.push(leaf);
};

const parseFlutterJsonl = (path: string): DynamicFile[] => {
    if (!existsSync(path)) return [];
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    const suites = new Map<number, FlutterSuite>();
    const groupNames = new Map<number, string>();
    const tests = new Map<number, FlutterTest>();
    const roots = new Map<string, TestGroupNode>();

    for (const line of lines) {
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- FlutterのJSONLレポーター出力を1行ずつJSON.parseした直後の中間表現。イベント種別ごとのフィールド検証はこの後で行う
        let event: Record<string, unknown>;
        try {
            event = JSON.parse(line);
        } catch {
            continue;
        }
        if (event.type === 'suite' && event.suite) {
            // SAFETY: event.type==='suite' を確認済みで、flutter test --reporter=json は
            // suiteイベント時にsuiteフィールドが{id,path}形状であることが仕様上保証されている
            const s = event.suite as FlutterSuite;
            suites.set(s.id, s);
        } else if (event.type === 'group' && event.group) {
            // SAFETY: event.type==='group' を確認済みで、flutter test --reporter=json は
            // groupイベント時にgroupフィールドが{id,name}形状であることが仕様上保証されている
            const g = event.group as { id: number; name: string };
            groupNames.set(g.id, g.name);
        } else if (event.type === 'testStart' && event.test) {
            // SAFETY: event.type==='testStart' を確認済みで、flutter test --reporter=json は
            // testStartイベント時にtestフィールドが本ファイル定義のFlutterTest形状であることが仕様上保証されている
            const t = event.test as FlutterTest;
            tests.set(t.id, t);
        } else if (event.type === 'testDone') {
            // SAFETY: testDoneイベントのtestIDは対応するtestStartイベントのtest.idと同じ
            // 数値であることがflutter test --reporter=jsonの仕様で保証されている
            const t = tests.get(event.testID as number);
            if (!t || t.hidden) continue;
            const suite = suites.get(t.suiteID);
            if (!suite) continue;
            const relPath = relativizeFrontPath(suite.path);
            let root = roots.get(relPath);
            if (!root) {
                root = { kind: 'group', name: basename(relPath), children: [] };
                roots.set(relPath, root);
            }
            // SAFETY: testDoneイベントのresultフィールドはflutter test --reporter=jsonの
            // 仕様上必ず文字列（'success'等のステータス名）で返される
            const result = event.result as string;
            const status: TestStatus = event.skipped
                ? 'skip'
                : result === 'success'
                  ? 'pass'
                  : 'fail';
            const path = t.groupIDs.map((id) => groupNames.get(id) ?? '');
            const name = t.name.startsWith('loading ')
                ? `⚠ コンパイル/ロードエラー（${relativizeFrontPath(t.name.slice('loading '.length))}）`
                : t.name;
            insertFlutterCase(root, path, {
                kind: 'case',
                name,
                status,
                timeMs: 0,
            });
        }
    }
    return [...roots.entries()].map(([relPath, root]) => ({ relPath, root }));
};

// ---- run サブコマンド: テストを実行し raw 結果を保存する ----

interface LayerRunSpec {
    layer: 'ut' | 'component' | 'sit' | 'uat';
    args: string[];
    env: Record<string, string>;
    outfile: string;
}

const BASE_ENV = {
    NODE_ENV: 'ci_local',
    TZ: 'jst',
    HTML_FETCH_DELAY_MS: '0',
} satisfies Record<string, string>;

const LAYER_RUN_SPECS = {
    ut: {
        layer: 'ut',
        args: ['test', 'packages/*/test/unittest'],
        env: BASE_ENV,
        outfile: join(RAW_DIR, 'ut.xml'),
    },
    component: {
        layer: 'component',
        args: ['test', 'packages/*/test/integration/component'],
        env: { ...BASE_ENV, USE_IN_MEMORY_DB: 'true' },
        outfile: join(RAW_DIR, 'component.xml'),
    },
    sit: {
        layer: 'sit',
        args: ['test', 'packages/*/test/integration/system'],
        env: BASE_ENV,
        outfile: join(RAW_DIR, 'sit.xml'),
    },
    uat: {
        layer: 'uat',
        args: ['test', './tests/uat'],
        env: { NODE_ENV: 'ci_local', TZ: 'jst' },
        outfile: join(RAW_DIR, 'uat.xml'),
    },
} satisfies Record<'ut' | 'component' | 'sit' | 'uat', LayerRunSpec>;

const runBunLayer = async (spec: LayerRunSpec): Promise<void> => {
    console.log(`▶ ${spec.layer} を実行中...`);
    // spec.args のパス引数はglob（packages/*/test/...）を含み、シェル経由でないと
    // 展開されない（run-bun-layer-with-inspector.ts が sh -c 経由で起動する）。
    // Inspector Protocol（--inspect-wait）経由でイベントも収集し、raw/<layer>.events.jsonl に
    // 書き出す（allure-inspector-reporter-design.md 参照）。JUnit XML（--reporter=junit
    // --reporter-outfile）は従来どおり常に出力するため、本HTMLレポート生成の経路は無変更。
    const result = await runBunLayerWithInspector({
        bunTestArgs: spec.args,
        cwd: ROOT,
        env: spec.env,
        xmlOutfile: spec.outfile,
        eventsOutfile: spec.outfile.replace(/\.xml$/, '.events.jsonl'),
    });
    const eventsNote = result.eventsWritten
        ? ''
        : '（Inspectorイベント収集は失敗のためJUnit XMLのみ生成）';
    console.log(
        `  → exit code ${result.exitCode}（結果はレイヤーの成否に関わらずレポートに反映されます）${eventsNote}`,
    );
};

const runFrontLayer = (): void => {
    console.log('▶ front（Flutter）を実行中...');
    const frontDir = join(ROOT, 'packages', 'front');
    if (!existsSync(frontDir)) {
        console.log('  → packages/front が見つからないためスキップします');
        return;
    }
    const pubGet = Bun.spawnSync({
        cmd: ['flutter', 'pub', 'get'],
        cwd: frontDir,
        stdout: 'inherit',
        stderr: 'inherit',
    });
    if (pubGet.exitCode !== 0) {
        console.log('  → flutter pub get に失敗したためスキップします');
        return;
    }
    const proc = Bun.spawnSync({
        cmd: ['flutter', 'test', '--reporter=json'],
        cwd: frontDir,
        stdout: 'pipe',
        stderr: 'inherit',
    });
    writeFileSync(join(RAW_DIR, 'front.jsonl'), proc.stdout);
    console.log(
        `  → exit code ${proc.exitCode}（結果はレイヤーの成否に関わらずレポートに反映されます）`,
    );
};

const runCommand = async (layersArg: string): Promise<void> => {
    mkdirSync(RAW_DIR, { recursive: true });
    const layers = layersArg.split(',').map((l) => l.trim().toLowerCase());
    for (const layer of layers) {
        if (layer === 'front') {
            runFrontLayer();
        } else if (
            layer === 'ut' ||
            layer === 'component' ||
            layer === 'sit' ||
            layer === 'uat'
        ) {
            await runBunLayer(LAYER_RUN_SPECS[layer]);
        } else {
            console.log(`⚠️  未知のレイヤー "${layer}" をスキップします`);
        }
    }
};

// ---- build サブコマンド: 静的スキャン + raw 結果 を統合し report.json / index.html を生成 ----

const sumTotals = (node: TestGroupNode): TestTotals => {
    const totals = { pass: 0, fail: 0, skip: 0 };
    const visit = (n: TestNode): void => {
        if (n.kind === 'case') totals[n.status]++;
        else n.children.forEach(visit);
    };
    visit(node);
    return totals;
};

// ---- カバレッジ（test:gap:json の出力を読む） ----

interface CoverageGapFile {
    file: string;
    funcsPct: number;
    linesPct: number;
    uncoveredLines: string;
}

interface CoveragePackage {
    package: string;
    totalSrcFiles: number;
    coveredSrcFiles: number;
    gapSrcFiles: CoverageGapFile[];
}

/**
 * `bun run test:gap:json`（scripts/test-gap-analysis.ts --json）の出力を読み込む。
 * test-report.yml が事前に `bun run test:gap:json > test-report/raw/coverage.json` を
 * 実行しておく前提。ファイルが無い場合（ローカルでの部分実行等）は null を返し、
 * HTML側ではカバレッジセクション自体を省略する。
 */
const loadCoverageData = (): CoveragePackage[] | null => {
    const path = join(RAW_DIR, 'coverage.json');
    if (!existsSync(path)) return null;
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        return parsed.results ?? null;
    } catch {
        return null;
    }
};

/**
 * `bun run spec:coverage:json`（scripts/spec-coverage.ts --json）の出力を読み込む。
 * test-report.yml が事前に `bun scripts/spec-coverage.ts --json > test-report/raw/spec-coverage.json`
 * を実行しておく前提。ファイルが無い場合（ローカルでの部分実行等）は null を返し、
 * HTML側ではSpec Coverageセクション自体を省略する。
 */
const loadSpecCoverageData = (): SpecCoverageReport | null => {
    const path = join(RAW_DIR, 'spec-coverage.json');
    if (!existsSync(path)) return null;
    try {
        // SAFETY: spec-coverage.jsonはscripts/spec-coverage.ts --jsonが本リポジトリ内で
        // 生成する自前フォーマットであり、SpecCoverageReport形状はその出力仕様と一致している
        return JSON.parse(readFileSync(path, 'utf8')) as SpecCoverageReport;
    } catch {
        return null;
    }
};

const loadDynamicFiles = (): Map<string, TestGroupNode> => {
    const all = [
        ...parseJUnitFile(join(RAW_DIR, 'ut.xml')),
        ...parseJUnitFile(join(RAW_DIR, 'component.xml')),
        ...parseJUnitFile(join(RAW_DIR, 'sit.xml')),
        ...parseJUnitFile(join(RAW_DIR, 'uat.xml')),
        ...parseFlutterJsonl(join(RAW_DIR, 'front.jsonl')),
    ];
    return new Map(all.map((f) => [f.relPath, f.root]));
};

const emptySummaryCell = (): ReportSummaryCell => ({
    files: 0,
    executedFiles: 0,
    pass: 0,
    fail: 0,
    skip: 0,
});

const buildSummary = (files: ReportFile[]): Report['summary'] => {
    // SAFETY: 空オブジェクトで初期化した直後、下のループで LAYERS の全キーを埋めるため、
    // この関数が返す時点では Report['summary'] の必須キーが全て揃っている
    const summary = {} as Report['summary'];
    for (const layer of LAYERS) summary[layer] = {};
    for (const file of files) {
        const byPkg = summary[file.layer];
        const cell = (byPkg[file.pkg] ??= emptySummaryCell());
        cell.files++;
        if (file.executed) cell.executedFiles++;
        cell.pass += file.totals.pass;
        cell.fail += file.totals.fail;
        cell.skip += file.totals.skip;
    }
    return summary;
};

const NOTES = [
    'UT/コンポーネント/sIT/UAT は bun test --reporter=junit の実測結果、front（Flutter）は flutter test --reporter=json の実測結果を集計している。',
    '「未実行」のファイルは、このレポート生成時にそのレイヤーを実行しなかったため、静的なファイル一覧（@specタグ・デシジョンテーブル）のみを表示している。',
    'E2E（tests/e2e/scenarios/）は testing-conventions.md §2 で定義されているが未整備のため 0 件表示になる。',
];

const buildReport = (): Report => {
    const staticFiles = scanStaticFiles();
    const dynamic = loadDynamicFiles();
    const files: ReportFile[] = staticFiles.map((f) => {
        const root = dynamic.get(f.relPath) ?? null;
        return {
            ...f,
            executed: root !== null,
            totals: root ? sumTotals(root) : { pass: 0, fail: 0, skip: 0 },
            root,
        };
    });
    return {
        generatedAt: new Date().toISOString(),
        files,
        summary: buildSummary(files),
        notes: NOTES,
        hasAllureReport: existsSync(join(OUT_DIR, 'allure', 'index.html')),
        coverage: loadCoverageData(),
        specCoverage: loadSpecCoverageData(),
    };
};

const printHumanSummary = (report: Report): void => {
    console.log('\n📋 テストレポート サマリ');
    console.log('━'.repeat(60));
    for (const layer of LAYERS) {
        const byPkg = report.summary[layer];
        const pkgs = Object.keys(byPkg);
        if (pkgs.length === 0) continue;
        console.log(`\n${layer}`);
        for (const pkg of pkgs) {
            const c = byPkg[pkg];
            console.log(
                `  ${pkg}: ${c.files}ファイル（実行済み${c.executedFiles}） pass=${c.pass} fail=${c.fail} skip=${c.skip}`,
            );
        }
    }
    console.log(`\n📄 HTML: ${join(OUT_DIR, 'index.html')}`);
    console.log(`📄 JSON: ${join(OUT_DIR, 'report.json')}\n`);
};

const buildCommand = (): void => {
    mkdirSync(OUT_DIR, { recursive: true });
    const report = buildReport();
    writeFileSync(
        join(OUT_DIR, 'report.json'),
        JSON.stringify(report, null, 2),
    );
    writeFileSync(join(OUT_DIR, 'index.html'), renderHtml(report));
    printHumanSummary(report);
};

// ---- HTML レンダリング ----

const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * パッケージ別カバレッジセクションを描画する。testing-conventions.md §7.5 の方針
 * （C0/C1 100% or gap）に合わせ、平均%ではなく「100%達成ファイル数/対象ファイル数」を
 * 主要指標にする（99%と50%を同列の「gapあり」として扱う既存のbaseline方針と一致させるため）。
 * @param coverage loadCoverageData の結果（未計測なら null でセクション自体を省略）
 */
const renderCoverageSection = (coverage: CoveragePackage[] | null): string => {
    if (!coverage) return '';
    const rows = coverage
        .map((pkg) => {
            const pct =
                pkg.totalSrcFiles === 0
                    ? 100
                    : Math.round(
                          (pkg.coveredSrcFiles / pkg.totalSrcFiles) * 1000,
                      ) / 10;
            const gapDetails =
                pkg.gapSrcFiles.length === 0
                    ? ''
                    : `<details><summary>gap ${pkg.gapSrcFiles.length}件</summary><ul>${pkg.gapSrcFiles
                          .map(
                              (g) =>
                                  `<li><code>${escapeHtml(g.file)}</code> — funcs ${g.funcsPct}% / lines ${g.linesPct}%${g.uncoveredLines ? ` (未カバー行: ${escapeHtml(g.uncoveredLines)})` : ''}</li>`,
                          )
                          .join('')}</ul></details>`;
            return `<div class="cov-row">
  <div class="cov-head"><span class="cov-pkg">${escapeHtml(pkg.package)}</span><span class="cov-pct">${pct}%</span><span class="cov-count">${pkg.coveredSrcFiles}/${pkg.totalSrcFiles} ファイル</span></div>
  <div class="cov-bar"><div class="cov-bar-fill" style="width:${pct}%"></div></div>
  ${gapDetails}
</div>`;
        })
        .join('');
    return `<section id="coverage">
  <h2>カバレッジ（C0/C1、src/ 配下、100%達成ファイル比率）</h2>
  ${rows}
</section>`;
};

const specCoverageSymbol = (
    state: SpecCoverageReport['specs'][number]['coverage'][SpecLayer],
): string => {
    if (state === 'covered') return '✅';
    if (state === 'gap') return '❌';
    if (state === 'pending') return '⏸';
    return '—';
};

/**
 * 仕様トレーサビリティ（spec-coverage.ts）のセクションを描画する。PR上のsticky comment
 * （build-spec-gap-comment.ts）と同じ内容（サマリ・表・トレーサビリティグラフ・issues・補足）を
 * 常設のCloudflare Pages上でも閲覧できるようにする。
 * @param report loadSpecCoverageData の結果（未計測なら null でセクション自体を省略）
 */
const renderSpecCoverageSection = (
    report: SpecCoverageReport | null,
): string => {
    if (!report) return '';
    const rows = report.specs
        .map((spec) => {
            const layerLine = spec.requires
                .map((l) => `${l}${specCoverageSymbol(spec.coverage[l])}`)
                .join(' ');
            const missing =
                spec.missingLayers.length > 0
                    ? spec.missingLayers.join(', ')
                    : '-';
            return `<tr><td><code>${escapeHtml(spec.id)}</code></td><td>${escapeHtml(spec.title)}</td><td>${escapeHtml(layerLine)}</td><td>${escapeHtml(missing)}</td></tr>`;
        })
        .join('');
    const table =
        report.specs.length === 0
            ? '<p>（active な仕様が docs/specs/ にありません）</p>'
            : `<table><thead><tr><th>Spec</th><th>Title</th><th>Layers</th><th>不足</th></tr></thead><tbody>${rows}</tbody></table>`;

    const graph =
        report.specs.length === 0
            ? ''
            : `<details open><summary>トレーサビリティグラフ（仕様 → レイヤー → テストファイル）</summary>
  <pre class="mermaid">${escapeHtml(buildMermaidGraph(report))}</pre>
</details>`;

    const { orphanTags, deprecatedRefs } = report.issues;
    const issues =
        orphanTags.length === 0 && deprecatedRefs.length === 0
            ? ''
            : `<details><summary>⚠️ Issues</summary><ul>
  ${orphanTags.map((i) => `<li>orphan-tag: <code>${escapeHtml(i.tag)}</code>（${escapeHtml(i.file)}）</li>`).join('')}
  ${deprecatedRefs.map((i) => `<li>deprecated-ref: <code>${escapeHtml(i.tag)}</code>（${escapeHtml(i.file)}）</li>`).join('')}
</ul></details>`;

    return `<section id="spec-coverage">
  <h2>Spec Coverage（仕様トレーサビリティ）</h2>
  <p><strong>${report.summary.fullyCovered} / ${report.summary.totalActiveSpecs}</strong> 仕様が全レイヤー充足（gap: ${report.summary.withGaps}）</p>
  ${table}
  ${graph}
  ${issues}
</section>`;
};

const renderHtml = (report: Report): string => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>テストレポート</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${HTML_STYLE}</style>
</head>
<body>
<header>
  <h1>テストレポート</h1>
  <p class="meta">生成日時: ${escapeHtml(report.generatedAt)}</p>
  ${report.hasAllureReport ? '<p class="meta"><a href="./allure/index.html">Allure Report（実行履歴・トレンドグラフ）を見る →</a></p>' : ''}
</header>
<main>
  <section id="summary"></section>
  ${renderCoverageSection(report.coverage)}
  ${renderSpecCoverageSection(report.specCoverage)}
  <section id="controls">
    <input id="search" type="search" placeholder="ファイルパス・テスト名で検索">
    <div id="layer-filters"></div>
  </section>
  <section id="files"></section>
  <section id="notes"><h2>補足</h2><ul>${report.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></section>
</main>
<script id="report-data" type="application/json">${JSON.stringify(report)}</script>
<script>${HTML_SCRIPT}</script>
${
    report.specCoverage && report.specCoverage.specs.length > 0
        ? `<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
</script>`
        : ''
}
</body>
</html>
`;

const HTML_STYLE = `
:root { color-scheme: light dark; --pass:#2f9e44; --fail:#e03131; --skip:#868e96; --border:#e0e0e0; }
body { font-family: system-ui, sans-serif; margin: 0; padding: 0 1.5rem 3rem; max-width: 1100px; margin-inline: auto; }
header { padding: 1.5rem 0 0.5rem; }
.meta { color: #888; font-size: 0.9rem; }
#controls { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin: 1rem 0; }
#search { flex: 1; min-width: 240px; padding: 0.5rem; font-size: 1rem; }
#layer-filters label { margin-right: 0.75rem; }
table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
th, td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; font-size: 0.9rem; }
th { background: rgba(128,128,128,0.1); }
.badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; margin-right: 0.3rem; background: rgba(128,128,128,0.15); }
.file-card { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.75rem; padding: 0.75rem 1rem; }
.file-card summary { cursor: pointer; font-weight: 600; display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; }
.path { font-family: monospace; font-size: 0.9rem; }
.counts .pass { color: var(--pass); }
.counts .fail { color: var(--fail); }
.counts .skip { color: var(--skip); }
.not-executed { opacity: 0.6; }
pre.decision-table { background: rgba(128,128,128,0.08); padding: 0.6rem; overflow-x: auto; font-size: 0.85rem; }
ul.tree, ul.tree ul { list-style: none; padding-left: 1.1rem; }
ul.tree > li { margin: 0.15rem 0; }
.status-icon.pass::before { content: "✅ "; }
.status-icon.fail::before { content: "❌ "; }
.status-icon.skip::before { content: "⏭ "; }
#coverage { margin: 1rem 0; }
.cov-row { margin-bottom: 0.6rem; }
.cov-head { display: flex; gap: 0.75rem; align-items: baseline; font-size: 0.9rem; }
.cov-pkg { font-weight: 600; min-width: 6rem; }
.cov-pct { font-variant-numeric: tabular-nums; }
.cov-count { color: #888; font-size: 0.85rem; }
.cov-bar { background: rgba(128,128,128,0.15); border-radius: 999px; height: 6px; overflow: hidden; margin: 0.2rem 0; }
.cov-bar-fill { background: var(--pass); height: 100%; }
.cov-row details { font-size: 0.85rem; margin-top: 0.2rem; }
#spec-coverage { margin: 1.5rem 0; }
#spec-coverage pre.mermaid { overflow-x: auto; background: rgba(128,128,128,0.08); padding: 0.6rem; }
`;

const HTML_SCRIPT = `
const report = JSON.parse(document.getElementById('report-data').textContent);
const LAYERS = ${JSON.stringify(LAYERS)};

const renderSummary = () => {
  const el = document.getElementById('summary');
  const pkgs = [...new Set(report.files.map(f => f.pkg))].sort();
  let html = '<h2>サマリ</h2><table><thead><tr><th>レイヤー</th><th>パッケージ</th><th>ファイル数</th><th>実行済み</th><th class="pass">pass</th><th class="fail">fail</th><th class="skip">skip</th></tr></thead><tbody>';
  for (const layer of LAYERS) {
    const byPkg = report.summary[layer] || {};
    for (const pkg of pkgs) {
      const c = byPkg[pkg];
      if (!c) continue;
      html += \`<tr><td>\${layer}</td><td>\${pkg}</td><td>\${c.files}</td><td>\${c.executedFiles}</td><td class="pass">\${c.pass}</td><td class="fail">\${c.fail}</td><td class="skip">\${c.skip}</td></tr>\`;
    }
  }
  html += '</tbody></table>';
  el.innerHTML = html;
};

const renderNode = (node) => {
  if (node.kind === 'case') {
    const li = document.createElement('li');
    li.className = 'status-icon ' + node.status;
    li.textContent = node.name + (node.timeMs ? \` (\${node.timeMs}ms)\` : '');
    return li;
  }
  const li = document.createElement('li');
  if (node.name) li.textContent = node.name;
  const ul = document.createElement('ul');
  ul.className = 'tree';
  node.children.forEach(c => ul.appendChild(renderNode(c)));
  li.appendChild(ul);
  return li;
};

const renderFile = (f) => {
  const details = document.createElement('details');
  details.className = 'file-card' + (f.executed ? '' : ' not-executed');
  details.dataset.search = (f.relPath + ' ' + (f.specTags||[]).join(' ') + ' ' + JSON.stringify(f.root||'')).toLowerCase();
  details.dataset.layer = f.layer;
  const badges = [\`<span class="badge">\${f.layer}</span>\`, \`<span class="badge">\${f.pkg}</span>\`]
    .concat((f.specTags||[]).map(t => \`<span class="badge">\${t}</span>\`))
    .concat(f.executed ? [] : ['<span class="badge">未実行</span>']);
  const counts = f.executed ? \`<span class="counts"><span class="pass">\${f.totals.pass} pass</span> / <span class="fail">\${f.totals.fail} fail</span> / <span class="skip">\${f.totals.skip} skip</span></span>\` : '';
  const summary = document.createElement('summary');
  summary.innerHTML = \`\${badges.join('')}<span class="path">\${f.relPath}</span>\${counts}\`;
  details.appendChild(summary);
  if (f.decisionTable) {
    const pre = document.createElement('pre');
    pre.className = 'decision-table';
    pre.textContent = f.decisionTable;
    details.appendChild(pre);
  }
  if (f.root) {
    const ul = document.createElement('ul');
    ul.className = 'tree';
    f.root.children.forEach(c => ul.appendChild(renderNode(c)));
    details.appendChild(ul);
  }
  return details;
};

const renderFiles = () => {
  const el = document.getElementById('files');
  el.innerHTML = '';
  report.files.forEach(f => el.appendChild(renderFile(f)));
};

const renderLayerFilters = () => {
  const el = document.getElementById('layer-filters');
  el.innerHTML = LAYERS.map(l => \`<label><input type="checkbox" value="\${l}" checked> \${l}</label>\`).join('');
  el.addEventListener('change', applyFilters);
};

const applyFilters = () => {
  const query = document.getElementById('search').value.toLowerCase();
  const checked = new Set([...document.querySelectorAll('#layer-filters input:checked')].map(i => i.value));
  document.querySelectorAll('.file-card').forEach(card => {
    const matchesText = !query || card.dataset.search.includes(query);
    const matchesLayer = checked.has(card.dataset.layer);
    card.style.display = matchesText && matchesLayer ? '' : 'none';
  });
};

renderSummary();
renderLayerFilters();
renderFiles();
document.getElementById('search').addEventListener('input', applyFilters);
`;

// ---- エントリポイント ----

const parseFlag = (args: string[], flag: string, fallback: string): string => {
    const prefix = `--${flag}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
};

const main = async (): Promise<void> => {
    const [sub, ...rest] = process.argv.slice(2);
    if (sub === 'run') {
        await runCommand(parseFlag(rest, 'layers', 'ut,mit'));
    } else if (sub === 'build') {
        buildCommand();
    } else {
        console.log(
            '使い方: bun scripts/generate-test-report.ts <run --layers=ut,mit,sit,uat,front|build>',
        );
        process.exit(1);
    }
};

if (import.meta.main) {
    await main();
}

export type {
    DynamicFile,
    Layer,
    Report,
    ReportFile,
    StaticFile,
    TestGroupNode,
    TestNode,
    TestStatus,
};
export {
    buildForestFromTags,
    buildReport,
    buildSummary,
    determineLayer,
    determinePackage,
    extractDartDecisionTable,
    extractSpecTags,
    extractTsDecisionTable,
    parseFlutterJsonl,
    parseJUnitFile,
    sumTotals,
    tokenizeXml,
};
