/**
 * runDataQualityWarningCheck のテスト
 *
 * @spec なし（DATA-01: データ品質警告のGitHub Issue化）
 *
 * ## デシジョンテーブル
 *
 * | #    | GITHUB_TOKEN | data_quality_warning_log（直近ウィンドウ内） | 期待挙動                                     |
 * |------|--------------|-----------------------------------------------|-----------------------------------------------|
 * | T-01 | 未設定       | -                                              | GitHub APIが呼ばれない（即return）             |
 * | T-02 | 設定         | 0件                                            | GitHub Issue作成APIは呼ばれない（正常）        |
 * | T-03 | 設定         | 3件（place_mapper）                            | GitHub Issue作成APIが1回呼ばれる               |
 * | T-04 | 設定         | ウィンドウ外（71分前）の行のみ                 | 0件扱い、GitHub Issue作成APIは呼ばれない       |
 * | T-05 | 設定         | DB(select)が例外を投げる                       | スローせずcatchされ、GitHub APIは呼ばれない    |
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import { DI_TOKENS, EnvStore } from '@race-schedule/core';
import { drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import * as schema from '../../../src/db/schema';
import { dataQualityWarningLog } from '../../../src/db/schema';
import type { IDrizzleGateway } from '../../../src/gateway/interface/IDrizzleGateway';
import { runDataQualityWarningCheck } from '../../../src/utility/dataQualityWarningCheck';
import { createInMemoryD1Database } from '../../common/inMemoryD1';

interface FakeResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
}
type FetchHandler = (
    url: string,
    init?: { method?: string },
) => Promise<FakeResponse>;

const okJson = (data: unknown): FakeResponse => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
});

const setFetch = (
    handler: FetchHandler,
): { calls: { url: string; init?: { method?: string } }[] } => {
    const calls: { url: string; init?: { method?: string } }[] = [];
    const fn = mock((url: string, init?: { method?: string }) => {
        calls.push({ url, init });
        return handler(url, init);
    });
    globalThis.fetch = fn as unknown as typeof globalThis.fetch;
    return { calls };
};

const MINIMAL_ENV = {
    JRA_CALENDAR_ID: 'mock',
    NAR_CALENDAR_ID: 'mock',
    WORLD_CALENDAR_ID: 'mock',
    KEIRIN_CALENDAR_ID: 'mock',
    AUTORACE_CALENDAR_ID: 'mock',
    BOATRACE_CALENDAR_ID: 'mock',
    GOOGLE_CLIENT_EMAIL: 'mock@example.com',
    GOOGLE_PRIVATE_KEY: 'mock',
    R2_BUCKET: {},
};

/** テスト用のin-memory D1をDIコンテナへ登録する。 */
function registerInMemoryDrizzleGateway(): ReturnType<typeof drizzle> {
    const db = drizzle(createInMemoryD1Database(), { schema });
    container.register<IDrizzleGateway>(DI_TOKENS.DrizzleGateway, {
        useValue: { db },
    });
    return db;
}

describe('runDataQualityWarningCheck', () => {
    afterEach(() => {
        container.clearInstances();
        EnvStore.reset();
    });

    it('T-01: GITHUB_TOKEN未設定ならGitHub APIを呼ばずreturnする', async () => {
        EnvStore.setEnv({ ...MINIMAL_ENV } as never, []);
        registerInMemoryDrizzleGateway();
        const { calls } = setFetch(() => Promise.resolve(okJson([])));

        await runDataQualityWarningCheck(new Date('2026-08-05T01:00:00Z'));

        expect(calls).toHaveLength(0);
    });

    it('T-02: 警告0件ならGitHub Issue作成APIは呼ばれない', async () => {
        EnvStore.setEnv(
            { ...MINIMAL_ENV, GITHUB_TOKEN: 'gh-token' } as never,
            [],
        );
        registerInMemoryDrizzleGateway();
        const { calls } = setFetch(() => Promise.resolve(okJson([])));

        await runDataQualityWarningCheck(new Date('2026-08-05T01:00:00Z'));

        const createCalls = calls.filter((c) => c.init?.method === 'POST');
        expect(createCalls).toHaveLength(0);
    });

    it('T-03: 直近ウィンドウ内に3件あればGitHub Issue作成APIが1回呼ばれる', async () => {
        EnvStore.setEnv(
            { ...MINIMAL_ENV, GITHUB_TOKEN: 'gh-token' } as never,
            [],
        );
        const db = registerInMemoryDrizzleGateway();
        await db.insert(dataQualityWarningLog).values([
            {
                source: 'place_mapper',
                message: 'bad row 1',
                createdAt: '2026-08-05T00:30:00.000Z',
            },
            {
                source: 'place_mapper',
                message: 'bad row 2',
                createdAt: '2026-08-05T00:40:00.000Z',
            },
            {
                source: 'place_mapper',
                message: 'bad row 3',
                createdAt: '2026-08-05T00:50:00.000Z',
            },
        ]);
        const { calls } = setFetch((_url, init) => {
            if (init?.method === 'POST') {
                return Promise.resolve(okJson({ number: 99 }));
            }
            return Promise.resolve(okJson([]));
        });

        await runDataQualityWarningCheck(new Date('2026-08-05T01:00:00Z'));

        const createCalls = calls.filter((c) => c.init?.method === 'POST');
        expect(createCalls).toHaveLength(1);
    });

    it('T-04: ウィンドウ外（71分前）の行のみなら0件扱いでGitHub Issue作成は呼ばれない', async () => {
        EnvStore.setEnv(
            { ...MINIMAL_ENV, GITHUB_TOKEN: 'gh-token' } as never,
            [],
        );
        const db = registerInMemoryDrizzleGateway();
        await db.insert(dataQualityWarningLog).values({
            source: 'place_mapper',
            message: 'too old',
            createdAt: '2026-08-04T23:49:00.000Z',
        });
        const { calls } = setFetch(() => Promise.resolve(okJson([])));

        await runDataQualityWarningCheck(new Date('2026-08-05T01:00:00Z'));

        const createCalls = calls.filter((c) => c.init?.method === 'POST');
        expect(createCalls).toHaveLength(0);
    });

    it('T-05: DB(select)が例外を投げてもスローせずcatchされる', async () => {
        EnvStore.setEnv(
            { ...MINIMAL_ENV, GITHUB_TOKEN: 'gh-token' } as never,
            [],
        );
        const failingGateway: IDrizzleGateway = {
            db: {
                select: () => ({
                    from: () => ({
                        where: () => Promise.reject(new Error('DB error')),
                    }),
                }),
            } as unknown as IDrizzleGateway['db'],
        };
        container.register<IDrizzleGateway>(DI_TOKENS.DrizzleGateway, {
            useValue: failingGateway,
        });
        const { calls } = setFetch(() => Promise.resolve(okJson([])));

        await expect(
            runDataQualityWarningCheck(new Date('2026-08-05T01:00:00Z')),
        ).resolves.toBeUndefined();

        const createCalls = calls.filter((c) => c.init?.method === 'POST');
        expect(createCalls).toHaveLength(0);
    });
});
