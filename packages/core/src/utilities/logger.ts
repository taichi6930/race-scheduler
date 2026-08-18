/**
 * @LogAllMethods クラスレベルデコレータ
 * - クラスのすべての非同期メソッドに自動でログ出力を適用
 * - メソッド単位の @Logger デコレータは不要になる
 *
 * 使用例：
 *   @LogAllMethods
 *   class PlaceUsecase {
 *     async fetch() { ... }
 *     async upsert() { ... }
 *   }
 */

import { appLogger } from './appLogger';
import { toJstISOString } from './dateJst';
import { sanitizeError } from './sanitizeLog';

/**
 * ログ出力用のタイムスタンプ文字列（`yyyy-MM-dd HH:mm:ss`、JST基準）を生成する。
 *
 * 従来は date-fns の `format(new Date(), 'yyyy-MM-dd HH:mm:ss')` を毎回呼び出していたが、
 * @LogAllMethods は1メソッド呼び出しあたり最低2回（開始・終了）呼ばれるため、
 * date-fns のパース・フォーマットコストが1リクエストあたり最低8回以上積み重なっていた
 * （PERF-053）。既に最適化済みの toJstISOString（Intl.DateTimeFormat の formatToParts を
 * 1回呼び出すだけの軽量実装）を再利用し、区切り文字だけ人間可読な表記に変換する。
 * @param date - フォーマット対象の日時
 * @returns `yyyy-MM-dd HH:mm:ss` 形式（JST基準）の文字列
 */
const formatLogTimestamp = (date: Date): string =>
    toJstISOString(date).replace('T', ' ').replace('+09:00', '');

/**
 * ログ出力に必要なコンテキスト（クラス名・メソッド名・抑制フラグ）。
 * logStart/logEnd/logError・wrapAsyncMethod/wrapSyncMethod 間で引き回す
 * 引数をまとめ、各関数の引数リストの肥大化（行数超過）を防ぐ。
 */
interface LogContext {
    constructorName: string;
    propertyName: string;
    shouldSuppressLogs: boolean;
}

/**
 * メソッド開始ログを出力し、経過時間計測の起点となる開始時刻を返す。
 * @param context - ログ出力コンテキスト
 */
function logStart(context: LogContext): number {
    const startTime = Date.now();

    if (!context.shouldSuppressLogs) {
        appLogger.info(
            `${formatLogTimestamp(new Date())} [${context.constructorName}.${context.propertyName}] 開始`,
        );
    }

    return startTime;
}

/**
 * メソッド終了ログ（経過 ms 付き）を出力する。
 *
 * 経過時間は `(150 ms)` のような埋め込み文字列ではなく `{ elapsedMs: 150 }` という
 * 構造化フィールドとして渡す（OBS-019）。JSON構造化ログ（`appLogger`のOBS-001対応）が
 * 有効な実行環境では、これにより Workers Logs 側で `elapsedMs` を数値としてフィルタ・
 * 閾値判定できるようになる（従来はメッセージ文字列に埋め込まれ検索・集計不能だった）。
 * @param context - ログ出力コンテキスト
 * @param startTime - logStart が返した開始時刻
 */
function logEnd(context: LogContext, startTime: number): void {
    const elapsed = Date.now() - startTime;

    if (!context.shouldSuppressLogs) {
        appLogger.info(
            `${formatLogTimestamp(new Date())} [${context.constructorName}.${context.propertyName}] 終了`,
            { elapsedMs: elapsed },
        );
    }
}

/**
 * メソッドのエラーログ（経過 ms 付き）を出力する。
 * @param context - ログ出力コンテキスト
 * @param startTime - logStart が返した開始時刻
 * @param error - 発生したエラー
 */
function logError(
    context: LogContext,
    startTime: number,
    error: unknown,
): void {
    const elapsed = Date.now() - startTime;

    if (!context.shouldSuppressLogs) {
        // 生のエラーには秘密鍵・トークン等が含まれ得るため、
        // sanitizeError で機密フィールドをマスクしてからログ出力する。
        appLogger.error(
            `${formatLogTimestamp(new Date())} [${context.constructorName}.${context.propertyName}] エラー (${elapsed} ms)`,
            sanitizeError(error),
        );
    }
}

/**
 * プロパティがコンストラクタ自身、または getter/setter であるためロギング
 * 対象外かどうかを判定する（descriptor が取得できないケースは呼び出し側で
 * 別途ガード済みであることを前提とする）。
 * `propertyName === 'constructor' || descriptor.get || descriptor.set`
 * という複合条件を独立関数へ切り出し、C2（条件網羅）の組み合わせ爆発を回避する。
 * @param descriptor - 対象プロパティの PropertyDescriptor
 * @param propertyName - 対象プロパティ名
 * @returns ロギング対象外であれば true
 */
const isConstructorOrAccessorProperty = (
    descriptor: PropertyDescriptor,
    propertyName: string,
): boolean =>
    propertyName === 'constructor' || !!descriptor.get || !!descriptor.set;

/** ラップ後のメソッドの型（開始/終了/エラーのログ出力を挟んで元メソッドを呼ぶ）。 */
type LoggedMethod = (this: unknown, ...args: unknown[]) => unknown;

/**
 * async メソッドを、開始/終了(経過ms)/エラーのログ出力で包んだラッパーに差し替える。
 * @param method - ラップ対象の元メソッド
 * @param context - ログ出力コンテキスト
 * @returns ラップ後のメソッド
 */
const wrapAsyncMethod = (
    method: (...args: unknown[]) => unknown,
    context: LogContext,
): LoggedMethod =>
    async function (this: unknown, ...args: unknown[]): Promise<unknown> {
        const startTime = logStart(context);

        try {
            const result = await method.apply(this, args);
            logEnd(context, startTime);
            return result;
        } catch (error) {
            logError(context, startTime, error);
            throw error;
        }
    };

/**
 * sync メソッドを、開始/終了(経過ms)/エラーのログ出力で包んだラッパーに差し替える。
 * sync メソッドを async 関数でラップすると戻り値が Promise 化して挙動が変わるため、
 * wrapAsyncMethod とはロジックは同一のまま関数の同期/非同期という構造だけを分けている。
 * @param method - ラップ対象の元メソッド
 * @param context - ログ出力コンテキスト
 * @returns ラップ後のメソッド
 */
const wrapSyncMethod = (
    method: (...args: unknown[]) => unknown,
    context: LogContext,
): LoggedMethod =>
    function (this: unknown, ...args: unknown[]): unknown {
        const startTime = logStart(context);

        try {
            const result = method.apply(this, args);
            logEnd(context, startTime);
            return result;
        } catch (error) {
            logError(context, startTime, error);
            throw error;
        }
    };

/**
 * メソッドを非同期/同期の判定に応じて適切なラッパーに差し替える。
 * @param method - ラップ対象の元メソッド
 * @param context - ログ出力コンテキスト
 * @returns ラップ後のメソッド
 */
const wrapMethodByKind = (
    method: (...args: unknown[]) => unknown,
    context: LogContext,
): LoggedMethod =>
    method.constructor.name === 'AsyncFunction'
        ? wrapAsyncMethod(method, context)
        : wrapSyncMethod(method, context);

/**
 * prototype 上の 1 プロパティについて、メソッドであればログ出力ラッパーに差し替える。
 * コンストラクタ・getter/setter・関数以外のプロパティは対象外としてスキップする。
 * @param prototype - 対象クラスの prototype
 * @param propertyName - 対象プロパティ名
 * @param context - ログ出力コンテキスト（メソッド名は呼び出し側で上書きする）
 */
const wrapPropertyIfMethod = (
    prototype: Record<PropertyKey, unknown>,
    propertyName: string,
    context: Omit<LogContext, 'propertyName'>,
): void => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);

    if (!descriptor) {
        return;
    }

    // コンストラクタとgetter/setterは対象外
    if (isConstructorOrAccessorProperty(descriptor, propertyName)) {
        return;
    }

    const method = descriptor.value;

    // メソッドか、そして関数であることを確認
    if (typeof method !== 'function') {
        return;
    }

    const wrappedMethod = wrapMethodByKind(method, {
        ...context,
        propertyName,
    });

    Object.defineProperty(prototype, propertyName, {
        ...descriptor,
        value: wrappedMethod,
    });
};

/**
 * Logger decorator for logging method calls
 *
 * ジェネリック制約は `never[]`（引数の反変性によりあらゆる具象クラスの
 * コンストラクタを受け付ける）と `unknown` を用い、`any` を排除している。
 * @param constructor
 */
export function LogAllMethods<T extends new (...args: never[]) => unknown>(
    constructor: T,
): T {
    const context = {
        constructorName: constructor.name,
        shouldSuppressLogs: process.env.NODE_ENV === 'ci_local',
    };

    const prototype = constructor.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propertyName of propertyNames) {
        wrapPropertyIfMethod(prototype, propertyName, context);
    }

    return constructor;
}
