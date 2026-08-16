import { DI_TOKENS } from '@race-schedule/core';
import { container, Lifecycle } from 'tsyringe';

import { MainApiGateway } from '../gateway/implement/mainApiGateway';
import type { IMainApiGateway } from '../gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../repository/implement/mainApiRepository';
import type { IMainApiRepository } from '../repository/interface/IMainApiRepository';

/**
 * インフラ層（Gateway/Repository）のDI登録
 *
 * PERF-135: MainApiGateway/MainApiRepositoryはインスタンスフィールドを
 * 持たないステートレスなクラスのため、リクエスト毎に再インスタンス化する必要が無い。
 * singleton化してオブジェクト生成コストを削減する（calendarと同じ方針）。
 */
export function registerInfrastructure(): void {
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
}
