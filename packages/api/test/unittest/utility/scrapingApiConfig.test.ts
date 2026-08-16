/**
 * scrapingApiConfig ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件 | Input | Expected | Coverage |
 * |----|------|-------|----------|----------|
 * | 1  | 正常系 | process.env.SCRAPING_API_URL 設定済み（EnvStore未初期化） | その値を返す | Line |
 * | 2  | 異常系 | 未設定 | Errorをスロー | Branch |
 * | 3  | 正常系 | EnvStore初期化済み・SCRAPING_API_URL未設定 | process.envにフォールバック | Branch |
 * | 4  | 正常系 | EnvStore初期化済み・SCRAPING_API_URL設定済み | EnvStoreの値を返す | Line |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { type CloudFlareEnv, EnvStore } from '@race-schedule/core';

import { getScrapingApiUrl } from '../../../src/utility/scrapingApiConfig';

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

describe('getScrapingApiUrl', () => {
    const originalEnv = process.env.SCRAPING_API_URL;

    beforeEach(() => {
        delete process.env.SCRAPING_API_URL;
        EnvStore.reset();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.SCRAPING_API_URL;
        } else {
            process.env.SCRAPING_API_URL = originalEnv;
        }
        EnvStore.reset();
    });

    it('#1: EnvStore未初期化でprocess.env.SCRAPING_API_URLが設定されている場合その値を返す', () => {
        process.env.SCRAPING_API_URL = 'https://scraping.example.com';

        expect(getScrapingApiUrl()).toBe('https://scraping.example.com');
    });

    it('#2: 未設定の場合Errorをスローする', () => {
        expect(() => getScrapingApiUrl()).toThrow(/SCRAPING_API_URL/);
    });

    it('#3: EnvStore初期化済みでSCRAPING_API_URL未設定の場合process.envにフォールバックする', () => {
        process.env.SCRAPING_API_URL = 'https://fallback.example.com';
        EnvStore.setEnv(createMockEnv());

        expect(getScrapingApiUrl()).toBe('https://fallback.example.com');
    });

    it('#4: EnvStore初期化済みでSCRAPING_API_URL設定済みの場合その値を返す', () => {
        EnvStore.setEnv(
            createMockEnv({ SCRAPING_API_URL: 'https://store.example.com' }),
        );

        expect(getScrapingApiUrl()).toBe('https://store.example.com');
    });
});
