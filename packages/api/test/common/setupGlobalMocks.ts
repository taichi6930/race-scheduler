import 'reflect-metadata';

import type {
    D1Database,
    D1PreparedStatement,
    R2Bucket,
} from '@cloudflare/workers-types';
import { EnvStore } from '@race-schedule/core';
import { container } from 'tsyringe';

import { initializeDIForInMemory } from '../../src/di';
import { MOCK_PUSH_DISPATCH_TOKEN } from './mockHonoEnv';

/**
 * @param db - EnvStore.env.DB へ設定する D1Database。省略時は常に空結果を返すダミー実装。
 *   Drizzle 化した repository を対象にしたコンポーネントテストでは、実データを扱えるよう
 *   createInMemoryD1Database()（test/common/inMemoryD1.ts）を渡す。
 */
export const setupGlobalMocks = (db?: D1Database): void => {
    // Setup mock environment variables
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
    const mockDB: Partial<D1Database> = {
        prepare: () => mockPreparedStatement as D1PreparedStatement,
    };
    const mockR2Bucket: Partial<R2Bucket> = {};
    EnvStore.setEnv({
        DB: db ?? (mockDB as D1Database),
        JRA_CALENDAR_ID: 'mock-jra-calendar-id',
        NAR_CALENDAR_ID: 'mock-nar-calendar-id',
        WORLD_CALENDAR_ID: 'mock-world-calendar-id',
        KEIRIN_CALENDAR_ID: 'mock-keirin-calendar-id',
        AUTORACE_CALENDAR_ID: 'mock-autorace-calendar-id',
        BOATRACE_CALENDAR_ID: 'mock-boatrace-calendar-id',
        GOOGLE_CLIENT_EMAIL: 'mock@example.com',
        GOOGLE_PRIVATE_KEY:
            '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtestKeyForUnitTest\n-----END RSA PRIVATE KEY-----',
        R2_BUCKET: mockR2Bucket as R2Bucket,
        // router.ts の ensureDIInitialized は一度DI初期化されると以降は
        // EnvStore.setEnv を呼ばない（本番Workerが同一isolateで複数リクエストを
        // 扱う際にenvが不変であることを前提にしたガード）。テストプロセス内では
        // このsetupGlobalMocks（beforeEachで直接EnvStore.setEnvを呼ぶ）が
        // 実質的に「最後に効くEnvStore設定」になるため、PUSH_DISPATCH_TOKEN等
        // EnvStore.env経由で読まれるフィールドはここにも含める必要がある
        // （c.env経由で読むSERVICE_AUTH_TOKEN等はリクエスト毎に正しく反映されるため対象外）。
        PUSH_DISPATCH_TOKEN: MOCK_PUSH_DISPATCH_TOKEN,
    });

    // テスト環境ではInMemoryDBを使用
    process.env.USE_IN_MEMORY_DB = 'true';

    // DIコンテナをクリアして再初期化（テスト用InMemoryDB構成）
    container.clearInstances();
    initializeDIForInMemory();
};
