import type { RaceEntity } from '../entity/raceEntity';

/**
 * GET /calendar のレスポンス用DTO。
 * カレンダー掲載対象のレースに、カレンダー登録フラグの有無を付与したもの。
 */
export interface CalendarRaceEntity extends RaceEntity {
    /** ユーザーが個別にカレンダー登録フラグを付けたレースかどうか */
    isFlagged: boolean;
    /** ユーザーが登録した注目選手（player_watch）が出走するレースかどうか */
    isWatched: boolean;
}
