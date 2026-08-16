/**
 * Web Push 購読・予約の安定IDを導出するユーティリティ（web-push-design.md §3）。
 */

/**
 * バイト列を Base64URL（パディングなし）文字列に変換する
 * @param bytes
 */
const toBase64Url = (bytes: Uint8Array): string => {
    const binary = String.fromCodePoint(...bytes);
    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
};

/**
 * 購読の endpoint から安定した ID（SHA-256 ダイジェストの Base64URL）を導出する。
 * 同一 endpoint は常に同一 ID になるため、購読の upsert が冪等になる。
 * @param endpoint - Push Service が発行した購読先 URL
 * @returns 決定的な購読 ID
 */
export const hashSubscriptionEndpoint = async (
    endpoint: string,
): Promise<string> => {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(endpoint),
    );
    return toBase64Url(new Uint8Array(digest));
};

/**
 * 発火予約の ID（購読ID × レースID）を組み立てる。
 * 同一の組み合わせは常に同一 ID になるため、予約の upsert が冪等になる。
 * @param subscriptionId - hashSubscriptionEndpoint で導出した購読 ID
 * @param raceId - レースID
 * @returns 決定的な予約 ID
 */
export const buildPushRequestId = (
    subscriptionId: string,
    raceId: string,
): string => `${subscriptionId}:${raceId}`;

/** 購読の所有権を証明するシークレットのバイト長（push-ownership-design.md §2.2） */
const SUBSCRIPTION_SECRET_BYTE_LENGTH = 32;

/**
 * 購読の所有権を証明するシークレットを生成する（push-ownership-design.md §2.1）。
 * サーバはこの平文を保存せず、{@link hashSubscriptionSecret} のハッシュのみを保持する。
 * @returns 32バイト乱数の Base64URL 文字列
 */
export const generateSubscriptionSecret = (): string => {
    const bytes = new Uint8Array(SUBSCRIPTION_SECRET_BYTE_LENGTH);
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
};

/**
 * 購読シークレットの SHA-256 ダイジェスト（Base64URL）を計算する。
 * DB には平文ではなくこのハッシュのみを保存する（push-ownership-design.md §2.1）。
 * @param secret - シークレット平文
 * @returns SHA-256 ダイジェストの Base64URL 文字列
 */
export const hashSubscriptionSecret = async (
    secret: string,
): Promise<string> => {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(secret),
    );
    return toBase64Url(new Uint8Array(digest));
};
