// Web Push 通知用の Service Worker（素の JS）。
// Flutter が自動生成する flutter_service_worker.js（PWAオフラインキャッシュ用）とは
// 別ファイル・別スコープで共存させる（index.html で明示的な scope を指定して登録する）。
// push イベントの配信自体はページを制御しているかどうかに依存しないため、
// スコープを狭めても通知の受信・表示には影響しない。

// QNTF-03: pushイベントに title を含まないペイロードが届いた場合の
// フォールバック文言。`data.title` が無いと showNotification(undefined, ...)
// となり、通知タイトルが「undefined」相当の表示になってしまうため用意する。
const FALLBACK_NOTIFICATION_TITLE = '開催盤';

// QNTF-04: pushsubscriptionchange時にサーバーへ再購読を通知するためのAPI
// ベースURL。push-sw.jsはFlutterのdart-defineの対象外（純粋な静的JSファイル）
// のため、デプロイ時（deploy-front-reusable.yml）にこのプレースホルダを
// sedで環境ごとのAPI_BASE_URLへ置換する。ローカル開発（`flutter run` 等）では
// 置換されず、その場合は再購読自体をスキップする（フォールバックとして
// アプリ起動時のWebNotificationScheduler.initialize()に委ねる）。
const API_BASE_URL = '__PUSH_SW_API_BASE_URL__';

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(
            data.title || FALLBACK_NOTIFICATION_TITLE,
            {
                body: data.body,
                icon: '/icons/Icon-192.png',
                badge: '/icons/Icon-maskable-192.png',
                // QNTF-02: raceId 由来の tag を付けることで、同一レースについて
                // 複数回配信された通知（自動重賞通知とお気に入り通知が同一レースに
                // 当たる場合等）が積み上がらず1件にまとまる。
                tag: data.raceId ? `race-${data.raceId}` : undefined,
                data: { url: data.url },
            },
        ),
    );
});

// 通知クリック時に開いてよいURLスキームの許可リスト（SECPUSH-01）。
// `event.notification.data.url` は push ペイロード（`data.url`）をそのまま経由しており、
// サーバー・Push Serviceのいずれかが侵害された場合に `javascript:` 等の危険なスキームや
// 任意の外部ドメインへ誘導する「オープンリダイレクト」に悪用されうる。
// front本体側の同種の対策（race_detail_sheet.dartの`_allowedExternalUrlSchemes`、SEC-054）と
// 同じ方針でhttp/https限定にする。
const ALLOWED_NOTIFICATION_URL_SCHEMES = ['http:', 'https:'];

/**
 * 通知クリック時に開いてよいURLかどうかを判定する（純粋関数、SECPUSH-01）。
 * 相対URLはService Workerのスコープ（self.location）を基準に解決する。
 * @param {string} url - 判定対象のURL（相対/絶対いずれも可）
 * @param {string} baseUrl - 相対URL解決の基準（通常は self.location.href）
 * @returns {boolean} http/https スキームなら true
 */
function isAllowedNotificationUrl(url, baseUrl) {
    try {
        return ALLOWED_NOTIFICATION_URL_SCHEMES.includes(
            new URL(url, baseUrl).protocol,
        );
    } catch {
        return false;
    }
}

/**
 * 通知タップ時に遷移する。既に開いている（PWAウィンドウ含む）クライアントが
 * あればそれを前面化＋そのタブ内で遷移させ、無ければ新規タブ/ウィンドウを
 * 開く（QNTF-01）。無条件に`clients.openWindow`すると、既にアプリを開いた
 * まま通知を受け続けた場合にタブが際限なく増えてしまうため。
 * @param {string} url - 遷移先URL（`isAllowedNotificationUrl`で検証済みの値を渡すこと）
 * @returns {Promise<void>}
 */
async function focusOrOpenWindow(url) {
    const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
    });
    const existing = windowClients[0];
    if (existing) {
        await existing.focus();
        if ('navigate' in existing) {
            await existing.navigate(url);
        }
        return;
    }
    await clients.openWindow(url);
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const requestedUrl =
        (event.notification.data && event.notification.data.url) || '/';
    const url = isAllowedNotificationUrl(requestedUrl, self.location.href)
        ? requestedUrl
        : '/';
    event.waitUntil(focusOrOpenWindow(url));
});

/**
 * バイト列（ArrayBuffer）をBase64URL（パディング無し）文字列に変換する
 * （`web_push_client_web.dart`の`_encodeBase64Url`と同じ変換）。
 * @param {ArrayBuffer} buffer - 変換対象
 * @returns {string} Base64URL文字列
 */
function arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}

// QNTF-04: ブラウザが購読を更新・失効させても、フロント側の再購読は
// WebNotificationScheduler.initialize()（アプリ起動時）でしか走らないため、
// アプリを開かない限り通知が無言で届かなくなっていた。ブラウザがこの
// イベントを発火した時点で再購読し、サーバーへ新しいendpointを伝える。
self.addEventListener('pushsubscriptionchange', (event) => {
    if (API_BASE_URL === '__PUSH_SW_API_BASE_URL__') return;

    const oldOptions = event.oldSubscription && event.oldSubscription.options;
    const applicationServerKey =
        (oldOptions && oldOptions.applicationServerKey) || undefined;

    event.waitUntil(
        (async () => {
            const subscription =
                event.newSubscription ||
                (await self.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                }));
            const p256dhBuffer = subscription.getKey('p256dh');
            const authBuffer = subscription.getKey('auth');
            if (!p256dhBuffer || !authBuffer) return;

            await fetch(`${API_BASE_URL}/push/subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: arrayBufferToBase64Url(p256dhBuffer),
                        auth: arrayBufferToBase64Url(authBuffer),
                    },
                }),
            });
        })(),
    );
});
