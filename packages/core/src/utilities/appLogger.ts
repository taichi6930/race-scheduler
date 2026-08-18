/**
 * アプリケーション共通ロガー
 *
 * console.log/error/warn/debug を直接使う代わりにこのモジュールを使用してください。
 *
 * 旧: console.log → 新: appLogger.info
 * 旧: console.error → 新: appLogger.error
 * 旧: console.warn → 新: appLogger.warn
 * 旧: console.debug → 新: appLogger.debug
 *
 * コメントやサンプルコードも appLogger を使うように統一してください。
 * ログレベル・タイムスタンプを統一フォーマットで出力します。
 *
 * 使用例:
 *   import { appLogger } from '@race-schedule/core';
 *   appLogger.info('処理を開始します');
 *   appLogger.debug('詳細な診断情報です');
 *   appLogger.error('エラーが発生しました', error);
 *
 * ## 出力フォーマット（OBS-001）
 *
 * `WORKER_NAME` 環境変数（`wrangler.toml` の `[env.*.vars]` で各 Worker に設定）が
 * 設定されている場合のみ、Cloudflare Workers Logs でフィールド単位のフィルタ・集計が
 * できるよう `{level,timestamp,worker,message,...meta}` の JSON 1 行を出力する。
 * 未設定の場合（`batch` の CLI（`cli.ts`）や既存のユニットテストなど、人が直接目視する
 * 用途）は従来どおり `[LEVEL] timestamp message` の可読テキスト形式を維持する
 * （挙動を変えると `cli.ts` のバナー出力の可読性が損なわれるため）。
 *
 * ## リクエスト相関ID（OBS-004）
 *
 * `requestContext.ts`（`runWithRequestId`）で紐付けられたリクエストIDがあれば、
 * JSON構造化ログの `requestId` フィールドに自動的に含める。並行リクエストの
 * ログが交錯していても、`requestId` で1リクエスト分だけを絞り込める。
 */

import { getRequestId } from './requestContext';

const timestamp = (): string => new Date().toISOString();

/**
 * 実行環境が production かどうかを判定する（`NODE_ENV`/`ENVIRONMENT` いずれかが
 * `production` であれば true）。ログレベル制御以外にも、production 環境でのみ
 * 有効化すべきでない機能（デバッグ用エンドポイント等）のガードとして
 * 他モジュールからも再利用する（SEC-023）。
 * @returns production 環境であれば true
 */
export const isProductionEnvironment = (): boolean => {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const environment = process.env.ENVIRONMENT?.toLowerCase();

    return nodeEnv === 'production' || environment === 'production';
};

/**
 * デバッグログを出力してよいかどうかを判定する（OBS-002）。
 *
 * 本番環境では既定で `debug` ログを破棄するが、障害調査中に一時的に
 * 詳細ログを見たいケースのため `LOG_LEVEL=debug` が明示されていれば
 * 本番環境でも出力を許可する（再デプロイ不要でログレベルを切り替えられる）。
 * @returns debug ログを出力してよい場合 true
 */
const isDebugLoggingEnabled = (): boolean => {
    if (!isProductionEnvironment()) {
        return true;
    }

    return process.env.LOG_LEVEL?.toLowerCase() === 'debug';
};

/** ログレベル名（JSON構造化ログの `level` フィールドに使う） */
type LogLevel = 'DEBUG' | 'ERROR' | 'INFO' | 'WARN';

/**
 * JSON構造化ログを出力してよい実行コンテキストかどうかを判定する。
 * @returns `WORKER_NAME` が設定されていれば true
 */
const isStructuredLoggingEnabled = (): boolean =>
    Boolean(process.env.WORKER_NAME);

/**
 * `console.*` へ渡す可変長引数（メッセージ本文の補足情報）を、JSON構造化ログの
 * `meta` フィールドに落とし込むための正規化を行う。
 * 引数が無ければ `meta` フィールド自体を省略し、1件なら値をそのまま、
 * 複数件なら配列として保持する（`JSON.stringify` 時に `undefined` は自動的に
 * キーごと省略される）。
 * @param args - `appLogger.*` に渡された可変長引数
 * @returns `meta` フィールドの値（引数が無ければ `undefined`）
 */
// oxlint-disable-next-line anti-slop/no-unknown-returns -- ログの補足情報は形状不定で、そのまま構造化ログのmetaへ渡すだけのためunknownが唯一正直な型
const buildMeta = (args: unknown[]): unknown => {
    if (args.length === 0) {
        return;
    }
    return args.length === 1 ? args[0] : args;
};

/**
 * JSON構造化ログ1行を出力する。
 * @param level - ログレベル
 * @param message - ログメッセージ
 * @param args - 補足情報（`meta` フィールドへ格納）
 */
const emitStructuredLog = (
    level: LogLevel,
    message: string,
    args: unknown[],
): void => {
    const record = {
        level,
        timestamp: timestamp(),
        worker: process.env.WORKER_NAME,
        requestId: getRequestId(),
        message,
        meta: buildMeta(args),
    };
    // JSON.stringify は値が undefined のキーを自動的に省略するため、
    // meta が無い呼び出しでは `meta` キー自体が出力されない。
    console.log(JSON.stringify(record));
};

/**
 * レベルに応じた `console.*` を呼び出す。
 *
 * `spyOn(console, 'xxx')` によるテストの差し替えを反映できるよう、モジュール
 * ロード時に関数参照を束縛（`bind`）せず、呼び出しのたびに `console.xxx` を
 * 動的に参照する。
 * @param level - ログレベル
 * @param formattedMessage - `[LEVEL] timestamp message` 形式のメッセージ
 * @param args - 補足情報（そのまま可変長引数として渡す）
 */
const callConsoleByLevel = (
    level: LogLevel,
    formattedMessage: string,
    args: unknown[],
): void => {
    if (level === 'DEBUG') {
        console.debug(formattedMessage, ...args);
        return;
    }
    if (level === 'WARN') {
        console.warn(formattedMessage, ...args);
        return;
    }
    if (level === 'ERROR') {
        console.error(formattedMessage, ...args);
        return;
    }
    console.log(formattedMessage, ...args);
};

/**
 * 可読テキスト形式（`[LEVEL] timestamp message`）でログを出力する。
 * @param level - ログレベル
 * @param message - ログメッセージ
 * @param args - 補足情報（そのまま可変長引数として渡す）
 */
const emitTextLog = (
    level: LogLevel,
    message: string,
    args: unknown[],
): void => {
    callConsoleByLevel(level, `[${level}] ${timestamp()} ${message}`, args);
};

/**
 * ログ出力の共通経路。JSON構造化ログが有効なら JSON を、そうでなければ
 * 従来の可読テキスト形式を出力する。
 * @param level - ログレベル
 * @param message - ログメッセージ
 * @param args - 補足情報
 */
const emitLog = (level: LogLevel, message: string, args: unknown[]): void => {
    if (isStructuredLoggingEnabled()) {
        emitStructuredLog(level, message, args);
        return;
    }
    emitTextLog(level, message, args);
};

export const appLogger = {
    debug: (message: string, ...args: unknown[]): void => {
        if (!isDebugLoggingEnabled()) {
            return;
        }

        emitLog('DEBUG', message, args);
    },
    info: (message: string, ...args: unknown[]): void => {
        emitLog('INFO', message, args);
    },
    warn: (message: string, ...args: unknown[]): void => {
        emitLog('WARN', message, args);
    },
    error: (message: string, ...args: unknown[]): void => {
        emitLog('ERROR', message, args);
    },
};
