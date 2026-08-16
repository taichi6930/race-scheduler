/**
 * Calendar Worker ルーティング定義
 *
 * メインAPI（@race-schedule/api）のレース・カレンダーフラグ情報を取得し、
 * Google Calendar への同期を担う。
 *
 * エンドポイント:
 * - GET  /health  ヘルスチェック
 * - POST /sync    メインAPIのレース・フラグ情報をGoogle Calendarへ同期
 * @module router
 */

import './di';

import {
    bodyLimitMiddleware,
    EnvStore,
    getAllowedOrigins,
    logInternalError,
    requireServiceAuth,
    resolveRequestId,
    runWithRequestId,
    type ServiceAuthExemptRoute,
    securityHeadersMiddleware,
} from '@race-schedule/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { container } from 'tsyringe';

import { CalendarSyncController } from './controller/calendarSyncController';

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
function registerRequestIdMiddleware(router: Hono): void {
    router.use('*', async (c, next) => {
        const requestId = resolveRequestId(c.req.header(REQUEST_ID_HEADER));
        c.header(REQUEST_ID_HEADER, requestId);
        await runWithRequestId(requestId, next);
    });
}

/**
 * CORS ミドルウェアを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerCorsMiddleware(router: Hono): void {
    router.use(
        '*',
        cors({
            origin: (origin) => {
                const allowedOrigins = getAllowedOrigins();
                if (allowedOrigins.includes('*')) return '*';
                return allowedOrigins.includes(origin) ? origin : '';
            },
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type'],
        }),
    );
}

/**
 * サービス間認証を免除するルート一覧。calendar は batch からのみ呼ばれる
 * サーバー間APIのため、公開が必要なのはヘルスチェックのみ
 * （service-auth-design.md §4.5）。
 */
export const SERVICE_AUTH_EXEMPT_ROUTES: readonly ServiceAuthExemptRoute[] = [
    { method: 'OPTIONS', path: '*', reason: 'cors-preflight' },
    { method: 'GET', path: '/health', reason: 'monitoring' },
];

/**
 * サービス間認証ミドルウェアを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerServiceAuthMiddleware(router: Hono): void {
    router.use('*', requireServiceAuth(SERVICE_AUTH_EXEMPT_ROUTES));
}

/**
 * リクエストボディサイズ制限（1MB、SEC-029）ミドルウェアを登録する。
 * PERF-049: ボディを持たない GET/HEAD/OPTIONS には適用せず、ボディを受け取りうる
 * POST/PUT/DELETE のみに絞り込む。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerBodyLimitMiddleware(router: Hono): void {
    router.on(['POST', 'PUT', 'DELETE'], '*', bodyLimitMiddleware());
}

/**
 * セキュリティヘッダーミドルウェアを登録する（SEC-031）。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerSecurityHeadersMiddleware(router: Hono): void {
    router.use('*', securityHeadersMiddleware());
}

/**
 * ヘルスチェックルートを登録する。
 *
 * QAPI-07: calendarが直接持つ依存は無く、主な依存はapiへの外部HTTP呼び出しと
 * Google Calendar APIのみ。ここで疎通確認すると、他システムが落ちているだけで
 * calendarのヘルスチェックまで巻き添えで赤くなり、監視の呼び出しがその都度
 * 追加リクエストを発生させる呼び出し増幅源になるため、意図的に浅い実装
 * （無条件200）のままにしている（`packages/api/src/router.ts`のD1 pingと
 * 対称的に、calendar自身が直接持つ依存が無いための判断。batchと同じ方針）。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerHealthRoute(router: Hono): void {
    // QAPI-06: 4 Worker横断でJSON形状を揃える
    router.get('/health', (c: Context) => {
        return c.json({ status: 'ok', package: 'calendar' }, 200);
    });
}

/**
 * カレンダー同期ルートを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerSyncRoute(router: Hono): void {
    router.post('/sync', async (c: Context) => {
        try {
            EnvStore.setEnv(c.env);
            const controller = container.resolve(CalendarSyncController);
            const body: unknown = await c.req.json();
            return await controller.sync(body);
        } catch (error) {
            return c.json(
                logInternalError('Calendar sync request failed', error),
                500,
            );
        }
    });
}

/**
 * Hono ルーターを構築する。
 * ルート登録（副作用）を関数内へ閉じ込め、no-top-level-side-effects を満たす。
 * @returns 構築済みの Hono ルーター
 */
function buildRouter(): Hono {
    const router = new Hono();

    registerRequestIdMiddleware(router);
    registerCorsMiddleware(router);
    registerServiceAuthMiddleware(router);
    registerBodyLimitMiddleware(router);
    registerSecurityHeadersMiddleware(router);
    registerHealthRoute(router);
    registerSyncRoute(router);

    return router;
}

/**
 * Calendar ルーティング定義ファイル
 */
export const router = buildRouter();
