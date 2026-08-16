/**
 * DI コンテナのトークン定数
 *
 * tsyringe の `container.register` / `@inject` で使う文字列トークンを一元管理する。
 * 登録側と注入側が同じ定数を参照することで、typo による実行時エラーを静的に防ぐ。
 */
export const DI_TOKENS = {
    // Gateway
    DrizzleGateway: 'DrizzleGateway',
    R2Gateway: 'R2Gateway',
    CalendarGateway: 'CalendarGateway',
    MainApiGateway: 'MainApiGateway',
    PlaceDataHtmlGateway: 'PlaceDataHtmlGateway',
    RaceDataHtmlGateway: 'RaceDataHtmlGateway',
    WebPushGateway: 'WebPushGateway',
    GithubIssueGateway: 'GithubIssueGateway',
    ScrapingApiGateway: 'ScrapingApiGateway',
    // Parser
    PlaceHtmlParser: 'PlaceHtmlParser',
    RaceHtmlParser: 'RaceHtmlParser',
    // Repository
    CalendarRepository: 'CalendarRepository',
    MainApiRepository: 'MainApiRepository',
    PlaceRepository: 'PlaceRepository',
    RaceRepository: 'RaceRepository',
    PlayerRepository: 'PlayerRepository',
    PlaceHtmlRepository: 'PlaceHtmlRepository',
    RaceHtmlRepository: 'RaceHtmlRepository',
    PushSubscriptionRepository: 'PushSubscriptionRepository',
    PushRequestRepository: 'PushRequestRepository',
    WebPushSendRepository: 'WebPushSendRepository',
    DebugRepository: 'DebugRepository',
    BatchLockRepository: 'BatchLockRepository',
    BackfillRepository: 'BackfillRepository',
    FeatureFlagRepository: 'FeatureFlagRepository',
    UiLayoutRepository: 'UiLayoutRepository',
    // Usecase
    AnnouncementUsecase: 'AnnouncementUsecase',
    FeatureFlagUsecase: 'FeatureFlagUsecase',
    UiLayoutUsecase: 'UiLayoutUsecase',
    CalendarUsecase: 'CalendarUsecase',
    PlaceUsecase: 'PlaceUsecase',
    RaceUsecase: 'RaceUsecase',
    PlayerUsecase: 'PlayerUsecase',
    PushUsecase: 'PushUsecase',
    DebugUsecase: 'DebugUsecase',
    BatchLockUsecase: 'BatchLockUsecase',
    BackfillUsecase: 'BackfillUsecase',
} as const;

/** DI トークンの型（DI_TOKENS の値のユニオン） */
export type DiToken = (typeof DI_TOKENS)[keyof typeof DI_TOKENS];
