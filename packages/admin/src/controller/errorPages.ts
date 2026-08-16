import { CHROME_STYLE, faviconFor, renderAdminHeader } from './adminPageChrome';

/**
 * admin配下の404/500ページ（QADM-07）。
 *
 * Hono既定のプレーンテキストエラーだと、共通chrome（`adminPageChrome.ts`）の
 * ナビゲーションが出ず、タイポしたパスや想定外の例外から正しい画面へ戻る導線が
 * 無くなってしまうため、他ページと同じ見た目でナビゲーションを保つ。
 */

const renderErrorPage = (
    title: string,
    isProduction: boolean,
    message: string,
): string => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} — race-schedule admin</title>
<link rel="icon" href="${faviconFor(isProduction)}">
<style>${CHROME_STYLE}</style>
</head>
<body>
${renderAdminHeader(title, isProduction, undefined)}
<p class="hint">${message}</p>
</body>
</html>
`;

/**
 * 404 Not Found ページのHTMLを組み立てる。
 * @param isProduction - production環境なら true
 * @returns レスポンスボディとして返すHTML文字列
 */
export const renderNotFoundPage = (isProduction: boolean): string =>
    renderErrorPage(
        '404 Not Found',
        isProduction,
        'お探しのページは見つかりませんでした。上部のナビゲーションから目的の画面を選んでください。',
    );

/**
 * 500 Internal Server Error ページのHTMLを組み立てる。
 * @param isProduction - production環境なら true
 * @returns レスポンスボディとして返すHTML文字列
 */
export const renderServerErrorPage = (isProduction: boolean): string =>
    renderErrorPage(
        '500 Internal Server Error',
        isProduction,
        '予期しないエラーが発生しました。時間をおいて再度お試しください。',
    );
