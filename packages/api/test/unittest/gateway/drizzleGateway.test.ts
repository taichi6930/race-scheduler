/**
 * drizzleGateway.test.ts - DrizzleGateway ユニットテスト
 *
 * @spec なし（PERF-051の検証用）
 *
 * ## デシジョンテーブル
 *
 * | #    | 条件                                                        | 期待値                                          |
 * |------|-------------------------------------------------------------|--------------------------------------------------|
 * | T-01 | 同一の EnvStore.env.DB 参照で `db` を連続取得                | 2回目は再生成されず同一の DrizzleD1Database 参照 |
 * | T-02 | 呼び出しの間で EnvStore.env.DB の参照を変更                  | 変更後は新しい DrizzleD1Database 参照が返る       |
 */

import 'reflect-metadata';

import { afterEach, describe, expect, it } from 'bun:test';
import type {
    D1Database,
    D1PreparedStatement,
} from '@cloudflare/workers-types';
import { EnvStore } from '@race-schedule/core';

import { DrizzleGateway } from '../../../src/gateway/implement/drizzleGateway';

/** テスト用の最小限の D1Database スタブを生成する（呼び出し内容の検証はしない） */
const createStubD1Database = (): D1Database => {
    const mockPreparedStatement: Partial<D1PreparedStatement> = {
        all: () =>
            Promise.resolve({
                success: true,
                results: [],
                meta: {
                    duration: 0,
                    served_by: 'test',
                    internal_stats: '',
                    size_after: 0,
                    rows_read: 0,
                    rows_written: 0,
                    last_row_id: 0,
                    changes: 0,
                    served_by_description: 'test',
                    changed_db: false,
                },
            }),
    };
    const stub: Partial<D1Database> = {
        prepare: () => mockPreparedStatement as D1PreparedStatement,
    };
    return stub as D1Database;
};

const setEnvWithDb = (db: D1Database): void => {
    EnvStore.setEnv({
        DB: db,
        JRA_CALENDAR_ID: 'mock-jra-calendar-id',
        NAR_CALENDAR_ID: 'mock-nar-calendar-id',
        WORLD_CALENDAR_ID: 'mock-world-calendar-id',
        KEIRIN_CALENDAR_ID: 'mock-keirin-calendar-id',
        AUTORACE_CALENDAR_ID: 'mock-autorace-calendar-id',
        BOATRACE_CALENDAR_ID: 'mock-boatrace-calendar-id',
        GOOGLE_CLIENT_EMAIL: 'mock@example.com',
        GOOGLE_PRIVATE_KEY: 'mock-private-key',
        R2_BUCKET: {} as never,
    });
};

describe('DrizzleGateway', () => {
    afterEach(() => {
        EnvStore.reset();
    });

    describe('db（PERF-051: バインディング参照キー付きメモ化）', () => {
        it('[T-01] db_同一DBバインディング参照で連続取得_2回目は同一参照を返す', () => {
            setEnvWithDb(createStubD1Database());
            const gateway = new DrizzleGateway();

            const first = gateway.db;
            const second = gateway.db;

            expect(second).toBe(first);
        });

        it('[T-02] db_呼び出しの間でDBバインディング参照を変更_変更後は新しい参照を返す', () => {
            setEnvWithDb(createStubD1Database());
            const gateway = new DrizzleGateway();
            const before = gateway.db;

            setEnvWithDb(createStubD1Database());
            const after = gateway.db;

            expect(after).not.toBe(before);
        });
    });
});
