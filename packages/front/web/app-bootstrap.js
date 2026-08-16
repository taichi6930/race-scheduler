// SEC-055: CSPのscript-srcに'unsafe-inline'を許可しないため、index.htmlの
// インラインscriptをここへ切り出す。中身はindex.htmlに元々あったものと同一。

// QWEB-10: Flutterが最初のフレームを描画したら`flutter-first-frame`イベントが
// windowに発火する（Flutter公式のWeb初期化ガイドに記載の仕組み）ので、それを
// 合図に#loading-splashを取り除く。イベントが何らかの理由で発火しない場合に備え、
// 10秒のフォールバックタイマーも用意する（splashが永久に残り続けるのを防ぐ）。
(() => {
    const removeSplash = () => {
        const splash = document.getElementById('loading-splash');
        if (splash) {
            splash.remove();
        }
    };
    window.addEventListener('flutter-first-frame', removeSplash, {
        once: true,
    });
    setTimeout(removeSplash, 10000);
})();

// Web Push 用の Service Worker を登録する。
// Flutter が自動生成する flutter_service_worker.js（ルートスコープ）とは
// 競合しないよう、明示的に非ルートスコープを指定して登録する
// （push イベントの受信自体はスコープに依存しない）。
//
// SEC-062: 下記の 'push-sw.js' / '/push/' は
// packages/front/lib/notifications/data/web_push_client/web_push_client_web.dart の
// _pushServiceWorkerScriptUrl / _pushServiceWorkerScope と値を一致させる必要がある
// （静的HTMLとDartコードという別々のビルド成果物にまたがるため、ビルド時の自動注入は
// 無く手動同期）。値を変更する場合は両方を直すこと。
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('push-sw.js', { scope: '/push/' })
            .catch((error) => {
                console.error('push-sw registration failed', error);
            });
    });
}
