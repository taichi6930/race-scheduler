/**
 * @file キャッシュコントロールの純ロジック
 *
 * 読み取り専用（GET）かつ成功（2xx）レスポンスにのみ Cache-Control を
 * 付与するための判定と、ヘッダー値の組み立てを、フレームワーク非依存な
 * 純関数として提供する。Hono など特定フレームワークのミドルウェア実装は
 * 各パッケージ側で薄くラップする。
 */

/**
 * GET リクエストかつレスポンスが成功（2xx）かどうかを判定する。
 * 複合条件（&&）を軽量なユニットテストで検証できるよう独立関数に切り出す。
 * @param method - HTTP メソッド
 * @param isOk - レスポンスが成功（2xx）かどうか
 * @returns キャッシュヘッダーを設定すべきであれば true
 */
export const isCacheableGetResponse = (
    method: string,
    isOk: boolean,
): boolean => method === 'GET' && isOk;

/**
 * Cache-Control ヘッダー値を組み立てる。
 * @param maxAge - クライアント側キャッシュ有効期限（秒）
 * @param sMaxAge - CDN/プロキシ側キャッシュ有効期限（秒）
 * @returns `public, max-age=<maxAge>, s-maxage=<sMaxAge>` 形式の文字列
 */
export const buildCacheControlHeader = (
    maxAge: number,
    sMaxAge: number,
): string => `public, max-age=${maxAge}, s-maxage=${sMaxAge}`;

/**
 * FNV-1a（32bit）ハッシュ関数。
 * 暗号学的強度は不要（衝突耐性より計算コストの低さを優先する ETag 用途）なため、
 * Web Crypto（非同期）ではなく同期的に計算できる軽量ハッシュを採用する。
 * @param input - ハッシュ化対象の文字列
 * @returns 32bit 符号無し整数のハッシュ値
 */
const fnv1aHash = (input: string): number => {
    let hash = 0x81_1c_9d_c5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01_00_01_93);
    }
    return hash >>> 0;
};

/**
 * 文字列コンテンツ（レスポンスボディ等）から弱い ETag（Weak ETag）を生成する。
 *
 * 条件付きリクエスト（If-None-Match）による 304 応答判定に使うためのヘルパー。
 * 同一内容からは常に同一の ETag が得られる（決定論的）。
 * @param content - ETag の元になる文字列（例: レスポンスボディの JSON 文字列）
 * @returns `W/"<hash>"` 形式の弱い ETag 文字列
 */
export const buildETagFromContent = (content: string): string =>
    `W/"${fnv1aHash(content).toString(16)}"`;

/**
 * 更新日時（updated_at 等）から弱い ETag（Weak ETag）を生成する。
 * レスポンスボディ全体をハッシュ化するコストをかけずに、更新日時の変化だけで
 * キャッシュ無効化を判定したい場合に使う。
 * @param updatedAt - 対象リソースの更新日時（Date または ISO 8601 文字列）
 * @returns `W/"<hash>"` 形式の弱い ETag 文字列
 */
export const buildETagFromUpdatedAt = (updatedAt: Date | string): string =>
    buildETagFromContent(
        typeof updatedAt === 'string' ? updatedAt : updatedAt.toISOString(),
    );

/**
 * ETag のクォート付き値から弱性標識（`W/`）を取り除く。
 * If-None-Match の比較は弱い比較（weak comparison）で行うため、
 * 双方から `W/` プレフィックスを除去してから値を比較する。
 * @param tag - 比較対象の ETag 文字列
 * @returns `W/` を除去し前後の空白を取り除いた文字列
 */
const stripWeakPrefix = (tag: string): string => tag.trim().replace(/^W\//, '');

/**
 * If-None-Match リクエストヘッダーの値が、指定した ETag と一致するかどうかを判定する。
 * `*`（任意のリソースに一致）と、カンマ区切りの複数 ETag 候補の両方に対応する。
 * @param ifNoneMatch - リクエストの If-None-Match ヘッダー値（無ければ null/undefined）
 * @param etag - サーバー側が算出した現在の ETag
 * @returns 304 Not Modified を返すべきであれば true
 */
export const isNoneMatch = (
    ifNoneMatch: string | null | undefined,
    etag: string,
): boolean => {
    if (!ifNoneMatch) {
        return false;
    }
    if (ifNoneMatch.trim() === '*') {
        return true;
    }
    const target = stripWeakPrefix(etag);
    return ifNoneMatch
        .split(',')
        .some((candidate) => stripWeakPrefix(candidate) === target);
};
