/**
 * @file DI (Dependency Injection) 設定の初期化
 *
 * インフラストラクチャ層とアプリケーション層の初期化を順序立てて実行します。
 * 環境変数 `USE_IN_MEMORY_DB` で本番DB（D1）かインメモリDB かを切り替えられます。
 */

import { createDIInitializer } from '@race-schedule/core';

import { isUseInMemoryDB } from '../utility/isUseInMemoryDb';
import { registerApplication } from './application';
import {
    registerInfrastructure,
    registerInfrastructureForInMemory,
} from './infrastructure';

/**
 * DIコンテナの初期化（本番・リモートDB使用）
 */
export const initializeDI = createDIInitializer(
    registerInfrastructure,
    registerApplication,
);

/**
 * DIコンテナの初期化（ローカル・テスト用・インメモリDB使用）
 */
export const initializeDIForInMemory = createDIInitializer(
    registerInfrastructureForInMemory,
    registerApplication,
);

/**
 * 環境に応じた DI 初期化を自動実行
 *
 * USE_IN_MEMORY_DB=true の場合はインメモリDB、
 * そうでない場合は通常の D1 を使用します。
 */
export const initializeDIByEnvironment = (): void => {
    if (isUseInMemoryDB()) {
        initializeDIForInMemory();
    } else {
        initializeDI();
    }
};

// サーバー起動時に自動実行
// （import 時の初期化という意図は維持しつつ、no-top-level-side-effects を満たすため
//   副作用を named export の束縛にする）
export const initialized = initializeDIByEnvironment();
