/**
 * 招待トークン・セッショントークンに使う高エントロピーな不透明トークンを生成する。
 * `crypto.randomUUID()`（122ビット相当）より広い256ビットの乱数を使う
 * （招待URLはLINE等で人に渡す想定のため、推測されにくさを優先する）。
 * @returns URL-safeなbase64url文字列（43文字、パディング無し）
 */
export const generateOpaqueToken = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
};
