/**
 * ログサニタイズユーティリティ
 *
 * appLogger.error などでエラーオブジェクトを出力する際に
 * APIキー・秘密鍵などの機密情報がログに残らないようにマスクする。
 *
 * ## ログ記録・保持方針（QPRIV-08）
 *
 * - **IPアドレス**: `rateLimitMiddleware.ts`（`resolveRateLimitKey`）が
 *   `CF-Connecting-IP`ヘッダーから取得し、レート制限の判定キーとしてのみ使用する。
 *   制限超過時は`logRateLimitExceeded`が`appLogger.warn`の`key`フィールドとして
 *   IPアドレスをそのままログへ出力する — フィールド名`key`は下記
 *   `SENSITIVE_KEY_PATTERNS`のいずれにも一致しないため、他の機密情報（APIキー・
 *   トークン等）と異なりマスク対象外である。IPアドレスはAPIキー等と同列の機密情報
 *   としては扱わない方針だが、レート制限以外の用途（ユーザー識別・分析等）には
 *   使用しない。
 * - **保持期間**: ログの保持期間はCloudflare Workers Logsのプラットフォーム既定値に
 *   従う。アプリケーション側でログをDB保存・外部ログ集約サービスへ転送する等の
 *   独自の長期保管は行わない。
 */

import { isNonNullObject, isStringValue } from './validation';

/** マスク対象のキー名パターン（大文字小文字を無視して一致したキー値をマスク） */
const SENSITIVE_KEY_PATTERNS = [
    /private.?key/i,
    /secret/i,
    /password/i,
    /api.?key/i,
    /access.?key/i,
    /token/i,
    /credential/i,
    /auth/i,
];

const MASKED = '[REDACTED]';

/**
 * 文字列値中の「キー=値」/「キー: 値」形式で埋め込まれたトークンらしき値を検出する際の
 * キー名語彙（SEC-020）。`SENSITIVE_KEY_PATTERNS` と同じ語彙をベースにしつつ、単語単位で
 * 完全一致させるために調整している:
 * - `credentials?` … `credential`/`credentials` の両方を単語境界で拾えるようにする
 *   （`SENSITIVE_KEY_PATTERNS` の `/credential/i` をそのまま `\b...\b` で囲むと
 *   「credentials」の末尾の `s` で単語境界が成立せずマッチしなくなるため）。
 * - `authorization` … `/auth/i` を単語境界で囲んでも「authorization」という一語には
 *   マッチしない（"auth" が独立した単語ではなく "authorization" の接頭辞に過ぎないため）
 *   ので、別語彙として明示的に追加している。
 */
const INLINE_SENSITIVE_KEY_WORDS = [
    'private.?key',
    'secret',
    'password',
    'api.?key',
    'access.?key',
    'token',
    'credentials?',
    'auth',
    'authorization',
];

/**
 * 文字列中の `token=xxx` / `Authorization: Bearer xxx` のような「キー=値」断片を検出する
 * 正規表現（SEC-020）。
 *
 * マッチ条件を「`INLINE_SENSITIVE_KEY_WORDS` のいずれかに単語単位で一致するキーで始まる」
 * ことに限定しているのがポイント。仮に「任意の単語 + `:`/`=`」を広く拾ってから事後的に
 * キー名を判定する実装にすると、`"sync failed: token=xxx"` のような文で無関係な単語
 * （`failed`）が先に「キーらしきもの」としてマッチしてしまい、その値部分として
 * 後続の `token=xxx` ごと飲み込んでしまう（結果 `token=xxx` 自体が独立した候補として
 * 二度と評価されずマスク漏れする）。マッチ開始位置自体を機密キー語彙に限定することで
 * この飲み込みを防いでいる。
 *
 * 値部分（最終キャプチャグループ）は空白・カンマ・セミコロン・クォート・閉じ括弧類の
 * 手前までの4文字以上の連続した非区切り文字とする。トークン/シークレットらしき値を
 * 広めに拾いつつ、文の区切りで確実に止める。
 */
const KEY_VALUE_IN_STRING_PATTERN = new RegExp(
    `\\b(?:${INLINE_SENSITIVE_KEY_WORDS.join('|')})\\b` +
        `\\s*[:=]\\s*(?:Bearer\\s+)?([^\\s,;"')}\\]]{4,})`,
    'gi',
);

/**
 * 文字列値の中に埋め込まれた `token=xxx` / `Authorization: Bearer xxx` のような
 * トークン・シークレット値をマスクする（SEC-020）。
 *
 * `maskSensitiveFields` はオブジェクトの**キー名**でのみ機密フィールドを判定するため、
 * `` `Failed with token=${token}` `` のようにエラーメッセージへ直接連結・埋め込まれた値は
 * キー名ベースの検出をすり抜けてログに漏洩しうる。この関数はメッセージ文字列自体を
 * 正規表現で走査し、キー名部分は残したまま値部分だけをマスクすることでログの
 * 可読性を保ちつつ機密値の漏洩を防ぐ（キー名ベースのマスクと並存する第二の防御層）。
 * @param text - 走査対象の文字列
 * @returns 機密値をマスクした文字列（該当箇所が無ければ元の文字列と同じ内容）
 */
const maskSensitiveValuesInString = (text: string): string =>
    text.replace(
        KEY_VALUE_IN_STRING_PATTERN,
        (match: string, value: string) =>
            `${match.slice(0, match.length - value.length)}${MASKED}`,
    );

/**
 * 本番環境で `stack` に残す先頭フレーム数（OBS-003）。
 *
 * 1行目（`Error: message`）に加えて、例外が実際に発生した直近の呼び出し
 * フレームのみを残す。呼び出し履歴を辿れる完全なスタック（内部のディレクトリ
 * 構成・呼び出し経路）は本番ログにも残さない一方、原因箇所の特定に最低限
 * 必要な「どのファイル・関数で発生したか」だけは残すバランスを取っている。
 */
const PROD_STACK_FRAME_LIMIT = 1;

/**
 * 本番環境向けにスタックトレースを先頭フレームのみへ切り詰める。
 * @param stack - 元のスタックトレース文字列（`Error#stack`）
 * @returns 先頭 `1 + PROD_STACK_FRAME_LIMIT` 行に切り詰めたスタック文字列
 */
const truncateStackForProduction = (
    stack: string | undefined,
): string | undefined => {
    if (stack === undefined) {
        return;
    }
    return stack
        .split('\n')
        .slice(0, 1 + PROD_STACK_FRAME_LIMIT)
        .join('\n');
};

/**
 * 値が null または undefined かどうかを判定する。
 * 呼び出し側にインライン展開すると複合条件（||）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param value - 判定対象の値
 * @returns null または undefined であれば true
 */
const isNullish = (value: unknown): value is null | undefined =>
    value === null || value === undefined;

/* oxlint-disable anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type --
   ログ・エラーに渡される値は形状不定（任意のオブジェクト・配列・プリミティブ）で、
   このマスク処理はキー名だけを見て再帰的にそのまま返す。マスク後も元の値の形状を
   保つ必要があるためunknown/Record<string, unknown>が唯一正直な型。 */
/**
 * サニタイズ済みのエラー情報。Error インスタンス由来なら `name`/`message`/`stack`、
 * それ以外の値なら機密フィールドをマスクした任意のキーを持つ。
 */
interface SanitizedError {
    [key: string]: unknown;
}

/**
 * オブジェクト内の機密フィールドを再帰的にマスクする
 * @param value - マスク対象の値
 * @param depth - 現在の再帰深さ（内部利用）
 * @returns 機密フィールドをマスクした値
 */
const maskSensitiveFields = (value: unknown, depth = 0): unknown => {
    if (depth > 5) return value; // 再帰深さ制限
    if (isNullish(value)) return value;
    if (isStringValue(value)) {
        // 文字列値そのものに `token=xxx` のようなキー・値が連結・埋め込まれている
        // ケースを検出してマスクする（SEC-020）。オブジェクトのキー名だけで判定する
        // 上のロジックでは、メッセージ文字列へ直接埋め込まれたトークン等はすり抜ける。
        return maskSensitiveValuesInString(value);
    }
    if (!isNonNullObject(value)) return value;
    if (Array.isArray(value)) {
        return value.map((item) => maskSensitiveFields(item, depth + 1));
    }

    const result: Record<string, unknown> = {};
    // SAFETY: 直前の isNonNullObject(value) と Array.isArray(value) の分岐により、
    // ここに到達する value は配列ではない非nullオブジェクトであることが確定しており、
    // Object.entries で列挙する目的のキー付きレコードとして扱って安全。
    for (const [key, entryValue] of Object.entries(
        value as Record<string, unknown>,
    )) {
        const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) =>
            pattern.test(key),
        );
        result[key] = isSensitive
            ? MASKED
            : maskSensitiveFields(entryValue, depth + 1);
    }
    return result;
};

/**
 * エラーオブジェクトを安全にシリアライズする（機密フィールドをマスク）
 * @param error - シリアライズ対象のエラー（Error インスタンスまたは任意の値）
 * @returns 機密フィールドをマスクしたサニタイズ済みエラー情報
 */
export const sanitizeError = (error: unknown): SanitizedError => {
    if (error instanceof Error) {
        return {
            name: error.name,
            // メッセージ文字列に `token=xxx` 等が連結・埋め込まれているケースを
            // 検出してマスクする（SEC-020）。
            message: maskSensitiveValuesInString(error.message),
            // 開発環境ではフルスタックを残す。本番環境では完全なスタックは
            // 内部のファイル構成・呼び出し経路を露出しうるため、原因箇所の
            // 特定に必要な先頭フレームのみへ切り詰める（OBS-003、全削除だった
            // 従来の挙動から変更）。
            stack:
                process.env.NODE_ENV === 'production'
                    ? truncateStackForProduction(error.stack)
                    : error.stack,
        };
    }
    if (isNonNullObject(error)) {
        // SAFETY: maskSensitiveFields はオブジェクト入力に対しては同じキー集合を持つ
        // レコードを返す実装（配列分岐は isNonNullObject の対象外の値には来ない）ため、
        // 戻り値を SanitizedError として扱って安全。
        return maskSensitiveFields(error) as SanitizedError;
    }
    return { message: maskSensitiveValuesInString(String(error)) };
};
/* oxlint-enable anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type */
