/**
 * spec-coverage.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 仕様トレーサビリティ機構の要となる突合ロジックのため UT を用意する
 * （.claude/docs/spec-traceability/spec-coverage-tool.md §6）。
 * 実ファイル（docs/specs/ や各パッケージの test/ 配下）には触れず、fixture のみで検証する
 * （hermetic：CI・ローカルどちらでも同じ結果になる）。
 *
 * ## デシジョンテーブル
 *
 * ### parseFrontMatter / buildSpecEntry
 * | # | 入力 | 期待 | 備考 |
 * |---|------|------|------|
 * | F1 | front-matter なし | throw | `---` ブロックが無い |
 * | F2 | スカラー + 配列混在の正常な front-matter | 全キーがパースされる | id/title/status/raceType/requires/targets/owner/related |
 * | F3 | requires に不正なレイヤー値 | throw | `isLayer` で弾く |
 * | F4 | status が不正な値 | throw | `isStatus` で弾く |
 * | F5 | id が欠落 | throw | 必須キー欠落 |
 *
 * ### determineLayer
 * | # | パス | 期待 |
 * |---|------|------|
 * | L1 | packages/core/test/unittest/foo.test.ts | 'UT' |
 * | L2 | packages/api/test/integration/component/foo.test.ts | 'Component' |
 * | L3 | packages/api/test/integration/system/foo.test.ts | 'sIT' |
 * | L4 | tests/e2e/scenarios/foo.test.ts | 'E2E' |
 * | L5 | tests/uat/smoke/foo.test.ts | 'UAT' |
 * | L6 | packages/api/test/common/foo.ts | null |
 *
 * ### extractSpecTags
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T1 | `@spec SPEC-CAL-001` を1つ含む本文 | ['SPEC-CAL-001'] |
 * | T2 | `@spec` を複数含む本文 | 全件抽出 |
 * | T3 | `@spec` を含まない本文 | [] |
 *
 * ### computeSpecCoverage
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | C1 | requires=[UT,Component]、UTのみタグ付きファイルあり | UT=covered, Component=gap, missingLayers=[Component] |
 * | C2 | requires=[UT,E2E]、UTなし・E2E(非enforceable)もなし | UT=gap, E2E=pending, missingLayers=[UT] |
 * | C3 | requires=[UT]、UTタグ付きファイルあり | UT=covered, missingLayers=[] |
 * | C4 | targets に実在しないパスを含む | staleTargets に含まれる |
 *
 * ### computeIssues
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | I1 | 実在しない ID を指す @spec | orphanTags に1件 |
 * | I2 | deprecated 仕様を指す @spec | deprecatedRefs に1件 |
 * | I3 | active 仕様を指す @spec | issue なし |
 *
 * ### buildReport
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | R1 | active 1件・draft 1件混在 | activeのみ specs に集計される |
 * | R2 | 全レイヤー covered | summary.fullyCovered=1, withGaps=0 |
 *
 * ### buildMermaidGraph
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | M1 | covered なレイヤー1件 | flowchart宣言・仕様ノード・レイヤーノード・class covered・ファイルノードを含む |
 * | M2 | gap なレイヤー1件（タグ付きファイルなし） | class gap を含み、ファイルノードは無い |
 * | M3 | pending なレイヤー1件 | class pending を含む |
 * | M4 | active仕様が0件 | flowchart宣言とclassDef定義のみ（ノード無し） |
 */
import { describe, expect, it } from 'bun:test';
import type { SpecEntry, TaggedFile } from './spec-coverage';
import {
    buildMermaidGraph,
    buildReport,
    buildSpecEntry,
    computeIssues,
    computeSpecCoverage,
    determineLayer,
    extractSpecTags,
    parseFrontMatter,
} from './spec-coverage';

const buildRawSpecFile = (overrides: Record<string, string> = {}): string => {
    const defaults = {
        id: 'SPEC-CAL-001',
        title: '登録フラグ ON のレースは常に掲載する',
        status: 'active',
    } satisfies Record<string, string>;
    const merged = { ...defaults, ...overrides };
    return [
        '---',
        `id: ${merged.id}`,
        `title: ${merged.title}`,
        `status: ${merged.status}`,
        'raceType: all',
        'requires:',
        '    - UT',
        '    - Component',
        'targets:',
        '    - packages/core/src/domain/policy/calendarInclusion.ts',
        'owner: core',
        'related:',
        '    - aidlc-docs/foo.md',
        '---',
        '',
        '## 仕様',
        '',
        '本文',
        '',
    ].join('\n');
};

const buildSpec = (overrides: Partial<SpecEntry> = {}): SpecEntry => ({
    id: 'SPEC-CAL-001',
    title: '登録フラグ ON のレースは常に掲載する',
    status: 'active',
    raceType: ['all'],
    requires: ['UT', 'Component'],
    targets: ['packages/core/src/domain/policy/calendarInclusion.ts'],
    owner: 'core',
    related: [],
    filePath: 'docs/specs/SPEC-CAL-001.md',
    ...overrides,
});

describe('parseFrontMatter / buildSpecEntry', () => {
    it('F1: front-matter がないと throw する', () => {
        expect(() => parseFrontMatter('# no frontmatter\n')).toThrow();
    });

    it('F2: スカラーと配列が混在する正常な front-matter を全キーパースする', () => {
        const raw = parseFrontMatter(buildRawSpecFile());
        const spec = buildSpecEntry(raw, 'docs/specs/SPEC-CAL-001.md');

        expect(spec.id).toBe('SPEC-CAL-001');
        expect(spec.title).toBe('登録フラグ ON のレースは常に掲載する');
        expect(spec.status).toBe('active');
        expect(spec.raceType).toEqual(['all']);
        expect(spec.requires).toEqual(['UT', 'Component']);
        expect(spec.targets).toEqual([
            'packages/core/src/domain/policy/calendarInclusion.ts',
        ]);
        expect(spec.owner).toBe('core');
        expect(spec.related).toEqual(['aidlc-docs/foo.md']);
    });

    it('F3: requires に不正なレイヤー値があると throw する', () => {
        const content = buildRawSpecFile().replace(
            '    - UT\n    - Component',
            '    - UT\n    - INVALID_LAYER',
        );
        const raw = parseFrontMatter(content);
        expect(() =>
            buildSpecEntry(raw, 'docs/specs/SPEC-CAL-001.md'),
        ).toThrow();
    });

    it('F4: status が不正な値だと throw する', () => {
        const raw = parseFrontMatter(buildRawSpecFile({ status: 'unknown' }));
        expect(() =>
            buildSpecEntry(raw, 'docs/specs/SPEC-CAL-001.md'),
        ).toThrow();
    });

    it('F5: id が欠落していると throw する', () => {
        const content = buildRawSpecFile()
            .split('\n')
            .filter((line) => !line.startsWith('id:'))
            .join('\n');
        const raw = parseFrontMatter(content);
        expect(() =>
            buildSpecEntry(raw, 'docs/specs/SPEC-CAL-001.md'),
        ).toThrow();
    });
});

describe('determineLayer', () => {
    it('L1: unittest 配下は UT と判定する', () => {
        expect(determineLayer('packages/core/test/unittest/foo.test.ts')).toBe(
            'UT',
        );
    });

    it('L2: integration/component 配下は Component と判定する', () => {
        expect(
            determineLayer(
                'packages/api/test/integration/component/foo.test.ts',
            ),
        ).toBe('Component');
    });

    it('L3: integration/system 配下は sIT と判定する', () => {
        expect(
            determineLayer('packages/api/test/integration/system/foo.test.ts'),
        ).toBe('sIT');
    });

    it('L4: tests/e2e/scenarios 配下は E2E と判定する', () => {
        expect(determineLayer('tests/e2e/scenarios/foo.test.ts')).toBe('E2E');
    });

    it('L5: tests/uat 配下は UAT と判定する', () => {
        expect(determineLayer('tests/uat/smoke/foo.test.ts')).toBe('UAT');
    });

    it('L6: いずれのレイヤーにも該当しないパスは null を返す', () => {
        expect(determineLayer('packages/api/test/common/foo.ts')).toBeNull();
    });
});

describe('extractSpecTags', () => {
    it('T1: @spec を1つ含む本文から1件抽出する', () => {
        const content = '/**\n * @spec SPEC-CAL-001\n */\n';
        expect(extractSpecTags(content)).toEqual(['SPEC-CAL-001']);
    });

    it('T2: @spec を複数含む本文から全件抽出する', () => {
        const content =
            '/**\n * @spec SPEC-CAL-001\n * @spec SPEC-RACE-002\n */\n';
        expect(extractSpecTags(content)).toEqual([
            'SPEC-CAL-001',
            'SPEC-RACE-002',
        ]);
    });

    it('T3: @spec を含まない本文からは空配列を返す', () => {
        const content = '/**\n * デシジョンテーブルのみ\n */\n';
        expect(extractSpecTags(content)).toEqual([]);
    });
});

describe('computeSpecCoverage', () => {
    it('C1: UTのみタグ付きファイルがある場合、Componentはgapになる', () => {
        const spec = buildSpec({ requires: ['UT', 'Component'] });
        const taggedFiles: TaggedFile[] = [
            {
                relPath: 'packages/core/test/unittest/foo.test.ts',
                layer: 'UT',
                specIds: ['SPEC-CAL-001'],
            },
        ];

        const result = computeSpecCoverage(spec, taggedFiles, () => true);

        expect(result.coverage.UT).toBe('covered');
        expect(result.coverage.Component).toBe('gap');
        expect(result.missingLayers).toEqual(['Component']);
    });

    it('C2: enforceable でないレイヤーはタグが無くてもpendingになる', () => {
        const spec = buildSpec({ requires: ['UT', 'E2E'] });
        const result = computeSpecCoverage(spec, [], () => true);

        expect(result.coverage.UT).toBe('gap');
        expect(result.coverage.E2E).toBe('pending');
        expect(result.missingLayers).toEqual(['UT']);
    });

    it('C3: 全requiresがcoveredの場合、missingLayersは空になる', () => {
        const spec = buildSpec({ requires: ['UT'] });
        const taggedFiles: TaggedFile[] = [
            {
                relPath: 'packages/core/test/unittest/foo.test.ts',
                layer: 'UT',
                specIds: ['SPEC-CAL-001'],
            },
        ];

        const result = computeSpecCoverage(spec, taggedFiles, () => true);

        expect(result.missingLayers).toEqual([]);
    });

    it('C4: targets に実在しないパスがあればstaleTargetsに含める', () => {
        const spec = buildSpec({
            requires: ['UT'],
            targets: ['packages/core/src/does/not/exist.ts'],
        });

        const result = computeSpecCoverage(spec, [], () => false);

        expect(result.staleTargets).toEqual([
            'packages/core/src/does/not/exist.ts',
        ]);
    });
});

describe('computeIssues', () => {
    it('I1: 実在しない仕様IDを指すタグはorphanTagsに入る', () => {
        const taggedFiles: TaggedFile[] = [
            {
                relPath: 'packages/core/test/unittest/foo.test.ts',
                layer: 'UT',
                specIds: ['SPEC-CAL-999'],
            },
        ];

        const issues = computeIssues([buildSpec()], taggedFiles);

        expect(issues.orphanTags).toEqual([
            {
                tag: 'SPEC-CAL-999',
                file: 'packages/core/test/unittest/foo.test.ts',
            },
        ]);
        expect(issues.deprecatedRefs).toEqual([]);
    });

    it('I2: deprecated仕様を指すタグはdeprecatedRefsに入る', () => {
        const deprecatedSpec = buildSpec({ status: 'deprecated' });
        const taggedFiles: TaggedFile[] = [
            {
                relPath: 'packages/core/test/unittest/foo.test.ts',
                layer: 'UT',
                specIds: ['SPEC-CAL-001'],
            },
        ];

        const issues = computeIssues([deprecatedSpec], taggedFiles);

        expect(issues.deprecatedRefs).toEqual([
            {
                tag: 'SPEC-CAL-001',
                file: 'packages/core/test/unittest/foo.test.ts',
            },
        ]);
        expect(issues.orphanTags).toEqual([]);
    });

    it('I3: active仕様を指すタグはissueにならない', () => {
        const taggedFiles: TaggedFile[] = [
            {
                relPath: 'packages/core/test/unittest/foo.test.ts',
                layer: 'UT',
                specIds: ['SPEC-CAL-001'],
            },
        ];

        const issues = computeIssues([buildSpec()], taggedFiles);

        expect(issues.orphanTags).toEqual([]);
        expect(issues.deprecatedRefs).toEqual([]);
    });
});

describe('buildReport', () => {
    it('R1: draft仕様はspecs集計から除外される', () => {
        const activeSpec = buildSpec({ id: 'SPEC-CAL-001' });
        const draftSpec = buildSpec({
            id: 'SPEC-CAL-002',
            status: 'draft',
            filePath: 'docs/specs/SPEC-CAL-002.md',
        });

        const report = buildReport([activeSpec, draftSpec], []);

        expect(report.specs).toHaveLength(1);
        expect(report.specs[0].id).toBe('SPEC-CAL-001');
        expect(report.summary.totalActiveSpecs).toBe(1);
    });

    it('R2: 全レイヤーcoveredな仕様はfullyCoveredに数えられる', () => {
        const spec = buildSpec({ requires: ['UT'] });
        const taggedFiles: TaggedFile[] = [
            {
                relPath: 'packages/core/test/unittest/foo.test.ts',
                layer: 'UT',
                specIds: ['SPEC-CAL-001'],
            },
        ];

        const report = buildReport([spec], taggedFiles);

        expect(report.summary.fullyCovered).toBe(1);
        expect(report.summary.withGaps).toBe(0);
    });
});

describe('buildMermaidGraph', () => {
    it('M1: coveredなレイヤーは仕様ノード・レイヤーノード・classとファイルノードを含む', () => {
        const spec = buildSpec({ requires: ['UT'] });
        const taggedFiles: TaggedFile[] = [
            {
                relPath: 'packages/core/test/unittest/foo.test.ts',
                layer: 'UT',
                specIds: ['SPEC-CAL-001'],
            },
        ];
        const report = buildReport([spec], taggedFiles);

        const graph = buildMermaidGraph(report);

        expect(graph).toContain('flowchart LR');
        expect(graph).toContain('SPEC-CAL-001');
        expect(graph).toContain('["UT"]');
        expect(graph).toContain('class spec0_layer0 covered');
        expect(graph).toContain('foo.test.ts');
    });

    it('M2: gapなレイヤーはclass gapを含み、ファイルノードは無い', () => {
        const spec = buildSpec({ requires: ['UT'] });
        const report = buildReport([spec], []);

        const graph = buildMermaidGraph(report);

        expect(graph).toContain('class spec0_layer0 gap');
        expect(graph).not.toContain('_f0');
    });

    it('M3: pendingなレイヤーはclass pendingを含む', () => {
        const spec = buildSpec({ requires: ['E2E'] });
        const report = buildReport([spec], []);

        const graph = buildMermaidGraph(report);

        expect(graph).toContain('class spec0_layer0 pending');
    });

    it('M4: active仕様が0件ならノードは無くflowchart宣言とclassDefのみになる', () => {
        const report = buildReport([], []);

        const graph = buildMermaidGraph(report);

        expect(graph).toContain('flowchart LR');
        expect(graph).toContain('classDef covered');
        expect(graph).not.toContain('spec0');
    });
});
