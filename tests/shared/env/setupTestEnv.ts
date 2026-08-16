/**
 * テスト共通: 環境セットアップヘルパー
 *
 * コンポーネントテスト で利用する InMemoryDB 切替用ヘルパー。
 * パッケージ固有の DI コンテナ初期化は各パッケージの test/common/setupGlobalMocks 等を利用してください。
 *
 * 利用例:
 *   import { useInMemoryDB } from '../../tests/shared/env/setupTestEnv';
 *   beforeAll(() => useInMemoryDB());
 */

const ENV_KEYS_TO_SET_FOR_INMEMORY = {
    USE_IN_MEMORY_DB: 'true',
    NODE_ENV: 'test',
} as const;

const originalEnv: Record<string, string | undefined> = {};

/**
 * テスト中だけ InMemoryDB を使用するように環境変数をセットし、
 * 復元用関数を返す。
 */
export const useInMemoryDB = (): (() => void) => {
    for (const key of Object.keys(ENV_KEYS_TO_SET_FOR_INMEMORY)) {
        originalEnv[key] = process.env[key];
    }
    for (const [key, value] of Object.entries(ENV_KEYS_TO_SET_FOR_INMEMORY)) {
        process.env[key] = value;
    }
    return () => {
        for (const key of Object.keys(ENV_KEYS_TO_SET_FOR_INMEMORY)) {
            if (originalEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = originalEnv[key];
            }
        }
    };
};
