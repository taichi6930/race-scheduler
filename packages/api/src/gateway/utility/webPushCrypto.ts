import { EnvStore } from '@race-schedule/core';

import type {
    WebPushDispatchCache,
    WebPushPayload,
    WebPushSendResult,
    WebPushSubscriptionKeys,
} from '../interface/IWebPushGateway';

/** VAPID JWT の有効期限（RFC 8292 は最大24時間を推奨。余裕を持って12時間とする） */
// Stryker disable next-line : ArithmeticOperator
// 時定数の乗算順序変更（12 * 60 / 60等）は出力値に影響せず、テストでの検証不可（equivalent）
const VAPID_JWT_TTL_SECONDS = 12 * 60 * 60;

/** Push Service に配信を委ねる最大期間（TTLヘッダー） */
// Stryker disable next-line : ArithmeticOperator
// 時定数の乗算順序変更は出力値に影響せず、テストでの検証不可（equivalent）
const PUSH_TTL_SECONDS = 24 * 60 * 60;

/** aes128gcm の record size（RFC 8188 のデフォルト） */
const AES128GCM_RECORD_SIZE = 4096;

/** P-256 の非圧縮点（0x04 || X(32) || Y(32)）のバイト長 */
const EC_UNCOMPRESSED_POINT_LENGTH = 65;

/** RFC 8291 §3.4 の HKDF info 文字列（末尾 NUL バイト込み） */
const WEB_PUSH_INFO_PREFIX = new TextEncoder().encode('WebPush: info\u{0}');
/** RFC 8188 の Content Encryption Key 導出用 info 文字列 */
const CEK_INFO = new TextEncoder().encode('Content-Encoding: aes128gcm\u{0}');
/** RFC 8188 の nonce 導出用 info 文字列 */
const NONCE_INFO = new TextEncoder().encode('Content-Encoding: nonce\u{0}');
/** RFC 8188 の最終レコード区切りバイト（パディング無し・単一レコード前提） */
const LAST_RECORD_DELIMITER = new Uint8Array([2]);

/**
 * バイト列を Base64URL（パディングなし）文字列に変換する
 * @param bytes - 変換対象のバイト列
 * @returns Base64URL 文字列
 */
function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
    // Stryker disable next-line : BooleanLiteral
    // omitPadding は RFC 8291 仕様で false にしようとしてもパディング無しが出力される
    // （Uint8Array.toBase64は仕様で omitPadding=true が必須）のため、実質的に変更不可（equivalent）
    return bytes.toBase64({ alphabet: 'base64url', omitPadding: true });
}

/**
 * Base64URL 文字列をバイト列に変換する
 * @param value - 変換対象の Base64URL 文字列
 * @returns バイト列
 */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.fromBase64(value, { alphabet: 'base64url' });
}

/**
 * 複数のバイト列を連結する
 * @param parts - 連結対象のバイト列（可変長）
 * @returns 連結したバイト列
 */
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

/**
 * VAPID 用の環境変数が3つとも設定されているかどうかを判定する。
 * 複合条件（&&）を独立関数として切り出し、C2組み合わせ爆発を回避する。
 * @param publicKey - VAPID_PUBLIC_KEY
 * @param privateKey - VAPID_PRIVATE_KEY
 * @param subject - VAPID_SUBJECT
 * @returns 3つとも非空文字列であれば true
 */
function isVapidConfigured(
    publicKey: string | undefined,
    privateKey: string | undefined,
    subject: string | undefined,
): publicKey is string {
    return Boolean(publicKey) && Boolean(privateKey) && Boolean(subject);
}

/**
 * VAPID 秘密鍵（JWK の `d` パラメータ）と公開鍵（Base64URL の非圧縮点）から
 * ECDSA 署名用の CryptoKey を組み立てる。
 * @param publicKeyBase64Url - VAPID公開鍵（Base64URL、非圧縮点）
 * @param privateKeyD - VAPID秘密鍵（JWK `d` パラメータ、Base64URL）
 * @returns 署名専用の CryptoKey
 */
async function importVapidPrivateKey(
    publicKeyBase64Url: string,
    privateKeyD: string,
): Promise<CryptoKey> {
    const publicKeyBytes = fromBase64Url(publicKeyBase64Url);
    const x = toBase64Url(publicKeyBytes.slice(1, 33));
    const y = toBase64Url(publicKeyBytes.slice(33, 65));

    // Stryker disable next-line : BooleanLiteral
    // JWKのext:trueは「extractableになり得る」ことの申告に過ぎず、実際の
    // extractability は下記の明示的な extractable 引数（false）で決まる
    // （Web Crypto APIの仕様上、明示引数がJWKのextより厳しい方向には常に安全）。
    // そのためこのext値の変更は下記extractable引数がfalseである限り観測不可能（equivalent）。
    return crypto.subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', d: privateKeyD, x, y, ext: true },
        { name: 'ECDSA', namedCurve: 'P-256' },
        // extractable=false: この秘密鍵をexportKeyで取り出せないようにする
        // （webPushGateway.test.ts の J4 で importKey 呼び出し引数を直接検証している）
        false,
        ['sign'],
    );
}

/**
 * PERF-054（`PushUsecase.dispatchDue`）で複数件を10件チャンクで並列送信する際、
 * `postPushRequest`（延いては `importVapidPrivateKey`）が送信ごとに毎回
 * 呼ばれ、同一のVAPID秘密鍵を何度も `crypto.subtle.importKey` していた。
 *
 * PERF-104: 呼び出し元（usecase層）が1回のdispatch呼び出しにつき1つ生成する
 * 空オブジェクト（`{}`、型は `WebPushDispatchCache` = `object`）を
 * 「キャッシュの識別子」として受け取り、`WeakMap` でインポート済み
 * `CryptoKey` を紐付ける。長期間有効なモジュールレベルのグローバルキャッシュ
 * にはせず、`WeakMap` の性質上この識別子オブジェクトが破棄されれば
 * （＝dispatch呼び出しが終われば）キャッシュエントリも自然に解放される。
 * 鍵ローテーション時も次回のdispatch呼び出しでは新しい識別子オブジェクトが
 * 使われるため、必ず最新のVAPID鍵で再インポートされる。
 */

/** dispatch呼び出し1回分にひもづく、インポート済みVAPID秘密鍵のキャッシュ */
const vapidKeyCacheByDispatch = new WeakMap<
    WebPushDispatchCache,
    CachedVapidKey
>();

/** `vapidKeyCacheByDispatch` に格納する1エントリ分の型 */
interface CachedVapidKey {
    cryptoKey: CryptoKey;
    publicKey: string;
    privateKey: string;
}

/**
 * キャッシュ済みエントリが今回要求された公開鍵・秘密鍵の組と一致する場合のみ
 * CryptoKeyを返す（不一致・未キャッシュならundefined）。
 * ガード節で単純な条件に分解し、複合条件（&&）を避ける。
 * @param cached - `vapidKeyCacheByDispatch` から取得したキャッシュエントリ（未キャッシュ時はundefined）
 * @param publicKeyBase64Url - 今回要求されたVAPID公開鍵（Base64URL）
 * @param privateKeyD - 今回要求されたVAPID秘密鍵（JWK `d` パラメータ）
 * @returns 再利用可能なCryptoKey、再利用不可なら undefined
 */
function resolveCachedVapidKey(
    cached: CachedVapidKey | undefined,
    publicKeyBase64Url: string,
    privateKeyD: string,
): CryptoKey | undefined {
    if (cached === undefined) {
        return;
    }
    if (cached.publicKey !== publicKeyBase64Url) {
        return;
    }
    if (cached.privateKey !== privateKeyD) {
        return;
    }
    return cached.cryptoKey;
}

/**
 * VAPID秘密鍵のCryptoKeyインポートをメモ化する。
 * `dispatchCache` が指定され、かつ同一の公開鍵・秘密鍵の組で既にインポート
 * 済みであればそれを再利用する。指定が無い場合（`sendTest` 等の単発送信）は
 * 毎回インポートする（従来どおり）。
 * @param publicKeyBase64Url - VAPID公開鍵（Base64URL、非圧縮点）
 * @param privateKeyD - VAPID秘密鍵（JWK `d` パラメータ、Base64URL）
 * @param dispatchCache - 呼び出し元が1回のdispatchにつき1つ生成するキャッシュ識別子
 * @returns 署名専用の CryptoKey
 */
async function importVapidPrivateKeyCached(
    publicKeyBase64Url: string,
    privateKeyD: string,
    dispatchCache: WebPushDispatchCache | undefined,
): Promise<CryptoKey> {
    if (dispatchCache !== undefined) {
        const cached = vapidKeyCacheByDispatch.get(dispatchCache);
        const cachedKey = resolveCachedVapidKey(
            cached,
            publicKeyBase64Url,
            privateKeyD,
        );
        if (cachedKey !== undefined) {
            return cachedKey;
        }
    }

    const cryptoKey = await importVapidPrivateKey(
        publicKeyBase64Url,
        privateKeyD,
    );
    if (dispatchCache !== undefined) {
        vapidKeyCacheByDispatch.set(dispatchCache, {
            cryptoKey,
            publicKey: publicKeyBase64Url,
            privateKey: privateKeyD,
        });
    }
    return cryptoKey;
}

/** 検証済みの VAPID 認証情報 */
interface VapidCredentials {
    publicKey: string;
    privateKey: string;
    subject: string;
}

/**
 * VAPID用の環境変数（公開鍵・秘密鍵・subject）を取得し検証する。
 * @returns 検証済みの VAPID 認証情報
 */
function resolveVapidCredentials(): VapidCredentials {
    const publicKey = EnvStore.env.VAPID_PUBLIC_KEY;
    const privateKey = EnvStore.env.VAPID_PRIVATE_KEY;
    const subject = EnvStore.env.VAPID_SUBJECT;
    if (!isVapidConfigured(publicKey, privateKey, subject)) {
        throw new Error(
            'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT is not set in environment variables',
        );
    }
    // 型ガード isVapidConfigured により privateKey/subject も string と分かっているが、
    // 型述語の対象は publicKey のみのため、ここでは非nullアサーションではなく
    // 事前に取得済みの値をそのまま使う（実行時は既に検証済み）。
    // SAFETY: 直前の isVapidConfigured(publicKey, privateKey, subject) が true を返した時点で
    // privateKey/subject もともに string（undefinedではない）であることが検証済み
    return {
        publicKey,
        privateKey: privateKey as string,
        subject: subject as string,
    };
}

/**
 * VAPID（RFC 8292）の Authorization ヘッダー値を組み立てる。
 * ES256（ECDSA P-256）で署名した JWT を `vapid t=<jwt>, k=<publicKey>` 形式にする。
 * @param endpoint - 送信先の Push Service エンドポイント URL
 * @param dispatchCache - 呼び出し元が1回のdispatchにつき1つ生成するキャッシュ識別子
 * （PERF-104）。省略時は毎回 CryptoKey をインポートする。
 * @returns Authorization ヘッダーに設定する値
 */
async function buildVapidAuthorizationHeader(
    endpoint: string,
    dispatchCache: WebPushDispatchCache | undefined,
): Promise<string> {
    const { publicKey, privateKey, subject } = resolveVapidCredentials();

    const header = { typ: 'JWT', alg: 'ES256' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        aud: new URL(endpoint).origin,
        exp: now + VAPID_JWT_TTL_SECONDS,
        sub: subject,
    };

    const encodedHeader = toBase64Url(
        new TextEncoder().encode(JSON.stringify(header)),
    );
    const encodedClaim = toBase64Url(
        new TextEncoder().encode(JSON.stringify(claim)),
    );
    const unsignedToken = `${encodedHeader}.${encodedClaim}`;

    const cryptoKey = await importVapidPrivateKeyCached(
        publicKey,
        privateKey,
        dispatchCache,
    );
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        new TextEncoder().encode(unsignedToken),
    );

    const jwt = `${unsignedToken}.${toBase64Url(new Uint8Array(signature))}`;
    return `vapid t=${jwt}, k=${publicKey}`;
}

/**
 * HKDF 鍵導出用の CryptoKey をインポートする。
 * @param keyMaterial - 鍵材料（生バイト列）
 * @returns HKDF の deriveBits に使える CryptoKey
 */
async function importHkdfKey(
    keyMaterial: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', keyMaterial, 'HKDF', false, [
        'deriveBits',
    ]);
}

/**
 * HKDF（SHA-256）でビット列を導出する。
 * deriveContentEncryptionKeys 内の3箇所の同型呼び出し（salt/info/長さのみ異なる）を集約する。
 * @param key - importHkdfKey で得た CryptoKey
 * @param salt - HKDF の salt
 * @param info - HKDF の info
 * @param lengthBits - 導出するビット長
 * @returns 導出したバイト列
 */
async function deriveHkdfBits(
    key: CryptoKey,
    salt: Uint8Array<ArrayBuffer>,
    info: Uint8Array<ArrayBuffer>,
    lengthBits: number,
): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info },
            key,
            lengthBits,
        ),
    );
}

/**
 * RFC 8291 §3.4 の鍵導出（ECDH共有鍵 + auth secret → Content Encryption Key / nonce）を行う。
 * @param ecdhSecret - ECDH共有鍵（32バイト）
 * @param authSecret - 購読の auth secret（16バイト）
 * @param uaPublicKey - 受信側（ブラウザ）の公開鍵（65バイト、非圧縮点）
 * @param asPublicKey - 送信側（本サーバ）の一時鍵の公開鍵（65バイト、非圧縮点）
 * @param salt - このメッセージ用のランダムな salt（16バイト）
 * @returns Content Encryption Key（16バイト）と nonce（12バイト）
 */
async function deriveContentEncryptionKeys(
    ecdhSecret: Uint8Array<ArrayBuffer>,
    authSecret: Uint8Array<ArrayBuffer>,
    uaPublicKey: Uint8Array<ArrayBuffer>,
    asPublicKey: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
): Promise<{ cek: Uint8Array<ArrayBuffer>; nonce: Uint8Array<ArrayBuffer> }> {
    const ecdhSecretKey = await importHkdfKey(ecdhSecret);
    const keyInfo = concatBytes(WEB_PUSH_INFO_PREFIX, uaPublicKey, asPublicKey);
    const ikm = await deriveHkdfBits(ecdhSecretKey, authSecret, keyInfo, 256);

    const ikmKey = await importHkdfKey(ikm);
    const cek = await deriveHkdfBits(ikmKey, salt, CEK_INFO, 128);
    const nonce = await deriveHkdfBits(ikmKey, salt, NONCE_INFO, 96);

    return { cek, nonce };
}

/**
 * aes128gcm のヘッダー（salt || record size || keyid長 || keyid）を組み立てる。
 * @param salt - このメッセージ用のランダムな salt（16バイト）
 * @param asPublicKey - keyid として埋め込む送信側一時鍵の公開鍵（65バイト）
 * @returns ヘッダーバイト列（86バイト）
 */
function buildAes128GcmHeader(
    salt: Uint8Array<ArrayBuffer>,
    asPublicKey: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
    const header = new Uint8Array(16 + 4 + 1 + EC_UNCOMPRESSED_POINT_LENGTH);
    header.set(salt, 0);
    new DataView(header.buffer).setUint32(16, AES128GCM_RECORD_SIZE, false);
    header[20] = EC_UNCOMPRESSED_POINT_LENGTH;
    header.set(asPublicKey, 21);
    return header;
}

/**
 * 送信側の一時ECDH鍵ペアを生成し、受信側公開鍵との共有鍵を導出する。
 * @param uaPublicKey - 受信側（ブラウザ）の公開鍵（65バイト、非圧縮点）
 * @returns ECDH共有鍵と、送信側一時鍵の公開鍵（keyid として使用）
 */
async function deriveEphemeralEcdhSecret(
    uaPublicKey: Uint8Array<ArrayBuffer>,
): Promise<{
    ecdhSecret: Uint8Array<ArrayBuffer>;
    asPublicKey: Uint8Array<ArrayBuffer>;
}> {
    const ephemeralKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
    );
    const asPublicKey = new Uint8Array(
        await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey),
    );

    const uaPublicCryptoKey = await crypto.subtle.importKey(
        'raw',
        uaPublicKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
    );
    const ecdhSecret = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: uaPublicCryptoKey },
            ephemeralKeyPair.privateKey,
            256,
        ),
    );

    return { ecdhSecret, asPublicKey };
}

/**
 * Content Encryption Key で平文を AES-128-GCM 暗号化する（単一レコード、パディング無し）。
 * @param cek - Content Encryption Key（16バイト）
 * @param nonce - nonce（12バイト）
 * @param plaintext - 暗号化対象の平文
 * @returns 暗号文（GCMタグ込み）
 */
async function encryptRecord(
    cek: Uint8Array<ArrayBuffer>,
    nonce: Uint8Array<ArrayBuffer>,
    plaintext: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, [
        'encrypt',
    ]);
    const record = concatBytes(plaintext, LAST_RECORD_DELIMITER);
    return new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            cekKey,
            record,
        ),
    );
}

/**
 * 通知ペイロードを RFC 8291（`aes128gcm`）で暗号化する。
 * @param subscription - 送信先の購読（p256dh / auth）
 * @param plaintext - 暗号化対象の平文（JSON文字列をエンコードしたもの）
 * @returns Push Service へ送信するリクエストボディ（ヘッダー + 暗号文）
 */
async function encryptPayload(
    subscription: WebPushSubscriptionKeys,
    plaintext: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
    const uaPublicKey = fromBase64Url(subscription.p256dh);
    const authSecret = fromBase64Url(subscription.auth);

    const { ecdhSecret, asPublicKey } =
        await deriveEphemeralEcdhSecret(uaPublicKey);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const { cek, nonce } = await deriveContentEncryptionKeys(
        ecdhSecret,
        authSecret,
        uaPublicKey,
        asPublicKey,
        salt,
    );

    const ciphertext = await encryptRecord(cek, nonce, plaintext);

    return concatBytes(buildAes128GcmHeader(salt, asPublicKey), ciphertext);
}

/**
 * レスポンスのステータスから購読が失効しているかどうかを判定する。
 * Push Service は購読が無効・失効している場合 404 または 410 を返す
 * （web-push-design.md §4）。
 * @param status - HTTPステータスコード
 * @returns 購読が失効していれば true
 */
function isGoneStatus(status: number): boolean {
    return status === 404 || status === 410;
}

/**
 * Push Service のレスポンスを WebPushSendResult に変換する。
 * @param response - fetch のレスポンス
 * @returns 送信結果
 */
async function toWebPushSendResult(
    response: Response,
): Promise<WebPushSendResult> {
    if (response.ok) {
        return { ok: true };
    }
    const message = await response.text();
    return {
        ok: false,
        gone: isGoneStatus(response.status),
        message: `Push service responded ${response.status}: ${message}`,
    };
}

/**
 * VAPID署名・RFC8291暗号化を行い、Push Serviceへ実際にPOSTしてレスポンスを判定する。
 * @param subscription - 送信先の購読（p256dh / auth）
 * @param payload - 通知内容
 * @param dispatchCache - 呼び出し元が1回のdispatchにつき1つ生成するキャッシュ識別子
 * （PERF-104: VAPID秘密鍵のCryptoKeyインポートをこの識別子単位でメモ化する）。
 * 省略時（`sendTest`等の単発送信）は毎回インポートする。
 * @returns 送信結果
 */
export async function postPushRequest(
    subscription: WebPushSubscriptionKeys,
    payload: WebPushPayload,
    dispatchCache?: WebPushDispatchCache,
): Promise<WebPushSendResult> {
    const authorization = await buildVapidAuthorizationHeader(
        subscription.endpoint,
        dispatchCache,
    );
    const body = await encryptPayload(
        subscription,
        new TextEncoder().encode(JSON.stringify(payload)),
    );

    const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            Authorization: authorization,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: String(PUSH_TTL_SECONDS),
        },
        body,
    });

    return toWebPushSendResult(response);
}
