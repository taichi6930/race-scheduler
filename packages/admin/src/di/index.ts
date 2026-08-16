import { createDIInitializer } from '@race-schedule/core';

import { registerApplication } from './application';
import { registerInfrastructure } from './infrastructure';

/**
 * DIコンテナの初期化
 */
export const initializeDI = createDIInitializer(
    registerInfrastructure,
    registerApplication,
);

/**
 * サーバー起動時に実行する初期化処理
 */
export function setupDI() {
    initializeDI();
}
