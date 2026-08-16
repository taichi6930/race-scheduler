/**
 * @file bun test を Inspector Protocol 付きで実行し、JUnit XML に加えて Allure 用の
 * イベント JSONL（`*.events.jsonl`）を生成する。
 *
 * 設計は `aidlc-docs/inception/application-design/allure-inspector-reporter-design.md`
 * §3〜§5 を正とする。要点:
 *
 * - `--reporter=junit --reporter-outfile=<xml>` は Inspector の有無にかかわらず常に出力する
 *   （既存の HTML レポート生成経路 `generate-test-report.ts` は本モジュール導入前後で無変更）。
 * - Inspector への接続に失敗した場合（ポート競合等）、`--inspect-wait` は子プロセスを
 *   永久にブロックしうるため、接続タイムアウト（既定30秒）で見切りをつけてプロセスを kill し、
 *   Inspector 無しの通常実行（フォールバック）で XML だけを生成し直す。
 *   この場合 `*.events.jsonl` は書き出さない（Allure 側は既存の XML 経路にフォールバックする。
 *   `build-allure-results.ts` 側の責務）。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
    formatInspectorEventLine,
    type InspectorEvent,
    runInspectorSession,
} from './lib/bunInspectorClient';

export interface RunBunLayerWithInspectorOptions {
    // `bun` に続く引数（例: ['test', 'packages/*/test/unittest']）

    bunTestArgs: string[];
    cwd: string;
    env: Record<string, string>;
    xmlOutfile: string;
    eventsOutfile: string;
    /** Inspector 接続確立の総タイムアウト（既定30秒） */
    connectTimeoutMs?: number;
}

export interface RunBunLayerWithInspectorResult {
    exitCode: number;
    /** true なら `eventsOutfile` が書き出された（Inspector セッションが正常に完走した） */
    eventsWritten: boolean;
}

interface AttemptResult {
    connected: boolean;
    exitCode: number;
    events: InspectorEvent[];
}

type RunAttempt = (
    opts: RunBunLayerWithInspectorOptions,
) => Promise<AttemptResult>;
type RunFallback = (opts: RunBunLayerWithInspectorOptions) => number;

const buildBunCommand = (
    opts: RunBunLayerWithInspectorOptions,
    inspectUrl?: string,
): string =>
    [
        'bun',
        ...(inspectUrl ? [`--inspect-wait=${inspectUrl}`] : []),
        ...opts.bunTestArgs,
        '--reporter=junit',
        `--reporter-outfile=${opts.xmlOutfile}`,
    ].join(' ');

/** OS にエフェメラルポートを割り当てさせ、直ちに解放して番号だけを得る（設計書 §5 (a)）。 */
const pickEphemeralPort = (): number => {
    const probe = Bun.serve({ port: 0, fetch: () => new Response('') });
    const { port } = probe;
    probe.stop(true);
    if (port === undefined) {
        throw new Error('failed to obtain an ephemeral port from Bun.serve');
    }
    return port;
};

const defaultAttempt: RunAttempt = async (opts) => {
    const port = pickEphemeralPort();
    const url = `ws://127.0.0.1:${port}/allure`;
    const proc = Bun.spawn({
        cmd: ['sh', '-c', buildBunCommand(opts, url)],
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdout: 'inherit',
        stderr: 'inherit',
    });
    const events: InspectorEvent[] = [];
    const session = await runInspectorSession({
        url,
        connectTimeoutMs: opts.connectTimeoutMs,
        onEvent: (e) => events.push(e),
    });
    if (!session.connected) {
        proc.kill(9);
        await proc.exited;
        return { connected: false, exitCode: -1, events: [] };
    }
    const exitCode = await proc.exited;
    return { connected: true, exitCode, events };
};

const defaultFallback: RunFallback = (opts) => {
    const proc = Bun.spawnSync({
        cmd: ['sh', '-c', buildBunCommand(opts)],
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdout: 'inherit',
        stderr: 'inherit',
    });
    return proc.exitCode ?? 1;
};

const writeJsonl = (path: string, events: InspectorEvent[]): void => {
    mkdirSync(dirname(path), { recursive: true });
    const body = events.map(formatInspectorEventLine).join('\n');
    writeFileSync(path, events.length ? `${body}\n` : '');
};

/**
 * `deps` はテスト用の注入ポイント。既定は実際に bun を spawn する実装
 * （`defaultAttempt`/`defaultFallback`）を使う。
 */
export const runBunLayerWithInspector = async (
    opts: RunBunLayerWithInspectorOptions,
    deps: { attempt?: RunAttempt; fallback?: RunFallback } = {},
): Promise<RunBunLayerWithInspectorResult> => {
    const attempt = deps.attempt ?? defaultAttempt;
    const fallback = deps.fallback ?? defaultFallback;

    const result = await attempt(opts);
    if (!result.connected) {
        console.log(
            '[run-bun-layer-with-inspector] Inspector接続に失敗したためフォールバック実行します（events.jsonlは生成されません）',
        );
        return { exitCode: fallback(opts), eventsWritten: false };
    }
    writeJsonl(opts.eventsOutfile, result.events);
    return { exitCode: result.exitCode, eventsWritten: true };
};
