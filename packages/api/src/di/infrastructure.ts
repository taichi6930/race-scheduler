/**
 * @file インフラストラクチャ層 (Infrastructure) の DI 設定
 *
 * このファイルは、全ドメイン機能で共通利用される
 * インフラストラクチャレイヤーのコンポーネント登録を行います。
 */

import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { DrizzleGateway } from '../gateway/implement/drizzleGateway';
import { ScrapingApiGateway } from '../gateway/implement/scrapingApiGateway';
import { WebPushGateway } from '../gateway/implement/webPushGateway';

/**
 * インフラストラクチャ層のDI登録（本番環境・リモートDB使用）
 * @remarks
 * PERF-052: DrizzleGateway/WebPushGatewayはどちらもインスタンスフィールドを
 * 持たないステートレスなクラスのため、`registerSingleton` でCloudflare
 * Workersのisolate生存期間中インスタンスを使い回しても安全（DrizzleGateway
 * の `db` ゲッターはモジュールレベルのキャッシュ（PERF-051）で
 * `EnvStore.env.DB` の参照変化を検知するため、singleton化してもテストごとに
 * 異なるDBを正しく参照できる）。
 */
export const registerInfrastructure = (): void => {
    container.registerSingleton(DI_TOKENS.DrizzleGateway, DrizzleGateway);
    container.registerSingleton(DI_TOKENS.WebPushGateway, WebPushGateway);
    container.registerSingleton(
        DI_TOKENS.ScrapingApiGateway,
        ScrapingApiGateway,
    );
};

/**
 * インフラストラクチャ層のDI登録（ローカル開発・テスト用・インメモリDB使用）
 * @remarks
 * ローカル開発やユニット/統合テストで D1 なしで機能確認する際に使用します。
 * DrizzleGateway は本番と同じクラスを登録する。EnvStore.env.DB を
 * bun:sqlite ベースの D1Database 互換アダプタ（test/common/inMemoryD1.ts）に
 * 差し替えることで、D1 なしで Drizzle 化済み repository のテストを成立させる。
 * WebPushGateway も外部の Push Service を叩く実クラスをそのまま登録する
 * （fetch はテスト側でモックする。DrizzleGateway と同じ方針）。
 * PERF-052: registerInfrastructure と同じ理由で singleton 化している。
 */
export const registerInfrastructureForInMemory = (): void => {
    container.registerSingleton(DI_TOKENS.DrizzleGateway, DrizzleGateway);
    container.registerSingleton(DI_TOKENS.WebPushGateway, WebPushGateway);
    container.registerSingleton(
        DI_TOKENS.ScrapingApiGateway,
        ScrapingApiGateway,
    );
};
