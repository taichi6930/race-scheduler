/**
 * envStore ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | setEnv | CloudFlareEnv | 環境変数を設定 | Line |
 * | 2  | get env | 設定済み | CloudFlareEnv を返す | Branch |
 * | 7  | setEnv | requiredKeysが必須だが値が空文字 | validateEnv経由でErrorをスロー | Line |
 *
 * ## デシジョンテーブル（requireEnvVar）
 *
 * | # | 条件 | Input | Expected | Coverage |
 * |----|------|-------|----------|----------|
 * | 1  | 正常系 | process.env設定済み（EnvStore未初期化） | その値を返す | Line |
 * | 2  | 異常系 | 未設定 | Errorをスロー | Branch |
 * | 3  | 正常系 | EnvStore初期化済み・対象キー未設定 | process.envにフォールバック | Branch |
 * | 4  | 正常系 | EnvStore初期化済み・対象キー設定済み | EnvStoreの値を返す | Line |
 * | 5  | 異常系 | 未設定 | エラーメッセージ全文を検証 | Line |
 * | 6  | 異常系 | EnvStore初期化済み・対象キーが空文字列 | process.envへフォールバックせずErrorをスロー | Branch |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import {
    type CloudFlareEnv,
    EnvStore,
    requireEnvVar,
} from '@race-schedule/core';

const VALID_PRIVATE_KEY =
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtestKeyForUnitTest\n-----END RSA PRIVATE KEY-----';

/**
 * CloudFlareEnv のモック作成ヘルパー関数
 * テストで使用する最小限のプロパティを提供
 */
const createMockEnv = (overrides?: Partial<CloudFlareEnv>): CloudFlareEnv => ({
    // テストでは DB バインディングは参照されないため空オブジェクトを型に合わせて渡す
    DB: {} as unknown as D1Database,
    JRA_CALENDAR_ID: 'jra-calendar',
    NAR_CALENDAR_ID: 'nar-calendar',
    WORLD_CALENDAR_ID: 'world-calendar',
    KEIRIN_CALENDAR_ID: 'keirin-calendar',
    AUTORACE_CALENDAR_ID: 'autorace-calendar',
    BOATRACE_CALENDAR_ID: 'boatrace-calendar',
    GOOGLE_CLIENT_EMAIL: 'test@example.com',
    GOOGLE_PRIVATE_KEY: VALID_PRIVATE_KEY,
    // テストでは R2 バインディングは参照されないため空オブジェクトを型に合わせて渡す
    R2_BUCKET: {} as unknown as R2Bucket,
    ...overrides,
});

describe('EnvStore', () => {
    beforeEach(() => {
        // 各テストの前に状態をリセット（テスト間での汚染を防止）
        EnvStore.reset();
    });

    describe('setEnv', () => {
        it('環境変数を設定する', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);

            expect(EnvStore.env).toBe(mockEnv);
        });

        it('複数回の setEnv で上書きされる', () => {
            const key1 =
                '-----BEGIN RSA PRIVATE KEY-----\nkey1content\n-----END RSA PRIVATE KEY-----';
            const key2 =
                '-----BEGIN RSA PRIVATE KEY-----\nkey2content\n-----END RSA PRIVATE KEY-----';
            const env1 = createMockEnv({ GOOGLE_PRIVATE_KEY: key1 });
            const env2 = createMockEnv({ GOOGLE_PRIVATE_KEY: key2 });

            EnvStore.setEnv(env1);
            expect(EnvStore.env.GOOGLE_PRIVATE_KEY).toBe(key1);

            EnvStore.setEnv(env2);
            expect(EnvStore.env.GOOGLE_PRIVATE_KEY).toBe(key2);
        });

        it('異なるプロパティを保持する環境変数', () => {
            const privateKey =
                '-----BEGIN RSA PRIVATE KEY-----\nprivate-key-content\n-----END RSA PRIVATE KEY-----';
            const mockEnv = createMockEnv({
                GOOGLE_PRIVATE_KEY: privateKey,
                GOOGLE_CLIENT_EMAIL: 'service@project.iam.gserviceaccount.com',
            });

            EnvStore.setEnv(mockEnv);

            expect(EnvStore.env.GOOGLE_PRIVATE_KEY).toBe(privateKey);
            expect(EnvStore.env.GOOGLE_CLIENT_EMAIL).toBe(
                'service@project.iam.gserviceaccount.com',
            );
            expect(EnvStore.env.JRA_CALENDAR_ID).toBe('jra-calendar');
        });

        it('#7: requiredKeysに指定したキーが空文字の場合validateEnv経由でErrorをスローする', () => {
            const mockEnv = createMockEnv({ JRA_CALENDAR_ID: '' });

            expect(() => EnvStore.setEnv(mockEnv, ['JRA_CALENDAR_ID'])).toThrow(
                Error,
            );
        });

        it('setEnv は何度でも呼び出し可能', () => {
            const keyA =
                '-----BEGIN RSA PRIVATE KEY-----\nkeyA\n-----END RSA PRIVATE KEY-----';
            const keyB =
                '-----BEGIN RSA PRIVATE KEY-----\nkeyB\n-----END RSA PRIVATE KEY-----';
            const keyC =
                '-----BEGIN RSA PRIVATE KEY-----\nkeyC\n-----END RSA PRIVATE KEY-----';
            const env1 = createMockEnv({ GOOGLE_PRIVATE_KEY: keyA });
            const env2 = createMockEnv({ GOOGLE_PRIVATE_KEY: keyB });
            const env3 = createMockEnv({ GOOGLE_PRIVATE_KEY: keyC });

            EnvStore.setEnv(env1);
            EnvStore.setEnv(env2);
            EnvStore.setEnv(env3);

            expect(EnvStore.env.GOOGLE_PRIVATE_KEY).toBe(keyC);
        });
    });

    describe('get env', () => {
        it('設定済みの環境変数を返す', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);

            expect(EnvStore.env).toEqual(mockEnv);
        });

        it('env getter は TypeError をスロー（未設定の場合）', () => {
            // Note: beforeEach で reset() が呼ばれているため、env は未設定状態

            expect(() => {
                // eslint-disable-next-line no-unused-expressions
                EnvStore.env;
            }).toThrow(TypeError);

            expect(() => {
                EnvStore.env;
            }).toThrow('EnvStore.env is not set');
        });

        it('環境変数のプロパティにアクセス可能', () => {
            const mockEnv = createMockEnv({
                GOOGLE_PRIVATE_KEY: VALID_PRIVATE_KEY,
            });

            EnvStore.setEnv(mockEnv);

            expect(EnvStore.env.GOOGLE_PRIVATE_KEY).toBe(VALID_PRIVATE_KEY);
            expect(EnvStore.env.GOOGLE_CLIENT_EMAIL).toBe('test@example.com');
            expect(EnvStore.env.JRA_CALENDAR_ID).toBe('jra-calendar');
        });

        it('複数回 env にアクセスしても同じオブジェクト', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);

            const env1 = EnvStore.env;
            const env2 = EnvStore.env;
            const env3 = EnvStore.env;

            expect(env1).toBe(env2);
            expect(env2).toBe(env3);
        });

        it('env は CloudFlareEnv 型を満たす', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);

            const env = EnvStore.env;

            expect('GOOGLE_PRIVATE_KEY' in env).toBe(true);
            expect('GOOGLE_CLIENT_EMAIL' in env).toBe(true);
            expect('JRA_CALENDAR_ID' in env).toBe(true);
        });

        it('env getter は常に現在の値を返す', () => {
            const key1 =
                '-----BEGIN RSA PRIVATE KEY-----\nvalue1\n-----END RSA PRIVATE KEY-----';
            const key2 =
                '-----BEGIN RSA PRIVATE KEY-----\nvalue2\n-----END RSA PRIVATE KEY-----';
            const env1 = createMockEnv({ GOOGLE_PRIVATE_KEY: key1 });

            EnvStore.setEnv(env1);
            const retrieved1 = EnvStore.env;

            const env2 = createMockEnv({ GOOGLE_PRIVATE_KEY: key2 });

            EnvStore.setEnv(env2);
            const retrieved2 = EnvStore.env;

            expect(retrieved1.GOOGLE_PRIVATE_KEY).toBe(key1);
            expect(retrieved2.GOOGLE_PRIVATE_KEY).toBe(key2);
            expect(retrieved1).not.toBe(retrieved2);
        });
    });

    describe('シングルトンパターン', () => {
        it('EnvStore は同じオブジェクト参照を持つ', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);

            expect(EnvStore.env).toBe(EnvStore.env);
        });

        it('setEnv と env の連携', () => {
            const firstKey =
                '-----BEGIN RSA PRIVATE KEY-----\nfirst-key\n-----END RSA PRIVATE KEY-----';
            const secondKey =
                '-----BEGIN RSA PRIVATE KEY-----\nsecond-key\n-----END RSA PRIVATE KEY-----';
            const env1 = createMockEnv({ GOOGLE_PRIVATE_KEY: firstKey });

            EnvStore.setEnv(env1);
            expect(EnvStore.env.GOOGLE_PRIVATE_KEY).toBe(firstKey);

            const env2 = createMockEnv({ GOOGLE_PRIVATE_KEY: secondKey });

            EnvStore.setEnv(env2);
            expect(EnvStore.env.GOOGLE_PRIVATE_KEY).toBe(secondKey);
        });
    });

    describe('環境変数の値の種類', () => {
        it('文字列型の値を保持', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);

            expect(typeof EnvStore.env.GOOGLE_PRIVATE_KEY).toBe('string');
            expect(typeof EnvStore.env.GOOGLE_CLIENT_EMAIL).toBe('string');
            expect(typeof EnvStore.env.JRA_CALENDAR_ID).toBe('string');
        });

        it('複数の環境変数プロパティ', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);

            // createMockEnv() は固定10プロパティ（DB, R2_BUCKET含む）を持つファクトリのため厳密件数で検証する
            expect(Object.keys(EnvStore.env)).toHaveLength(10);
        });

        it('env にはすべての必須プロパティが含まれる', () => {
            const mockEnv = createMockEnv();

            EnvStore.setEnv(mockEnv);
            const env = EnvStore.env;

            expect(env.GOOGLE_PRIVATE_KEY).toBeDefined();
            expect(env.GOOGLE_CLIENT_EMAIL).toBeDefined();
            expect(env.JRA_CALENDAR_ID).toBeDefined();
        });
    });
});

describe('requireEnvVar', () => {
    const originalEnv = process.env.MAIN_API_URL;

    beforeEach(() => {
        delete process.env.MAIN_API_URL;
        EnvStore.reset();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.MAIN_API_URL;
        } else {
            process.env.MAIN_API_URL = originalEnv;
        }
        EnvStore.reset();
    });

    it('#1: EnvStore未初期化でprocess.envに設定済みの場合その値を返す', () => {
        process.env.MAIN_API_URL = 'https://example.com';

        expect(requireEnvVar('MAIN_API_URL')).toBe('https://example.com');
    });

    it('#2: 未設定の場合Errorをスローする', () => {
        expect(() => requireEnvVar('MAIN_API_URL')).toThrow(/MAIN_API_URL/);
    });

    it('#3: EnvStore初期化済みで対象キー未設定の場合process.envにフォールバックする', () => {
        process.env.MAIN_API_URL = 'https://fallback.example.com';
        EnvStore.setEnv(createMockEnv());

        expect(requireEnvVar('MAIN_API_URL')).toBe(
            'https://fallback.example.com',
        );
    });

    it('#4: EnvStore初期化済みで対象キー設定済みの場合EnvStoreの値を返す', () => {
        EnvStore.setEnv(
            createMockEnv({ MAIN_API_URL: 'https://store.example.com' }),
        );

        expect(requireEnvVar('MAIN_API_URL')).toBe('https://store.example.com');
    });

    it('#5: 未設定の場合のエラーメッセージ全文を検証する', () => {
        expect(() => requireEnvVar('MAIN_API_URL')).toThrow(
            'MAIN_API_URL environment variable is required. ' +
                'Set it in your .env file or via environment variables.',
        );
    });

    it('#6: EnvStore初期化済みで対象キーが空文字列の場合process.envへフォールバックせずErrorをスローする', () => {
        process.env.MAIN_API_URL = 'https://fallback.example.com';
        EnvStore.setEnv(createMockEnv({ MAIN_API_URL: '' }));

        expect(() => requireEnvVar('MAIN_API_URL')).toThrow(
            'MAIN_API_URL environment variable is required. ' +
                'Set it in your .env file or via environment variables.',
        );
    });
});
