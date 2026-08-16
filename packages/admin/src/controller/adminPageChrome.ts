import {
    PRODUCTION_FAVICON_DATA_URI,
    TEST_FAVICON_DATA_URI,
} from './faviconAssets';

/**
 * admin配下の各画面（`/flags`・`/backfill`）で共有する見た目まわりの部品。
 *
 * 配色は`packages/front`の実際のデザイントークン（`lib/design/tokens.dart`の
 * light テーマ）をそのまま流用し、front本体と見た目の一貫性を持たせる。
 * favicon・環境バッジはtest/production環境を視覚的に区別するために使う
 * （2026-08-08、機能フラグ管理画面で導入した仕組みを他の管理画面にも展開）。
 */

/** front `AppColors.light`（`packages/front/lib/design/tokens.dart`）由来の配色。 */
export const FRONT_COLORS = {
    bg: '#EBEEE9',
    surface: '#FFFFFF',
    surface2: '#F1F3EF',
    ink: '#171B18',
    ink2: '#4A524C',
    line: '#E4E7E0',
    brand: '#1E6E4C',
    danger: '#D50000',
};

/**
 * 環境に応じたfaviconのdata URIを選ぶ。
 * @param isProduction - production環境なら true
 * @returns favicon用data URI
 */
export const faviconFor = (isProduction: boolean): string =>
    isProduction ? PRODUCTION_FAVICON_DATA_URI : TEST_FAVICON_DATA_URI;

/** admin配下のページ間ナビゲーション項目（表示順）。 */
const NAV_ITEMS = [
    { path: '/flags', label: '機能フラグ管理' },
    { path: '/backfill', label: 'バックフィル実行' },
    { path: '/race-detail-layout', label: 'レース詳細レイアウト編集キット' },
] as const;

/**
 * admin外部（別Cloudflare Pagesプロジェクト）へのリンク。test/production共通で
 * 同一URL（デザインカタログはtest/productionでコンポーネント自体は変わらないため、
 * front本体のようなPAGES_PROJECT_NAMEの環境分岐を持たない）。
 */
const EXTERNAL_LINKS = [
    {
        href: 'https://race-schedule-widgetbook.pages.dev',
        label: 'Widgetbook（デザインカタログ）',
    },
] as const;

/**
 * 管理画面共通のヘッダー（タイトル・環境バッジ・ページ間ナビゲーション）を組み立てる。
 * @param title - このページのタイトル
 * @param isProduction - production環境なら true
 * @param currentPath - 現在のページのパス（ナビゲーションでのハイライト用）。
 *   404/500ページ等、ナビゲーション項目に対応しないページからは `undefined` を渡す
 *   （どの項目もハイライトされない、QADM-07）
 * @returns `<body>`直下に置くヘッダーHTML
 */
export const renderAdminHeader = (
    title: string,
    isProduction: boolean,
    currentPath: (typeof NAV_ITEMS)[number]['path'] | undefined,
): string => {
    const envLabel = isProduction ? '本番環境' : 'テスト環境';
    const envClass = isProduction ? 'production' : 'test';
    const nav = [
        ...NAV_ITEMS.map((item) =>
            item.path === currentPath
                ? `<span class="nav-item nav-current">${item.label}</span>`
                : `<a class="nav-item" href="${item.path}">${item.label}</a>`,
        ),
        ...EXTERNAL_LINKS.map(
            (link) =>
                `<a class="nav-item nav-external" href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label} ↗</a>`,
        ),
    ].join('');

    return `
<nav class="admin-nav">${nav}</nav>
<h1>${title}</h1><span class="env-badge ${envClass}">${envLabel}</span>
`;
};

/** 全admin画面共通のCSS（ナビゲーション・見出し・環境バッジ・エラー表示）。 */
export const CHROME_STYLE = `
body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; color: ${FRONT_COLORS.ink}; background: ${FRONT_COLORS.bg}; }
.admin-nav { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
.nav-item { display: inline-block; padding: 0.35rem 0.8rem; border-radius: 0.5rem; font-size: 0.8125rem; text-decoration: none; }
a.nav-item { color: ${FRONT_COLORS.ink2}; background: ${FRONT_COLORS.surface}; border: 1px solid ${FRONT_COLORS.line}; }
a.nav-item:hover { border-color: ${FRONT_COLORS.brand}; color: ${FRONT_COLORS.brand}; }
.nav-item.nav-current { color: #fff; background: ${FRONT_COLORS.brand}; font-weight: bold; }
a.nav-item.nav-external { color: ${FRONT_COLORS.brand}; background: transparent; border: 1px dashed ${FRONT_COLORS.brand}; }
h1 { font-size: 1.25rem; margin-bottom: 0.25rem; display: inline-block; }
.env-badge { display: inline-block; margin-left: 0.5rem; padding: 0.15rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: bold; color: #fff; vertical-align: middle; }
.env-badge.test { background: ${FRONT_COLORS.brand}; }
.env-badge.production { background: ${FRONT_COLORS.danger}; }
.hint { color: ${FRONT_COLORS.ink2}; font-size: 0.875rem; margin-top: 0; }
.error { color: ${FRONT_COLORS.danger}; }
`;
