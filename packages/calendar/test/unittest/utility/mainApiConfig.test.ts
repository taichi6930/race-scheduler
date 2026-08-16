/**
 * mainApiConfig ユーティリティ テスト
 *
 * ## デシジョンテーブル（getMainApiUrl）
 *
 * | #    | 条件   | Input                                                  | Expected                     | Coverage |
 * |------|--------|---------------------------------------------------------|-------------------------------|----------|
 * | T-01 | 正常系 | process.env.MAIN_API_URL 設定済み（EnvStore未初期化） | その値を返す                  | Line     |
 * | T-02 | 異常系 | 未設定                                                 | Errorをスロー                 | Branch   |
 * | T-03 | 正常系 | EnvStore初期化済み・MAIN_API_URL未設定                | process.envにフォールバック   | Branch   |
 * | T-04 | 正常系 | EnvStore初期化済み・MAIN_API_URL設定済み               | EnvStoreの値を返す            | Line     |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { type CloudFlareEnv, EnvStore } from '@race-schedule/core';

import { getMainApiUrl } from '../../../src/utility/mainApiConfig';

const createMockEnv = (overrides?: Partial<CloudFlareEnv>): CloudFlareEnv => ({
    DB: {} as unknown as D1Database,
    JRA_CALENDAR_ID: 'jra-calendar',
    NAR_CALENDAR_ID: 'nar-calendar',
    KEIRIN_CALENDAR_ID: 'keirin-calendar',
    AUTORACE_CALENDAR_ID: 'autorace-calendar',
    BOATRACE_CALENDAR_ID: 'boatrace-calendar',
    GOOGLE_CLIENT_EMAIL: 'test@example.com',
    GOOGLE_PRIVATE_KEY: 'test-key',
    R2_BUCKET: {} as unknown as R2Bucket,
    ...overrides,
});

describe('getMainApiUrl', () => {
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

    it('[T-01] EnvStore未初期化でprocess.env.MAIN_API_URLが設定されている場合その値を返す', () => {
        process.env.MAIN_API_URL = 'https://example.com';

        expect(getMainApiUrl()).toBe('https://example.com');
    });

    it('[T-02] 未設定の場合Errorをスローする', () => {
        expect(() => getMainApiUrl()).toThrow(/MAIN_API_URL/);
    });

    it('[T-03] EnvStore初期化済みでMAIN_API_URL未設定の場合process.envにフォールバックする', () => {
        process.env.MAIN_API_URL = 'https://fallback.example.com';
        EnvStore.setEnv(createMockEnv());

        expect(getMainApiUrl()).toBe('https://fallback.example.com');
    });

    it('[T-04] EnvStore初期化済みでMAIN_API_URL設定済みの場合その値を返す', () => {
        EnvStore.setEnv(
            createMockEnv({ MAIN_API_URL: 'https://store.example.com' }),
        );

        expect(getMainApiUrl()).toBe('https://store.example.com');
    });
});
