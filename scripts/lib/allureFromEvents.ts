/**
 * @file bun Inspector Protocol のイベント列（`bunInspectorClient.ts` が収集した
 * `InspectorEvent[]`）から、Allure ネイティブ結果向けのテストケース情報を組み立てる。
 *
 * 相関ルールは
 * `aidlc-docs/inception/application-design/allure-inspector-reporter-design.md` §4 を正とする。
 * **必須の注意（同§4）**: `pass` のときに直前の `LifecycleReporter.error` を
 * `statusDetails` へ入れてはならない——bun は成功するテストでもエラーイベントを発火することが
 * 実機検証で確認されている（例外を握りつぶす挙動を検証するテスト）。
 */

import { relative, sep } from 'node:path';
import type { InspectorEvent } from './bunInspectorClient';

export type AllureCaseStatus = 'passed' | 'failed' | 'broken' | 'skipped';

export interface AllureStatusDetails {
    message: string;
    trace?: string;
}

/** 1テストケース分の組み立て結果。`relPath`/`describePath` はファイル名を含まない
 * （設計書 §4 注4。JUnit XML経路では最上位testsuite名＝ファイル名がstoryに混入していたが、
 * イベント経路ではdescribeの実名のみになる）。 */
export interface AllureEventCase {
    relPath: string;
    describePath: string[];
    name: string;
    status: AllureCaseStatus;
    statusDetails?: AllureStatusDetails;
    start: number;
    stop: number;
    /** ALLURE-10: このケースの実行中に発火した console 出力（`[level] text` 形式）。
     * 無ければ undefined（1件も出力が無かった場合、または events 経路自体を使っていない場合）。 */
    consoleMessages?: string[];
}

interface FoundParams {
    id: number;
    url: string;
    name: string;
    type: 'describe' | 'test';
    parentId?: number;
}

interface IdParams {
    id: number;
}

interface EndParams extends IdParams {
    status: 'pass' | 'fail' | 'skip' | 'todo' | 'timeout';
}

interface LifecycleErrorParams {
    message: string;
    urls?: string[];
    lineColumns?: number[];
}

interface ConsoleMessageAddedParams {
    message: {
        level: string;
        text: string;
    };
}

const asFoundParams = (p: unknown): FoundParams => p as FoundParams;
const asIdParams = (p: unknown): IdParams => p as IdParams;
const asEndParams = (p: unknown): EndParams => p as EndParams;
const asLifecycleErrorParams = (p: unknown): LifecycleErrorParams =>
    p as LifecycleErrorParams;
const asConsoleMessageAddedParams = (p: unknown): ConsoleMessageAddedParams =>
    p as ConsoleMessageAddedParams;

const toRelPath = (absPath: string, rootDir: string): string =>
    relative(rootDir, absPath).split(sep).join('/');

/** `id` の直近の祖先（parentIdチェーン）から describe 名の配列を復元する（根→葉の順）。 */
const collectDescribePath = (
    nodes: Map<number, FoundParams>,
    id: number,
): string[] => {
    const path: string[] = [];
    let parentId = nodes.get(id)?.parentId;
    while (parentId !== undefined) {
        const node = nodes.get(parentId);
        if (!node) break;
        path.push(node.name);
        parentId = node.parentId;
    }
    return path.reverse();
};

/** `pendingErrors` のうち直近1件から statusDetails を組み立てる（設計書 §4 注3）。 */
const buildStatusDetails = (
    errors: LifecycleErrorParams[],
): AllureStatusDetails | undefined => {
    if (errors.length === 0) return undefined;
    const last = errors[errors.length - 1];
    const firstLine = last.message.split('\n')[0];
    const location =
        last.urls?.[0] && last.lineColumns
            ? `${last.urls[0]}:${last.lineColumns.join(':')}`
            : undefined;
    return {
        message: firstLine,
        trace: location ? `${last.message}\n${location}` : last.message,
    };
};

const STATUS_MAP: Record<
    EndParams['status'],
    (errors: LifecycleErrorParams[]) => {
        status: AllureCaseStatus;
        statusDetails?: AllureStatusDetails;
    }
> = {
    // pass: pendingErrors は握りつぶし例外の可能性があるため破棄する（設計書 §4 必須の注意1）
    pass: () => ({ status: 'passed' }),
    fail: (errors) => ({
        status: 'failed',
        statusDetails: buildStatusDetails(errors),
    }),
    timeout: (errors) => ({
        status: 'broken',
        statusDetails: buildStatusDetails(errors) ?? { message: 'Timed out' },
    }),
    skip: () => ({ status: 'skipped' }),
    todo: () => ({ status: 'skipped', statusDetails: { message: 'todo' } }),
};

/**
 * イベント列を先頭から1パスで走査し、テストケースごとの結果を組み立てる。
 * `.concurrent` 未使用（実機確認済み。設計書 §2.3/§7.2）を前提に、実行中のテストは
 * 常に高々1つという仮定で `LifecycleReporter.error` を相関させている。
 */
export const buildCasesFromEvents = (
    events: readonly InspectorEvent[],
    rootDir: string,
): AllureEventCase[] => {
    const nodes = new Map<number, FoundParams>();
    const startedAt = new Map<number, number>();
    const cases: AllureEventCase[] = [];
    let current: number | null = null;
    let pendingErrors: LifecycleErrorParams[] = [];
    let pendingConsoleMessages: ConsoleMessageAddedParams[] = [];

    for (const event of events) {
        if (event.m === 'TestReporter.found') {
            const p = asFoundParams(event.p);
            nodes.set(p.id, p);
        } else if (event.m === 'TestReporter.start') {
            const p = asIdParams(event.p);
            current = p.id;
            startedAt.set(p.id, event.t);
            pendingErrors = [];
            pendingConsoleMessages = [];
        } else if (event.m === 'LifecycleReporter.error') {
            if (current !== null) {
                pendingErrors.push(asLifecycleErrorParams(event.p));
            }
        } else if (event.m === 'Console.messageAdded') {
            if (current !== null) {
                pendingConsoleMessages.push(
                    asConsoleMessageAddedParams(event.p),
                );
            }
        } else if (event.m === 'TestReporter.end') {
            const p = asEndParams(event.p);
            const node = nodes.get(p.id);
            if (node && node.type === 'test') {
                const { status, statusDetails } =
                    STATUS_MAP[p.status](pendingErrors);
                cases.push({
                    relPath: toRelPath(node.url, rootDir),
                    describePath: collectDescribePath(nodes, p.id),
                    name: node.name,
                    status,
                    statusDetails,
                    start: startedAt.get(p.id) ?? event.t,
                    stop: event.t,
                    // ALLURE-10: 失敗調査に使うのが目的のため、失敗/broken時のみ添付する
                    // （passでも例外を握りつぶすテスト等でconsole出力は起こりうるが、
                    // 成功したテストの出力を毎回添付する価値は無い）。
                    consoleMessages:
                        (status === 'failed' || status === 'broken') &&
                        pendingConsoleMessages.length > 0
                            ? pendingConsoleMessages.map(
                                  (m) =>
                                      `[${m.message.level}] ${m.message.text}`,
                              )
                            : undefined,
                });
            }
            current = null;
            pendingErrors = [];
            pendingConsoleMessages = [];
        }
    }
    return cases;
};
