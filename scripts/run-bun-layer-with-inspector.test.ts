/**
 * run-bun-layer-with-inspector.ts の自己テスト
 *
 * 実際に bun test を spawn する経路（defaultAttempt/defaultFallback）は実プロセス起動を
 * 伴い低速・重いため UT の対象にせず、実機検証（`bun run test:report:full` 等）で確認する
 * （設計書 §6 Stage1 の受け入れ条件）。ここでは `attempt`/`fallback` を注入可能にした
 * 分岐ロジック（接続成功→events.jsonl書き出し / 接続失敗→フォールバックしevents.jsonlは
 * 書き出さない）を検証する。
 *
 * ## デシジョンテーブル
 *
 * ### runBunLayerWithInspector
 * | # | attemptの結果 | 期待 |
 * |---|---------------|------|
 * | T-01 | connected=true, events 2件 | fallbackを呼ばない、eventsOutfileにJSONL2行が書かれる、exitCodeがattemptのものになる |
 * | T-02 | connected=false | fallbackを呼ぶ、eventsOutfileは書かれない、exitCodeがfallbackの返り値になる |
 * | T-03 | connected=true, events 0件 | eventsOutfileは空文字列で書かれる（末尾改行を付けない） |
 */

import { describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runBunLayerWithInspector } from './run-bun-layer-with-inspector';

const baseOpts = (dir: string) => ({
    bunTestArgs: ['test', 'dummy'],
    cwd: dir,
    env: {},
    xmlOutfile: join(dir, 'out.xml'),
    eventsOutfile: join(dir, 'out.events.jsonl'),
});

const withTempDir =
    (run: (dir: string) => Promise<void> | void) => async () => {
        const dir = mkdtempSync(
            join(tmpdir(), 'run-bun-layer-inspector-test-'),
        );
        try {
            await run(dir);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

describe('runBunLayerWithInspector', () => {
    it(
        '[T-01] 接続成功時はfallbackを呼ばずevents.jsonlを書き出す',
        withTempDir(async (dir) => {
            let fallbackCalled = false;
            const result = await runBunLayerWithInspector(baseOpts(dir), {
                attempt: async () => ({
                    connected: true,
                    exitCode: 0,
                    events: [
                        { t: 1, m: 'TestReporter.found', p: { id: 1 } },
                        {
                            t: 2,
                            m: 'TestReporter.end',
                            p: { id: 1, status: 'pass' },
                        },
                    ],
                }),
                fallback: () => {
                    fallbackCalled = true;
                    return 1;
                },
            });

            expect(fallbackCalled).toBe(false);
            expect(result).toEqual({ exitCode: 0, eventsWritten: true });
            const written = readFileSync(baseOpts(dir).eventsOutfile, 'utf8');
            expect(written).toBe(
                '{"t":1,"m":"TestReporter.found","p":{"id":1}}\n{"t":2,"m":"TestReporter.end","p":{"id":1,"status":"pass"}}\n',
            );
        }),
    );

    it(
        '[T-02] 接続失敗時はfallbackを呼びevents.jsonlは書き出さない',
        withTempDir(async (dir) => {
            const result = await runBunLayerWithInspector(baseOpts(dir), {
                attempt: async () => ({
                    connected: false,
                    exitCode: -1,
                    events: [],
                }),
                fallback: () => 42,
            });

            expect(result).toEqual({ exitCode: 42, eventsWritten: false });
            expect(existsSync(baseOpts(dir).eventsOutfile)).toBe(false);
        }),
    );

    it(
        '[T-03] イベント0件のときは空文字列で書き出す',
        withTempDir(async (dir) => {
            await runBunLayerWithInspector(baseOpts(dir), {
                attempt: async () => ({
                    connected: true,
                    exitCode: 0,
                    events: [],
                }),
                fallback: () => 1,
            });

            expect(readFileSync(baseOpts(dir).eventsOutfile, 'utf8')).toBe('');
        }),
    );
});
