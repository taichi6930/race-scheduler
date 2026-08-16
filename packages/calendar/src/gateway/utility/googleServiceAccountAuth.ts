import { appLogger, EnvStore } from '@race-schedule/core';

/**
 * Google サービスアカウント（JWT/OAuth2）認証まわりのロジック。
 * `GoogleCalendarGateway` から認証の詳細（JWT組み立て・署名・OAuth2トークン
 * 交換・キャッシュ）を切り離すために独立させたモジュール。
 */

const GOOGLE_AUTH_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_AUD = 'https://oauth2.googleapis.com/token';

/**
 * Uint8Array を Base64URL（パディング無し）文字列へ変換する。
 * JWT の header/claim/signature で 3 回重複していた変換チェーンを共通化。
 * @param bytes - 変換対象のバイト列
 * @returns Base64URL 文字列
 */
function toBase64Url(bytes: Uint8Array): string {
    return bytes
        .toBase64()
        .replaceAll('=', '')
        .replaceAll('+', '-')
        .replaceAll('/', '_');
}

/**
 * キャッシュ済みアクセストークンが（60秒以上の余裕を持って）まだ有効かどうかを判定する。
 * 複合条件（&&）を独立関数として切り出し、C2組み合わせ爆発を回避する。
 * @param accessToken - キャッシュされたアクセストークン
 * @param tokenExpiry - トークンの有効期限（UNIX秒）
 * @param now - 現在時刻（UNIX秒）
 * @returns キャッシュが有効であれば true
 */
function isAccessTokenCacheValid(
    accessToken: string | null,
    tokenExpiry: number,
    now: number,
): accessToken is string {
    return accessToken !== null && tokenExpiry > now + 60;
}

/**
 * GOOGLE_PRIVATE_KEY の値が有効（非空文字列）かどうかを判定する。
 * 型定義上は string だが環境変数由来の値のため、実行時防御チェックとして
 * 複合条件（&&）を独立関数に切り出す。
 * @param rawPrivateKey - 環境変数から取得した値
 * @returns 有効な非空文字列であれば true
 */
function isValidPrivateKey(rawPrivateKey: unknown): rawPrivateKey is string {
    return typeof rawPrivateKey === 'string' && rawPrivateKey.length > 0;
}

/**
 * PEM形式の秘密鍵文字列から、ヘッダー/フッター・改行・エスケープを除去してバイト列にデコードする。
 * @param privateKey - PEM形式の秘密鍵（実改行・Cloudflareのエスケープ\nの両方に対応）
 * @returns デコード済みの鍵バイト列（pkcs8）
 */
function decodePrivateKeyBytes(privateKey: string): Uint8Array<ArrayBuffer> {
    const keyData = privateKey
        .replaceAll('-----BEGIN PRIVATE KEY-----', '')
        .replaceAll('-----END PRIVATE KEY-----', '')
        .replaceAll(/[\n\r]/g, '') // 実改行を削除
        .replaceAll(String.raw`\n`, '') // Cloudflareのエスケープ\nも削除
        .trim();

    return Uint8Array.fromBase64(keyData);
}

/**
 * JWT の "encodedHeader.encodedClaim" を RS256（RSASSA-PKCS1-v1_5 + SHA-256）で署名する。
 * @param unsignedToken - "encodedHeader.encodedClaim" 文字列
 * @param privateKey - PEM形式の秘密鍵
 * @returns Base64URLエンコード済みの署名
 */
async function signJwt(
    unsignedToken: string,
    privateKey: string,
): Promise<string> {
    const binaryKey = decodePrivateKeyBytes(privateKey);

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['sign'],
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(unsignedToken),
    );

    return toBase64Url(new Uint8Array(signature));
}

/**
 * Service Account JWT を組み立てて署名する。
 * @param clientEmail - サービスアカウントのクライアントメール
 * @param privateKey - PEM形式の秘密鍵
 * @param scopes - 要求するスコープ一覧
 */
async function createGoogleJWT(
    clientEmail: string,
    privateKey: string,
    scopes: string[],
): Promise<string> {
    const header = {
        alg: 'RS256',
        typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: clientEmail,
        scope: scopes.join(' '),
        aud: GOOGLE_OAUTH_AUD,
        exp: now + 3600,
        iat: now,
    };

    const encodedHeader = toBase64Url(
        new TextEncoder().encode(JSON.stringify(header)),
    );
    const encodedClaim = toBase64Url(
        new TextEncoder().encode(JSON.stringify(claim)),
    );

    const unsignedToken = `${encodedHeader}.${encodedClaim}`;

    // Web Crypto API で署名
    const encodedSignature = await signJwt(unsignedToken, privateKey);

    return `${unsignedToken}.${encodedSignature}`;
}

/**
 * JWT を使って Google OAuth2 アクセストークンを取得する。
 * @param clientEmail - サービスアカウントのクライアントメール
 * @param privateKey - PEM形式の秘密鍵
 */
async function getAccessToken(
    clientEmail: string,
    privateKey: string,
): Promise<string> {
    const jwt = await createGoogleJWT(clientEmail, privateKey, [
        GOOGLE_AUTH_SCOPE,
    ]);

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        // Google OAuth2 の生エラー本文はサービスアカウントの内部状態を含みうるため、
        // 呼び出し元（ひいてはログ集約先である公開GitHub Issue等）へは要約のみ伝播し、
        // 詳細は appLogger にのみ残す（SEC-018）。
        appLogger.warn(
            `Google OAuth2 token exchange failed (status ${response.status}): ${error}`,
        );
        throw new Error(
            `Failed to get access token: OAuth2 error (status ${response.status})`,
        );
    }

    const data = await response.json<{ access_token: string }>();
    return data.access_token;
}

/** Service Account 認証（アクセストークンのキャッシュ付き取得）を提供するインターフェース。 */
export interface GoogleServiceAccountAuth {
    ensureAccessToken: () => Promise<string>;
}

/**
 * Google サービスアカウント認証の状態（キャッシュ済みアクセストークン・有効期限）を
 * カプセル化したインスタンスを作る。
 * @returns アクセストークンをキャッシュ付きで取得できるオブジェクト
 */
export function createGoogleServiceAccountAuth(): GoogleServiceAccountAuth {
    let accessToken: string | null = null;
    let tokenExpiry = 0;

    return {
        async ensureAccessToken(): Promise<string> {
            const now = Math.floor(Date.now() / 1000);
            // トークンが有効期限内であればキャッシュを返す
            if (isAccessTokenCacheValid(accessToken, tokenExpiry, now)) {
                return accessToken;
            }

            const clientEmail = EnvStore.env.GOOGLE_CLIENT_EMAIL.trim();
            const rawPrivateKey = EnvStore.env.GOOGLE_PRIVATE_KEY;
            if (!isValidPrivateKey(rawPrivateKey)) {
                throw new Error(
                    'GOOGLE_PRIVATE_KEY is not set in environment variables',
                );
            }
            const privateKey = rawPrivateKey.replaceAll(String.raw`\n`, '\n');

            accessToken = await getAccessToken(clientEmail, privateKey);
            tokenExpiry = now + 3500; // 3600秒 - 100秒のバッファ
            return accessToken;
        },
    };
}
