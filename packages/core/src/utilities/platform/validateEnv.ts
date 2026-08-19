import type { CloudFlareEnv } from './cloudFlareEnv';

/**
 * APIパッケージ固有の必須環境変数キー一覧。
 * Google Calendar 連携・認証に必要な変数。
 * scraping パッケージはカレンダーを使わないため、これらは API 起動時のみ検証する。
 */
export const API_REQUIRED_KEYS = [
    'JRA_CALENDAR_ID',
    'NAR_CALENDAR_ID',
    // 海外カレンダー: 新キー OVERSEAS_CALENDAR_ID を必須とするが、
    // validateEnv 側で旧キー WORLD_CALENDAR_ID へのフォールバックを行い後方互換を維持する。
    'OVERSEAS_CALENDAR_ID',
    'KEIRIN_CALENDAR_ID',
    'AUTORACE_CALENDAR_ID',
    'BOATRACE_CALENDAR_ID',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
] as const satisfies (keyof CloudFlareEnv)[];

/**
 * Google Private Key の PEM フォーマット検証パターン。
 * Cloudflare Workers secret に格納された値は Base64 エンコードされている場合がある。
 * PEM ヘッダー (-----BEGIN ...) またはBase64文字列（44文字以上）を許容する。
 */
const GOOGLE_PRIVATE_KEY_MIN_LENGTH = 44;

/**
 * value が未設定または空文字列（トリム後）かどうかを判定する。
 * 複合条件（||）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param value - 検証対象の値
 * @returns 未設定または空文字列なら true
 */
const isBlankValue = (value: string | undefined): boolean =>
    !value || value.trim() === '';

/**
 * GOOGLE_PRIVATE_KEY のフォーマット検証を実行すべきかどうかを判定する。
 * 複合条件（&&）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @remarks
 * `env` を丸ごと受け取り、プロパティアクセスを関数内部で行うこと。
 * 呼び出し側で `env.GOOGLE_PRIVATE_KEY` を先に評価して引数として渡すと、
 * `requiredKeys` に GOOGLE_PRIVATE_KEY が含まれない場合でも
 * （env が未設定オブジェクトである等の理由で）評価自体が例外を投げうる。
 * 元の `&&` 式が持っていた短絡評価（1つ目が false なら2つ目を評価しない）を
 * 維持するため、プロパティアクセスは関数内の `&&` に委ねる。
 * @param requiredKeys - 検証する必須環境変数キーの一覧
 * @param env - CloudFlareEnv オブジェクト
 * @returns フォーマット検証が必要なら true
 */
const shouldValidateGooglePrivateKeyFormat = (
    requiredKeys: readonly (keyof CloudFlareEnv)[],
    env: CloudFlareEnv,
): boolean =>
    // SAFETY: requiredKeys は `keyof CloudFlareEnv` の配列であり、
    // 'GOOGLE_PRIVATE_KEY' との包含比較のために string[] として扱っても要素の実体は変わらない。
    (requiredKeys as readonly string[]).includes('GOOGLE_PRIVATE_KEY') &&
    Boolean(env.GOOGLE_PRIVATE_KEY);

/**
 * PEM 形式・Base64 形式のいずれにも合致しないかどうかを判定する。
 * 複合条件（&&）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param isPem - PEM ヘッダーで始まるか
 * @param isBase64 - Base64 文字列として妥当か
 * @returns どちらの形式にも合致しなければ true
 */
const isPrivateKeyFormatInvalid = (
    isPem: boolean,
    isBase64: boolean,
): boolean => !isPem && !isBase64;

/**
 * requiredKeys のうち未設定・空文字の環境変数キー一覧を返す。
 * @param env - CloudFlareEnv オブジェクト
 * @param requiredKeys - 検証する必須環境変数キーの一覧
 * @returns 未設定・空文字のキー一覧
 */
const collectMissingRequiredKeys = (
    env: CloudFlareEnv,
    requiredKeys: readonly (keyof CloudFlareEnv)[],
): string[] => {
    const missing: string[] = [];

    for (const key of requiredKeys) {
        // 後方互換: OVERSEAS_CALENDAR_ID が未設定でも旧キー WORLD_CALENDAR_ID があれば有効とみなす。
        // SAFETY: API_REQUIRED_KEYS 等 requiredKeys に列挙されるキーは Cloudflare Workers の
        // シークレット/環境変数（すべて文字列値）のみであり、CloudFlareEnv 上の他の非文字列
        // プロパティはこの一覧に含まれないため、string | undefined として扱って安全。
        const value: string | undefined =
            key === 'OVERSEAS_CALENDAR_ID'
                ? (env.OVERSEAS_CALENDAR_ID ?? env.WORLD_CALENDAR_ID)
                : (env[key] as string | undefined);
        if (isBlankValue(value)) {
            missing.push(key);
        }
    }

    return missing;
};

/**
 * GOOGLE_PRIVATE_KEY のフォーマットを検証する（requiredKeys に含まれる場合のみ）。
 * PEM 形式 (-----BEGIN ...) または Base64 文字列（最低44文字）を受け入れる。
 * @param env - CloudFlareEnv オブジェクト
 * @param requiredKeys - 検証する必須環境変数キーの一覧
 * @throws {Error} フォーマットが不正な場合
 */
const validateGooglePrivateKeyFormat = (
    env: CloudFlareEnv,
    requiredKeys: readonly (keyof CloudFlareEnv)[],
): void => {
    if (!shouldValidateGooglePrivateKeyFormat(requiredKeys, env)) {
        return;
    }

    const privateKey = env.GOOGLE_PRIVATE_KEY.trim();
    const isPem = privateKey.startsWith('-----BEGIN');
    const isBase64 =
        privateKey.length >= GOOGLE_PRIVATE_KEY_MIN_LENGTH &&
        /^[A-Za-z0-9+/=\n]+$/.test(privateKey);

    if (isPrivateKeyFormatInvalid(isPem, isBase64)) {
        throw new Error(
            '[EnvValidation] GOOGLE_PRIVATE_KEY のフォーマットが不正です。' +
                'PEM 形式（-----BEGIN で始まる）または Base64 文字列を設定してください。',
        );
    }
};

/**
 * 直近で検証に成功した env / requiredKeys の参照。
 * `validateEnv` は `EnvStore.setEnv` 経由でリクエストのたびに呼ばれるが、Cloudflare Workers の
 * 実行モデルでは env バインディング自体は isolate 起動時に確定し、リクエストを跨いで同一参照で
 * あることが一般的なため、参照が変わらない限り再検証（PEM 判定正規表現を含む）をスキップする
 * （PERF-048/051/085 と同型の「参照が変わったら再計算」パターン）。
 */
let lastValidatedEnv: CloudFlareEnv | undefined;
let lastValidatedRequiredKeys: readonly (keyof CloudFlareEnv)[] | undefined;

/**
 * env / requiredKeys がいずれも直近の検証成功時と同一参照かどうかを判定する。
 * 複合条件（&&）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param env - 検証対象の CloudFlareEnv オブジェクト
 * @param requiredKeys - 検証する必須環境変数キーの一覧
 * @returns 直近の検証成功時と同一参照なら true
 */
const isSameAsLastValidated = (
    env: CloudFlareEnv,
    requiredKeys: readonly (keyof CloudFlareEnv)[],
): boolean =>
    lastValidatedEnv === env && lastValidatedRequiredKeys === requiredKeys;

/**
 * 環境変数を検証する。
 * サービス起動時（初回リクエスト）に呼び出し、未設定・不正な値があれば即時エラーにする。
 * @param env - CloudFlareEnv オブジェクト
 * @param requiredKeys - 検証する必須環境変数キーの一覧（デフォルト: 空配列）
 * @throws {Error} 必須環境変数が未設定・空文字の場合
 * @throws {Error} GOOGLE_PRIVATE_KEY のフォーマットが不正な場合 (#4)
 */
export const validateEnv = (
    env: CloudFlareEnv,
    requiredKeys: readonly (keyof CloudFlareEnv)[] = [],
): void => {
    if (isSameAsLastValidated(env, requiredKeys)) {
        return;
    }

    const missing = collectMissingRequiredKeys(env, requiredKeys);

    if (missing.length > 0) {
        throw new Error(
            `[EnvValidation] 必須環境変数が未設定です: ${missing.join(', ')}`,
        );
    }

    // #4: GOOGLE_PRIVATE_KEY のフォーマット検証（requiredKeys に含まれる場合のみ）
    validateGooglePrivateKeyFormat(env, requiredKeys);

    lastValidatedEnv = env;
    lastValidatedRequiredKeys = requiredKeys;
};
