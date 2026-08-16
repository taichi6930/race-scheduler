/**
 * VAPID（RFC 8292）鍵ペアを1組生成し、標準出力に表示するワンショットスクリプト。
 *
 * 実行: bun packages/api/scripts/generateVapidKeys.ts
 *
 * 出力される2つの値の登録先:
 * - VAPID_PUBLIC_KEY  : 非機密。GitHub の Variables（development/test/production 各環境）
 *                        に登録し、front のビルド時に --dart-define で注入する。
 * - VAPID_PRIVATE_KEY : 機密。GitHub の Secrets（各環境）に登録し、
 *                        deploy-api-reusable.yml の secrets-json 経由で
 *                        api Worker のシークレットとして注入する。
 *
 * 環境（development/test/production）ごとに鍵ペアを分けたい場合は、
 * このスクリプトを環境の数だけ実行する。
 */

/**
 *
 * @param bytes
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
 *
 */
async function main(): Promise<void> {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
    );

    const publicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', keyPair.publicKey),
    );
    const privateKeyJwk = (await crypto.subtle.exportKey(
        'jwk',
        keyPair.privateKey,
    )) as JsonWebKey;

    if (!privateKeyJwk.d) {
        throw new Error(
            'Failed to export the VAPID private key (missing "d" parameter).',
        );
    }

    console.log('VAPID_PUBLIC_KEY=' + toBase64Url(publicKeyRaw));
    console.log('VAPID_PRIVATE_KEY=' + privateKeyJwk.d);
}

if (import.meta.main) {
    void main();
}
