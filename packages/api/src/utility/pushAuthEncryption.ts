import { EnvStore } from '@race-schedule/core';

/**
 * Web Push購読のauth(共有シークレット)を保存時に暗号化する（SEC-053）。
 *
 * `push_subscription.auth` は RFC 8291 のメッセージ暗号化に使う共有シークレットで、
 * `endpoint`/`p256dh`と揃うと、DBを読める主体が任意の通知を送信でき過去ペイロードも
 * 復号しうる。`PUSH_AUTH_ENCRYPTION_KEY`（Workersシークレット、AES-256-GCM鍵）が
 * 設定されている環境でのみ、この鍵で暗号化してDBへ保存する。
 *
 * @remarks 未設定環境ではPush機能自体を止めないため平文のまま扱う（fail-open）。
 * 既存の平文行はこのモジュール導入前から残っているため、暗号化マーカー
 * （`encv1:`）の有無で判定し後方互換を保つ（一括移行バッチは行わない。次回
 * upsert時に自然に暗号化された値へ置き換わる）。
 */

/** 暗号化済みauth値の先頭に付与するマーカー。無ければ非暗号化（レガシー）とみなす。 */
const ENCRYPTED_PREFIX = 'encv1:';
/** AES-GCMの推奨IVバイト長 */
const IV_BYTE_LENGTH = 12;

/**
 * バイト列を Base64URL（パディングなし）文字列に変換する。
 * @param bytes - 変換対象のバイト列
 */
const toBase64Url = (bytes: Uint8Array): string => {
    const binary = String.fromCodePoint(...bytes);
    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
};

/**
 * Base64URL文字列をバイト列に変換する（{@link toBase64Url} の逆変換）。
 * @param value - 変換対象のBase64URL文字列
 */
const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
    const padded = value
        .replaceAll('-', '+')
        .replaceAll('_', '/')
        .padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    return new Uint8Array(
        Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0),
    );
};

/**
 * Base64URLエンコードされた生鍵からAES-GCM用のCryptoKeyをインポートする。
 * @param rawKey - `PUSH_AUTH_ENCRYPTION_KEY`の値（Base64URL、32バイト）
 */
const importAesKey = (rawKey: string): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', fromBase64Url(rawKey), 'AES-GCM', false, [
        'encrypt',
        'decrypt',
    ]);

/**
 * `PUSH_AUTH_ENCRYPTION_KEY` を読み取る。
 * @remarks `EnvStore.setEnv` 未実行（repository単体テスト等、Cloudflare実行環境を
 * 経由しない文脈）では `EnvStore.env` 自体がthrowするため、`requireEnvVar`
 * （envStore.ts）と同じ方針で「未初期化 = 未設定」として扱う。
 */
const readEncryptionKey = (): string | undefined => {
    try {
        return EnvStore.env.PUSH_AUTH_ENCRYPTION_KEY;
    } catch {
        return;
    }
};

/**
 * auth平文をAES-256-GCMで暗号化する。
 * @param authPlaintext - 暗号化前のauth値
 * @returns `PUSH_AUTH_ENCRYPTION_KEY`設定時は`encv1:`で始まる暗号化済み文字列、
 * 未設定時は入力をそのまま返す
 */
export const encryptPushAuth = async (
    authPlaintext: string,
): Promise<string> => {
    const rawKey = readEncryptionKey();
    if (!rawKey) return authPlaintext;

    const key = await importAesKey(rawKey);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(authPlaintext),
    );
    return `${ENCRYPTED_PREFIX}${toBase64Url(iv)}:${toBase64Url(new Uint8Array(ciphertext))}`;
};

/**
 * {@link encryptPushAuth} で暗号化されたauth値を復号する。
 * @param storedValue - DBに保存されているauth列の値
 * @returns 復号済みの平文auth値。暗号化マーカーが無い値（レガシー行）はそのまま返す
 * @throws {Error} 暗号化済みの値だが `PUSH_AUTH_ENCRYPTION_KEY` が未設定、または形式が壊れている場合
 */
export const decryptPushAuth = async (storedValue: string): Promise<string> => {
    if (!storedValue.startsWith(ENCRYPTED_PREFIX)) return storedValue;

    const rawKey = readEncryptionKey();
    if (!rawKey) {
        throw new Error(
            'PUSH_AUTH_ENCRYPTION_KEY is not set but an encrypted push auth value exists. Cannot decrypt.',
        );
    }

    const [ivPart, ciphertextPart] = storedValue
        .slice(ENCRYPTED_PREFIX.length)
        .split(':');
    if (!ivPart) {
        throw new Error('Malformed encrypted push auth value.');
    }
    if (!ciphertextPart) {
        throw new Error('Malformed encrypted push auth value.');
    }

    const key = await importAesKey(rawKey);
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
        key,
        fromBase64Url(ciphertextPart),
    );
    return new TextDecoder().decode(plaintext);
};
