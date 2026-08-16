/**
 * @file アプリケーション層 (Application) の DI 設定
 *
 * このファイルは、各ドメイン機能（Calendar, Place, Player, Race）の
 * Service層、Usecase層、Controller層のコンポーネント登録を行います。
 */

import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { BackfillRepository } from '../repository/implement/backfillRepository';
import { BatchLockRepository } from '../repository/implement/batchLockRepository';
import { CalendarRepository } from '../repository/implement/calendarRepository';
import { DebugRepository } from '../repository/implement/debugRepository';
import { FeatureFlagRepository } from '../repository/implement/featureFlagRepository';
import { PlaceRepository } from '../repository/implement/placeRepository';
import { PlayerRepository } from '../repository/implement/playerRepository';
import { PushRequestRepository } from '../repository/implement/pushRequestRepository';
import { PushSubscriptionRepository } from '../repository/implement/pushSubscriptionRepository';
import { RaceRepository } from '../repository/implement/raceRepository';
import { ReleaseNoteRepository } from '../repository/implement/releaseNoteRepository';
import { UiLayoutRepository } from '../repository/implement/uiLayoutRepository';
import { WebPushSendRepository } from '../repository/implement/webPushSendRepository';
import { AnnouncementUsecase } from '../usecase/implement/announcementUsecase';
import { BackfillUsecase } from '../usecase/implement/backfillUsecase';
import { BatchLockUsecase } from '../usecase/implement/batchLockUsecase';
import { CalendarUsecase } from '../usecase/implement/calendarUsecase';
import { DebugUsecase } from '../usecase/implement/debugUsecase';
import { FeatureFlagUsecase } from '../usecase/implement/featureFlagUsecase';
import { PlaceUsecase } from '../usecase/implement/placeUsecase';
import { PlayerUsecase } from '../usecase/implement/playerUsecase';
import { PushUsecase } from '../usecase/implement/pushUsecase';
import { RaceUsecase } from '../usecase/implement/raceUsecase';
import { ReleaseNoteUsecase } from '../usecase/implement/releaseNoteUsecase';
import { UiLayoutUsecase } from '../usecase/implement/uiLayoutUsecase';

/**
 * Push domain（Web Push の購読・発火予約。web-push-design.md 参照）と
 * Debug domain（`GET /debug/database` 専用。in-memory DB 使用時のみ有効）、
 * BatchLock domain（batch実行の排他制御ロック、CICD-73/CONC-03）、
 * Backfill domain（R2キャッシュのみでの再同期、フロントから実行可能）のDI登録
 * @remarks
 * PERF-052: Repository/Usecase自体はステートレスだが、`registerSingleton`に
 * するとテストが `container.register(DI_TOKENS.DrizzleGateway, { useValue })`
 * でGatewayだけを後から差し替える戦略（`router.coverage.test.ts`の
 * `registerGateway`等）と衝突する。singleton化したRepositoryは初回解決時に
 * 注入されたGatewayをコンストラクタで一度だけ受け取って以降使い回すため、
 * 初回解決後にGatewayの登録だけを差し替えても、既にキャッシュ済みの
 * Repositoryインスタンスには反映されない（実際にこのパターンで
 * `debugDatabase_selectがthrow_500でerrorを返すこと`等が壊れることを確認した）。
 * そのため、この層は `registerApplication` の remarks に記載の理由により
 * 引き続き transient（`useClass`）のまま維持する。
 */
const registerPushDebugBatchLockAndBackfillDomains = (): void => {
    container.register(DI_TOKENS.PushSubscriptionRepository, {
        useClass: PushSubscriptionRepository,
    });
    container.register(DI_TOKENS.PushRequestRepository, {
        useClass: PushRequestRepository,
    });
    container.register(DI_TOKENS.WebPushSendRepository, {
        useClass: WebPushSendRepository,
    });
    container.register(DI_TOKENS.PushUsecase, { useClass: PushUsecase });

    container.register(DI_TOKENS.DebugRepository, {
        useClass: DebugRepository,
    });
    container.register(DI_TOKENS.DebugUsecase, { useClass: DebugUsecase });

    container.register(DI_TOKENS.BatchLockRepository, {
        useClass: BatchLockRepository,
    });
    container.register(DI_TOKENS.BatchLockUsecase, {
        useClass: BatchLockUsecase,
    });

    container.register(DI_TOKENS.BackfillRepository, {
        useClass: BackfillRepository,
    });
    container.register(DI_TOKENS.BackfillUsecase, {
        useClass: BackfillUsecase,
    });
};

/**
 * アプリケーション層のDI登録
 * @remarks
 * PERF-052: Repository/Usecase を `registerSingleton` 化できないか検討した。
 * これらのクラス自体は `private readonly` な注入依存以外のインスタンス
 * フィールドを持たないステートレスな実装だが、実際に試したところ
 * `packages/api/test/unittest/router.coverage.test.ts` が
 * `warmUpDI()` でDIを一度初期化した後、`container.register(DI_TOKENS.DrizzleGateway,
 * { useValue: fakeGateway })` のようにGatewayの登録だけを個別に差し替えて
 * DB障害系のテストケース（select失敗・データ有無のバリエーション等）を
 * 表現する設計になっていた。Repository/Usecaseをsingleton化すると、初回
 * 解決時に注入されたGatewayをそのまま使い回すため、後からのGateway差し替えが
 * 反映されず、複数のテストが失敗した。
 *
 * そのため、Repository/Usecase層は今回 singleton化を見送り、従来どおり
 * `useClass`（transient）のまま維持する。一方、Gatewayそのもの
 * （`di/infrastructure.ts`）は末端の依存であり、Repositoryのように
 * 上位からの差し替えを別レイヤーで捕まれる心配がないため、
 * `registerSingleton` に変更した（Gatewayの登録自体を丸ごと `useValue` で
 * 上書きするテストのやり方は、singleton/transientどちらでも同様に機能する）。
 */
export const registerApplication = (): void => {
    // FeatureFlag domain（feature-flag-design.md。Announcement等のSDUI機能・
    // 管理画面 GET /admin/flags の両方から参照される）
    container.register(DI_TOKENS.FeatureFlagRepository, {
        useClass: FeatureFlagRepository,
    });
    container.register(DI_TOKENS.FeatureFlagUsecase, {
        useClass: FeatureFlagUsecase,
    });

    // Announcement domain（Server-Driven UI PoC。enabled判定はFeatureFlagUsecaseに
    // 委譲するためrepositoryを持たない）
    container.register(DI_TOKENS.AnnouncementUsecase, {
        useClass: AnnouncementUsecase,
    });

    // ReleaseNote domain（What's New画面向け更新履歴。release-notes-db移行）
    container.register(DI_TOKENS.ReleaseNoteRepository, {
        useClass: ReleaseNoteRepository,
    });
    container.register(DI_TOKENS.ReleaseNoteUsecase, {
        useClass: ReleaseNoteUsecase,
    });

    // Calendar domain
    // Google Calendarとの実際の同期はcalendar Workerが担うため、
    // apiにはGoogle Calendar関連のGateway/Repositoryを登録しない（D1のみ）。
    container.register(DI_TOKENS.CalendarRepository, {
        useClass: CalendarRepository,
    });
    container.register(DI_TOKENS.CalendarUsecase, {
        useClass: CalendarUsecase,
    });

    // Place domain
    container.register(DI_TOKENS.PlaceRepository, {
        useClass: PlaceRepository,
    });
    container.register(DI_TOKENS.PlaceUsecase, { useClass: PlaceUsecase });

    // Player domain
    container.register(DI_TOKENS.PlayerRepository, {
        useClass: PlayerRepository,
    });
    container.register(DI_TOKENS.PlayerUsecase, { useClass: PlayerUsecase });

    // UiLayout domain（race-detail-sdui-design.md。RaceUsecase.fetchRaceDetailUiが
    // 読み取りに、UiLayoutUsecaseが管理画面からの読み書き・プレビューに使う）
    container.register(DI_TOKENS.UiLayoutRepository, {
        useClass: UiLayoutRepository,
    });
    container.register(DI_TOKENS.UiLayoutUsecase, {
        useClass: UiLayoutUsecase,
    });

    // Race domain
    container.register(DI_TOKENS.RaceRepository, { useClass: RaceRepository });
    container.register(DI_TOKENS.RaceUsecase, { useClass: RaceUsecase });

    registerPushDebugBatchLockAndBackfillDomains();
};
