import { DI_TOKENS } from '@race-schedule/core';
import { container, Lifecycle } from 'tsyringe';

import { GoogleCalendarGateway } from '../gateway/implement/googleCalendarGateway';
import { MainApiGateway } from '../gateway/implement/mainApiGateway';
import type { IGoogleCalendarGateway } from '../gateway/interface/IGoogleCalendarGateway';
import type { IMainApiGateway } from '../gateway/interface/IMainApiGateway';
import { GoogleCalendarRepository } from '../repository/implement/googleCalendarRepository';
import { MainApiRepository } from '../repository/implement/mainApiRepository';
import type { ICalendarRepository } from '../repository/interface/ICalendarRepository';
import type { IMainApiRepository } from '../repository/interface/IMainApiRepository';

/**
 * インフラ層（Gateway/Repository）のDI登録
 *
 * `registerInfrastructure` はWorker isolateの起動時（`index.ts` の
 * トップレベルで一度だけ呼ばれる `setupDI()`）に1回だけ実行されるため、
 * ここで singleton 登録したインスタンスは同一isolate内の複数リクエストで
 * 使い回される。
 */
export function registerInfrastructure(): void {
    // PERF-075: GoogleCalendarGatewayはJWT署名+OAuthトークン交換（ensureAccessToken）と
    // Event Label登録確認（ensureEventLabels）を独自にキャッシュする設計（インスタンス内で
    // 有効期限/登録済みIDを保持し使い回す）だが、transient登録だとリクエスト毎に
    // 新規インスタンスが作られキャッシュが効かず、リクエスト毎にJWT署名・トークン交換が
    // 発生していた。GoogleCalendarGatewayはこのキャッシュ用状態以外に可変の
    // リクエスト固有データを持たないため、singleton化して安全にキャッシュを使い回す。
    // （GoogleCalendarRepositoryは PERF-072/073 用に1リクエスト内でのみ有効な
    // イベントキャッシュを持つため、こちらはtransientのまま据え置く）
    container.register<IGoogleCalendarGateway>(
        DI_TOKENS.CalendarGateway,
        { useClass: GoogleCalendarGateway },
        { lifecycle: Lifecycle.Singleton },
    );
    // PERF-135: MainApiGateway/MainApiRepositoryはインスタンスフィールドを
    // 持たないステートレスなクラス（メソッド呼び出し間で共有される状態が無い）のため、
    // リクエスト毎に再インスタンス化する必要が無い。singleton化してオブジェクト
    // 生成コストを削減する。
    container.register<IMainApiGateway>(
        DI_TOKENS.MainApiGateway,
        { useClass: MainApiGateway },
        { lifecycle: Lifecycle.Singleton },
    );
    container.register<IMainApiRepository>(
        DI_TOKENS.MainApiRepository,
        { useClass: MainApiRepository },
        { lifecycle: Lifecycle.Singleton },
    );
    container.register<ICalendarRepository>(DI_TOKENS.CalendarRepository, {
        useClass: GoogleCalendarRepository,
    });
}
