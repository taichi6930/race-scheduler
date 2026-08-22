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
 * | T-08 | verifyRegistration         | verified: true（fmt:'none'の正当なレスポンス） | credentialId/publicKey/signCount/aaguidを返す |
 * | T-09 | verifyAuthentication       | verified: true（実ECDSA署名を持つ正当なレスポンス） | 新しいsignCountを返す                  |
 * | T-10 | verifyRegistration         | verified: false（構造は正当だが署名が不一致な`packed`自己署名レスポンス） | 例外を投げずnullを返す |
 * | T-11 | verifyAuthentication       | verified: false（構造は正当だが登録時と異なる公開鍵） | 例外を投げずnullを返す        |
 *
 * T-08・T-09・T-10・T-11は`mock.module`を使わず、`../../common/webauthnTestFixtures`
 * （`@simplewebauthn/server/helpers`で構造的に正しいレスポンスを組み立てる共通
 * フィクスチャ、詳細は同ファイル先頭コメント参照）で本物の検証ロジックを通す。
 */

import { describe, expect, it } from 'bun:test';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { CloudFlareEnv } from '@race-schedule/core';
import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL, isoCBOR, toHash } from '@simplewebauthn/server/helpers';
import {
    buildAuthenticationOptions,
    buildRegistrationOptions,
    resolveWebauthnRpConfig,
    type StoredCredential,
    verifyAuthentication,
    verifyRegistration,
    type WebauthnRpConfig,
} from '../../../src/utility/webauthn';
import {
    buildValidAuthenticationResponse,
    buildValidNoneAttestationResponse,
    derEncodeEcdsaSignature,
    exportRawXY,
    generateP256KeyPair,
} from '../../common/webauthnTestFixtures';

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

describe('verifyRegistration（成功分岐）', () => {
    it('[T-08] 正当なfmt:none登録レスポンスの場合DB保存用の値を返すこと', async () => {
        const credentialId = new Uint8Array([1, 2, 3, 4]);
        const response = await buildValidNoneAttestationResponse(
            TEST_CONFIG.rpId,
            TEST_CONFIG.origin,
            'expected-challenge',
            credentialId,
        );

        const result = await verifyRegistration(
            TEST_CONFIG,
            response,
            'expected-challenge',
        );

        expect(result?.credentialId).toBe(
            isoBase64URL.fromBuffer(credentialId),
        );
        expect(result?.signCount).toBe(0);
        expect(result?.aaguid).toBe('00000000-0000-0000-0000-000000000000');
    });
});

describe('verifyAuthentication（成功分岐）', () => {
    it('[T-09] 実ECDSA署名を持つ正当なレスポンスの場合新しいsignCountを返すこと', async () => {
        const credentialId = new Uint8Array([9, 8, 7, 6]);
        const { response, publicKey } = await buildValidAuthenticationResponse(
            TEST_CONFIG.rpId,
            TEST_CONFIG.origin,
            'expected-challenge',
            credentialId,
        );
        const storedCredential: StoredCredential = {
            id: isoBase64URL.fromBuffer(credentialId),
            publicKey,
            signCount: 0,
        };

        const result = await verifyAuthentication(
            TEST_CONFIG,
            response,
            'expected-challenge',
            storedCredential,
        );

        expect(result).toBe(1);
    });
});

/**
 * fmt:'packed'の自己署名（x5c無し）で、構造は正当だが署名が一致しない登録レスポンスを
 * 組み立てる。`@simplewebauthn/server`のverifyAttestationPackedは自己署名の場合
 * `verifySignature`の結果をそのまま`verified`にするため、署名を別の鍵ペアで
 * 作ることで例外を投げずに`verified: false`を再現できる（T-10専用、1箇所でしか
 * 使わないためwebauthnTestFixtures.tsへは追加せずここに閉じる）。
 * @param rpId - Relying Party ID
 * @param origin - 期待するオリジン
 * @param challenge - options生成時に発行したchallenge
 * @param credentialId - 登録するcredential ID
 */
const buildInvalidSignaturePackedRegistrationResponse = async (
    rpId: string,
    origin: string,
    challenge: string,
    credentialId: Uint8Array<ArrayBuffer>,
): Promise<RegistrationResponseJSON> => {
    const keyPair = await generateP256KeyPair();
    const { x, y } = await exportRawXY(keyPair);
    const cosePublicKey = isoCBOR.encode(
        new Map<number, number | Uint8Array>([
            [1, 2], // kty: EC2
            [3, -7], // alg: ES256
            [-1, 1], // crv: P-256
            [-2, x],
            [-3, y],
        ]),
    );
    const credentialIdLength = new Uint8Array(2);
    new DataView(credentialIdLength.buffer).setUint16(0, credentialId.length);
    const rpIdHash = await toHash(rpId);
    // flags: UP(bit0) + UV(bit2) + AT(bit6) = 0b01000101
    const authenticatorData = new Uint8Array([
        ...rpIdHash,
        0b0100_0101,
        0,
        0,
        0,
        0, // signCount = 0
        ...new Uint8Array(16), // aaguid
        ...credentialIdLength,
        ...credentialId,
        ...cosePublicKey,
    ]);
    const clientDataJSON = new TextEncoder().encode(
        JSON.stringify({ type: 'webauthn.create', challenge, origin }),
    );
    const clientDataHash = new Uint8Array(
        await crypto.subtle.digest('SHA-256', clientDataJSON),
    );
    const signatureBase = new Uint8Array([
        ...authenticatorData,
        ...clientDataHash,
    ]);
    // 署名は登録するcredentialの鍵ペアとは別の鍵ペアで作る
    // → 構造は正当なDER署名だが検証は必ず失敗し、verified: falseになる
    const wrongKeyPair = await generateP256KeyPair();
    const rawSignature = new Uint8Array(
        await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            wrongKeyPair.privateKey,
            signatureBase,
        ),
    );
    const sig = derEncodeEcdsaSignature(rawSignature);
    type PackedAttStmtValue = string | number | Uint8Array;
    const attestationObject = isoCBOR.encode(
        new Map<string, PackedAttStmtValue | Map<string, PackedAttStmtValue>>([
            ['fmt', 'packed'],
            [
                'attStmt',
                new Map<string, PackedAttStmtValue>([
                    ['sig', sig],
                    ['alg', -7],
                ]),
            ],
            ['authData', authenticatorData],
        ]),
    );

    return {
        id: isoBase64URL.fromBuffer(credentialId),
        rawId: isoBase64URL.fromBuffer(credentialId),
        type: 'public-key',
        response: {
            clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
            attestationObject: isoBase64URL.fromBuffer(attestationObject),
        },
        clientExtensionResults: {},
    };
};

describe('verifyRegistration（verified:false分岐）', () => {
    it('[T-10] 構造は正当だが署名が不一致な場合は例外を投げずnullを返す', async () => {
        const credentialId = new Uint8Array([1, 2, 3, 4]);
        const response = await buildInvalidSignaturePackedRegistrationResponse(
            TEST_CONFIG.rpId,
            TEST_CONFIG.origin,
            'expected-challenge',
            credentialId,
        );

        const result = await verifyRegistration(
            TEST_CONFIG,
            response,
            'expected-challenge',
        );

        expect(result).toBeNull();
    });
});

describe('verifyAuthentication（verified:false分岐）', () => {
    it('[T-11] 構造は正当だが登録時と異なる公開鍵の場合は例外を投げずnullを返す', async () => {
        const credentialId = new Uint8Array([9, 8, 7, 6]);
        const { response } = await buildValidAuthenticationResponse(
            TEST_CONFIG.rpId,
            TEST_CONFIG.origin,
            'expected-challenge',
            credentialId,
        );
        // storedCredentialの公開鍵は、署名した鍵ペアとは別の鍵ペアのものにする
        // → 構造は正当だが署名検証は必ず失敗し、verified: falseになる
        const wrongKeyPair = await generateP256KeyPair();
        const { x, y } = await exportRawXY(wrongKeyPair);
        const wrongPublicKey = isoCBOR.encode(
            new Map<number, number | Uint8Array>([
                [1, 2],
                [3, -7],
                [-1, 1],
                [-2, x],
                [-3, y],
            ]),
        ) as Uint8Array<ArrayBuffer>;
        const storedCredential: StoredCredential = {
            id: isoBase64URL.fromBuffer(credentialId),
            publicKey: wrongPublicKey,
            signCount: 0,
        };

        const result = await verifyAuthentication(
            TEST_CONFIG,
            response,
            'expected-challenge',
            storedCredential,
        );

        expect(result).toBeNull();
    });
});
