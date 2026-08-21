/**
 * admin パッケージ内でのみ使うDIトークン。
 *
 * `@race-schedule/core`の`DI_TOKENS`は他Worker（api/batch/calendar/scraping）と
 * 共有する定数だが、招待発行・参加者一覧のUsecaseはadmin単独の機能であり、
 * それだけのためにcore（他パッケージ横断の共有ファイル）へ変更を加えるのは
 * 避けたい。他パッケージから参照される予定が無いトークンはadmin内で完結させる。
 */
export const ADMIN_DI_TOKENS = {
    InviteUsecase: 'InviteUsecase',
    ParticipantsUsecase: 'ParticipantsUsecase',
    JoinRequestsUsecase: 'JoinRequestsUsecase',
} as const;
