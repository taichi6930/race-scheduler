/**
 * @file リクエスト相関ID（request id）ユーティリティ（OBS-004）
 *
 * 並行リクエスト下ではログが交錯し、1件のリクエストに関するログ行だけを
 * 追いにくい問題があった。`AsyncLocalStorage` でリクエストごとの相関IDを
 * 保持し、`appLogger` の JSON構造化ログ（OBS-001）にも自動的に含めることで、
 * Cloudflare Workers Logs 上で `requestId` フィールドによる絞り込みができる
 * ようにする。
 *
 * Hono フレームワークには依存させず（`core` は Hono を利用しない `batch` の
 * CLI からも参照されるため）、`node:async_hooks` の `AsyncLocalStorage` のみを
 * 使う。Hono ミドルウェアとしての結線は各 Worker の `router.ts` 側で行う
 * （`cacheControl.ts` 等と同じ「core は純ロジック、フレームワーク結線は呼び出し側」
 * という方針を踏襲）。
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const requestIdStorage = new AsyncLocalStorage<string>();

/** リクエストIDとして許容する文字種・最大長（ヘッダー経由の外部入力を軽く検証する） */
const REQUEST_ID_MAX_LENGTH = 255;
const REQUEST_ID_PATTERN = /^[\w-]+$/;

/**
 * リクエストID候補が空でないかどうかを判定する。
 * 呼び出し側にインライン展開すると複合条件（&&）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param candidate - `X-Request-Id` ヘッダー等から取得した値（無ければ `undefined`）
 * @returns 非空の文字列であれば true
 */
const isNonEmpty = (
    candidate: string | null | undefined,
): candidate is string =>
    candidate !== null && candidate !== undefined && candidate.length > 0;

/**
 * リクエストID候補の長さが上限以内かどうかを判定する。
 * @param candidate - 判定対象の文字列
 * @returns 上限以内であれば true
 */
const isWithinMaxLength = (candidate: string): boolean =>
    candidate.length <= REQUEST_ID_MAX_LENGTH;

/**
 * 受信ヘッダー由来のリクエストID候補が、そのまま採用してよい形式かどうかを判定する。
 * @param candidate - `X-Request-Id` ヘッダー等から取得した値（無ければ `undefined`）
 * @returns 妥当な形式であれば true
 */
const isValidRequestId = (
    candidate: string | null | undefined,
): candidate is string => {
    if (!isNonEmpty(candidate)) {
        return false;
    }
    if (!isWithinMaxLength(candidate)) {
        return false;
    }
    return REQUEST_ID_PATTERN.test(candidate);
};

/**
 * 受信リクエストのリクエストIDを解決する。
 *
 * 上流（batch から api を呼ぶ場合等）が `X-Request-Id` を伝搬してきていれば
 * それをそのまま引き継ぎ、無ければ新規に生成する。これにより、複数 Worker を
 * またぐ呼び出し連鎖も同じIDで相関付けられる。
 * @param headerValue - `X-Request-Id` リクエストヘッダーの値（無ければ `undefined`）
 * @returns 採用するリクエストID
 */
export const resolveRequestId = (
    headerValue: string | null | undefined,
): string => {
    if (isValidRequestId(headerValue)) {
        return headerValue;
    }
    return crypto.randomUUID();
};

/**
 * 指定したリクエストIDを `AsyncLocalStorage` に紐付けた状態で `fn` を実行する。
 * `fn` から呼ばれる非同期処理（`await` を挟んだ先も含む）全体で
 * `getRequestId()` により同じIDを参照できる。
 * @param requestId - 紐付けるリクエストID
 * @param fn - この呼び出しスコープ内で実行する処理
 * @returns `fn` の戻り値
 */
export const runWithRequestId = <T>(requestId: string, fn: () => T): T =>
    requestIdStorage.run(requestId, fn);

/**
 * 現在の非同期実行コンテキストに紐付いたリクエストIDを取得する。
 * `runWithRequestId` のスコープ外（バッチCLI等）から呼ばれた場合は `undefined`。
 * @returns リクエストID、紐付けが無ければ `undefined`
 */
export const getRequestId = (): string | undefined =>
    requestIdStorage.getStore();

const internalServiceCallStorage = new AsyncLocalStorage<boolean>();

/**
 * サービス間認証済みの呼び出し（batch→scraping→api等、外部非公開の内部呼び出し）
 * かどうかを、このスコープ内の非同期処理全体（`await` を挟んだ先も含む）に
 * 紐付けて実行する。500応答へエラー詳細を含めてよいかどうかの判定
 * （`resolveInternalErrorMessage`、SEC-017の例外）に使う。
 * @param isInternal - サービス間認証済みなら true
 * @param fn - このスコープ内で実行する処理
 * @returns `fn` の戻り値
 */
export const runWithInternalServiceCall = <T>(
    isInternal: boolean,
    fn: () => T,
): T => internalServiceCallStorage.run(isInternal, fn);

/**
 * 現在の非同期実行コンテキストがサービス間認証済みの呼び出しかどうかを返す。
 * 紐付けが無ければ `false`（公開エンドポイント・CLI・ユニットテスト等での
 * 直接呼び出しでは、安全側＝汎用メッセージのままになる既定値）。
 * @returns サービス間認証済みの呼び出しなら true
 */
export const isInternalServiceCall = (): boolean =>
    internalServiceCallStorage.getStore() ?? false;

const currentUserIdStorage = new AsyncLocalStorage<string>();

/**
 * セッション認証済みリクエストの呼び出し元ユーザーIDを、このスコープ内の
 * 非同期処理全体（`await` を挟んだ先も含む）に紐付けて実行する。
 * `player_watch`/`favorite` 等のuser単位データへのアクセス範囲を、
 * repository層が `getCurrentUserId()` を通じてクライアント入力に依存せず
 * 決定できるようにする（クライアントが送るuserIdを信用しない設計、
 * IDOR対策・SECURITY-08）。
 * @param userId - 紐付けるユーザーID（session認証ミドルウェアが検証済みの値）
 * @param fn - このスコープ内で実行する処理
 * @returns `fn` の戻り値
 */
export const runWithCurrentUserId = <T>(userId: string, fn: () => T): T =>
    currentUserIdStorage.run(userId, fn);

/**
 * 現在の非同期実行コンテキストに紐付いた認証済みユーザーIDを取得する。
 * セッション認証ミドルウェアのスコープ外（サービス間認証のみの呼び出し・
 * CLI・ユニットテスト等）から呼ばれた場合は `undefined`。
 * @returns ユーザーID、紐付けが無ければ `undefined`
 */
export const getCurrentUserId = (): string | undefined =>
    currentUserIdStorage.getStore();
