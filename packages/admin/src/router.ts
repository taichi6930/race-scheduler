/**
 * Admin Worker ルーティング定義
 *
 * Cloudflare Access（Zero Trust、ダッシュボード側で手動設定）によりホスト名全体が
 * 保護された運用者専用Worker。管理対象データ（D1）は持たず、メインAPI
 * （`@race-schedule/api`）の `/internal/feature-flags`・`/internal/backfill/*`を
 * サービス間認証（`X-Service-Auth-Token`）付きで呼び出すプロキシとして機能する
 * （admin-package-design.md）。
 *
 * エンドポイント:
 * - GET  /                 /flags へリダイレクト
 * - GET  /health           ヘルスチェック
 * - GET  /flags            機能フラグ管理画面（HTML）
 * - GET  /flags/api        機能フラグ一覧取得
 * - POST /flags/api        機能フラグ更新
 * - GET  /backfill         バックフィル実行画面（HTML）
 * - POST /backfill/api/place  開催場情報のバックフィル実行
 * - POST /backfill/api/race   レース情報のバックフィル実行
 * - GET  /race-detail-layout          レース詳細レイアウト編集キット画面（HTML）
 * - GET  /race-detail-layout/api      レイアウト構成取得
 * - POST /race-detail-layout/api      レイアウト構成保存
 * - POST /race-detail-layout/api/preview  保存せずに解決結果を取得
 * - GET  /race-detail-layout/api/races    プレビュー候補のレース一覧取得
 * - GET  /release-notes            更新履歴（全リポジトリ）一覧画面（HTML）
 * - GET  /release-notes/api        更新履歴一覧取得（非公開リポジトリ分含む）
 * @module router
 */

import './di';

import {
    appLogger,
    bodyLimitMiddleware,
    EnvStore,
    rateLimitMiddleware,
    resolveRequestId,
    runWithRequestId,
    type ServiceAuthExemptRoute,
    securityHeadersMiddleware,
} from '@race-schedule/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { container } from 'tsyringe';

import { BackfillController } from './controller/backfillController';
import {
    renderNotFoundPage,
    renderServerErrorPage,
} from './controller/errorPages';
import { FeatureFlagsController } from './controller/featureFlagsController';
import { RaceDetailLayoutController } from './controller/raceDetailLayoutController';
import { ReleaseNotesController } from './controller/releaseNotesController';
import { isProductionAdmin } from './utility/isProductionAdmin';

/** リクエスト相関ID（OBS-004）をやり取りする HTTP ヘッダー名 */
const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * リクエスト相関ID（OBS-004）を解決し、レスポンスヘッダーへの付与と
 * 後続処理（ログ出力含む）への伝搬を行うミドルウェアを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerRequestIdMiddleware(router: Hono): void {
    router.use('*', async (c, next) => {
        const requestId = resolveRequestId(c.req.header(REQUEST_ID_HEADER));
        c.header(REQUEST_ID_HEADER, requestId);
        await runWithRequestId(requestId, next);
    });
}

/** レート制限で除外するルート一覧（監視用のヘルスチェックのみ）。 */
const RATE_LIMIT_EXEMPT_ROUTES: readonly ServiceAuthExemptRoute[] = [
    { method: 'GET', path: '/health', reason: 'monitoring' },
];

/**
 * IPベースのレート制限ミドルウェアを登録する（Cloudflare Accessに加えた多層防御）。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerRateLimitMiddleware(router: Hono): void {
    router.use('*', rateLimitMiddleware(RATE_LIMIT_EXEMPT_ROUTES));
}

/**
 * リクエストボディサイズ制限（1MB、SEC-029）ミドルウェアを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerBodyLimitMiddleware(router: Hono): void {
    router.on(['POST', 'PUT', 'DELETE'], '*', bodyLimitMiddleware());
}

/**
 * `GET /flags`・`GET /backfill`（管理画面各ページ）向けの緩和したCSP。
 * 外部CDNを一切使わない自己完結ページのため、`'self'`とインラインスクリプト/
 * スタイルの許可のみで済む。
 */
const ADMIN_PAGE_CSP =
    "default-src 'none'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    'img-src data:; ' +
    "connect-src 'self'";

/**
 * セキュリティヘッダーミドルウェアを登録する（SEC-031）。管理画面の各ページのみ
 * CSPを緩和する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerSecurityHeadersMiddleware(router: Hono): void {
    router.use(
        '*',
        securityHeadersMiddleware({
            cspOverrides: new Map([
                ['/flags', ADMIN_PAGE_CSP],
                ['/backfill', ADMIN_PAGE_CSP],
                ['/race-detail-layout', ADMIN_PAGE_CSP],
                ['/release-notes', ADMIN_PAGE_CSP],
            ]),
        }),
    );
}

/**
 * ルート（`/`）を機能フラグ管理画面へリダイレクトする（QADM-06）。
 *
 * admin のホスト名をそのまま開いたとき、Hono既定の素の `404 Not Found` が
 * 最初に表示される画面になっていたため、運用者が最初に見る画面を用意する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerRootRoute(router: Hono): void {
    router.get('/', (c: Context) => c.redirect('/flags'));
}

/**
 * 共通chrome付きの404/500ハンドラを登録する（QADM-07）。
 * テストから直接 `onError` の配線を検証できるよう export する。
 * @param router - 登録対象の Hono アプリケーション
 */
export function registerErrorHandlers(router: Hono): void {
    router.notFound((c: Context) =>
        c.html(renderNotFoundPage(isProductionAdmin()), 404),
    );
    router.onError((error: Error, c: Context) => {
        appLogger.error('admin: 未処理の例外が発生しました', error);
        return c.html(renderServerErrorPage(isProductionAdmin()), 500);
    });
}

/**
 * ヘルスチェックルートを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerHealthRoute(router: Hono): void {
    // QAPI-06: 他Worker横断でJSON形状を揃える
    router.get('/health', (c: Context) =>
        c.json({ status: 'ok', package: 'admin' }, 200),
    );
}

/**
 * 機能フラグ管理のルートを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerFeatureFlagsRoutes(router: Hono): void {
    router.get('/flags', () => {
        const controller = container.resolve(FeatureFlagsController);
        return controller.page();
    });
    router.get('/flags/api', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(FeatureFlagsController);
        return controller.list();
    });
    router.post('/flags/api', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(FeatureFlagsController);
        return controller.update(c.req.raw);
    });
}

/**
 * バックフィル（R2キャッシュのみでの再同期）のルートを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerBackfillRoutes(router: Hono): void {
    router.get('/backfill', () => {
        const controller = container.resolve(BackfillController);
        return controller.page();
    });
    router.post('/backfill/api/place', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(BackfillController);
        return controller.place(c.req.raw);
    });
    router.post('/backfill/api/race', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(BackfillController);
        return controller.race(c.req.raw);
    });
}

/**
 * レース詳細レイアウト編集キットのルートを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerRaceDetailLayoutRoutes(router: Hono): void {
    router.get('/race-detail-layout', () => {
        const controller = container.resolve(RaceDetailLayoutController);
        return controller.page();
    });
    router.get('/race-detail-layout/api', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(RaceDetailLayoutController);
        return controller.get();
    });
    router.post('/race-detail-layout/api', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(RaceDetailLayoutController);
        return controller.save(c.req.raw);
    });
    router.post('/race-detail-layout/api/preview', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(RaceDetailLayoutController);
        return controller.preview(c.req.raw);
    });
    router.get('/race-detail-layout/api/races', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(RaceDetailLayoutController);
        return controller.races();
    });
}

/**
 * 更新履歴（全リポジトリ）閲覧のルートを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
function registerReleaseNotesRoutes(router: Hono): void {
    router.get('/release-notes', () => {
        const controller = container.resolve(ReleaseNotesController);
        return controller.page();
    });
    router.get('/release-notes/api', (c: Context) => {
        EnvStore.setEnv(c.env);
        const controller = container.resolve(ReleaseNotesController);
        return controller.list();
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
    registerRateLimitMiddleware(router);
    registerBodyLimitMiddleware(router);
    registerSecurityHeadersMiddleware(router);
    registerErrorHandlers(router);
    registerHealthRoute(router);
    registerRootRoute(router);
    registerFeatureFlagsRoutes(router);
    registerBackfillRoutes(router);
    registerRaceDetailLayoutRoutes(router);
    registerReleaseNotesRoutes(router);

    return router;
}

/**
 * Admin ルーティング定義ファイル
 */
export const router = buildRouter();
