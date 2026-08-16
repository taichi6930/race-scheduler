/**
 * Batch Worker ルーティング定義
 *
 * HTTP API 経由でバッチ処理をトリガーします。
 * スクレイピング API からデータを取得し、メイン API に登録します。
 *
 * エンドポイント:
 * - GET  /health         ヘルスチェック
 * - POST /batch/trigger  batch実行をトリガー（Cloudflare Workflowインスタンスを作成、
 *   CICD-73/CONC-03でbatch-all cron・batch-race/place/calendar手動の4経路を統合）
 * @module router
 */

import {
    bodyLimitMiddleware,
    type CloudFlareEnv,
    EnvStore,
    getAllowedOrigins,
    logInternalError,
    type RaceType,
    requireServiceAuth,
    resolveRequestId,
    runWithRequestId,
    type ServiceAuthExemptRoute,
    securityHeadersMiddleware,
    validateRaceType,
} from '@race-schedule/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import { acquireBatchLock, releaseBatchLock } from './client/batchLock';
import type { BatchExecTarget } from './types';
import {
    dateRangeErrorMessage,
    getMaxRangeDays,
    validateDateRange,
    validRaceTypesMessage,
} from './validation';
import { ALL_RACE_TYPES_FOR_BATCH } from './workflows/raceTypes';

/** place/race/calendarの全ターゲット（targets省略時の既定値、cron相当）。 */
const ALL_EXEC_TARGETS: BatchExecTarget[] = ['place', 'race', 'calendar'];

/**
 * バッチ実行トリガーのリクエストボディスキーマ（CICD-73/CONC-03）。
 * batch-all（cron）・batch-race/place/calendar（手動）の4つの起動経路を
 * このエンドポイントへ統合するため、各フィールドは全て省略可能で、
 * 省略時はcron相当（全raceType・全target・Workflow内部で計算する日付レンジ）
 * にフォールバックする。
 */
const BatchTriggerRequestSchema = z.object({
    raceTypes: z.array(z.string()).optional(),
    targets: z.array(z.enum(['place', 'race', 'calendar'])).optional(),
    startDate: z.string().optional(),
    finishDate: z.string().optional(),
});

/** 検証に失敗したときに返す HTTP エラーレスポンス（ステータス + ボディ）。 */
interface BatchErrorResponse {
    kind: 'error';
    status: 400;
    body: { error: string; message?: string };
}

/** 検証に成功したトリガーリクエスト（省略されたフィールドはundefinedのまま保持する）。 */
interface ValidatedBatchTriggerRequest {
    kind: 'ok';
    raceTypes: RaceType[] | undefined;
    targets: BatchExecTarget[] | undefined;
    startDate: string | undefined;
    finishDate: string | undefined;
}

/**
 * エラーレスポンスを組み立てるファクトリ。
 * @param error error フィールドの値
 * @param message message フィールドの値
 * @returns BatchErrorResponse
 */
const errorResponse = (error: string, message: string): BatchErrorResponse => ({
    kind: 'error',
    status: 400,
    body: { error, message },
});

/** startDate/finishDateの形式（YYYY-MM-DD）検証用パターン。 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** raceTypes検証結果。 */
interface ValidatedRaceTypesField {
    kind: 'ok';
    raceTypes: RaceType[] | undefined;
}

/**
 * raceTypes（文字列配列、省略可）を検証し、RaceType[]へ変換する。
 * @param raceTypesRaw リクエストボディのraceTypes（省略時undefined）
 * @returns 検証済みのraceTypes、または失敗時のエラーレスポンス
 */
const validateRaceTypesField = (
    raceTypesRaw: string[] | undefined,
): ValidatedRaceTypesField | BatchErrorResponse => {
    if (raceTypesRaw === undefined) {
        return { kind: 'ok', raceTypes: undefined };
    }
    const raceTypes: RaceType[] = [];
    for (const raw of raceTypesRaw) {
        try {
            raceTypes.push(validateRaceType(raw));
        } catch {
            return errorResponse(
                'Bad Request',
                `Invalid raceType: ${raw}. ${validRaceTypesMessage()}`,
            );
        }
    }
    return { kind: 'ok', raceTypes };
};

/** startDate/finishDate検証結果（両方省略、または両方YYYY-MM-DD指定のいずれか）。 */
type ValidatedDateFields =
    | { kind: 'ok'; startDate: string; finishDate: string }
    | { kind: 'ok'; startDate: undefined; finishDate: undefined };

/**
 * startDate/finishDate（ともに省略、またはともにYYYY-MM-DD指定のいずれかのみ許可）を検証する。
 * ガード節をネストさせることで、複合条件（&&/||）を書かずにTSの型narrowingを効かせている
 * （local/no-compound-condition。単純な `if (a === undefined && b === undefined)` は
 * 検出対象だが、ネストしたガード節はロジック上等価かつ検出対象外）。
 * @param startDate リクエストボディのstartDate（省略時undefined）
 * @param finishDate リクエストボディのfinishDate（省略時undefined）
 * @returns 検証済みのstartDate/finishDate、または失敗時のエラーレスポンス
 */
const validateDateFieldsField = (
    startDate: string | undefined,
    finishDate: string | undefined,
): ValidatedDateFields | BatchErrorResponse => {
    const providedTogetherError = errorResponse(
        'Bad Request',
        'startDate and finishDate must be provided together',
    );

    if (startDate === undefined) {
        if (finishDate === undefined) {
            return { kind: 'ok', startDate: undefined, finishDate: undefined };
        }
        return providedTogetherError;
    }
    if (finishDate === undefined) {
        return providedTogetherError;
    }

    if (!DATE_PATTERN.test(startDate)) {
        return errorResponse(
            'Bad Request',
            'startDate and finishDate must be YYYY-MM-DD',
        );
    }
    if (!DATE_PATTERN.test(finishDate)) {
        return errorResponse(
            'Bad Request',
            'startDate and finishDate must be YYYY-MM-DD',
        );
    }
    return { kind: 'ok', startDate, finishDate };
};

/**
 * 指定された全raceType×targetの組み合わせで日付レンジ上限（cli.ts/既存/batch/
 * エンドポイントと共通のvalidateDateRange/getMaxRangeDays）を検証する。
 * startDate/finishDateが明示指定された場合（手動トリガー相当）のみ呼ばれる
 * （省略時はWorkflow内部で計算する既定レンジを使うため対象外）。
 * @param startDate 検証済みのstartDate
 * @param finishDate 検証済みのfinishDate
 * @param raceTypes 対象raceType（呼び出し側で解決済みの値）
 * @param targets 対象ターゲット（呼び出し側で解決済みの値）
 * @returns 最初に検出した違反のエラーレスポンス、または問題なければundefined
 */
const validateDateRangeForCombinations = (
    startDate: string,
    finishDate: string,
    raceTypes: RaceType[],
    targets: BatchExecTarget[],
): BatchErrorResponse | undefined => {
    for (const raceType of raceTypes) {
        for (const target of targets) {
            const maxDays = getMaxRangeDays(target, raceType);
            const result = validateDateRange(startDate, finishDate, maxDays);
            if (!result.valid) {
                return errorResponse(
                    'Bad Request',
                    dateRangeErrorMessage(result.reason, maxDays),
                );
            }
        }
    }
    return;
};

/**
 * startDate/finishDateが両方指定されている場合のみ日付レンジ上限を検証する
 * （省略時はWorkflow内部で計算する既定レンジを使うため対象外）。
 * `ValidatedDateFields` は両方 undefined か両方 string の判別共用体のため、
 * `startDate` の undefined 判定1つで `finishDate` 側も string へ narrow される
 * （複合条件を書く必要も、到達不能な二重ガード節も発生しない）。
 * @param datesResult 検証済みのstartDate/finishDate
 * @param raceTypes 対象raceType（解決済み、未指定時は呼び出し側で埋める）
 * @param targets 対象ターゲット（schemaのまま、未指定時は呼び出し側で埋める）
 * @returns 検証エラー、または問題なければundefined
 */
const validateRangeIfDatesProvided = (
    datesResult: ValidatedDateFields,
    raceTypes: RaceType[] | undefined,
    targets: BatchExecTarget[] | undefined,
): BatchErrorResponse | undefined => {
    if (datesResult.startDate === undefined) {
        return;
    }
    return validateDateRangeForCombinations(
        datesResult.startDate,
        datesResult.finishDate,
        raceTypes ?? ALL_RACE_TYPES_FOR_BATCH,
        targets ?? ALL_EXEC_TARGETS,
    );
};

/**
 * リクエストボディを検証する。
 * @param body 未検証のJSONボディ
 * @returns 検証済みリクエスト、または最初に失敗した検証のエラーレスポンス
 */
const validateBatchTriggerRequest = (
    body: unknown,
): ValidatedBatchTriggerRequest | BatchErrorResponse => {
    const parsed = BatchTriggerRequestSchema.safeParse(body);
    if (!parsed.success) {
        return errorResponse('Bad Request', 'Invalid JSON body');
    }

    const raceTypesResult = validateRaceTypesField(parsed.data.raceTypes);
    if (raceTypesResult.kind === 'error') {
        return raceTypesResult;
    }

    const datesResult = validateDateFieldsField(
        parsed.data.startDate,
        parsed.data.finishDate,
    );
    if (datesResult.kind === 'error') {
        return datesResult;
    }

    const rangeError = validateRangeIfDatesProvided(
        datesResult,
        raceTypesResult.raceTypes,
        parsed.data.targets,
    );
    if (rangeError) {
        return rangeError;
    }

    return {
        kind: 'ok',
        raceTypes: raceTypesResult.raceTypes,
        targets: parsed.data.targets,
        startDate: datesResult.startDate,
        finishDate: datesResult.finishDate,
    };
};

/**
 * リクエストJSONをパースする。
 * @param c Hono コンテキスト
 * @returns パース済みJSON、またはパース失敗時の400レスポンス
 */
const parseTriggerRequestJson = async (
    c: Context<{ Bindings: CloudFlareEnv }>,
): Promise<{ json: unknown } | { errorResponse: Response }> => {
    try {
        return { json: await c.req.json() };
    } catch {
        return {
            errorResponse: c.json(
                { error: 'Bad Request', message: 'Invalid JSON body' },
                400,
            ),
        };
    }
};

/**
 * batch実行ロック（api Worker `/internal/batch-lock/acquire`）の取得を試みる。
 * @param c Hono コンテキスト
 * @param instanceId 取得を試みるWorkflowインスタンスID
 * @returns 取得できなければ409、例外時は500のレスポンス。取得できればundefined
 */
const acquireLockOrErrorResponse = async (
    c: Context<{ Bindings: CloudFlareEnv }>,
    instanceId: string,
): Promise<{ errorResponse: Response } | undefined> => {
    let lockResult: Awaited<ReturnType<typeof acquireBatchLock>>;
    try {
        lockResult = await acquireBatchLock(instanceId);
    } catch (error) {
        return {
            errorResponse: c.json(
                logInternalError('Batch lock acquisition failed:', error),
                500,
            ),
        };
    }
    if (!lockResult.acquired) {
        return {
            errorResponse: c.json(
                { error: 'Conflict', message: '他のbatch実行が進行中です' },
                409,
            ),
        };
    }
    return;
};

/**
 * Cloudflare Workflowインスタンスを作成する。
 * 失敗時は取得済みのロックを保持したまま放置しないよう解放する
 * （releaseの失敗自体は致命的ではないため、元のエラーをそのまま返す）。
 * @param c Hono コンテキスト
 * @param workflowBinding `env.BATCH_ALL_WORKFLOW`（未設定でないことを呼び出し側で確認済み）
 * @param instanceId 作成するWorkflowインスタンスID（取得済みロックのID）
 * @param validated 検証済みトリガーリクエスト
 * @returns 202（作成成功）、または500（作成失敗）のレスポンス
 */
const createWorkflowInstanceOrErrorResponse = async (
    c: Context<{ Bindings: CloudFlareEnv }>,
    workflowBinding: NonNullable<CloudFlareEnv['BATCH_ALL_WORKFLOW']>,
    instanceId: string,
    validated: ValidatedBatchTriggerRequest,
): Promise<Response> => {
    try {
        const instance = await workflowBinding.create({
            id: instanceId,
            params: {
                raceTypes: validated.raceTypes,
                targets: validated.targets,
                startDate: validated.startDate,
                finishDate: validated.finishDate,
            },
        });
        return c.json({ success: true, instanceId: instance.id }, 202);
    } catch (error) {
        await releaseBatchLock(instanceId).catch(() => undefined);
        return c.json(
            logInternalError('Workflow instance creation failed:', error),
            500,
        );
    }
};

/**
 * batch実行トリガーエンドポイントのハンドラ本体（CICD-73/CONC-03）。
 * batch-all（cron）・batch-race/place/calendar（手動）の4つの起動経路を
 * このエンドポイントへ統合する。api Worker（`/internal/batch-lock/acquire`）の
 * 排他制御ロックを取得できた場合のみCloudflare Workflowインスタンスを作成し、
 * 202を返す（Workflow自体は非同期実行のため完了を待たない。実際の実行結果は
 * Workflowが自身の完了時にロックを解放することでのみ観測できる）。
 *
 * リクエストボディ（全フィールド省略可、省略時はcron相当）:
 * - raceTypes: 対象レース種別の配列（省略時: 全種別）
 * - targets: 対象ターゲットの配列（place/race/calendar、省略時: 全て）
 * - startDate/finishDate: 日付レンジ（YYYY-MM-DD、両方セットで指定。省略時はWorkflow内で計算）
 * @param c Hono コンテキスト
 * @returns トリガー結果、またはパース/検証/ロック競合/実行エラーのレスポンス
 */
const handleBatchTriggerPost = async (
    c: Context<{ Bindings: CloudFlareEnv }>,
): Promise<Response> => {
    // Worker 環境変数を EnvStore に設定（getApiConfig() / acquireBatchLock() が参照する）
    EnvStore.setEnv(c.env);

    const parsed = await parseTriggerRequestJson(c);
    if ('errorResponse' in parsed) {
        return parsed.errorResponse;
    }

    const validated = validateBatchTriggerRequest(parsed.json);
    if (validated.kind === 'error') {
        return c.json(validated.body, validated.status);
    }

    const workflowBinding = c.env.BATCH_ALL_WORKFLOW;
    if (!workflowBinding) {
        return c.json(
            {
                error: 'Internal Server Error',
                message: 'BATCH_ALL_WORKFLOW binding is not configured',
            },
            500,
        );
    }

    const instanceId = crypto.randomUUID();
    const lockError = await acquireLockOrErrorResponse(c, instanceId);
    if (lockError) {
        return lockError.errorResponse;
    }

    return createWorkflowInstanceOrErrorResponse(
        c,
        workflowBinding,
        instanceId,
        validated,
    );
};

/**
 * 現在の `getAllowedOrigins()` の結果に基づく cors() ミドルウェアを構築する。
 * @returns 構築した cors() ミドルウェア
 */
const buildBatchCorsMiddleware = (): ReturnType<typeof cors> => {
    const allowedOrigins = getAllowedOrigins();
    return cors({
        origin: (origin) => {
            // CORS_ALLOWED_ORIGINS='*' の場合のみ全オリジン許可（テスト用途）
            if (allowedOrigins.includes('*')) return '*';
            return allowedOrigins.includes(origin) ? origin : '';
        },
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
    });
};

/**
 * CORS_ALLOWED_ORIGINS の解決結果が変わらない限り cors() を再構築しないミドルウェアを
 * 返すファクトリ。api の `createCachedCorsMiddleware` と同じキャッシュパターン（PERF-048）。
 * batch は c.env ではなく process.env のみを見るため、キーは process.env の値のみでよい。
 * @returns 呼び出す度に最新（またはキャッシュ済み）の cors() ミドルウェアを返す関数
 */
const createCachedCorsMiddleware = () => {
    let cachedKey: string | undefined;
    let cachedMiddleware: ReturnType<typeof cors> | undefined;

    return (): ReturnType<typeof cors> => {
        const key = process.env.CORS_ALLOWED_ORIGINS ?? '';

        // 未構築（初回リクエスト）ならここで構築して早期 return する。
        // 以降 cachedMiddleware は undefined ではないと TS に narrow させるための
        // ガード節（複合条件を避け、単純な条件を 2 つに分ける。api と同じパターン）。
        if (cachedMiddleware === undefined) {
            cachedMiddleware = buildBatchCorsMiddleware();
            cachedKey = key;
            return cachedMiddleware;
        }

        if (key !== cachedKey) {
            cachedMiddleware = buildBatchCorsMiddleware();
            cachedKey = key;
        }

        return cachedMiddleware;
    };
};

const getCachedCorsMiddleware = createCachedCorsMiddleware();

/**
 * サービス間認証を免除するルート一覧。batch の `POST /batch/trigger` は
 * GitHub Actions（batch-all/race/place/calendar.yml）専用のサーバー間APIのため、
 * 公開が必要なのはヘルスチェックのみ（service-auth-design.md §4.5）。
 */
export const SERVICE_AUTH_EXEMPT_ROUTES: readonly ServiceAuthExemptRoute[] = [
    { method: 'OPTIONS', path: '*', reason: 'cors-preflight' },
    { method: 'GET', path: '/health', reason: 'monitoring' },
];

/** リクエスト相関ID（OBS-004）をやり取りする HTTP ヘッダー名 */
const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * リクエスト相関ID（OBS-004）を解決し、レスポンスヘッダーへの付与と
 * 後続処理（ログ出力含む）への伝搬を行うミドルウェアを登録する。
 * 並行リクエストでログが交錯しても `appLogger` の JSON構造化ログ（OBS-001）に
 * 含まれる `requestId` で1リクエスト分だけを追跡できるようにするため、
 * 他のミドルウェアより先に登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerRequestIdMiddleware = (router: Hono): void => {
    router.use('*', async (c, next) => {
        const requestId = resolveRequestId(c.req.header(REQUEST_ID_HEADER));
        c.header(REQUEST_ID_HEADER, requestId);
        await runWithRequestId(requestId, next);
    });
};

/**
 * Hono アプリケーション
 */
export const router = buildRouter();

/**
 * Hono ルーターを構築する
 * @returns 構築済みの Hono ルーター
 */
function buildRouter(): Hono {
    const router = new Hono();

    registerRequestIdMiddleware(router);

    // CORS 設定
    // core の getAllowedOrigins（CORS_ALLOWED_ORIGINS 環境変数によるホワイトリスト）を
    // 再利用し、api と同様にデフォルトで全許可にならないようにする。
    // PERF-048: api の createCachedCorsMiddleware と同じキャッシュパターンを適用し、
    // CORS_ALLOWED_ORIGINS の解決結果が変わらない限り getAllowedOrigins() の
    // 再計算・cors() ミドルウェアの再構築を避ける。
    router.use('*', (c, next) => getCachedCorsMiddleware()(c, next));

    router.use('*', requireServiceAuth(SERVICE_AUTH_EXEMPT_ROUTES));

    // リクエストボディサイズ制限（1MB、SEC-029）
    router.on(['POST', 'PUT', 'DELETE'], '*', bodyLimitMiddleware());

    // セキュリティヘッダー（SEC-031）
    router.use('*', securityHeadersMiddleware());

    // ヘルスチェック（QAPI-06: 4 Worker横断でJSON形状を揃える）。
    // QAPI-07: batchが直接持つ依存は無く、主な依存はapi/scraping/calendarへの
    // 外部HTTP呼び出しのみ。ここで疎通確認すると、他Workerが落ちているだけで
    // batchのヘルスチェックまで巻き添えで赤くなり、かつ監視の呼び出し（uptime-check
    // 等）がその都度3 Worker分の追加リクエストを発生させる呼び出し増幅源になる
    // ため、意図的に浅い実装（無条件200）のままにしている（api側のD1 pingと
    // 対称的に、batch/calendar自身が直接持つ依存が無いための判断）。
    router.get('/health', (c: Context) => {
        return c.json({ status: 'ok', package: 'batch' }, 200);
    });

    router.post('/batch/trigger', handleBatchTriggerPost);

    return router;
}
