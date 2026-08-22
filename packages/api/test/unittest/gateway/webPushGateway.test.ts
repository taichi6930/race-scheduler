/**
 * webPushGateway.test.ts - WebPushGateway ユニットテスト
 *
 * ## デシジョンテーブル（send）
 *
 * | # | 条件                                    | 期待値                                  |
 * |---|------------------------------------------|------------------------------------------|
 * | S1 | VAPID環境変数が未設定                    | `{ ok: false, gone: false }`（例外を捕捉） |
 * | S2 | Push Service が 200 を返す                | `{ ok: true }`                           |
 * | S3 | Push Service が 404 を返す                | `{ ok: false, gone: true }`              |
 * | S4 | Push Service が 410 を返す                | `{ ok: false, gone: true }`              |
 * | S5 | Push Service が 500 を返す                | `{ ok: false, gone: false }`             |
 * | S6 | fetch が例外を投げる（ネットワークエラー）| `{ ok: false, gone: false }`             |
 * | S7 | 正常系のリクエスト形状                    | method=POST・Authorization/Content-Encoding/Content-Type/TTLヘッダー・endpoint宛 |
 *
 * ## デシジョンテーブル（VAPID JWT）
 *
 * | # | 検証項目                          | 期待値                                    |
 * |---|-------------------------------------|--------------------------------------------|
 * | J1 | Authorization ヘッダーの形式        | `vapid t=<jwt>, k=<publicKey>`             |
 * | J2 | JWT の header/claim                 | alg=ES256, typ=JWT, aud=endpoint origin, sub=VAPID_SUBJECT, exp=now+12時間（TTL値そのもの） |
 * | J3 | JWT の署名                          | VAPID公開鍵で検証（crypto.subtle.verify）が true、Base64URLパディング文字'='を含まない |
 * | J4 | VAPID秘密鍵のCryptoKeyインポート     | extractable引数がfalse（秘密鍵をexportKeyできない） |
 *
 * ## デシジョンテーブル（RFC 8291 暗号化）
 *
 * | # | 条件                                                    | 期待値                                   |
 * |---|-----------------------------------------------------------|--------------------------------------------|
 * | E1 | RFC 8291 Appendix A の既知ベクタをこのテストの復号ロジックで復号 | 既知の平文 "When I grow up, ..." と一致 |
 * | E2 | 本番 `send()` が生成した暗号文をラウンドトリップ復号        | 送信したペイロード（JSON）と一致          |
 *
 * ## デシジョンテーブル（PERF-104: VAPID秘密鍵インポートのメモ化）
 *
 * | # | 条件                                              | 期待値                                   |
 * |---|-----------------------------------------------------|--------------------------------------------|
 * | C1 | 同一dispatchCacheで2回send                         | VAPID鍵のimportKeyは1回のみ呼ばれる       |
 * | C2 | dispatchCache省略で2回send                         | VAPID鍵のimportKeyは呼び出しごとに毎回呼ばれる（従来どおり） |
 * | C3 | 同一dispatchCacheで公開鍵が変わる                    | 変化を検知し再インポートする（2回）       |
 * | C4 | 同一dispatchCacheで公開鍵は同じ・秘密鍵だけ変わる    | 変化を検知し再インポートする（2回）       |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { CloudFlareEnv } from '@race-schedule/core';
import { EnvStore } from '@race-schedule/core';
import 'reflect-metadata';

import { WebPushGateway } from '../../../src/gateway/implement/webPushGateway';
import type { WebPushSubscriptionKeys } from '../../../src/gateway/interface/IWebPushGateway';

// --- テスト用 Base64URL ヘルパー（本番実装とは独立に用意する） ---

function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
    return bytes.toBase64({ alphabet: 'base64url', omitPadding: true });
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.fromBase64(value, { alphabet: 'base64url' });
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// --- RFC 8291 受信側（復号）の再実装。production の暗号化と対で正しさを検証する ---

const WEB_PUSH_INFO_PREFIX = new TextEncoder().encode('WebPush: info\u{0}');
const CEK_INFO = new TextEncoder().encode('Content-Encoding: aes128gcm\u{0}');
const NONCE_INFO = new TextEncoder().encode('Content-Encoding: nonce\u{0}');

function concatBytes(
    ...parts: Uint8Array<ArrayBuffer>[]
): Uint8Array<ArrayBuffer> {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

/** aes128gcm ペイロード（送信ボディ）を、受信側の秘密鍵・公開鍵・auth secretで復号する */
async function decryptAes128Gcm(
    receiverPrivateKey: CryptoKey,
    receiverPublicKeyRaw: Uint8Array<ArrayBuffer>,
    authSecret: Uint8Array<ArrayBuffer>,
    payload: Uint8Array<ArrayBuffer>,
): Promise<string> {
    const salt = payload.slice(0, 16);
    const idLen = payload[20];
    const asPublicKeyRaw = payload.slice(21, 21 + idLen);
    const ciphertext = payload.slice(21 + idLen);

    const asPublicKey = await crypto.subtle.importKey(
        'raw',
        asPublicKeyRaw,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
    );
    const ecdhSecret = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: asPublicKey },
            receiverPrivateKey,
            256,
        ),
    );

    const ecdhSecretKey = await crypto.subtle.importKey(
        'raw',
        ecdhSecret,
        'HKDF',
        false,
        ['deriveBits'],
    );
    const keyInfo = concatBytes(
        WEB_PUSH_INFO_PREFIX,
        receiverPublicKeyRaw,
        asPublicKeyRaw,
    );
    const ikm = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo },
            ecdhSecretKey,
            256,
        ),
    );

    const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
        'deriveBits',
    ]);
    const cek = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info: CEK_INFO },
            ikmKey,
            128,
        ),
    );
    const nonce = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info: NONCE_INFO },
            ikmKey,
            96,
        ),
    );

    const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, [
        'decrypt',
    ]);
    const decrypted = new Uint8Array(
        await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonce },
            cekKey,
            ciphertext,
        ),
    );
    // 最終レコードの区切りバイト（0x02）を取り除く（パディング無し前提）
    return new TextDecoder().decode(decrypted.slice(0, -1));
}

// --- テスト用フィクスチャ生成 ---

interface SubscriberFixture {
    subscription: WebPushSubscriptionKeys;
    privateKey: CryptoKey;
    publicKeyRaw: Uint8Array<ArrayBuffer>;
    authSecretRaw: Uint8Array<ArrayBuffer>;
}

async function generateSubscriberFixture(
    endpoint: string,
): Promise<SubscriberFixture> {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
    );
    const publicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', keyPair.publicKey),
    );
    const authSecretRaw = crypto.getRandomValues(new Uint8Array(16));

    return {
        subscription: {
            endpoint,
            p256dh: toBase64Url(publicKeyRaw),
            auth: toBase64Url(authSecretRaw),
        },
        privateKey: keyPair.privateKey,
        publicKeyRaw,
        authSecretRaw,
    };
}

async function generateVapidFixture(): Promise<{
    publicKeyBase64Url: string;
    privateKeyD: string;
    verifyKey: CryptoKey;
}> {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
    );
    const publicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', keyPair.publicKey),
    );
    const privateJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey,
    )) as JsonWebKey;
    if (!privateJwk.d) {
        throw new Error('failed to export VAPID private key');
    }

    return {
        publicKeyBase64Url: toBase64Url(publicKeyRaw),
        privateKeyD: privateJwk.d,
        verifyKey: keyPair.publicKey,
    };
}

interface FetchCallRecord {
    url: string;
    init: RequestInit;
}

const MOCK_ENV_BASE = {
    DB: {},
    JRA_CALENDAR_ID: 'mock-jra',
    NAR_CALENDAR_ID: 'mock-nar',
    WORLD_CALENDAR_ID: 'mock-world',
    KEIRIN_CALENDAR_ID: 'mock-keirin',
    AUTORACE_CALENDAR_ID: 'mock-autorace',
    BOATRACE_CALENDAR_ID: 'mock-boatrace',
    GOOGLE_CLIENT_EMAIL: 'mock@example.com',
    GOOGLE_PRIVATE_KEY: 'mock-private-key',
    R2_BUCKET: {},
};

describe('WebPushGateway', () => {
    let gateway: WebPushGateway;
    let originalFetch: typeof globalThis.fetch;
    let fetchCalls: FetchCallRecord[];

    beforeEach(() => {
        gateway = new WebPushGateway();
        fetchCalls = [];
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        EnvStore.reset();
    });

    const mockFetchWithStatus = (status: number, ok: boolean): void => {
        globalThis.fetch = (async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            fetchCalls.push({ url: input.toString(), init: init ?? {} });
            return {
                ok,
                status,
                text: async () => 'push service error body',
            } as unknown as Response;
        }) as unknown as typeof globalThis.fetch;
    };

    describe('send', () => {
        it('S1: VAPID環境変数が未設定の場合はok:false,gone:falseを返すこと', async () => {
            EnvStore.setEnv({ ...MOCK_ENV_BASE } as unknown as CloudFlareEnv);
            const fixture = await generateSubscriberFixture(
                'https://push.example.com/subscription/1',
            );

            const result = await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            expect(result).toEqual({
                ok: false,
                gone: false,
                message: expect.stringContaining('VAPID_PUBLIC_KEY'),
            });
        });

        it('S2: Push Serviceが200を返す場合はok:trueを返すこと', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixture = await generateSubscriberFixture(
                'https://push.example.com/subscription/2',
            );
            mockFetchWithStatus(201, true);

            const result = await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            expect(result).toEqual({ ok: true });
        });

        it('S3: Push Serviceが404を返す場合はgone:trueを返すこと', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixture = await generateSubscriberFixture(
                'https://push.example.com/subscription/3',
            );
            mockFetchWithStatus(404, false);

            const result = await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            expect(result).toEqual({
                ok: false,
                gone: true,
                message: expect.stringContaining('404'),
            });
        });

        it('S4: Push Serviceが410を返す場合はgone:trueを返すこと', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixture = await generateSubscriberFixture(
                'https://push.example.com/subscription/4',
            );
            mockFetchWithStatus(410, false);

            const result = await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            expect(result).toEqual({
                ok: false,
                gone: true,
                message: expect.stringContaining('410'),
            });
        });

        it('S5: Push Serviceが500を返す場合はgone:falseを返すこと', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixture = await generateSubscriberFixture(
                'https://push.example.com/subscription/5',
            );
            mockFetchWithStatus(500, false);

            const result = await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            expect(result).toEqual({
                ok: false,
                gone: false,
                message: expect.stringContaining('500'),
            });
        });

        it('S6: fetchが例外を投げる場合はok:false,gone:falseを返すこと', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixture = await generateSubscriberFixture(
                'https://push.example.com/subscription/6',
            );
            globalThis.fetch = (async () => {
                throw new Error('network error');
            }) as unknown as typeof globalThis.fetch;

            const result = await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            expect(result).toEqual({
                ok: false,
                gone: false,
                message: 'network error',
            });
        });

        it('S7/J1/J2/J3: リクエスト形状とVAPID JWTが正しいこと', async () => {
            const vapid = await generateVapidFixture();
            const subject = 'mailto:test@example.com';
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: subject,
            } as unknown as CloudFlareEnv);
            const endpoint = 'https://push.example.com/subscription/7';
            const fixture = await generateSubscriberFixture(endpoint);
            mockFetchWithStatus(201, true);

            await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            expect(fetchCalls).toHaveLength(1);
            const call = fetchCalls[0];
            expect(call.url).toBe(endpoint);
            expect(call.init.method).toBe('POST');

            const headers = call.init.headers as Record<string, string>;
            expect(headers['Content-Encoding']).toBe('aes128gcm');
            expect(headers['Content-Type']).toBe('application/octet-stream');
            expect(headers.TTL).toBe(String(24 * 60 * 60));

            const authorizationMatch =
                /^vapid t=(?<jwt>[^,]+), k=(?<publicKey>.+)$/.exec(
                    headers.Authorization,
                );
            expect(authorizationMatch).not.toBeNull();
            const jwt = authorizationMatch?.groups?.jwt ?? '';
            const publicKey = authorizationMatch?.groups?.publicKey ?? '';
            expect(publicKey).toBe(vapid.publicKeyBase64Url);

            const [encodedHeader, encodedClaim, encodedSignature] =
                jwt.split('.');
            const header = JSON.parse(
                new TextDecoder().decode(fromBase64Url(encodedHeader)),
            ) as { alg: string; typ: string };
            const claim = JSON.parse(
                new TextDecoder().decode(fromBase64Url(encodedClaim)),
            ) as { aud: string; sub: string; exp: number };

            expect(header).toEqual({ alg: 'ES256', typ: 'JWT' });
            expect(claim.aud).toBe(new URL(endpoint).origin);
            expect(claim.sub).toBe(subject);
            // VAPID_JWT_TTL_SECONDS（12時間=43200秒）ぶん先の有効期限になっていること。
            // 「未来であること」だけでなく実際のTTL値も検証する（テスト実行時間分の
            // 誤差を許容するため60秒の範囲チェックにする）。
            const now = Math.floor(Date.now() / 1000);
            expect(claim.exp).toBeGreaterThan(now + 12 * 60 * 60 - 60);
            expect(claim.exp).toBeLessThanOrEqual(now + 12 * 60 * 60);

            // JWT署名（ECDSA P-256の生署名、常に64バイト=3の倍数でないためBase64URL化すると
            // パディングが必要になる）にBase64URLのパディング文字'='が含まれないこと
            // （toBase64UrlのomitPadding:trueが効いていることの検証）。
            expect(encodedSignature).not.toContain('=');

            const signatureValid = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                vapid.verifyKey,
                fromBase64Url(encodedSignature),
                new TextEncoder().encode(`${encodedHeader}.${encodedClaim}`),
            );
            expect(signatureValid).toBe(true);
        });

        it('J4: VAPID秘密鍵のCryptoKeyはextractable:falseでインポートされること', async () => {
            // extractable:falseは「この秘密鍵をexportKeyで取り出せない」ことを保証する
            // セキュリティ上重要な設定。trueに変わっても送信結果（JWT署名等）自体は
            // 変わらず見た目上は観測できないため、importKeyの呼び出し引数を
            // 直接検証する（C1-C4と同じ isVapidImportKeyCall フィルタで
            // VAPID用のECDSA importKey呼び出しのみを抽出する）。
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixture = await generateSubscriberFixture(
                'https://push.example.com/subscription/13',
            );
            mockFetchWithStatus(201, true);
            const importKeySpy = spyOn(crypto.subtle, 'importKey');

            await gateway.send(fixture.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            const vapidImportCalls =
                importKeySpy.mock.calls.filter(isVapidImportKeyCall);
            expect(vapidImportCalls).toHaveLength(1);
            const [, , , extractable] = vapidImportCalls[0];
            expect(extractable).toBe(false);
            importKeySpy.mockRestore();
        });

        it('E2: 送信した暗号文をラウンドトリップ復号すると元のペイロードと一致すること', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const endpoint = 'https://push.example.com/subscription/8';
            const fixture = await generateSubscriberFixture(endpoint);
            mockFetchWithStatus(201, true);

            const payload = {
                title: '皐月賞（GⅠ）',
                body: '中山 11R',
                url: '/timeline',
            };
            await gateway.send(fixture.subscription, payload);

            const body = fetchCalls[0].init.body as Uint8Array<ArrayBuffer>;
            const decrypted = await decryptAes128Gcm(
                fixture.privateKey,
                fixture.publicKeyRaw,
                fixture.authSecretRaw,
                body,
            );

            expect(JSON.parse(decrypted)).toEqual(payload);
        });

        // VAPID秘密鍵(ECDSA P-256)のimportKey呼び出しのみを抽出するフィルタ。
        // encryptPayload側でもimportKeyが呼ばれる(ECDH/HKDF/AES-GCM)ため、
        // アルゴリズム引数でVAPID用のものだけに絞り込む。
        const isVapidImportKeyCall = (call: readonly unknown[]): boolean => {
            const algorithm = call[2] as { name?: string } | string;
            return (
                typeof algorithm === 'object' &&
                algorithm !== null &&
                algorithm.name === 'ECDSA'
            );
        };

        it('C1: 同一dispatchCacheで2回sendすると、VAPID鍵のimportKeyは1回のみ呼ばれること', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixtureA = await generateSubscriberFixture(
                'https://push.example.com/subscription/9a',
            );
            const fixtureB = await generateSubscriberFixture(
                'https://push.example.com/subscription/9b',
            );
            mockFetchWithStatus(201, true);
            const importKeySpy = spyOn(crypto.subtle, 'importKey');
            const dispatchCache = {};

            await gateway.send(
                fixtureA.subscription,
                { title: 'タイトル', body: '本文' },
                dispatchCache,
            );
            await gateway.send(
                fixtureB.subscription,
                { title: 'タイトル', body: '本文' },
                dispatchCache,
            );

            const vapidImportCalls =
                importKeySpy.mock.calls.filter(isVapidImportKeyCall);
            expect(vapidImportCalls).toHaveLength(1);
            importKeySpy.mockRestore();
        });

        it('C2: dispatchCacheを省略して2回sendすると、VAPID鍵のimportKeyは毎回呼ばれること', async () => {
            const vapid = await generateVapidFixture();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapid.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapid.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            const fixtureA = await generateSubscriberFixture(
                'https://push.example.com/subscription/10a',
            );
            const fixtureB = await generateSubscriberFixture(
                'https://push.example.com/subscription/10b',
            );
            mockFetchWithStatus(201, true);
            const importKeySpy = spyOn(crypto.subtle, 'importKey');

            await gateway.send(fixtureA.subscription, {
                title: 'タイトル',
                body: '本文',
            });
            await gateway.send(fixtureB.subscription, {
                title: 'タイトル',
                body: '本文',
            });

            const vapidImportCalls =
                importKeySpy.mock.calls.filter(isVapidImportKeyCall);
            expect(vapidImportCalls).toHaveLength(2);
            importKeySpy.mockRestore();
        });

        it('C3: 同一dispatchCacheでも公開鍵が変わった場合は再インポートすること', async () => {
            const vapidA = await generateVapidFixture();
            const vapidB = await generateVapidFixture();
            const fixtureA = await generateSubscriberFixture(
                'https://push.example.com/subscription/11a',
            );
            const fixtureB = await generateSubscriberFixture(
                'https://push.example.com/subscription/11b',
            );
            mockFetchWithStatus(201, true);
            const importKeySpy = spyOn(crypto.subtle, 'importKey');
            const dispatchCache = {};

            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapidA.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapidA.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            await gateway.send(
                fixtureA.subscription,
                { title: 'タイトル', body: '本文' },
                dispatchCache,
            );

            // 公開鍵(+秘密鍵)が異なる別のVAPIDペアに切り替える
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapidB.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapidB.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            await gateway.send(
                fixtureB.subscription,
                { title: 'タイトル', body: '本文' },
                dispatchCache,
            );

            const vapidImportCalls =
                importKeySpy.mock.calls.filter(isVapidImportKeyCall);
            expect(vapidImportCalls).toHaveLength(2);
            importKeySpy.mockRestore();
        });

        it('C4: 同一dispatchCacheでも公開鍵は同じで秘密鍵だけ変わった場合は再インポートすること', async () => {
            const vapidA = await generateVapidFixture();
            const vapidB = await generateVapidFixture();
            const fixtureA = await generateSubscriberFixture(
                'https://push.example.com/subscription/12a',
            );
            const fixtureB = await generateSubscriberFixture(
                'https://push.example.com/subscription/12b',
            );
            mockFetchWithStatus(201, true);
            const importKeySpy = spyOn(crypto.subtle, 'importKey');
            const dispatchCache = {};

            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapidA.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapidA.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            await gateway.send(
                fixtureA.subscription,
                { title: 'タイトル', body: '本文' },
                dispatchCache,
            );

            // 公開鍵はvapidAのまま、秘密鍵だけ別ペア(vapidB)のものに差し替える
            // （現実のVAPID鍵ローテーションでは起きない組み合わせだが、
            // resolveCachedVapidKeyが秘密鍵の一致も個別に判定していることを
            // 検証するためのテスト）。
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                VAPID_PUBLIC_KEY: vapidA.publicKeyBase64Url,
                VAPID_PRIVATE_KEY: vapidB.privateKeyD,
                VAPID_SUBJECT: 'mailto:test@example.com',
            } as unknown as CloudFlareEnv);
            await gateway.send(
                fixtureB.subscription,
                { title: 'タイトル', body: '本文' },
                dispatchCache,
            );

            const vapidImportCalls =
                importKeySpy.mock.calls.filter(isVapidImportKeyCall);
            expect(vapidImportCalls).toHaveLength(2);
            importKeySpy.mockRestore();
        });
    });

    describe('RFC 8291 既知ベクタ', () => {
        it('E1: RFC 8291 Appendix A の既知ベクタを復号すると既知の平文と一致すること', async () => {
            const receiverPrivHex =
                'ab5757a70dd4a53e553a6bbf71ffefea2874ec07a6b379e3c48f895a02dc33de';
            const receiverPubHex =
                '042571b2becdfde360551aaf1ed0f4cd366c11cebe555f89bcb7b186a53339173168ece2ebe018597bd30479b86e3c8f8eced577ca59187e9246990db682008b0e';
            const authSecretHex = '05305932a1c7eabe13b6cec9fda48882';
            const payloadHex =
                '0c6bfaadad67958803092d454676f397000010004104fe33f4ab0dea71914db55823f73b54948f41306d920732dbb9a59a53286482200e597a7b7bc260ba1c227998580992e93973002f3012a28ae8f06bbb78e5ec0ff297de5b429bba7153d3a4ae0caa091fd425f3b4b5414add8ab37a19c1bbb05cf5cb5b2a2e0562d558635641ec52812c6c8ff42e95ccb86be7cd';

            const receiverPriv = hexToBytes(receiverPrivHex);
            const receiverPub = hexToBytes(receiverPubHex);
            const authSecret = hexToBytes(authSecretHex);
            const payload = hexToBytes(payloadHex);

            const receiverPrivateKey = await crypto.subtle.importKey(
                'jwk',
                {
                    kty: 'EC',
                    crv: 'P-256',
                    d: toBase64Url(receiverPriv),
                    x: toBase64Url(receiverPub.slice(1, 33)),
                    y: toBase64Url(receiverPub.slice(33, 65)),
                    ext: true,
                },
                { name: 'ECDH', namedCurve: 'P-256' },
                false,
                ['deriveBits'],
            );

            const plaintext = await decryptAes128Gcm(
                receiverPrivateKey,
                receiverPub,
                authSecret,
                payload,
            );

            expect(plaintext).toBe('When I grow up, I want to be a watermelon');
        });
    });
});
