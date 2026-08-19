/**
 * 環境変数ストア
 *
 * アプリケーション内で環境変数を一元管理するためのシングルトンパターン。
 * 環境変数は初期化時に setEnv() 経由で設定され、
 * 以降は env プロパティ経由でアクセスします。
 * @example
 * // アプリケーション起動時に設定
 * EnvStore.setEnv(process.env);
 *
 * // アプリケーション内で使用
 * const googleKey = EnvStore.env.GOOGLE_PRIVATE_KEY;
 */

import type { CloudFlareEnv } from './cloudFlareEnv';
import { validateEnv } from './validateEnv';

// SAFETY: 初期値は未設定状態を表す undefined そのものであり、setEnv() 呼び出しまで
// CloudFlareEnv 型の値が無いことを表現するために union 型として明示している（実行時の値は変わらない）。
const _cache = { env: undefined as CloudFlareEnv | undefined };

/**
 * 環境変数管理オブジェクト
 * setEnv - 環境変数を設定する
 * env - 設定済みの環境変数にアクセス（getter）
 * reset - テスト用に環境変数をリセット
 */
export const EnvStore = {
    /**
     * 環境変数を設定する
     * @param env - 設定する環境変数オブジェクト
     * @param requiredKeys - 検証する必須環境変数キーの一覧（デフォルト: 空配列）。
     *   API パッケージでは API_REQUIRED_KEYS を渡す。
     * @throws {TypeError} env が undefined の場合、このメソッドは TypeError をスロー
     */
    setEnv(
        env: CloudFlareEnv,
        requiredKeys: readonly (keyof CloudFlareEnv)[] = [],
    ): void {
        validateEnv(env, requiredKeys);
        _cache.env = env;
    },
    /**
     * 設定済みの環境変数にアクセス
     * @returns 環境変数オブジェクト
     * @throws {TypeError} 環境変数が setEnv() 経由で設定されていない場合
     */
    get env(): CloudFlareEnv {
        if (_cache.env === undefined) {
            throw new TypeError('EnvStore.env is not set');
        }
        return _cache.env;
    },
    /**
     * 環境変数をリセット（テスト用）
     * @internal
     */
    reset(): void {
        _cache.env = undefined;
    },
};

/**
 * 必須の環境変数（URL系）を取得する。
 *
 * Worker モード（EnvStore.setEnv 済み）では EnvStore から読み取り、
 * CLI モード（EnvStore 未初期化）ではフォールバックとして process.env を使用する。
 * api/batch/calendar/scraping で個別実装されていた同型のロジックを集約したもの。
 * @param key 取得する環境変数名
 * @returns 環境変数の値
 * @throws {Error} 環境変数が設定されていない場合
 */
export function requireEnvVar(
    key: 'SCRAPING_API_URL' | 'MAIN_API_URL' | 'CALENDAR_API_URL',
): string {
    let value: string | undefined;
    try {
        value = EnvStore.env[key] ?? process.env[key];
    } catch {
        value = process.env[key];
    }

    if (!value) {
        throw new Error(
            `${key} environment variable is required. ` +
                'Set it in your .env file or via environment variables.',
        );
    }

    return value;
}
