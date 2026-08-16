/**
 * メインAPI（@race-schedule/api）通信の設定取得
 */

import { requireEnvVar } from '@race-schedule/core';

/**
 * メインAPIのベースURLを取得する。
 * @returns メインAPIのベースURL
 * @throws Error MAIN_API_URL が設定されていない場合
 */
export const getMainApiUrl = (): string => requireEnvVar('MAIN_API_URL');
