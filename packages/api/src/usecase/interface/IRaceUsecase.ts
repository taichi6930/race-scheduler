import type {
    RaceDetailUi,
    RaceEntity,
    RaceId,
    RaceLink,
    RacePlayerEntity,
    SearchRaceFilterParamsInput,
    UpsertResult,
} from '@race-schedule/core';

/**
 * カレンダーアプリ（Google Calendar等）へのイベント登録に必要な項目のみを
 * 抜き出したプレビュー。`convertRaceEntityToCalendarEvent`（core）の出力から
 * Google Calendar API固有の内部項目（id/colorId/eventLabelId）を除いたもの。
 */
export interface CalendarEventPreview {
    /** イベントタイトル */
    summary: string;
    /** イベント詳細（発走時刻・netkeiba/YouTubeリンク等。実際のGoogle Calendar同期と同一内容） */
    description: string;
    /** 開催場所 */
    location: string;
    /** 開始日時 */
    start: { dateTime: string; timeZone: string };
    /** 終了日時 */
    end: { dateTime: string; timeZone: string };
    /**
     * レースに関連する外部リンク（netkeiba出馬表・レース動画・YouTube公式配信等）。
     * `description` に埋め込まれているのと同一のリンクを構造化データで持つ
     * （フロント側でボタン表示するため）。対応データが無いレース種別
     * （AUTORACE/BOATRACE/OVERSEAS）は空配列。
     */
    links: RaceLink[];
}

/**
 * レース開催ユースケースのインターフェース
 */
export interface IRaceUsecase {
    /**
     * レース開催のEntity配列を取得する
     * @param searchRaceFilterParams - レース情報フィルター情報
     */
    fetch: (
        searchRaceFilterParams: SearchRaceFilterParamsInput,
    ) => Promise<RaceEntity[]>;

    /**
     * レース開催のEntity配列の更新を行う
     * @param entityList - レースエンティティ配列
     */
    upsert: (entityList: RaceEntity[]) => Promise<UpsertResult>;

    /**
     * raceIdを指定して、そのレースをカレンダーに登録する際のイベント内容を取得する。
     * calendar Workerが実際にGoogle Calendarへ登録する内容と完全に同一のものを返す。
     * @param raceId - 取得対象のraceId
     * @returns カレンダーイベントプレビュー。該当レースが存在しない場合は null
     */
    fetchCalendarEvent: (
        raceId: RaceId,
    ) => Promise<CalendarEventPreview | null>;

    /**
     * 指定した raceId のうち、注目選手（player_watch, priority>0）が
     * 出走しているものの集合を取得する（SPEC-PLAYER-001）。
     * @param raceIds - 絞り込み対象の raceId 一覧
     */
    fetchWatchedRaceIds: (raceIds: readonly string[]) => Promise<Set<string>>;

    /**
     * raceIdを指定して、そのレースの出走選手一覧（車番順）を取得する。
     * 機械式競技（現状KEIRIN・AUTORACE）以外、またはまだ出走表を取得していない
     * レースの場合は空配列を返す。
     * @param raceId - 取得対象のraceId
     */
    fetchRacePlayers: (raceId: RaceId) => Promise<RacePlayerEntity[]>;

    /**
     * raceIdを指定して、レース詳細画面（front）向けのセクション型UIスキーマを取得する
     * （Server-Driven UI、race-detail-sdui-design.md）。
     * @param raceId - 取得対象のraceId
     * @returns 解決済みのUIスキーマ。該当レースが存在しない場合は null
     */
    fetchRaceDetailUi: (raceId: RaceId) => Promise<RaceDetailUi | null>;
}
