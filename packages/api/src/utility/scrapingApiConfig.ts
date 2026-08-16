/**
 * スクレイピングAPI（@race-schedule/scraping）通信の設定取得
 *
 * `packages/scraping/src/utility/mainApiConfig.ts`（scraping→api方向）と
 * 対になる、api→scraping方向の設定取得（バックフィル機能専用）。
 */

import { requireEnvVar } from '@race-schedule/core';

/**
 * スクレイピングAPIのベースURLを取得する。
 * @returns スクレイピングAPIのベースURL
 * @throws {Error} SCRAPING_API_URL が設定されていない場合
 */
export const getScrapingApiUrl = (): string =>
    requireEnvVar('SCRAPING_API_URL');
