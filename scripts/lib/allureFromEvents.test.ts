/**
 * allureFromEvents.ts の自己テスト
 *
 * 設計書（allure-inspector-reporter-design.md）§4 の相関ルールを実機検証の知見に基づいて
 * 検証する。特に T-03（pass時にpendingErrorsを破棄すること）は、これを取り違えると
 * 成功した2553件中2件が誤って失敗表示になる（実機検証で確認済みの実例）。
 *
 * ## デシジョンテーブル
 *
 * ### buildCasesFromEvents
 * | # | 入力イベント | 期待 |
 * |---|--------------|------|
 * | T-01 | pass、エラー無し | status=passed、statusDetails無し |
 * | T-02 | fail、エラー1件 | status=failed、statusDetailsがエラーのmessage/traceから組み立てられる |
 * | T-03 | pass だが直前にエラーが発火（握りつぶし例外パターン） | status=passed、statusDetails**無し**（エラーを破棄） |
 * | T-04 | timeout、エラー1件 | status=broken、statusDetailsがエラーから組み立てられる |
 * | T-05 | timeout、エラー無し | status=broken、statusDetails.message='Timed out' |
 * | T-06 | skip（startイベント無し） | status=skipped、statusDetails無し、start===stop===end受信時刻 |
 * | T-07 | todo（startイベント無し） | status=skipped、statusDetails.message='todo' |
 * | T-08 | hookで例外発生（start→error→end fail） | 相関ルール上はT-02と同じ扱いになる（hook由来か本体由来かを区別しない） |
 * | T-09 | describeが2階層ネスト | describePathが根→葉の順で2要素になる |
 * | T-10 | 複数ファイルが逐次実行される | 各ケースのrelPathがファイルごとに正しく分離される |
 * | T-11 | fail、Console.messageAdded 2件 | consoleMessagesに`[level] text`形式で2件とも入る（ALLURE-10） |
 * | T-12 | pass、Console.messageAdded 1件（握りつぶし例外パターン相当） | consoleMessagesはundefined（失敗時のみ添付する） |
 * | T-13 | fail、Console.messageAdded無し | consoleMessagesはundefined |
 * | T-14 | 2つのテストが連続実行、片方だけconsole出力あり | consoleMessagesがテスト間で混ざらない |
 */
import { describe, expect, it } from 'bun:test';
import { buildCasesFromEvents } from './allureFromEvents';
import type { InspectorEvent } from './bunInspectorClient';

const ROOT = '/repo';

const found = (
    t: number,
    id: number,
    url: string,
    name: string,
    type: 'describe' | 'test',
    parentId?: number,
): InspectorEvent => ({
    t,
    m: 'TestReporter.found',
    p: { id, url, name, type, parentId },
});
const start = (t: number, id: number): InspectorEvent => ({
    t,
    m: 'TestReporter.start',
    p: { id },
});
const end = (
    t: number,
    id: number,
    status: 'pass' | 'fail' | 'skip' | 'todo' | 'timeout',
): InspectorEvent => ({ t, m: 'TestReporter.end', p: { id, status } });
const error = (
    t: number,
    message: string,
    urls: string[] = ['/repo/a.test.ts'],
    lineColumns: number[] = [6, 15],
): InspectorEvent => ({
    t,
    m: 'LifecycleReporter.error',
    p: { message, urls, lineColumns },
});
const consoleMessage = (
    t: number,
    level: string,
    text: string,
): InspectorEvent => ({
    t,
    m: 'Console.messageAdded',
    p: { message: { level, text } },
});

describe('buildCasesFromEvents', () => {
    it('[T-01] passはstatusDetails無しでpassedになる', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            end(2, 1, 'pass'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('passed');
        expect(c.statusDetails).toBeUndefined();
        expect(c.start).toBe(1);
        expect(c.stop).toBe(2);
    });

    it('[T-02] failはエラーからstatusDetailsが組み立てられる', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            error(
                1,
                'expect(received).toBe(expected)\n\nExpected: 2\nReceived: 1',
                ['/repo/a.test.ts'],
                [6, 15],
            ),
            end(2, 1, 'fail'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('failed');
        expect(c.statusDetails?.message).toBe(
            'expect(received).toBe(expected)',
        );
        expect(c.statusDetails?.trace).toBe(
            'expect(received).toBe(expected)\n\nExpected: 2\nReceived: 1\n/repo/a.test.ts:6:15',
        );
    });

    it('[T-03] passかつ直前にエラーが発火してもstatusDetailsは破棄される（握りつぶし例外パターン）', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            error(1, 'caught internally, not a real failure'),
            end(2, 1, 'pass'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('passed');
        expect(c.statusDetails).toBeUndefined();
    });

    it('[T-04] timeoutはエラーがあればstatusDetailsに使われる', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            error(1, 'some error before timeout'),
            end(2, 1, 'timeout'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('broken');
        expect(c.statusDetails?.message).toBe('some error before timeout');
    });

    it('[T-05] timeoutでエラーが無ければ既定メッセージになる', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            end(2, 1, 'timeout'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('broken');
        expect(c.statusDetails).toEqual({ message: 'Timed out' });
    });

    it('[T-06] skipはstartが無くstart===stop===end受信時刻になる', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            end(5, 1, 'skip'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('skipped');
        expect(c.statusDetails).toBeUndefined();
        expect(c.start).toBe(5);
        expect(c.stop).toBe(5);
    });

    it('[T-07] todoはstatusDetails.message=todoになる', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            end(5, 1, 'todo'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('skipped');
        expect(c.statusDetails).toEqual({ message: 'todo' });
    });

    it('[T-08] hookでの例外もstart→error→end failと同じ相関ルールで扱われる', () => {
        const events = [
            found(0, 1, '/repo/b.test.ts', 'b1', 'test'),
            start(1, 1),
            error(1, 'hook exploded', ['/repo/b.test.ts'], [4, 20]),
            end(2, 1, 'fail'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.status).toBe('failed');
        expect(c.statusDetails?.message).toBe('hook exploded');
    });

    it('[T-09] describeが2階層ネストする場合、describePathが根→葉の順になる', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'Outer', 'describe'),
            found(0, 2, '/repo/a.test.ts', 'Inner', 'describe', 1),
            found(0, 3, '/repo/a.test.ts', 'leaf test', 'test', 2),
            start(1, 3),
            end(2, 3, 'pass'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.describePath).toEqual(['Outer', 'Inner']);
        expect(c.name).toBe('leaf test');
    });

    it('[T-10] 複数ファイルが逐次実行されてもrelPathが正しく分離される', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'Suite A', 'describe'),
            found(0, 2, '/repo/a.test.ts', 'a1', 'test', 1),
            start(1, 2),
            end(2, 2, 'pass'),
            found(3, 10, '/repo/nested/b.test.ts', 'Suite B', 'describe'),
            found(3, 11, '/repo/nested/b.test.ts', 'b1', 'test', 10),
            start(4, 11),
            end(5, 11, 'pass'),
        ];

        const cases = buildCasesFromEvents(events, ROOT);

        expect(cases).toHaveLength(2);
        expect(cases[0].relPath).toBe('a.test.ts');
        expect(cases[0].describePath).toEqual(['Suite A']);
        expect(cases[1].relPath).toBe('nested/b.test.ts');
        expect(cases[1].describePath).toEqual(['Suite B']);
    });

    it('describeのidにendイベントが来ても無視される（防御的）', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'Outer', 'describe'),
            end(1, 1, 'pass'),
        ];

        expect(buildCasesFromEvents(events, ROOT)).toEqual([]);
    });

    it('[T-11] failしたテストのconsole出力が[level] text形式でconsoleMessagesに入る（ALLURE-10）', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            consoleMessage(1, 'log', 'first line'),
            consoleMessage(1, 'error', 'second line'),
            end(2, 1, 'fail'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.consoleMessages).toEqual([
            '[log] first line',
            '[error] second line',
        ]);
    });

    it('[T-12] passしたテストはconsole出力があってもconsoleMessagesはundefined（失敗時のみ添付）', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            consoleMessage(1, 'log', 'caught internally, not a real failure'),
            end(2, 1, 'pass'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.consoleMessages).toBeUndefined();
    });

    it('[T-13] failしたテストでもconsole出力が無ければconsoleMessagesはundefined', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            start(1, 1),
            end(2, 1, 'fail'),
        ];

        const [c] = buildCasesFromEvents(events, ROOT);

        expect(c.consoleMessages).toBeUndefined();
    });

    it('[T-14] 2つのテストが連続実行されてもconsoleMessagesがテスト間で混ざらない', () => {
        const events = [
            found(0, 1, '/repo/a.test.ts', 'a1', 'test'),
            found(0, 2, '/repo/a.test.ts', 'a2', 'test'),
            start(1, 1),
            consoleMessage(1, 'log', 'from a1'),
            end(2, 1, 'fail'),
            start(3, 2),
            end(4, 2, 'fail'),
        ];

        const [c1, c2] = buildCasesFromEvents(events, ROOT);

        expect(c1.consoleMessages).toEqual(['[log] from a1']);
        expect(c2.consoleMessages).toBeUndefined();
    });
});
