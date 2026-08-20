#!/usr/bin/env bun
/**
 * spec-coverage.ts
 *
 * `docs/specs/*.md`（仕様レジストリ）の front-matter と、テストファイル先頭 JSDoc の
 * `@spec <ID>` タグを静的に突合し、「仕様 × 検証レイヤー（UT/Component/sIT/E2E/UAT）」の
 * 充足マトリクスを算出する。
 *
 * `test-gap-analysis.ts` の兄弟ツール。あちらが「ファイル × カバレッジ%」を lcov 実測で
 * 測るのに対し、これは「仕様 × レイヤー」を静的テキスト解析（grep 相当）で測る。
 * テストを実行しないため高速。対象テストが実際に green かどうかは検証しない
 * （既存の `bun test` / CI がそれを担保する）。
 *
 * 詳細仕様: .claude/docs/spec-traceability/spec-coverage-tool.md
 *
 * 使い方:
 *   bun scripts/spec-coverage.ts              # gapのある仕様のみ、人間向け表示（TOK-050: 既定は要約、TOP10まで）
 *   bun scripts/spec-coverage.ts --all         # 充足済みも含め全仕様を表示
 *   bun scripts/spec-coverage.ts --json        # JSON 出力（CI / PRコメント / ループ detector 用、常に全件）
 *   bun scripts/spec-coverage.ts --mermaid     # Mermaid flowchart 出力（仕様→レイヤー→テストファイルの可視化）
 *   bun scripts/spec-coverage.ts --strict      # gap（pending除く）/ orphan-tag があれば非0終了
 */

/* eslint-disable no-console */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { walkDir } from './lib/walkDir';

const ROOT = process.cwd();
const SPECS_DIR = join(ROOT, 'docs', 'specs');
const TEST_ROOTS = [join(ROOT, 'packages'), join(ROOT, 'tests')];

const LAYERS = ['UT', 'Component', 'sIT', 'E2E', 'UAT'] as const;
type Layer = (typeof LAYERS)[number];

const STATUSES = ['active', 'draft', 'deprecated'] as const;
type SpecStatus = (typeof STATUSES)[number];

type CoverageState = 'covered' | 'gap' | 'pending';

/**
 * そのレイヤーが「今、実 green を要求できる」状態か。
 * Phase が進むたびにここを true にするだけで requires のブロッキング対象が広がる
 * （.claude/docs/spec-traceability/README.md §5 段階導入）。
 */
const LAYER_ENFORCEABLE = {
    UT: true,
    Component: true,
    // Phase 2 解禁済み（2026-07-23）: tests/shared/env/setupMiniflareEnv.ts が
    // 実D1/R2（miniflare/workerd）でsITを起動できるようになった
    // （packages/api・packages/scraping に最初の参照実装あり）
    sIT: true,
    E2E: false, // Phase 3: tests/e2e/ 整備後に true
    UAT: false, // Phase 3: tests/uat/{synthetic,contract}/ 整備後に true（smokeのみ実装済み）
} satisfies Record<Layer, boolean>;

const LAYER_PATH_PATTERNS: ReadonlyArray<readonly [Layer, RegExp]> = [
    ['UT', /^packages\/[^/]+\/test\/unittest\//],
    ['Component', /^packages\/[^/]+\/test\/integration\/component\//],
    ['sIT', /^packages\/[^/]+\/test\/integration\/system\//],
    ['E2E', /^tests\/e2e\/scenarios\//],
    ['UAT', /^tests\/uat\//],
];

interface SpecEntry {
    id: string;
    title: string;
    status: SpecStatus;
    raceType: string[];
    requires: Layer[];
    targets: string[];
    owner?: string;
    related: string[];
    filePath: string;
}

interface TaggedFile {
    relPath: string;
    layer: Layer | null;
    specIds: string[];
}

interface Issue {
    tag: string;
    file: string;
}

/** タグ突合で見つかった問題（実在しないID・廃止仕様への参照）。 */
interface SpecIssues {
    orphanTags: Issue[];
    deprecatedRefs: Issue[];
}

interface SpecCoverageResult {
    id: string;
    title: string;
    raceType: string[];
    requires: Layer[];
    coverage: Partial<Record<Layer, CoverageState>>;
    coveredBy: Partial<Record<Layer, string[]>>;
    missingLayers: Layer[];
    targets: string[];
    staleTargets: string[];
}

interface SpecCoverageReport {
    specs: SpecCoverageResult[];
    issues: SpecIssues;
    summary: {
        totalActiveSpecs: number;
        fullyCovered: number;
        withGaps: number;
    };
    notes: string[];
}

const NOTES = [
    'このレポートは docs/specs/*.md の front-matter と、テストファイル先頭 JSDoc の',
    '@spec タグを静的照合した結果である。テストが実際に green かどうかは検証しない',
    '（既存の bun test / CI が担保する）。',
    '',
    'pending 表示のレイヤー（既定では E2E/UAT synthetic/contract）は、対応するテスト基盤が',
    '未整備なため非ブロッキング扱いにしている（sIT は Phase 2 で解禁済み。',
    '.claude/docs/spec-traceability/README.md §5 参照）。',
];

// ---- front-matter パース ----

/** front-matter の生データ（キー → スカラー文字列 or 文字列配列、キー自体が無ければ undefined）。 */
interface RawFrontMatter {
    [key: string]: string | string[] | undefined;
}

/**
 * front-matter（`--- ... ---` で囲まれた領域）を最小限のスキーマ
 * （スカラー文字列 or 文字列配列のみ）でパースする
 * @param content Markdown ファイルの全文
 */
const parseFrontMatter = (content: string): RawFrontMatter => {
    const match = /^---\n([\s\S]*?)\n---/.exec(content);
    if (!match) {
        throw new Error('front-matter（--- ... ---）が見つかりません');
    }
    const result: RawFrontMatter = {};
    let currentKey: string | null = null;
    for (const line of match[1].split('\n')) {
        if (line.trim() === '') continue;
        const arrayItemMatch = /^\s+-\s*(.+)$/.exec(line);
        if (arrayItemMatch && currentKey) {
            const existing = result[currentKey];
            const item = arrayItemMatch[1].trim();
            result[currentKey] = Array.isArray(existing)
                ? [...existing, item]
                : [item];
            continue;
        }
        const scalarMatch = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
        if (scalarMatch) {
            const [, key, value] = scalarMatch;
            currentKey = key;
            result[key] = value.trim() === '' ? [] : value.trim();
        }
    }
    return result;
};

const asStringArray = (value: string | string[] | undefined): string[] => {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
};

const isLayer = (value: string): value is Layer =>
    LAYERS.some((layer) => layer === value);

const isStatus = (value: string | undefined): value is SpecStatus =>
    STATUSES.some((status) => status === value);

/**
 * front-matter の生データを検証済みの SpecEntry に変換する。
 * 必須キーが欠けている・型が不正な場合はエラーを投げる（フェイルファスト）。
 * @param raw parseFrontMatter の出力
 * @param filePath エラーメッセージ用のファイルパス
 */
const buildSpecEntry = (raw: RawFrontMatter, filePath: string): SpecEntry => {
    const { id, title, status } = raw;
    if (id === undefined || Array.isArray(id) || id === '') {
        throw new Error(`${filePath}: id が不正です`);
    }
    if (title === undefined || Array.isArray(title) || title === '') {
        throw new Error(`${filePath}: title が不正です`);
    }
    if (Array.isArray(status) || !isStatus(status)) {
        throw new Error(
            `${filePath}: status が不正です（active|draft|deprecated のいずれか）`,
        );
    }

    const requires: Layer[] = [];
    for (const r of asStringArray(raw.requires)) {
        if (!isLayer(r)) {
            throw new Error(
                `${filePath}: requires に不正なレイヤー "${r}" があります`,
            );
        }
        requires.push(r);
    }

    return {
        id,
        title,
        status,
        raceType: asStringArray(raw.raceType),
        requires,
        targets: asStringArray(raw.targets),
        owner: Array.isArray(raw.owner) ? undefined : raw.owner,
        related: asStringArray(raw.related),
        filePath,
    };
};

// ---- ファイル走査 ----

const toRelPath = (absPath: string): string =>
    relative(ROOT, absPath).split(sep).join('/');

/**
 * ファイルパスからテストレイヤーを機械判定する
 * （.claude/docs/spec-traceability/traceability-tags.md §2 と同じ規約）
 * @param relPath リポジトリルートからの相対パス（`/` 区切り）
 */
const determineLayer = (relPath: string): Layer | null => {
    for (const [layer, pattern] of LAYER_PATH_PATTERNS) {
        if (pattern.test(relPath)) return layer;
    }
    return null;
};

/**
 * テストファイル本文から `@spec <ID>` タグをすべて抽出する
 * @param content テストファイルの全文
 */
const extractSpecTags = (content: string): string[] => {
    const matches = [...content.matchAll(/@spec\s+(SPEC-[A-Z]+-\d+)/g)];
    return matches.map((m) => m[1]);
};

const loadSpecs = (): SpecEntry[] => {
    let entries: string[];
    try {
        entries = readdirSync(SPECS_DIR);
    } catch {
        return [];
    }
    const specs: SpecEntry[] = [];
    for (const name of entries) {
        if (!name.endsWith('.md') || name === 'README.md') continue;
        const filePath = join(SPECS_DIR, name);
        const content = readFileSync(filePath, 'utf8');
        const raw = parseFrontMatter(content);
        specs.push(buildSpecEntry(raw, toRelPath(filePath)));
    }
    return specs;
};

const loadTaggedFiles = (): TaggedFile[] => {
    const taggedFiles: TaggedFile[] = [];
    for (const root of TEST_ROOTS) {
        for (const file of walkDir(root)) {
            if (!file.endsWith('.test.ts')) continue;
            const relPath = toRelPath(file);
            const specIds = extractSpecTags(readFileSync(file, 'utf8'));
            if (specIds.length === 0) continue;
            taggedFiles.push({
                relPath,
                layer: determineLayer(relPath),
                specIds,
            });
        }
    }
    return taggedFiles;
};

// ---- 突合ロジック（純粋関数） ----

/**
 * 1 仕様について、requires 各レイヤーの充足状態を算出する
 * @param spec 対象仕様
 * @param taggedFiles 全テストファイルの @spec タグ抽出結果
 * @param targetExists targets の実在確認関数（テスト時は差し替え可能）
 */
const computeSpecCoverage = (
    spec: SpecEntry,
    taggedFiles: readonly TaggedFile[],
    targetExists: (relPath: string) => boolean = (p) =>
        existsSync(join(ROOT, p)),
): SpecCoverageResult => {
    const coverage: Partial<Record<Layer, CoverageState>> = {};
    const coveredBy: Partial<Record<Layer, string[]>> = {};
    const missingLayers: Layer[] = [];

    for (const layer of spec.requires) {
        const matches = taggedFiles.filter(
            (f) => f.layer === layer && f.specIds.includes(spec.id),
        );
        coveredBy[layer] = matches.map((f) => f.relPath);
        if (matches.length > 0) {
            coverage[layer] = 'covered';
        } else if (!LAYER_ENFORCEABLE[layer]) {
            coverage[layer] = 'pending';
        } else {
            coverage[layer] = 'gap';
            missingLayers.push(layer);
        }
    }

    const staleTargets = spec.targets.filter((t) => !targetExists(t));

    return {
        id: spec.id,
        title: spec.title,
        raceType: spec.raceType,
        requires: spec.requires,
        coverage,
        coveredBy,
        missingLayers,
        targets: spec.targets,
        staleTargets,
    };
};

/**
 * 全テストファイルの @spec タグを、既知の仕様一覧と突合し、
 * 実在しない ID（orphan-tag）・廃止仕様への参照（deprecated-ref）を検出する
 * @param allSpecs status を問わない全仕様（active/draft/deprecated）
 * @param taggedFiles 全テストファイルの @spec タグ抽出結果
 */
const computeIssues = (
    allSpecs: readonly SpecEntry[],
    taggedFiles: readonly TaggedFile[],
): SpecIssues => {
    const specById = new Map(allSpecs.map((s) => [s.id, s]));
    const orphanTags: Issue[] = [];
    const deprecatedRefs: Issue[] = [];
    for (const file of taggedFiles) {
        for (const tag of file.specIds) {
            const spec = specById.get(tag);
            if (spec === undefined) {
                orphanTags.push({ tag, file: file.relPath });
            } else if (spec.status === 'deprecated') {
                deprecatedRefs.push({ tag, file: file.relPath });
            }
        }
    }
    return { orphanTags, deprecatedRefs };
};

/**
 * 仕様一覧とタグ付きファイル一覧から、最終レポートを組み立てる
 * @param allSpecs status を問わない全仕様
 * @param taggedFiles 全テストファイルの @spec タグ抽出結果
 */
const buildReport = (
    allSpecs: readonly SpecEntry[],
    taggedFiles: readonly TaggedFile[],
): SpecCoverageReport => {
    const activeSpecs = allSpecs.filter((s) => s.status === 'active');
    const specs = activeSpecs.map((s) => computeSpecCoverage(s, taggedFiles));
    const issues = computeIssues(allSpecs, taggedFiles);
    const fullyCovered = specs.filter(
        (s) => s.missingLayers.length === 0,
    ).length;

    return {
        specs,
        issues,
        summary: {
            totalActiveSpecs: activeSpecs.length,
            fullyCovered,
            withGaps: specs.length - fullyCovered,
        },
        notes: NOTES,
    };
};

// ---- 出力 ----

/**
 * Mermaid のノード・エッジラベルとして安全な文字列にエスケープする
 * @param label 元のラベル文字列
 */
const escapeMermaidLabel = (label: string): string =>
    label.replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ');

const basename = (relPath: string): string =>
    relPath.split('/').pop() ?? relPath;

/**
 * SpecCoverageReport を Mermaid `flowchart` 定義に変換する。
 * 仕様ノード → レイヤーノード（covered/gap/pending で色分け）→ 実テストファイルノード、
 * という 3 階層で「仕様がどのレイヤーのどのテストで検証されているか」を可視化する。
 * @param report buildReport の出力
 */
const buildMermaidGraph = (report: SpecCoverageReport): string => {
    const lines: string[] = ['flowchart LR'];

    report.specs.forEach((spec, specIndex) => {
        const specId = `spec${specIndex}`;
        lines.push(
            `    ${specId}["${escapeMermaidLabel(spec.id)}<br/>${escapeMermaidLabel(spec.title)}"]`,
        );
        spec.requires.forEach((layer, layerIndex) => {
            const layerId = `${specId}_layer${layerIndex}`;
            lines.push(`    ${specId} --> ${layerId}["${layer}"]`);
            lines.push(`    class ${layerId} ${spec.coverage[layer]}`);

            const files = spec.coveredBy[layer] ?? [];
            files.forEach((file, fileIndex) => {
                const fileId = `${layerId}_f${fileIndex}`;
                lines.push(
                    `    ${layerId} --> ${fileId}["${escapeMermaidLabel(basename(file))}"]`,
                );
            });
        });
    });

    lines.push(
        '    classDef covered fill:#d4f4dd,stroke:#2f9e44,color:#1a1a1a',
        '    classDef gap fill:#ffe3e3,stroke:#e03131,color:#1a1a1a',
        '    classDef pending fill:#f1f3f5,stroke:#868e96,color:#1a1a1a,stroke-dasharray: 5 5',
    );

    return lines.join('\n');
};

const coverageSymbol = (state: CoverageState | undefined): string => {
    if (state === 'covered') return '✅';
    if (state === 'gap') return '❌';
    if (state === 'pending') return '⏸(infra-pending)';
    return '—';
};

const printHuman = (report: SpecCoverageReport, isAll = false): void => {
    console.log('\n📋 Spec Coverage（@spec タグ突合ベース）');
    console.log('━'.repeat(60));
    if (report.specs.length === 0) {
        console.log('\n（active な仕様が docs/specs/ にありません）');
    }
    // TOK-050: 既定はgapのある仕様のみTOP10まで要約表示し、充足済みは件数のみに留める。
    // 全仕様（充足済み込み）を見たい場合は --all を指定する。
    const gapSpecs = report.specs.filter((s) => s.missingLayers.length > 0);
    const specsToShow = isAll ? report.specs : gapSpecs.slice(0, 10);
    for (const spec of specsToShow) {
        console.log(`\n📄 ${spec.id} — ${spec.title}`);
        const layerLine = spec.requires
            .map((l) => `${l} ${coverageSymbol(spec.coverage[l])}`)
            .join(' / ');
        console.log(`   requires: ${layerLine}`);
        if (spec.missingLayers.length > 0) {
            console.log(`   → 不足: ${spec.missingLayers.join(', ')}`);
        }
        if (spec.staleTargets.length > 0) {
            console.log(`   ⚠️  stale-target: ${spec.staleTargets.join(', ')}`);
        }
    }
    if (!isAll) {
        if (gapSpecs.length > specsToShow.length) {
            console.log(
                `\n   ... and ${gapSpecs.length - specsToShow.length} more gap 仕様 (--all で全件表示)`,
            );
        }
        if (gapSpecs.length === 0) {
            console.log(
                '\n   ✅ gap のある仕様はありません（--all で全仕様を表示）',
            );
        }
    }

    if (report.issues.orphanTags.length > 0) {
        console.log('\n⚠️  orphan-tag（実在しない仕様 ID を指す @spec）:');
        for (const issue of report.issues.orphanTags) {
            console.log(`   - ${issue.tag}（${issue.file}）`);
        }
    }
    if (report.issues.deprecatedRefs.length > 0) {
        console.log('\n⚠️  deprecated-ref（廃止仕様を指す @spec）:');
        for (const issue of report.issues.deprecatedRefs) {
            console.log(`   - ${issue.tag}（${issue.file}）`);
        }
    }

    console.log(
        `\n📊 ${report.summary.fullyCovered}/${report.summary.totalActiveSpecs} 仕様が全レイヤー充足`,
    );
    console.log('\n📝 補足');
    for (const line of report.notes) {
        console.log(line === '' ? '' : `   ${line}`);
    }
    console.log('');
};

const hasBlockingIssue = (report: SpecCoverageReport): boolean =>
    report.specs.some((s) => s.missingLayers.length > 0) ||
    report.issues.orphanTags.length > 0;

const main = (): void => {
    const args = process.argv.slice(2);
    const isJson = args.includes('--json');
    const isMermaid = args.includes('--mermaid');
    const isStrict = args.includes('--strict');
    const isAll = args.includes('--all');

    const allSpecs = loadSpecs();
    const taggedFiles = loadTaggedFiles();
    const report = buildReport(allSpecs, taggedFiles);

    if (isMermaid) {
        process.stdout.write(`${buildMermaidGraph(report)}\n`);
    } else if (isJson) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        printHuman(report, isAll);
    }

    if (isStrict && hasBlockingIssue(report)) {
        process.exit(1);
    }
};

if (import.meta.main) {
    main();
}

export type {
    Issue,
    Layer,
    SpecCoverageReport,
    SpecCoverageResult,
    SpecEntry,
    SpecStatus,
    TaggedFile,
};
export {
    buildMermaidGraph,
    buildReport,
    buildSpecEntry,
    computeIssues,
    computeSpecCoverage,
    determineLayer,
    extractSpecTags,
    parseFrontMatter,
};
