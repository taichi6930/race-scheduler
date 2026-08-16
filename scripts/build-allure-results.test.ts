/**
 * build-allure-results.ts の自己テスト
 *
 * Allure の Behaviors/Packages タブを実データで埋めるための変換ロジック
 * （JUnit XML → Allureネイティブ結果JSON）は、ラベル付け（epic/feature/story/package）を
 * 誤ると Behaviors タブが再び空になる/誤ったツリーになるため、UTを用意する
 * （testing-conventions.md §9: 既存の実機検証で判明した不具合の再発防止）。
 *
 * ## デシジョンテーブル
 *
 * ### toPackageLabel
 * | # | relPath | 期待 |
 * |---|---------|------|
 * | T-01 | packages/core/test/unittest/foo.test.ts | core.test.unittest.foo |
 * | T-02 | tests/uat/smoke/api.test.ts（packages/prefix無し） | tests.uat.smoke.api |
 *
 * ### buildResults
 * | # | 入力JUnit | 期待 |
 * |---|-----------|------|
 * | T-03 | pass 1件（describe階層あり） | labels に epic/feature/story/suite/package/parentSuite/subSuite が正しく入る、statusDetailsは無し |
 * | T-04 | fail 1件（failure type属性あり） | status=failed、statusDetails.messageがtype属性の値 |
 * | T-05 | fail 1件（failure type属性なし） | statusDetails.messageがフォールバック値 'Failed' |
 * | T-06 | skip 1件 | status=skipped |
 * | T-07 | 未知のlayer引数 | throw |
 *
 * ### buildResults（--events オプション。設計書 §3.2/§5-2 の整合性チェック＋フォールバック）
 * | # | events.jsonl | 期待 |
 * |---|--------------|------|
 * | T-08 | XMLと件数が一致する正常なイベント列 | イベント経路が使われる（storyがファイル名を含まない、statusDetailsが実メッセージ、subSuiteはstoryと同じ値） |
 * | T-08b | describeで囲まれていないテスト（イベント経路） | subSuiteラベルを付与しない |
 * | T-09 | XMLと件数が不一致 | XML経路にフォールバック（storyにファイル名が混入する従来どおりの挙動） |
 * | T-10 | ファイルが存在しない | XML経路にフォールバック |
 * | T-11 | JSONとして壊れている | XML経路にフォールバック |
 *
 * ### buildResults（severityラベル。設計書 §7.1）
 * | # | layerArg / ファイル | 期待 |
 * |---|---------------------|------|
 * | T-12 | layerArg='uat' | severity='blocker'（@specタグの有無に関わらず） |
 * | T-13 | layerArg='sit' | severity='critical' |
 * | T-14 | layerArg='ut'、@specタグ付きファイル | severity='critical' |
 * | T-15 | layerArg='ut'、@specタグ無し | severity='normal' |
 *
 * ### buildResults（consoleMessagesのattachment化。ALLURE-10）
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-16 | events経由でfail + consoleMessages 2件 | attachmentsに1件（source参照先のファイルに2件分が改行区切りで書き出される） |
 * | T-17 | events経由でfail + consoleMessages無し | attachmentsは無し |
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildResults, toPackageLabel } from './build-allure-results';

describe('toPackageLabel', () => {
    it('[T-01] packages/配下のテストファイルはpackages/を除いたドット区切りになる', () => {
        const result = toPackageLabel(
            'packages/core/test/unittest/foo.test.ts',
        );

        expect(result).toBe('core.test.unittest.foo');
    });

    it('[T-02] packages/prefixが無いパスはそのままドット区切りになる', () => {
        const result = toPackageLabel('tests/uat/smoke/api.test.ts');

        expect(result).toBe('tests.uat.smoke.api');
    });
});

interface AllureResult {
    status: string;
    statusDetails?: { message: string };
    labels: Array<{ name: string; value: string }>;
    attachments?: Array<{ name: string; source: string; type: string }>;
}

const withTempDir = (run: (dir: string) => void): void => {
    const dir = mkdtempSync(join(tmpdir(), 'allure-results-test-'));
    try {
        run(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
};

const readResults = (dir: string): AllureResult[] =>
    readdirSync(dir)
        .filter((f) => f.endsWith('-result.json'))
        .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const labelValue = (result: AllureResult, name: string): string | undefined =>
    result.labels.find((l) => l.name === name)?.value;

describe('buildResults', () => {
    it('[T-03] passしたテストにはepic/feature/story/suite/packageラベルが入る', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(
                input,
                `<?xml version="1.0"?><testsuites>
  <testsuite name="foo" file="packages/core/test/unittest/foo.test.ts">
    <testsuite name="outer">
      <testcase name="does a thing" time="0.01" />
    </testsuite>
  </testsuite>
</testsuites>`,
            );

            buildResults('ut', input, dir);
            const [result] = readResults(dir);

            expect(result.status).toBe('passed');
            expect(result.statusDetails).toBeUndefined();
            expect(labelValue(result, 'epic')).toBe('UT');
            expect(labelValue(result, 'feature')).toBe('core');
            expect(labelValue(result, 'story')).toBe('foo > outer');
            expect(labelValue(result, 'suite')).toBe(
                'packages/core/test/unittest/foo.test.ts',
            );
            expect(labelValue(result, 'package')).toBe(
                'core.test.unittest.foo',
            );
            expect(labelValue(result, 'parentSuite')).toBe('UT');
            // XML経路ではdescribePathの先頭に常にファイル単位のtestsuite名が入るため
            // （既存の仕様。ALLURE-04のイベント経路とは異なる）、subSuiteもstoryと同じ値になる
            expect(labelValue(result, 'subSuite')).toBe('foo > outer');
        });
    });

    it('[T-04] failureのtype属性がある場合はstatusDetails.messageに使われる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(
                input,
                `<?xml version="1.0"?><testsuites>
  <testsuite name="foo" file="packages/core/test/unittest/foo.test.ts">
    <testcase name="times out">
      <failure type="TimeoutError" />
    </testcase>
  </testsuite>
</testsuites>`,
            );

            buildResults('ut', input, dir);
            const [result] = readResults(dir);

            expect(result.status).toBe('failed');
            expect(result.statusDetails?.message).toBe('TimeoutError');
        });
    });

    it('[T-05] failureのtype属性が無い場合はフォールバック値になる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(
                input,
                `<?xml version="1.0"?><testsuites>
  <testsuite name="foo" file="packages/core/test/unittest/foo.test.ts">
    <testcase name="breaks">
      <failure />
    </testcase>
  </testsuite>
</testsuites>`,
            );

            buildResults('ut', input, dir);
            const [result] = readResults(dir);

            expect(result.statusDetails?.message).toBe('Failed');
        });
    });

    it('[T-06] skippedはstatus=skippedになる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(
                input,
                `<?xml version="1.0"?><testsuites>
  <testsuite name="foo" file="packages/core/test/unittest/foo.test.ts">
    <testcase name="not run yet">
      <skipped />
    </testcase>
  </testsuite>
</testsuites>`,
            );

            buildResults('ut', input, dir);
            const [result] = readResults(dir);

            expect(result.status).toBe('skipped');
        });
    });

    it('[T-07] 未知のlayer引数はthrowする', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(
                input,
                '<?xml version="1.0"?><testsuites></testsuites>',
            );

            expect(() => buildResults('unknown', input, dir)).toThrow();
        });
    });
});

const REL_PATH = 'packages/core/test/unittest/foo.test.ts';
const ABS_URL = join(process.cwd(), REL_PATH);

const eventLine = (obj: unknown): string => `${JSON.stringify(obj)}\n`;

/** XML側と対になる、正常系のイベント列（1件のfail、実メッセージ付き）。 */
const validEventsJsonl = (): string =>
    [
        eventLine({
            t: 0,
            m: 'TestReporter.found',
            p: { id: 1, url: ABS_URL, name: 'outer', type: 'describe' },
        }),
        eventLine({
            t: 0,
            m: 'TestReporter.found',
            p: {
                id: 2,
                url: ABS_URL,
                name: 'does a thing',
                type: 'test',
                parentId: 1,
            },
        }),
        eventLine({ t: 1, m: 'TestReporter.start', p: { id: 2 } }),
        eventLine({
            t: 1,
            m: 'LifecycleReporter.error',
            p: {
                message: 'expect(received).toBe(expected)\n\nreal message',
                urls: [ABS_URL],
                lineColumns: [3, 5],
            },
        }),
        eventLine({
            t: 2,
            m: 'TestReporter.end',
            p: { id: 2, status: 'fail' },
        }),
    ].join('');

const xmlWithOneFailure = (): string =>
    `<?xml version="1.0"?><testsuites>
  <testsuite name="foo" file="${REL_PATH}">
    <testsuite name="outer">
      <testcase name="does a thing" time="0.01">
        <failure type="AssertionError" />
      </testcase>
    </testsuite>
  </testsuite>
</testsuites>`;

describe('buildResults（--events オプション）', () => {
    it('[T-08] XMLと件数が一致すればイベント経路が使われる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            const events = join(dir, 'input.events.jsonl');
            writeFileSync(input, xmlWithOneFailure());
            writeFileSync(events, validEventsJsonl());

            buildResults('ut', input, dir, events);
            const [result] = readResults(dir);

            expect(labelValue(result, 'story')).toBe('outer');
            expect(labelValue(result, 'subSuite')).toBe('outer');
            expect(result.statusDetails?.message).toBe(
                'expect(received).toBe(expected)',
            );
        });
    });

    it('[T-08b] describeで囲まれていないテストはsubSuiteラベルを付与しない（イベント経路）', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            const events = join(dir, 'input.events.jsonl');
            writeFileSync(
                input,
                `<?xml version="1.0"?><testsuites>
  <testsuite name="foo" file="${REL_PATH}">
    <testcase name="top level test" time="0.01" />
  </testsuite>
</testsuites>`,
            );
            writeFileSync(
                events,
                [
                    eventLine({
                        t: 0,
                        m: 'TestReporter.found',
                        p: {
                            id: 1,
                            url: ABS_URL,
                            name: 'top level test',
                            type: 'test',
                        },
                    }),
                    eventLine({ t: 1, m: 'TestReporter.start', p: { id: 1 } }),
                    eventLine({
                        t: 2,
                        m: 'TestReporter.end',
                        p: { id: 1, status: 'pass' },
                    }),
                ].join(''),
            );

            buildResults('ut', input, dir, events);
            const [result] = readResults(dir);

            expect(labelValue(result, 'subSuite')).toBeUndefined();
        });
    });

    it('[T-09] XMLと件数が不一致ならXML経路にフォールバックする', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            const events = join(dir, 'input.events.jsonl');
            writeFileSync(input, xmlWithOneFailure());
            // XMLは1件だが、イベント側は2件目のtestを追加して件数を不一致にする
            writeFileSync(
                events,
                `${validEventsJsonl()}${eventLine({
                    t: 0,
                    m: 'TestReporter.found',
                    p: { id: 3, url: ABS_URL, name: 'extra', type: 'test' },
                })}${eventLine({ t: 3, m: 'TestReporter.start', p: { id: 3 } })}${eventLine(
                    {
                        t: 4,
                        m: 'TestReporter.end',
                        p: { id: 3, status: 'pass' },
                    },
                )}`,
            );

            buildResults('ut', input, dir, events);
            const [result] = readResults(dir);

            expect(labelValue(result, 'story')).toBe('foo > outer');
            expect(result.statusDetails?.message).toBe('AssertionError');
        });
    });

    it('[T-10] events.jsonlが存在しなければXML経路にフォールバックする', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(input, xmlWithOneFailure());

            buildResults('ut', input, dir, join(dir, 'does-not-exist.jsonl'));
            const [result] = readResults(dir);

            expect(labelValue(result, 'story')).toBe('foo > outer');
        });
    });

    it('[T-11] events.jsonlがJSONとして壊れていればXML経路にフォールバックする', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            const events = join(dir, 'input.events.jsonl');
            writeFileSync(input, xmlWithOneFailure());
            writeFileSync(events, 'not valid json\n');

            buildResults('ut', input, dir, events);
            const [result] = readResults(dir);

            expect(labelValue(result, 'story')).toBe('foo > outer');
        });
    });
});

describe('buildResults（severityラベル）', () => {
    // test-report/ はgitignore対象のスクラッチ領域。ROOT(process.cwd())からの相対パスで
    // @specタグの有無を読み分けるため、実ファイルとして書き出す必要がある
    const FIXTURE_DIR = join(
        process.cwd(),
        'test-report',
        '__allure-severity-fixture__',
    );
    const WITH_SPEC_REL =
        'test-report/__allure-severity-fixture__/withSpec.test.ts';
    const WITHOUT_SPEC_REL =
        'test-report/__allure-severity-fixture__/withoutSpec.test.ts';

    beforeAll(() => {
        mkdirSync(FIXTURE_DIR, { recursive: true });
        writeFileSync(
            join(FIXTURE_DIR, 'withSpec.test.ts'),
            '/**\n * @spec SPEC-TEST-001\n */\nimport {} from "bun:test";\n',
        );
        writeFileSync(
            join(FIXTURE_DIR, 'withoutSpec.test.ts'),
            'import {} from "bun:test";\n',
        );
    });
    afterAll(() => {
        rmSync(FIXTURE_DIR, { recursive: true, force: true });
    });

    const xmlFor = (relPath: string): string =>
        `<?xml version="1.0"?><testsuites>
  <testsuite name="foo" file="${relPath}">
    <testcase name="t" time="0.01" />
  </testsuite>
</testsuites>`;

    it('[T-12] layerArg=uatはseverity=blockerになる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(input, xmlFor(WITHOUT_SPEC_REL));

            buildResults('uat', input, dir);
            const [result] = readResults(dir);

            expect(labelValue(result, 'severity')).toBe('blocker');
        });
    });

    it('[T-13] layerArg=sitはseverity=criticalになる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(input, xmlFor(WITHOUT_SPEC_REL));

            buildResults('sit', input, dir);
            const [result] = readResults(dir);

            expect(labelValue(result, 'severity')).toBe('critical');
        });
    });

    it('[T-14] layerArg=utで@specタグ付きファイルはseverity=criticalになる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(input, xmlFor(WITH_SPEC_REL));

            buildResults('ut', input, dir);
            const [result] = readResults(dir);

            expect(labelValue(result, 'severity')).toBe('critical');
        });
    });

    it('[T-15] layerArg=utで@specタグが無ければseverity=normalになる', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            writeFileSync(input, xmlFor(WITHOUT_SPEC_REL));

            buildResults('ut', input, dir);
            const [result] = readResults(dir);

            expect(labelValue(result, 'severity')).toBe('normal');
        });
    });
});

describe('buildResults（consoleMessagesのattachment化。ALLURE-10）', () => {
    /** validEventsJsonl（fail 1件）にConsole.messageAddedを2件差し込んだイベント列。 */
    const eventsWithConsoleMessages = (): string =>
        [
            eventLine({
                t: 0,
                m: 'TestReporter.found',
                p: { id: 1, url: ABS_URL, name: 'outer', type: 'describe' },
            }),
            eventLine({
                t: 0,
                m: 'TestReporter.found',
                p: {
                    id: 2,
                    url: ABS_URL,
                    name: 'does a thing',
                    type: 'test',
                    parentId: 1,
                },
            }),
            eventLine({ t: 1, m: 'TestReporter.start', p: { id: 2 } }),
            eventLine({
                t: 1,
                m: 'Console.messageAdded',
                p: { message: { level: 'log', text: 'first line' } },
            }),
            eventLine({
                t: 1,
                m: 'Console.messageAdded',
                p: { message: { level: 'error', text: 'second line' } },
            }),
            eventLine({
                t: 1,
                m: 'LifecycleReporter.error',
                p: {
                    message: 'expect(received).toBe(expected)\n\nreal message',
                    urls: [ABS_URL],
                    lineColumns: [3, 5],
                },
            }),
            eventLine({
                t: 2,
                m: 'TestReporter.end',
                p: { id: 2, status: 'fail' },
            }),
        ].join('');

    it('[T-16] consoleMessagesが2件あればattachmentファイルに改行区切りで書き出される', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            const events = join(dir, 'input.events.jsonl');
            writeFileSync(input, xmlWithOneFailure());
            writeFileSync(events, eventsWithConsoleMessages());

            buildResults('ut', input, dir, events);
            const [result] = readResults(dir);

            expect(result.attachments).toHaveLength(1);
            const [attachment] = result.attachments ?? [];
            expect(attachment.name).toBe('Console output');
            expect(attachment.type).toBe('text/plain');
            const content = readFileSync(join(dir, attachment.source), 'utf8');
            expect(content).toBe('[log] first line\n[error] second line');
        });
    });

    it('[T-17] consoleMessagesが無ければattachmentsは付与されない', () => {
        withTempDir((dir) => {
            const input = join(dir, 'input.xml');
            const events = join(dir, 'input.events.jsonl');
            writeFileSync(input, xmlWithOneFailure());
            writeFileSync(events, validEventsJsonl());

            buildResults('ut', input, dir, events);
            const [result] = readResults(dir);

            expect(result.attachments).toBeUndefined();
        });
    });
});
