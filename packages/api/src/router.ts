/**
 * API ルーティング定義ファイル
 *
 * 本ファイルはすべての API エンドポイントを定義します。
 * 各エンドポイントのリクエスト処理を対応するコントローラーにルーティングします。
 * @module router
 * @remarks
 * PERF-047調査結果（レスポンス圧縮）:
 * `hono/compress`（`CompressionStream`によるgzip/deflate圧縮）の導入を検討したが、
 * 見送った。理由:
 * 1. Cloudflare Workersはエッジ（Cloudflareのプロキシ層）を経由してレスポンスを
 *    返すため、Workerが `Content-Encoding` を未設定のまま返せば、リクエストの
 *    `Accept-Encoding` に応じてCloudflare側が自動的にgzip/Brotli圧縮を適用する
 *    （Brotliはgzip/deflateより圧縮率が高いことが多い）。
 * 2. `hono/compress` を導入して明示的に `Content-Encoding` を設定してしまうと、
 *    Cloudflare側は既にエンコード済みと判断して自身の圧縮をスキップするため、
 *    より効率の良いBrotli圧縮の機会を失う可能性がある。
 * 3. `CompressionStream` によるWorker内圧縮はWorker自体のCPU時間を消費するため、
 *    Cloudflareのエッジ層で行われる圧縮（Workerの実行時間に計上されない）と比べて
 *    割に合わない。
 * 上記はCloudflare Workersのプラットフォーム挙動に基づく判断であり、本サンドボックス
 * 環境からは外部ネットワークアクセスができず実機（デプロイ済みtest環境）での
 * `curl -H 'Accept-Encoding: gzip, br' -v` 等による実測はできていない。導入するか
 * どうかの最終判断や実測確認は、デプロイ環境にアクセスできる開発者側で行うことを推奨する。
 */

import './di';

import type {
    CloudFlareEnv,
    ServiceAuthExemptRoute,
} from '@race-schedule/core';
import {
    API_REQUIRED_KEYS,
    appLogger,
    bodyLimitMiddleware,
    EnvStore,
    getAllowedOrigins,
    isCacheableGetResponse,
    isProductionEnvironment,
    rateLimitMiddleware,
    requireServiceAuth,
    resolveRequestId,
    runWithRequestId,
    sanitizeError,
    securityHeadersMiddleware,
} from '@race-schedule/core';
import { Scalar } from '@scalar/hono-api-reference';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { InjectionToken } from 'tsyringe';
import { container } from 'tsyringe';

import { AnnouncementController } from './controller/announcementController';
import { BackfillController } from './controller/backfillController';
import { BatchLockController } from './controller/batchLockController';
import { CalendarController } from './controller/calendarController';
import { DebugController } from './controller/debugController';
import { InternalFeatureFlagsController } from './controller/internalFeatureFlagsController';
import { InternalReleaseNoteController } from './controller/internalReleaseNoteController';
import { InternalUiLayoutController } from './controller/internalUiLayoutController';
import { PlaceController } from './controller/placeController';
import { PlayerController } from './controller/playerController';
import { PushController } from './controller/pushController';
import { RaceController } from './controller/raceController';
import { ReleaseNoteController } from './controller/releaseNoteController';
import { initializeDIForInMemory } from './di';
import { openApiSpec } from './openapi/openApiSpec';
import { createCacheControlMiddleware } from './utility/cacheControl';
import { handleApiError } from './utility/errorHandler';
import { isUseInMemoryDB } from './utility/isUseInMemoryDb';
import { RACE_TYPE_VALUES } from './utility/raceTypeConstants';

/**
 * DI初期化済みフラグ
 */
const _state = { diInitialized: false };

/**
 * 環境に応じたDI初期化（初回リクエスト時）。
 * @remarks
 * Hono の `fetch` ハンドラだけでなく、Cloudflare `scheduled` ハンドラ
 * （`env` 引数はあるが `Context` は無い）からも呼べるよう、
 * `Context` ではなく `env` を直接受け取る。
 * @param env - Cloudflare Workers の環境変数（`c.env` 相当）
 */
export const ensureDIInitialized = (env: CloudFlareEnv): void => {
    if (_state.diInitialized) {
        return;
    }

    // EnvStore に設定（DrizzleGateway など他のコンポーネントでアクセス可能に）
    EnvStore.setEnv(env, API_REQUIRED_KEYS);

    if (isUseInMemoryDB(env)) {
        container.clearInstances();
        initializeDIForInMemory();
    }

    _state.diInitialized = true;
};

/**
 * 読み取り専用エンドポイントに適用する Cache-Control の設定（1エンドポイント分）。
 */
interface CacheTtlConfig {
    /** クライアント側キャッシュ有効期限（秒） */
    maxAgeSeconds: number;
    /** CDN/プロキシ側キャッシュ有効期限（秒） */
    sMaxAgeSeconds: number;
}

/**
 * キャッシュ対象パスごとの Cache-Control 設定。
 * @remarks
 * PERF-036: 従来は全パス一律 60秒/300秒 だったが、エンドポイントごとの実際の
 * 更新頻度に合わせて緩急を付ける。
 * - `/calendar`: ユーザーのフラグ操作（登録・解除）を反映する必要があるため、
 *   従来どおり short-lived (60秒/300秒) を維持する。GET /calendar のレスポンス
 *   自体は `isFlagged`/`isWatched` を含み構造上は `/player`・`/race` と同じ
 *   リスクを抱えるが、現時点でこれを叩くフロント画面が存在しないため実害は無い
 *   （将来カレンダー機能を front に追加する場合は `/race` と同様の見直しが必要）。
 * - `/place`: 開催場情報はレース単位の情報ほど頻繁には変わらないため、
 *   5分/30分に緩和する。ユーザー操作で変わる値を一切含まない。
 * - `/player`・`/race`: 意図的に対象外（CACHE_TTL_BY_PATHには含めず、
 *   `NO_STORE_PATHS` 経由で `Cache-Control: no-store` を個別付与する）。
 *   `/player` は選手・騎手情報自体（氏名・支部・期別）は低頻度データだが、
 *   KPLAYER-07で追加した`priority`（注目選手フラグ、ユーザー操作で随時変わる・
 *   全ユーザー共有の値）が同じレコード・同じエンドポイントに乗っている。
 *   `/race` も同様に、レスポンスへ埋め込む `isWatched`（priority由来）が
 *   `POST /player` 直後に変わる。いずれも当初は`/calendar`と同じ60秒/300秒に
 *   短縮する対応をしたが、それでも「検索→即タップ」「お気に入りトグル→即
 *   タイムライン再取得」という通常の操作フローでは、直後の再取得
 *   （`playerSearchResultsProvider`・`timelineProvider`・
 *   `favoriteRacesRawProvider`のinvalidate）が60秒以内に収まり、操作前に
 *   取得した同一URLのキャッシュをそのまま再利用してしまうレース条件が残って
 *   いた（実機で再現・確認済み）。キャッシュを完全に無効化する影響は、
 *   `/player`は検索ヒット件数・再訪頻度ともに低いため軽微、`/race`は
 *   タイムラインの主要データのため相応のD1負荷増を許容する判断とした。
 *
 * `/calendar/flag`（PERF-034参照）は `/calendar` のワイルドカード登録に
 * 含まれるため、個別のエントリは不要。
 */
const CACHE_TTL_BY_PATH: Record<string, CacheTtlConfig> = {
    '/calendar': { maxAgeSeconds: 60, sMaxAgeSeconds: 300 },
    '/place': { maxAgeSeconds: 300, sMaxAgeSeconds: 1800 },
};

/**
 * ユーザー操作で随時変わる値（priority由来のisWatched等）を含むため、
 * キャッシュを完全に無効化するパス一覧。{@link CACHE_TTL_BY_PATH} とは
 * 排他的に扱う（両方に同じパスを含めないこと）。
 * `/health`（CFCACHE-09）はヘルスチェック用でCache-Controlが一切付いておらず、
 * ヘッダー無しの場合の中間キャッシュの挙動がクライアント/プロキシ実装依存に
 * なるため明示的に無効化する（監視対象なので常に最新状態を返す必要がある）。
 * `/ui`（`/ui/race-detail`等、race-detail-sdui-design.md §1.5）は、将来
 * 管理画面からレイアウト構成を調整した際に、TTL分の遅延無く反映される必要が
 * あるため無効化する。`/ui/announcement`もこの配下に含まれるが、元々
 * Cache-Controlヘッダー無しで運用されていたため挙動に変化は無い。
 */
const NO_STORE_PATHS: readonly string[] = [
    '/player',
    '/race',
    '/health',
    '/ui',
];

/**
 * CORS_ALLOWED_ORIGINS の解決結果から cors() ミドルウェアを構築する。
 *
 * オリジン解決自体（`c.env.CORS_ALLOWED_ORIGINS` 優先・`process.env` フォールバック・
 * デフォルト値・メモ化）は core の `getAllowedOrigins`（batch/scraping/calendar と共通）に
 * 委譲する（refactor#134）。api だけが `c.env`（Workers のリクエスト時バインディング）を
 * 併用する理由は、Hono の `cors()` の `origin` コールバックが `(origin, c)` を受け取り、
 * リクエストごとに再評価されるため。オリジン解決結果ごとのキャッシュは
 * `getAllowedOrigins` 内部のメモ化がそのまま効くため、api 側で別途キャッシュを持つ必要はない。
 * @returns 構築した cors() ミドルウェア
 */
const buildCorsMiddleware = (): ReturnType<typeof cors> =>
    cors({
        origin: (origin, c) => {
            const envOriginsRaw = (
                c.env as { CORS_ALLOWED_ORIGINS?: string } | undefined
            )?.CORS_ALLOWED_ORIGINS;
            const allowedOrigins = getAllowedOrigins(envOriginsRaw);
            // CORS_ALLOWED_ORIGINS='*' の場合のみ全オリジン許可（テスト用途）
            if (allowedOrigins.includes('*')) return '*';
            return allowedOrigins.includes(origin) ? origin : '';
        },
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
    });

/**
 * CRUD コントローラの共通インターフェース
 * GET は searchParams を、POST(upsert) は Request を受け取る。
 *
 * `controller/crudController.ts` の抽象クラス `CrudController` とは別物
 * （あちらは usecase 委譲の実装基底クラス、これは registerCrud が要求する
 * 最小限のダックタイピング契約）のため、混同を避けて `CrudEndpointController` と命名する。
 */
interface CrudEndpointController {
    get: (searchParams: URLSearchParams) => Promise<Response>;
    upsert: (request: Request) => Promise<Response>;
}

/**
 * GET/POST が同型な CRUD エンドポイントを一括登録する。
 * try→ensureDIInitialized→resolve→controller 呼び出し→catch handleApiError の
 * 定型を 1 箇所に集約する。
 * @param router - 登録対象の Hono アプリケーション
 * @param path - エンドポイントパス（例: '/calendar'）
 * @param ControllerClass - 解決対象のコントローラクラス
 */
const registerCrud = (
    router: Hono,
    path: string,
    ControllerClass: InjectionToken<CrudEndpointController>,
): void => {
    router.get(path, async (c: Context) => {
        try {
            ensureDIInitialized(c.env);
            const controller = container.resolve(ControllerClass);
            const searchParams = new URL(c.req.url).searchParams;
            return await controller.get(searchParams);
        } catch (error) {
            return handleApiError(c, error);
        }
    });

    router.post(path, async (c: Context) => {
        try {
            ensureDIInitialized(c.env);
            const controller = container.resolve(ControllerClass);
            return await controller.upsert(c.req.raw);
        } catch (error) {
            return handleApiError(c, error);
        }
    });
};

/** Hono の HTTP メソッド登録関数名（`router.get` / `router.post` / `router.delete`） */
type HonoMethodName = 'delete' | 'get' | 'post';

/**
 * try→ensureDIInitialized→resolve→メソッド呼び出し→catch handleApiError の
 * 定型を 1 メソッド分だけ登録するエントリ。
 * GET 系（引数なし）と POST/DELETE 系（Request を受け取る）の両方に対応する。
 */
interface MethodDispatchEntry<TController> {
    /** Hono に登録する HTTP メソッド */
    httpMethod: HonoMethodName;
    /** 解決したコントローラから呼び出すメソッド */
    invoke: (controller: TController, c: Context) => Promise<Response>;
}

/**
 * 同一パスに対する複数 HTTP メソッドを、共通の try→ensureDIInitialized→resolve→
 * catch handleApiError 定型でまとめて登録する。
 * `/calendar/flag` の GET(一覧)/POST(追加)/DELETE(削除) のように、CRUD 形（get/upsert）
 * に当てはまらないメソッド集合を持つエンドポイント向け。
 * @param router - 登録対象の Hono アプリケーション
 * @param path - エンドポイントパス（例: '/calendar/flag'）
 * @param ControllerClass - 解決対象のコントローラクラス
 * @param entries - HTTP メソッドごとの呼び出し定義
 */
const registerMethodDispatch = <TController>(
    router: Hono,
    path: string,
    ControllerClass: InjectionToken<TController>,
    entries: MethodDispatchEntry<TController>[],
): void => {
    for (const { httpMethod, invoke } of entries) {
        router[httpMethod](path, async (c: Context) => {
            try {
                ensureDIInitialized(c.env);
                const controller = container.resolve(ControllerClass);
                return await invoke(controller, c);
            } catch (error) {
                return handleApiError(c, error);
            }
        });
    }
};

/**
 * docs エンドポイントの examples に載せる 1 件分の定義。
 */
interface EndpointExample {
    description: string;
    url: string;
}

/** /place/docs, /race/docs で共通・固定の startDate パラメータ定義。 */
const START_DATE_PARAM_DOC = {
    type: 'string (YYYY-MM-DD)',
    required: true,
    description: '取得開始日',
    example: '2026-01-01',
};

/** /place/docs, /race/docs で共通・固定の finishDate パラメータ定義。 */
const FINISH_DATE_PARAM_DOC = {
    type: 'string (YYYY-MM-DD)',
    required: true,
    description: '取得終了日',
    example: '2026-12-31',
};

/** /place/docs, /race/docs で共通・固定の raceTypeList パラメータ定義。 */
const RACE_TYPE_LIST_PARAM_DOC = {
    type: 'string | string[]',
    required: true,
    description: 'レース種別（カンマ区切り、または複数指定）',
    values: RACE_TYPE_VALUES,
    example: 'jra,keirin',
};

/** /place/docs, /race/docs で共通・固定の locationList パラメータ定義。 */
const LOCATION_LIST_PARAM_DOC = {
    type: 'string | string[]',
    required: false,
    description: '開催場所コードで絞り込み（複数指定可）',
    example: '01,02',
};

/** /place/docs, /race/docs で共通・固定の isDisplayPlaceHeldDays パラメータ定義。 */
const HELD_DAYS_PARAM_DOC = {
    type: 'boolean',
    required: false,
    description: '開催回数・日数情報を含めるか',
    example: 'true',
};

/** /place/docs のみで使う isDisplayPlaceGrade パラメータ定義。 */
const PLACE_GRADE_PARAM_DOC = {
    type: 'boolean',
    required: false,
    description: '開催場グレードを含めるか',
    example: 'true',
};

/**
 * /place/docs と /race/docs で共通のパラメータ定義に、gradeList の説明・例と
 * isDisplayPlaceGrade（place のみ）を差し込んで組み立てる。
 * @param config - リソースごとに異なる差分
 * @param config.gradeDescription - gradeList パラメータの説明
 * @param config.gradeExample - gradeList パラメータの例
 * @param config.includePlaceGrade - isDisplayPlaceGrade パラメータを含めるか
 * @returns parameters レスポンス用オブジェクト
 */
/* oxlint-disable anti-slop/no-unsafe-dictionary-type -- /place/docs・/race/docs が返す
   人間向けAPIドキュメントJSONで、パラメータごとに持つフィールド（type/required/
   description/example）が異なる。型検証される値ではないためRecord<string, unknown>で正しい。 */
const buildEndpointParameters = (config: {
    gradeDescription: string;
    gradeExample: string;
    includePlaceGrade: boolean;
}): Record<string, unknown> => {
    const parameters: Record<string, unknown> = {
        startDate: START_DATE_PARAM_DOC,
        finishDate: FINISH_DATE_PARAM_DOC,
        raceTypeList: RACE_TYPE_LIST_PARAM_DOC,
        locationList: LOCATION_LIST_PARAM_DOC,
        gradeList: {
            type: 'string | string[]',
            required: false,
            description: config.gradeDescription,
            example: config.gradeExample,
        },
        isDisplayPlaceHeldDays: HELD_DAYS_PARAM_DOC,
    };

    // place のみ isDisplayPlaceGrade を isDisplayPlaceHeldDays の後ろに付与する
    if (config.includePlaceGrade) {
        parameters.isDisplayPlaceGrade = PLACE_GRADE_PARAM_DOC;
    }

    return parameters;
};

/**
 * /place/docs と /race/docs のパラメータ定義がほぼ同一であるため、
 * 共通部分を組み立てて差分のみ差し込むビルダー。
 * @remarks
 * 生成される docs レスポンスの内容（キー順序含む）は個別定義時と完全一致させること。
 * @param config - リソースごとに異なる差分
 * @param config.endpoint - endpoint 表示文字列（例: 'GET /place'）
 * @param config.description - リソース説明
 * @param config.gradeDescription - gradeList パラメータの説明
 * @param config.gradeExample - gradeList パラメータの例
 * @param config.includePlaceGrade - isDisplayPlaceGrade パラメータを含めるか
 * @param config.examples - examples 配列
 * @returns docs レスポンス用オブジェクト
 */
const buildEndpointDocumentation = (config: {
    endpoint: string;
    description: string;
    gradeDescription: string;
    gradeExample: string;
    includePlaceGrade: boolean;
    examples: EndpointExample[];
}): Record<string, unknown> => ({
    endpoint: config.endpoint,
    description: config.description,
    parameters: buildEndpointParameters(config),
    examples: config.examples,
});
/* oxlint-enable anti-slop/no-unsafe-dictionary-type */

/** リクエスト相関ID（OBS-004）をやり取りする HTTP ヘッダー名 */
const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * リクエスト相関ID（OBS-004）を解決し、レスポンスヘッダーへの付与と
 * 後続処理（ログ出力含む）への伝搬を行うミドルウェアを登録する。
 *
 * 並行リクエストでログが交錯しても `appLogger` の JSON構造化ログ（OBS-001）に
 * 含まれる `requestId` で1リクエスト分だけを追跡できるようにするため、
 * 他のミドルウェアより先に（`registerCommonMiddleware` の先頭で）登録する。
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
 * CORS ミドルウェアを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerCorsMiddleware = (router: Hono): void => {
    router.use('*', buildCorsMiddleware());
};

/**
 * リクエストボディサイズ制限（1MB、SEC-029）を登録する。過大なリクエストによる
 * リソース枯渇・DoS攻撃を防ぐ。実体は core の `bodyLimitMiddleware`（全 Worker共通）。
 * PERF-049: ボディを持たない GET/HEAD/OPTIONS にも毎回評価されていたのを、
 * ボディを受け取りうる POST/PUT/DELETE のみに絞り込む。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerBodyLimitMiddleware = (router: Hono): void => {
    router.on(['POST', 'PUT', 'DELETE'], '*', bodyLimitMiddleware());
};

/**
 * 読み取り専用エンドポイントにキャッシュヘッダーを設定するミドルウェアを登録する。
 * @remarks
 * PERF-033: `router.use(path, mw)`（完全一致パターン）で登録すると、Honoの `use()` は
 * ワイルドカード（`/*`）を付けない限りサブパスへ伝播しないため、`/race` には効いても
 * `/race/docs` や `/race/calendar-event` のようなサブパスにはキャッシュヘッダーが
 * 設定されていなかった（実機で確認済みの不具合）。`${path}/*` で登録することで、
 * ベースパス自身（例: `/race`）とそのサブパス（例: `/race/docs`）の両方に適用する
 * （Honoの `/*` パターンはベースパス自身にもマッチする）。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerCacheControlMiddleware = (router: Hono): void => {
    // KPLAYER-07回帰: NO_STORE_PATHS はCACHE_TTL_BY_PATHから意図的に除外して
    // いる（priority変更を即座に反映する必要があるため）が、Cache-Control
    // ヘッダーを何も付けない場合、一部のブラウザ/CDNが独自の発見的
    // キャッシュ（heuristic caching, RFC 7234 §4.2.2）を適用する可能性が
    // 理論上残る。明示的に `no-store` を付与し、キャッシュされないことを
    // 保証する。
    for (const path of NO_STORE_PATHS) {
        router.use(`${path}/*`, async (c: Context, next: Next) => {
            await next();
            if (isCacheableGetResponse(c.req.method, c.res.ok)) {
                c.res.headers.set('Cache-Control', 'no-store');
            }
        });
    }

    for (const [path, { maxAgeSeconds, sMaxAgeSeconds }] of Object.entries(
        CACHE_TTL_BY_PATH,
    )) {
        const cacheControlMiddleware = createCacheControlMiddleware(
            maxAgeSeconds,
            sMaxAgeSeconds,
        );
        router.use(`${path}/*`, cacheControlMiddleware);
    }
};

/**
 * サービス間認証を免除するルート一覧（service-auth-design.md §4.5・§3.2 の
 * api Worker エンドポイント分類表と1:1で対応）。
 * ここに列挙されていないルートはすべて `requireServiceAuth` により保護される
 * （deny-by-default）。
 */
export const SERVICE_AUTH_EXEMPT_ROUTES: readonly ServiceAuthExemptRoute[] = [
    { method: 'OPTIONS', path: '*', reason: 'cors-preflight' },
    { method: 'GET', path: '/health', reason: 'monitoring' },
    { method: 'GET', path: '/ui/announcement', reason: 'front-public' },
    { method: 'GET', path: '/ui/race-detail', reason: 'front-public' },
    { method: 'GET', path: '/release-notes', reason: 'front-public' },
    { method: 'GET', path: '/openapi.json', reason: 'static-docs' },
    { method: 'GET', path: '/docs', reason: 'static-docs' },
    { method: 'GET', path: '/calendar', reason: 'front-public' },
    { method: 'GET', path: '/place', reason: 'front-public' },
    { method: 'GET', path: '/place/docs', reason: 'static-docs' },
    { method: 'GET', path: '/race', reason: 'front-public' },
    { method: 'GET', path: '/race/docs', reason: 'static-docs' },
    { method: 'GET', path: '/race/calendar-event', reason: 'front-public' },
    { method: 'GET', path: '/race/players', reason: 'front-public' },
    { method: 'GET', path: '/player', reason: 'front-public' },
    { method: 'POST', path: '/player', reason: 'pending-user-auth' },
    { method: 'POST', path: '/push/subscription', reason: 'pending-user-auth' },
    {
        method: 'DELETE',
        path: '/push/subscription',
        reason: 'pending-user-auth',
    },
    { method: 'POST', path: '/push/request', reason: 'pending-user-auth' },
    { method: 'DELETE', path: '/push/request', reason: 'pending-user-auth' },
    { method: 'POST', path: '/push/test', reason: 'pending-user-auth' },
    { method: 'POST', path: '/push/dispatch', reason: 'has-own-auth' },
];

/**
 * サービス間認証ミドルウェアを登録する。
 * `POST/DELETE /calendar/flag` の呼び出し元は現状 calendar Worker のみで、
 * front からの呼び出しコードは存在しない。**将来 front からカレンダー掲載
 * フラグを直接操作する機能を作る場合、共有シークレットでは実装できない**
 * （ブラウザに秘密を置けないため）。その時点でユーザー認証の導入が必要になる
 * （service-auth-design.md §3.3）。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerServiceAuthMiddleware = (router: Hono): void => {
    router.use('*', requireServiceAuth(SERVICE_AUTH_EXEMPT_ROUTES));
};

/**
 * IPベースのレート制限ミドルウェアを登録する（SEC-011, SEC-013）。
 * サービス間認証で保護されていない公開エンドポイント（GET /place・/race 等）を、
 * HTTPメソッドに応じて読み取り用 `RATE_LIMITER`（GET/HEAD等）・書き込み用
 * `RATE_LIMITER_WRITE`（POST/PUT/DELETE、より厳しい制限）のいずれかで制限する
 * （`env.RATE_LIMITER` / `env.RATE_LIMITER_WRITE`、`wrangler.toml` の
 * `[[ratelimits]]`。バインディング名はミドルウェア内部（`resolveRateLimiter`）で
 * 解決するため、呼び出し側の `rateLimitMiddleware(SERVICE_AUTH_EXEMPT_ROUTES)` の
 * シグネチャはSEC-011時点から変更していない）。対応するバインディングが無い
 * 環境では何もしない。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerRateLimitMiddleware = (router: Hono): void => {
    router.use('*', rateLimitMiddleware(SERVICE_AUTH_EXEMPT_ROUTES));
};

/**
 * `GET /docs`（Scalar UI）向けの緩和したCSP。ScalarはJS/CSSを`cdn.jsdelivr.net`から
 * 読み込み、読み込んだJSが同一オリジンの`/openapi.json`をfetchして描画するため、
 * 他エンドポイント共通の`default-src 'none'`のままだと画面が空白になる（実機で
 * 確認済みの不具合）。必要な最小限のディレクティブのみ緩和し、それ以外は`'none'`のまま。
 */
const DOCS_PAGE_CSP =
    "default-src 'none'; " +
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; " +
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; " +
    "img-src 'self' https://cdn.jsdelivr.net data:; " +
    "font-src 'self' https://cdn.jsdelivr.net data:; " +
    "connect-src 'self'";

/**
 * セキュリティヘッダーミドルウェアを登録する（SEC-031）。
 * `/docs`（{@link DOCS_PAGE_CSP}）のみCSPを緩和する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerSecurityHeadersMiddleware = (router: Hono): void => {
    router.use(
        '*',
        securityHeadersMiddleware({
            cspOverrides: new Map([['/docs', DOCS_PAGE_CSP]]),
        }),
    );
};

/**
 * CORS・サービス間認証・レート制限・リクエストボディサイズ制限・キャッシュヘッダー・
 * セキュリティヘッダーの共通ミドルウェアを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerCommonMiddleware = (router: Hono): void => {
    registerRequestIdMiddleware(router);
    registerCorsMiddleware(router);
    registerServiceAuthMiddleware(router);
    registerRateLimitMiddleware(router);
    registerBodyLimitMiddleware(router);
    registerCacheControlMiddleware(router);
    registerSecurityHeadersMiddleware(router);
};

/**
 * `GET /calendar` と `GET/POST/DELETE /calendar/flag` を登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerCalendarRoutes = (router: Hono): void => {
    // Calendar エンドポイント（GETのみ。カレンダー掲載対象レース+フラグ状態を返す。
    // Google Calendarへの同期はcalendar Workerが担うため、apiはD1のみを参照する）
    registerMethodDispatch(router, '/calendar', CalendarController, [
        {
            httpMethod: 'get',
            invoke: (controller, c) =>
                controller.get(new URL(c.req.url).searchParams),
        },
    ]);

    // Calendar Flag エンドポイント（指定レースのカレンダー登録管理）
    // GET: 一覧取得 / POST: フラグ追加（D1保存のみ） / DELETE: フラグ削除（D1削除のみ）
    // Google Calendarへの反映は次回のcalendar Worker同期サイクルで行われる
    registerMethodDispatch(router, '/calendar/flag', CalendarController, [
        { httpMethod: 'get', invoke: (controller) => controller.flagList() },
        {
            httpMethod: 'post',
            invoke: (controller, c) => controller.flagAdd(c.req.raw),
        },
        {
            httpMethod: 'delete',
            invoke: (controller, c) => controller.flagRemove(c.req.raw),
        },
    ]);
};

/**
 * `GET /place/docs` と `GET/POST /place` を登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerPlaceRoutes = (router: Hono): void => {
    // Place ドキュメントエンドポイント
    router.get('/place/docs', (c: Context) => {
        return c.json(
            buildEndpointDocumentation({
                endpoint: 'GET /place',
                description: '開催場情報を取得します',
                gradeDescription: '開催場グレードで絞り込み（複数指定可）',
                gradeExample: 'S1,S2',
                includePlaceGrade: true,
                examples: [
                    {
                        description: 'JRAの全開催場を取得',
                        url: '/place?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=jra',
                    },
                    {
                        description: '競輪のS1・S2グレードの開催場を取得',
                        url: '/place?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=keirin&gradeList=S1&gradeList=S2',
                    },
                    {
                        description: '特定の開催場コードで絞り込み',
                        url: '/place?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=jra&locationList=01&locationList=05',
                    },
                ],
            }),
        );
    });

    // Place エンドポイント
    registerCrud(router, '/place', PlaceController);
};

/**
 * `GET /race/docs` を登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerRaceDocumentationRoute = (router: Hono): void => {
    router.get('/race/docs', (c: Context) => {
        return c.json(
            buildEndpointDocumentation({
                endpoint: 'GET /race',
                description: 'レース情報を取得します',
                gradeDescription: 'レースグレードで絞り込み（複数指定可）',
                gradeExample: 'GⅠ,GⅡ',
                includePlaceGrade: false,
                examples: [
                    {
                        description: 'JRAの全レースを取得',
                        url: '/race?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=jra',
                    },
                    {
                        description: 'JRAのGⅠ・GⅡレースを取得',
                        url: '/race?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=jra&gradeList=GⅠ&gradeList=GⅡ',
                    },
                    {
                        description: '特定の開催場コードで絞り込み',
                        url: '/race?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=jra&locationList=01&locationList=05',
                    },
                ],
            }),
        );
    });
};

/**
 * `GET /race/calendar-event` を登録する。
 * フロントの「カレンダーに追加」機能が、calendar Workerが実際に
 * Google Calendarへ登録する内容と同じ説明文を使うためのエンドポイント。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerRaceCalendarEventRoute = (router: Hono): void => {
    registerMethodDispatch(router, '/race/calendar-event', RaceController, [
        {
            httpMethod: 'get',
            invoke: (controller, c) =>
                controller.calendarEvent(new URL(c.req.url).searchParams),
        },
    ]);
};

/**
 * `GET /race/players` を登録する。
 * レース詳細を開いたときにオンデマンドで出走選手一覧を取得するためのエンドポイント
 * （KPLAYER-07）。一覧取得（GET /race）には含めない。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerRacePlayersRoute = (router: Hono): void => {
    registerMethodDispatch(router, '/race/players', RaceController, [
        {
            httpMethod: 'get',
            invoke: (controller, c) =>
                controller.players(new URL(c.req.url).searchParams),
        },
    ]);
};

/**
 * `GET /race/docs`・`GET/POST /race`・`GET /race/calendar-event`・
 * `GET /race/players` を登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerRaceRoutes = (router: Hono): void => {
    registerRaceDocumentationRoute(router);
    registerCrud(router, '/race', RaceController);
    registerRaceCalendarEventRoute(router);
    registerRacePlayersRoute(router);
};

/**
 * Web Push 購読・発火予約エンドポイント（登録・解除・取消）を登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerPushSubscriptionRoutes = (router: Hono): void => {
    // Web Push 購読エンドポイント（登録・解除）
    registerMethodDispatch(router, '/push/subscription', PushController, [
        {
            httpMethod: 'post',
            invoke: (controller, c) => controller.subscriptionUpsert(c.req.raw),
        },
        {
            httpMethod: 'delete',
            invoke: (controller, c) => controller.subscriptionRemove(c.req.raw),
        },
    ]);

    // Web Push 発火予約エンドポイント（登録・取消）
    registerMethodDispatch(router, '/push/request', PushController, [
        {
            httpMethod: 'post',
            invoke: (controller, c) => controller.requestUpsert(c.req.raw),
        },
        {
            httpMethod: 'delete',
            invoke: (controller, c) => controller.requestRemove(c.req.raw),
        },
    ]);
};

/**
 * Web Push ディスパッチ・テスト送信エンドポイントを登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerPushDispatchRoutes = (router: Hono): void => {
    // Web Push ディスパッチエンドポイント（デバッグ・手動実行用。毎分の自動配信は scheduled が行う）
    registerMethodDispatch(router, '/push/dispatch', PushController, [
        {
            httpMethod: 'post',
            invoke: (controller, c) => controller.dispatch(c.req.raw),
        },
    ]);

    // Web Push テスト送信エンドポイント（配信テスト機能。ユーザー自身の購読へ即時送信）
    registerMethodDispatch(router, '/push/test', PushController, [
        {
            httpMethod: 'post',
            invoke: (controller, c) => controller.sendTest(c.req.raw),
        },
    ]);
};

/**
 * Web Push 関連（購読・発火予約・ディスパッチ・テスト送信）を登録する。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerPushRoutes = (router: Hono): void => {
    registerPushSubscriptionRoutes(router);
    registerPushDispatchRoutes(router);
};

/**
 * デバッグエンドポイント（`GET /debug/database`）を登録する。
 * 本番の D1 環境では DB 件数が認証なしで露出してしまうため、
 * in-memory DB 使用時（開発・テスト環境）のみ有効にする。
 *
 * SEC-023: `isUseInMemoryDB` の環境変数フラグ判定一本に頼ると、設定ミスで
 * 本番に `USE_IN_MEMORY_DB=true` が紛れ込んだ場合に露出してしまう。
 * デプロイ環境名（`NODE_ENV`/`ENVIRONMENT`）による判定も多層防御として追加し、
 * production 環境ではフラグの値に関わらず常に 404 を返す。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerDebugRoutes = (router: Hono): void => {
    router.get('/debug/database', async (c: Context) => {
        if (isProductionEnvironment()) {
            return c.json({ success: false, message: 'Not Found' }, 404);
        }
        try {
            ensureDIInitialized(c.env);
            const controller = container.resolve(DebugController);
            return await controller.database(isUseInMemoryDB(c.env));
        } catch (error) {
            return handleApiError(c, error);
        }
    });
};

/**
 * バックフィル（R2キャッシュのみでの再同期）エンドポイントを登録する。
 * `packages/admin`（Cloudflare Accessで保護された管理専用Worker）からのみ
 * `X-Service-Auth-Token`経由で呼ばれる想定のため、公開APIとしては扱わない
 * （`SERVICE_AUTH_EXEMPT_ROUTES`に免除エントリを追加しないこと。運用者向け機能で
 * front（一般ユーザー向けアプリ）からは呼ばれなくなったため、2026-08-08に
 * `/admin/backfill/*`から`/internal/backfill/*`へ移設し認証必須化した）。
 * `cacheOnly: true` 固定でscraping Workerへ委譲するため、生スクレイピングは発生しない。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerBackfillRoutes = (router: Hono): void => {
    registerMethodDispatch(
        router,
        '/internal/backfill/place',
        BackfillController,
        [
            {
                httpMethod: 'post',
                invoke: (controller, c) => controller.place(c.req.raw),
            },
        ],
    );

    registerMethodDispatch(
        router,
        '/internal/backfill/race',
        BackfillController,
        [
            {
                httpMethod: 'post',
                invoke: (controller, c) => controller.race(c.req.raw),
            },
        ],
    );
};

/**
 * Server-Driven UI 用エンドポイントを登録する。
 * フロントから直接呼ばれる公開エンドポイント（`SERVICE_AUTH_EXEMPT_ROUTES`で免除）。
 * `/ui/announcement`（PoC）に続く2件目として `/ui/race-detail`
 * （race-detail-sdui-design.md）を追加している。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerServerDrivenUiRoutes = (router: Hono): void => {
    registerMethodDispatch(router, '/ui/announcement', AnnouncementController, [
        {
            httpMethod: 'get',
            invoke: (controller) => controller.get(),
        },
    ]);

    registerMethodDispatch(router, '/ui/race-detail', RaceController, [
        {
            httpMethod: 'get',
            invoke: (controller, c) =>
                controller.raceDetailUi(new URL(c.req.url).searchParams),
        },
    ]);
};

/**
 * 更新履歴（What's New画面）エンドポイントを登録する。
 * GET はfrontから直接呼ばれる公開エンドポイント（`SERVICE_AUTH_EXEMPT_ROUTES`で免除）。
 * POST は `scripts/release/autoRelease.ts` からの `X-Service-Auth-Token` 経由の
 * サービス間書き込み専用のため免除しない（`requireServiceAuth` で保護される）。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerReleaseNoteRoutes = (router: Hono): void => {
    registerMethodDispatch(router, '/release-notes', ReleaseNoteController, [
        {
            httpMethod: 'get',
            invoke: (controller) => controller.get(),
        },
        {
            httpMethod: 'post',
            invoke: (controller, c) => controller.create(c.req.raw),
        },
    ]);
};

/**
 * 更新履歴の運用者専用エンドポイント（`GET /internal/release-notes`）を登録する。
 * `packages/admin` からのみ `X-Service-Auth-Token`（`requireServiceAuth`）経由で
 * 呼ばれる想定のため、公開ドキュメントには載せず `SERVICE_AUTH_EXEMPT_ROUTES` にも
 * 免除エントリを追加しない。分割元の非公開リポジトリ（race-schedule）分も含む全件を
 * 返す点が `registerReleaseNoteRoutes` の公開GETとの違い。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerInternalReleaseNoteRoutes = (router: Hono): void => {
    registerMethodDispatch(
        router,
        '/internal/release-notes',
        InternalReleaseNoteController,
        [
            {
                httpMethod: 'get',
                invoke: (controller) => controller.list(),
            },
        ],
    );
};

/**
 * APIドキュメント（OpenAPI仕様 + Scalarによるインタラクティブなビューア）を登録する。
 * front-publicなエンドポイント（`SERVICE_AUTH_EXEMPT_ROUTES`で免除）と同じ範囲を
 * `openApiSpec` にまとめており、front以外の開発者・利用者もブラウザで一覧できる。
 * api Workerの一部として実装しているため、test/production環境ともapiの既存デプロイ
 * フローにそのまま乗る（新しいインフラ・デプロイ手順は不要）。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerDocsRoutes = (router: Hono): void => {
    router.get('/openapi.json', (c: Context) => c.json(openApiSpec));
    router.get(
        '/docs',
        Scalar({
            url: '/openapi.json',
            pageTitle: 'race-schedule API',
        }),
    );
};

/**
 * batch実行の排他制御ロック（CICD-73/CONC-03）エンドポイントを登録する。
 * batch Worker からのみ `X-Service-Auth-Token` 経由で呼ばれる想定（`requireServiceAuth`
 * により保護され、公開ドキュメントには載せない）。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerBatchLockRoutes = (router: Hono): void => {
    registerMethodDispatch(
        router,
        '/internal/batch-lock/acquire',
        BatchLockController,
        [
            {
                httpMethod: 'post',
                invoke: (controller, c) => controller.acquire(c.req.raw),
            },
        ],
    );

    registerMethodDispatch(
        router,
        '/internal/batch-lock/release',
        BatchLockController,
        [
            {
                httpMethod: 'post',
                invoke: (controller, c) => controller.release(c.req.raw),
            },
        ],
    );
};

/**
 * 機能フラグ管理のサービス間APIを登録する（旧`/admin/flags`系を置き換え、
 * `packages/admin`専用Worker、admin-package-design.md）。
 * `packages/admin` からのみ `X-Service-Auth-Token`（`requireServiceAuth`）経由で
 * 呼ばれる想定のため、公開ドキュメントには載せず `SERVICE_AUTH_EXEMPT_ROUTES` にも
 * 免除エントリを追加しない。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerInternalFeatureFlagsRoutes = (router: Hono): void => {
    registerMethodDispatch(
        router,
        '/internal/feature-flags',
        InternalFeatureFlagsController,
        [
            { httpMethod: 'get', invoke: (controller) => controller.list() },
            {
                httpMethod: 'post',
                invoke: (controller, c) => controller.update(c.req.raw),
            },
        ],
    );
};

/**
 * レイアウト構成管理のサービス間APIを登録する（`packages/admin`専用Worker、
 * race-detail-sdui-design.md §2）。`packages/admin` からのみ
 * `X-Service-Auth-Token`（`requireServiceAuth`）経由で呼ばれる想定のため、
 * 公開ドキュメントには載せず `SERVICE_AUTH_EXEMPT_ROUTES` にも免除エントリを
 * 追加しない。
 * @param router - 登録対象の Hono アプリケーション
 */
const registerInternalUiLayoutRoutes = (router: Hono): void => {
    registerMethodDispatch(
        router,
        '/internal/ui-layout',
        InternalUiLayoutController,
        [
            {
                httpMethod: 'get',
                invoke: (controller, c) =>
                    controller.get(new URL(c.req.url).searchParams),
            },
            {
                httpMethod: 'post',
                invoke: (controller, c) => controller.save(c.req.raw),
            },
        ],
    );
    registerMethodDispatch(
        router,
        '/internal/ui-layout/preview',
        InternalUiLayoutController,
        [
            {
                httpMethod: 'post',
                invoke: (controller, c) => controller.preview(c.req.raw),
            },
        ],
    );
};

/**
 * Hono アプリケーションを構築する。
 *
 * 各エンドポイントについて:
 * - `GET /calendar` - カレンダー掲載対象レース一覧（フラグ状態付き）
 * - `GET /calendar/flag` / `POST /calendar/flag` / `DELETE /calendar/flag` - 指定レースのカレンダー登録フラグ管理
 * - `GET /place` / `POST /place` - 競馬場情報管理
 * - `GET /race` / `POST /race` - レース情報管理
 * - `GET /race/calendar-event` - 指定レースのカレンダー登録イベントプレビュー取得
 * - `GET /player` / `POST /player` - 選手/騎手情報管理
 * - `POST /push/subscription` / `DELETE /push/subscription` - Web Push 購読の登録・解除
 * - `POST /push/request` / `DELETE /push/request` - Web Push 発火予約の登録・取消
 * - `POST /push/dispatch` - 期限到来分の配信（`X-Push-Dispatch-Token` 必須）
 * - `POST /push/test` - 指定した購読へテスト通知を即時送信（配信テスト機能）
 * - `POST /internal/backfill/place` / `POST /internal/backfill/race` - R2キャッシュのみで
 *   開催場・レース情報を再同期（バックフィル機能。`cacheOnly: true` 固定でscraping
 *   Workerへ委譲するため生スクレイピングは発生しない。サービス間認証必須）
 * - `GET`/`POST /internal/feature-flags` - 機能フラグの一覧取得・更新
 *   （`packages/admin` 専用Workerからのみ呼ばれるサービス間API）
 * - `GET`/`POST /internal/ui-layout` - レイアウト構成の取得・保存、
 *   `POST /internal/ui-layout/preview` - 保存せずに解決結果を取得
 *   （`packages/admin` 専用Workerからのみ呼ばれるサービス間API）
 * - `GET /health` - ヘルスチェック
 * - `GET /ui/announcement` - 起動時お知らせバナーのUIスキーマ取得（Server-Driven UI PoC）
 * - `GET /ui/race-detail` - レース詳細のセクション型UIスキーマ取得（Server-Driven UI）
 * - `GET /docs` - APIドキュメント（Scalar UI）
 * - `GET /openapi.json` - OpenAPI仕様（上記docsが参照する）
 * @returns 各エンドポイントを登録済みの Hono アプリケーション
 */
const buildRouter = (): Hono => {
    const router = new Hono();

    registerCommonMiddleware(router);

    // ヘルスチェック（OBS-017）
    // 従来はD1等への疎通確認をせずに常時200を返すshallow実装だった。
    // deploy.ymlのpost-deploy検証がこのエンドポイントに依存しているため、
    // 「デプロイはできたがD1バインディングが壊れている」ような障害を
    // デプロイ直後に検知できるよう、軽量なD1 ping（`SELECT 1`）を追加する。
    // D1は毎リクエストごとに使う主要な依存であり追加の外部ネットワーク呼び出しを
    // 伴わないため、ヘルスチェックに含めても安全（QAPI-07: 4 Worker共通の方針は
    // 「各Workerが直接持つ依存のみ確認し、他Worker/外部APIへの呼び出しは対象外」。
    // scrapingはR2という直接依存を持つため同様にheadチェックを行う一方、
    // batch/calendarは直接依存を持たず主な依存が他Worker/外部APIへの
    // HTTP呼び出しのみのため、そちらまで深掘りすると障害時の呼び出し増幅源に
    // なりかねず意図的に対象外としている。詳細は各Workerの`registerHealthRoute`
    // コメント参照）。
    router.get('/health', async (c: Context) => {
        try {
            await (c.env as CloudFlareEnv).DB.prepare('SELECT 1').first();
            return c.json({ status: 'ok', package: 'api' }, 200);
        } catch (error) {
            appLogger.error(
                'Health check failed: D1 connectivity error',
                sanitizeError(error),
            );
            return c.json(
                { status: 'ng', package: 'api', reason: 'D1 unreachable' },
                503,
            );
        }
    });

    registerServerDrivenUiRoutes(router);
    registerReleaseNoteRoutes(router);
    registerDocsRoutes(router);
    registerCalendarRoutes(router);
    registerPlaceRoutes(router);
    registerRaceRoutes(router);

    // Player エンドポイント
    registerCrud(router, '/player', PlayerController);

    registerPushRoutes(router);
    registerDebugRoutes(router);
    registerBatchLockRoutes(router);
    registerBackfillRoutes(router);
    registerInternalFeatureFlagsRoutes(router);
    registerInternalReleaseNoteRoutes(router);
    registerInternalUiLayoutRoutes(router);

    return router;
};

/**
 * Hono アプリケーション
 */
export const router = buildRouter();
