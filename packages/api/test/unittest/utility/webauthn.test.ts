/**
 * webauthn.ts のデシジョンテーブル
 *
 * | #    | 関数                       | 入力                                   | 期待                                        |
 * | ---- | -------------------------- | ---------------------------------------- | --------------------------------------------- |
 * | T-01 | resolveWebauthnRpConfig    | WEBAUTHN_RP_ID未設定                     | null                                          |
 * | T-02 | resolveWebauthnRpConfig    | WEBAUTHN_RP_ID設定・RP_NAME未設定         | rpName既定値・originはhttps://<rpId>          |
 * | T-03 | resolveWebauthnRpConfig    | 両方設定                                  | 設定値がそのまま反映される                     |
 * | T-04 | buildRegistrationOptions   | 正常系                                    | rpID/rpName/userDisplayNameが反映される       |
 * | T-05 | buildAuthenticationOptions | 正常系                                    | rpID・allowCredentials未指定が反映される      |
 * | T-06 | verifyRegistration         | 構造的に壊れたcredentialResponse           | 例外を投げずnullを返す                         |
 * | T-07 | verifyAuthentication       | 構造的に壊れたcredentialResponse           | 例外を投げずnullを返す                         |
 */

import { describe, expect, it } from 'bun:test';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { CloudFlareEnv } from '@race-schedule/core';
import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
} from '@simplewebauthn/server';

import {
    buildAuthenticationOptions,
    buildRegistrationOptions,
    resolveWebauthnRpConfig,
    verifyAuthentication,
    verifyRegistration,
    type WebauthnRpConfig,
} from '../../../src/utility/webauthn';

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

describe('resolveWebauthnRpConfig', () => {
    it('[T-01] WEBAUTHN_RP_ID未設定でnullを返す', () => {
        const config = resolveWebauthnRpConfig(createMockEnv());

        expect(config).toBeNull();
    });

    it('[T-02] WEBAUTHN_RP_ID設定・RP_NAME未設定で既定名とhttps originを返す', () => {
        const config = resolveWebauthnRpConfig(
            createMockEnv({ WEBAUTHN_RP_ID: 'front.example.com' }),
        );

        expect(config).toEqual({
            rpId: 'front.example.com',
            rpName: 'race-schedule',
            origin: 'https://front.example.com',
        });
    });

    it('[T-03] 両方設定した値がそのまま反映される', () => {
        const config = resolveWebauthnRpConfig(
            createMockEnv({
                WEBAUTHN_RP_ID: 'front.example.com',
                WEBAUTHN_RP_NAME: 'マイレース',
            }),
        );

        expect(config).toEqual({
            rpId: 'front.example.com',
            rpName: 'マイレース',
            origin: 'https://front.example.com',
        });
    });
});

const TEST_CONFIG: WebauthnRpConfig = {
    rpId: 'front.example.com',
    rpName: 'race-schedule',
    origin: 'https://front.example.com',
};

describe('buildRegistrationOptions', () => {
    it('[T-04] rpID・rpName・userDisplayNameが反映される', async () => {
        const options = await buildRegistrationOptions(
            TEST_CONFIG,
            'user-id-123',
            'たなか',
        );

        expect(options.rp.id).toBe('front.example.com');
        expect(options.rp.name).toBe('race-schedule');
        expect(options.user.displayName).toBe('たなか');
        expect(options.user.name).toBe('たなか');
        expect(options.challenge).toBeTruthy();
    });
});

describe('buildAuthenticationOptions', () => {
    it('[T-05] rpIDが反映されallowCredentialsが空であること', async () => {
        const options = await buildAuthenticationOptions(TEST_CONFIG);

        expect(options.rpId).toBe('front.example.com');
        expect(options.allowCredentials ?? []).toHaveLength(0);
        expect(options.challenge).toBeTruthy();
    });
});

describe('verifyRegistration', () => {
    it('[T-06] 構造的に壊れたレスポンスで例外を投げずnullを返す', async () => {
        const garbage = {
            id: 'not-base64url-!!!',
            rawId: 'not-base64url-!!!',
            type: 'public-key',
            response: {
                clientDataJSON: 'broken',
                attestationObject: 'broken',
            },
            clientExtensionResults: {},
        } as unknown as RegistrationResponseJSON;

        const result = await verifyRegistration(
            TEST_CONFIG,
            garbage,
            'expected-challenge',
        );

        expect(result).toBeNull();
    });
});

describe('verifyAuthentication', () => {
    it('[T-07] 構造的に壊れたレスポンスで例外を投げずnullを返す', async () => {
        const garbage = {
            id: 'not-base64url-!!!',
            rawId: 'not-base64url-!!!',
            type: 'public-key',
            response: {
                clientDataJSON: 'broken',
                authenticatorData: 'broken',
                signature: 'broken',
            },
            clientExtensionResults: {},
        } as unknown as AuthenticationResponseJSON;

        const result = await verifyAuthentication(
            TEST_CONFIG,
            garbage,
            'expected-challenge',
            {
                id: 'cred-id',
                publicKey: new Uint8Array(32) as Uint8Array<ArrayBuffer>,
                signCount: 0,
            },
        );

        expect(result).toBeNull();
    });
});
