import {
    type CloudFlareEnv,
    createErrorMessage,
    EnvStore,
    LogAllMethods,
    RaceType,
    toJstISOString,
} from '@race-schedule/core';
import type { calendar_v3 } from 'googleapis';
import { injectable } from 'tsyringe';

import type { IGoogleCalendarGateway } from '../interface/IGoogleCalendarGateway';
import { createGoogleCalendarEventLabelManager } from '../utility/googleCalendarEventLabels';
import { createGoogleServiceAccountAuth } from '../utility/googleServiceAccountAuth';

/**
 * Google Calendar API の定数
 * @see https://developers.google.com/calendar/api/quickstart/js
 */
const GOOGLE_CALENDAR_API_BASE_URL = 'https://www.googleapis.com/calendar/v3';

/**
 * Event Labels機能を使うためのクエリパラメータ
 * eventLabelVersion=1 を指定すると eventLabelId が使われ、colorId は無視される
 * @see https://developers.google.com/workspace/calendar/api/guides/labels
 */
const EVENT_LABEL_VERSION_QUERY = 'eventLabelVersion=1';

/**
 * Google Calendar API エンドポイント
 * @param calendarId
 */
const CALENDAR_EVENTS_ENDPOINT = (calendarId: string) =>
    `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events`;

const CALENDAR_EVENT_DETAIL_ENDPOINT = (calendarId: string, eventId: string) =>
    `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

/**
 * calendarId が有効（文字列かつ Google Calendar の group calendar 形式）かどうかを判定する。
 * 複合条件（&&）を独立関数として切り出し、C2組み合わせ爆発を回避する。
 * @param calendarId - 対象の calendarId
 * @returns 有効な calendarId であれば true
 */
function isValidCalendarId(
    calendarId: string | undefined,
): calendarId is string {
    return (
        typeof calendarId === 'string' &&
        calendarId.includes('@group.calendar.google.com')
    );
}

/**
 * Google Calendar API のレスポンスをチェックしてエラー処理
 * @param response
 */
async function checkGoogleCalendarResponse(response: Response): Promise<void> {
    if (response.ok) {
        return;
    }

    const errorText = await response.text();
    throw new Error(
        `Google Calendar API error: ${response.status} ${errorText}`,
    );
}

/**
 * RaceType → カレンダー ID のマップを env から生成する。
 * （getCalendarId のメソッド内インライン定義をモジュールスコープへ切り出し）
 * @param env - Cloudflare 環境変数
 * @returns RaceType をキーとしたカレンダー ID マップ
 */
const buildCalendarIdMap = (
    env: CloudFlareEnv,
): Record<RaceType, string | undefined> => ({
    [RaceType.JRA]: env.JRA_CALENDAR_ID,
    [RaceType.NAR]: env.NAR_CALENDAR_ID,
    // 新キー OVERSEAS_CALENDAR_ID を優先し、未設定時は旧 WORLD_CALENDAR_ID へフォールバック（後方互換）
    [RaceType.OVERSEAS]: env.OVERSEAS_CALENDAR_ID ?? env.WORLD_CALENDAR_ID,
    [RaceType.KEIRIN]: env.KEIRIN_CALENDAR_ID,
    [RaceType.AUTORACE]: env.AUTORACE_CALENDAR_ID,
    [RaceType.BOATRACE]: env.BOATRACE_CALENDAR_ID,
});

@LogAllMethods
@injectable()
export class GoogleCalendarGateway implements IGoogleCalendarGateway {
    private readonly auth = createGoogleServiceAccountAuth();
    private readonly labelManager = createGoogleCalendarEventLabelManager(
        (url, accessToken, init) =>
            this.authorizedFetch(url, accessToken, init),
    );

    /**
     * Bearer 認証つきで Google Calendar API を呼び出し、レスポンスを検証して返す。
     * 5 つの呼び出しメソッドで重複していた
     * 「Authorization/Content-Type ヘッダ付与 → fetch → checkGoogleCalendarResponse」を集約する。
     * @param url - リクエスト URL
     * @param accessToken - アクセストークン
     * @param init - fetch の init（method/body 等）。headers はここで付与するため不要
     * @returns 検証済みの Response
     */
    private async authorizedFetch(
        url: string,
        accessToken: string,
        init: Omit<RequestInit, 'headers'> = {},
    ): Promise<Response> {
        const response = await fetch(url, {
            ...init,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        await checkGoogleCalendarResponse(response);
        return response;
    }

    private async getCalendarId(
        raceType: RaceType,
        env: CloudFlareEnv,
    ): Promise<string> {
        const calendarId = buildCalendarIdMap(env)[raceType];
        if (!isValidCalendarId(calendarId)) {
            throw new Error(
                `Invalid or empty calendarId for raceType: ${raceType}, value: ${calendarId}`,
            );
        }
        // async メソッドのため文字列を返すだけで Promise<string> になる（不要な Promise ラップを排除）
        return calendarId;
    }

    /**
     * calendarId / accessToken の準備と、失敗時のエラーラップ（cause 付与）を
     * まとめて行う高階ヘルパー。
     * 5 つの公開メソッドで重複していた
     * 「getCalendarId → ensureAccessToken 取得」＋「catch で createErrorMessage を投げ直す」を集約する。
     * @remarks
     * calendarId は try 内で取得したものを外側スコープに保持し、catch では再取得しない。
     * これにより、getCalendarId 自体が失敗した場合でも再取得で元エラーを隠すことなく、
     * 元エラーを cause として保持したまま投げ直せる。
     * @param raceType - 対象レース種別
     * @param buildErrorMessage - 失敗時メッセージ生成（取得済み calendarId を渡す。未取得時は undefined）
     * @param body - calendarId / accessToken を用いた本処理
     * @returns body の戻り値
     */
    private async withCalendarContext<T>(
        raceType: RaceType,
        buildErrorMessage: (context: {
            calendarId: string | undefined;
        }) => string,
        body: (context: {
            calendarId: string;
            accessToken: string;
        }) => Promise<T>,
    ): Promise<T> {
        let calendarId: string | undefined;
        try {
            calendarId = await this.getCalendarId(raceType, EnvStore.env);
            const accessToken = await this.auth.ensureAccessToken();
            return await body({ calendarId, accessToken });
        } catch (error) {
            throw new Error(
                createErrorMessage(buildErrorMessage({ calendarId }), error),
                { cause: error },
            );
        }
    }

    public async fetchCalendarDataList(
        raceType: RaceType,
        startDate: Date,
        finishDate: Date,
    ): Promise<calendar_v3.Schema$Event[]> {
        return await this.withCalendarContext(
            raceType,
            ({ calendarId }) =>
                `Failed to get calendar list (calendarId: ${calendarId}, client_email: ${EnvStore.env.GOOGLE_CLIENT_EMAIL})`,
            async ({ calendarId, accessToken }) => {
                const params = new URLSearchParams({
                    timeMin: toJstISOString(startDate),
                    timeMax: toJstISOString(finishDate),
                    singleEvents: 'true',
                    orderBy: 'startTime',
                });

                const url = `${CALENDAR_EVENTS_ENDPOINT(calendarId)}?${params.toString()}`;
                const response = await this.authorizedFetch(url, accessToken);

                const data = await response.json<{
                    items?: calendar_v3.Schema$Event[];
                }>();
                return data.items ?? [];
            },
        );
    }

    public async fetchCalendarData(
        raceType: RaceType,
        eventId: string,
    ): Promise<calendar_v3.Schema$Event> {
        return await this.withCalendarContext(
            raceType,
            () => 'Failed to get calendar event',
            async ({ calendarId, accessToken }) => {
                const url = CALENDAR_EVENT_DETAIL_ENDPOINT(calendarId, eventId);
                const response = await this.authorizedFetch(url, accessToken);

                return await response.json<calendar_v3.Schema$Event>();
            },
        );
    }

    public async updateCalendarData(
        raceType: RaceType,
        calendarData: calendar_v3.Schema$Event,
    ): Promise<void> {
        if (!calendarData.id) {
            throw new Error('eventId (id) is required for update');
        }
        const eventId = calendarData.id;
        await this.withCalendarContext(
            raceType,
            () => 'Failed to update calendar event',
            async ({ calendarId, accessToken }) => {
                await this.labelManager.ensureEventLabels(
                    calendarId,
                    accessToken,
                );

                const url = `${CALENDAR_EVENT_DETAIL_ENDPOINT(
                    calendarId,
                    eventId,
                )}?${EVENT_LABEL_VERSION_QUERY}`;
                await this.authorizedFetch(url, accessToken, {
                    method: 'PUT',
                    body: JSON.stringify(calendarData),
                });
            },
        );
    }

    public async insertCalendarData(
        raceType: RaceType,
        calendarData: calendar_v3.Schema$Event,
    ): Promise<string> {
        return await this.withCalendarContext(
            raceType,
            () => 'Failed to insert calendar event',
            async ({ calendarId, accessToken }) => {
                await this.labelManager.ensureEventLabels(
                    calendarId,
                    accessToken,
                );

                const url = `${CALENDAR_EVENTS_ENDPOINT(calendarId)}?${EVENT_LABEL_VERSION_QUERY}`;
                const response = await this.authorizedFetch(url, accessToken, {
                    method: 'POST',
                    body: JSON.stringify(calendarData),
                });

                const createdEvent =
                    await response.json<calendar_v3.Schema$Event>();
                return createdEvent.id ?? '';
            },
        );
    }

    public async deleteCalendarData(
        raceType: RaceType,
        eventId: string,
    ): Promise<void> {
        await this.withCalendarContext(
            raceType,
            () => 'Failed to delete calendar event',
            async ({ calendarId, accessToken }) => {
                const url = CALENDAR_EVENT_DETAIL_ENDPOINT(calendarId, eventId);
                await this.authorizedFetch(url, accessToken, {
                    method: 'DELETE',
                });
            },
        );
    }
}
