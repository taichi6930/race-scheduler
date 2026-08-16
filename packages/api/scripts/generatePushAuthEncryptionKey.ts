/**
 * Web Push購読のauth暗号化用（SEC-053）AES-256-GCM鍵を1つ生成し、標準出力に表示する
 * ワンショットスクリプト。
 *
 * 実行: bun packages/api/scripts/generatePushAuthEncryptionKey.ts
 *
 * 出力される値の登録先:
 * - PUSH_AUTH_ENCRYPTION_KEY : 機密。GitHub の Secrets（各環境）に登録し、
 *                               deploy-api-reusable.yml の secrets-json 経由で
 *                               api Worker のシークレットとして注入する。
 *
 * 環境（development/test/production）ごとに鍵を分けたい場合は、
 * このスクリプトを環境の数だけ実行する。
 *
 * @remarks 未設定のままでもWeb Push機能自体は従来どおり動作する（authが平文で
 * 保存されるだけ）。設定すると、以降のupsertでauthがこの鍵で暗号化されて保存される
 * （既存の平文行は次回upsert時に自然に置き換わる。一括移行は行わない）。
 */

/** AES-256-GCM鍵のバイト長 */
const KEY_BYTE_LENGTH = 32;

/**
 * バイト列を Base64URL（パディングなし）文字列に変換する。
 * @param bytes - 変換対象のバイト列
 */
function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }
    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
}

/**
 * 鍵を生成し標準出力へ表示する。
 */
function main(): void {
    const key = crypto.getRandomValues(new Uint8Array(KEY_BYTE_LENGTH));
    console.log('PUSH_AUTH_ENCRYPTION_KEY=' + toBase64Url(key));
}

if (import.meta.main) {
    main();
}
