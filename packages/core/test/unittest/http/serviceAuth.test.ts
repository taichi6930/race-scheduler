/**
 * serviceAuth のデシジョンテーブル（SECAUTH-02）
 *
 * @spec SPEC-API-001
 *
 * ## verifyServiceAuthToken
 *
 * | #    | presented         | expected  | previous  | 期待                        |
 * | ---- | ------------------ | --------- | --------- | --------------------------- |
 * | T-01 | null                | 設定あり  | なし      | false                        |
 * | T-02 | 空文字              | 設定あり  | なし      | false                        |
 * | T-03 | 一致                | 設定あり  | なし      | true                         |
 * | T-04 | 不一致              | 設定あり  | なし      | false                        |
 * | T-05 | 何か                | undefined | なし      | false（フェイルクローズ）    |
 * | T-06 | previous と一致     | 設定あり  | 設定あり  | true（ローテーション中）     |
 * | T-07 | どちらとも不一致    | 設定あり  | 設定あり  | false                        |
 * | T-08 | 何か                | undefined | 設定あり  | previous と一致すれば true   |
 *
 * ## isExempt
 *
 * | #    | method/path                  | exemptRoutes                                   | 期待  |
 * | ---- | ----------------------------- | ----------------------------------------------- | ----- |
 * | T-09 | GET /health                   | [{GET,/health}]                                 | true  |
 * | T-10 | POST /health                  | [{GET,/health}]                                 | false |
 * | T-11 | GET /other                    | [{GET,/health}]                                 | false |
 * | T-12 | OPTIONS /anything              | [{OPTIONS,*}]                                    | true  |
 *
 * ## readServiceAuthToken
 *
 * | #    | 状態                                  | 期待                              |
 * | ---- | -------------------------------------- | ---------------------------------- |
 * | T-13 | EnvStore設定済み・値あり               | EnvStoreの値を返す                 |
 * | T-14 | EnvStore未初期化・process.envに値あり  | process.envの値にフォールバック    |
 * | T-15 | どちらにも無い                         | undefined                          |
 *
 * ## withServiceAuthHeader
 *
 * | #    | トークン | 元のheaders            | 期待                                          |
 * | ---- | -------- | ------------------------ | --------------------------------------------- |
 * | T-16 | あり      | { 'Content-Type': 'x' }  | ヘッダにX-Service-Auth-Tokenが追加される       |
 * | T-17 | 無し      | { 'Content-Type': 'x' }  | 元のheadersのまま（追加なし・警告ログ）        |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { type CloudFlareEnv, EnvStore } from '@race-schedule/core';

import {
    isExempt,
    readServiceAuthToken,
    SERVICE_AUTH_HEADER,
    type ServiceAuthExemptRoute,
    verifyServiceAuthToken,
    withServiceAuthHeader,
} from '../../../src/http/serviceAuth';

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

describe('verifyServiceAuthToken', () => {
    it('[T-01] presented=null_falseを返す', async () => {
        const result = await verifyServiceAuthToken(null, 'expected');

        expect(result).toBe(false);
    });

    it('[T-02] presented=空文字_falseを返す', async () => {
        const result = await verifyServiceAuthToken('', 'expected');

        expect(result).toBe(false);
    });

    it('[T-03] presentedがexpectedと一致_trueを返す', async () => {
        const result = await verifyServiceAuthToken('token-a', 'token-a');

        expect(result).toBe(true);
    });

    it('[T-04] presentedがexpectedと不一致_falseを返す', async () => {
        const result = await verifyServiceAuthToken('token-a', 'token-b');

        expect(result).toBe(false);
    });

    it('[T-05] expectedが未設定_フェイルクローズでfalseを返す', async () => {
        const result = await verifyServiceAuthToken('anything', undefined);

        expect(result).toBe(false);
    });

    it('[T-06] presentedがpreviousと一致_ローテーション中はtrueを返す', async () => {
        const result = await verifyServiceAuthToken(
            'old-token',
            'new-token',
            'old-token',
        );

        expect(result).toBe(true);
    });

    it('[T-07] presentedがcurrent/previousどちらとも不一致_falseを返す', async () => {
        const result = await verifyServiceAuthToken(
            'unknown-token',
            'new-token',
            'old-token',
        );

        expect(result).toBe(false);
    });

    it('[T-08] expectedが未設定でpreviousと一致_trueを返す', async () => {
        const result = await verifyServiceAuthToken(
            'old-token',
            undefined,
            'old-token',
        );

        expect(result).toBe(true);
    });
});

describe('isExempt', () => {
    const exemptHealthOnly: ServiceAuthExemptRoute[] = [
        { method: 'GET', path: '/health', reason: 'monitoring' },
    ];
    const exemptOptionsWildcard: ServiceAuthExemptRoute[] = [
        { method: 'OPTIONS', path: '*', reason: 'cors-preflight' },
    ];

    it('[T-09] method/pathが完全一致_trueを返す', () => {
        const result = isExempt('GET', '/health', exemptHealthOnly);

        expect(result).toBe(true);
    });

    it('[T-10] methodのみ異なる_falseを返す', () => {
        const result = isExempt('POST', '/health', exemptHealthOnly);

        expect(result).toBe(false);
    });

    it('[T-11] pathのみ異なる_falseを返す', () => {
        const result = isExempt('GET', '/other', exemptHealthOnly);

        expect(result).toBe(false);
    });

    it('[T-12] pathがワイルドカード_任意のpathでtrueを返す', () => {
        const result = isExempt('OPTIONS', '/anything', exemptOptionsWildcard);

        expect(result).toBe(true);
    });
});

describe('readServiceAuthToken', () => {
    const originalToken = process.env.SERVICE_AUTH_TOKEN;

    beforeEach(() => {
        EnvStore.reset();
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.SERVICE_AUTH_TOKEN;
        } else {
            process.env.SERVICE_AUTH_TOKEN = originalToken;
        }
    });

    it('[T-13] EnvStore設定済み_EnvStoreの値を返す', () => {
        EnvStore.setEnv(createMockEnv({ SERVICE_AUTH_TOKEN: 'env-token' }));

        const result = readServiceAuthToken();

        expect(result).toBe('env-token');
    });

    it('[T-14] EnvStore未初期化_process.envにフォールバックする', () => {
        process.env.SERVICE_AUTH_TOKEN = 'process-token';

        const result = readServiceAuthToken();

        expect(result).toBe('process-token');
    });

    it('[T-15] どちらにも無い_undefinedを返す', () => {
        const result = readServiceAuthToken();

        expect(result).toBeUndefined();
    });
});

describe('withServiceAuthHeader', () => {
    const originalToken = process.env.SERVICE_AUTH_TOKEN;

    beforeEach(() => {
        EnvStore.reset();
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.SERVICE_AUTH_TOKEN;
        } else {
            process.env.SERVICE_AUTH_TOKEN = originalToken;
        }
    });

    it('[T-16] トークンあり_ヘッダにSERVICE_AUTH_HEADERが追加される', () => {
        process.env.SERVICE_AUTH_TOKEN = 'process-token';

        const result = withServiceAuthHeader({ 'Content-Type': 'x' });

        expect(result).toEqual({
            'Content-Type': 'x',
            [SERVICE_AUTH_HEADER]: 'process-token',
        });
    });

    it('[T-17] トークン無し_元のheadersのまま追加されない', () => {
        const result = withServiceAuthHeader({ 'Content-Type': 'x' });

        expect(result).toEqual({ 'Content-Type': 'x' });
    });
});
