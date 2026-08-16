import { GOOGLE_CALENDAR_ALL_COLORS } from '@race-schedule/core';

/**
 * Google Calendar の Event Labels（色ラベル）管理まわりのロジック。
 * `GoogleCalendarGateway` からラベル自動登録の詳細を切り離すために独立させたモジュール。
 * @see https://developers.google.com/workspace/calendar/api/guides/labels
 */

const GOOGLE_CALENDAR_API_BASE_URL = 'https://www.googleapis.com/calendar/v3';

const CALENDAR_DETAIL_ENDPOINT = (calendarId: string) =>
    `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(calendarId)}`;

/**
 * Event Label のJSON表現
 * googleapis の型定義が labelProperties/eventLabelId にまだ対応していないため独自定義する
 */
export interface GoogleCalendarEventLabel {
    id: string;
    name?: string;
    backgroundColor: string;
}

interface GoogleCalendarWithLabels {
    labelProperties?: {
        eventLabels?: GoogleCalendarEventLabel[];
    };
}

/**
 * Bearer 認証つきで Google Calendar API を呼び出し、検証済みの Response を返す関数の型。
 * `GoogleCalendarGateway.authorizedFetch` を注入するために定義する。
 */
export type AuthorizedFetch = (
    url: string,
    accessToken: string,
    init?: Omit<RequestInit, 'headers'>,
) => Promise<Response>;

/**
 * カレンダーの既存 Event Label 一覧を取得する。
 * @param authorizedFetch - 認証済み fetch 関数
 * @param calendarId - 対象カレンダーID
 * @param accessToken - Bearer アクセストークン
 * @returns 既存の Event Label 一覧
 */
async function fetchExistingEventLabels(
    authorizedFetch: AuthorizedFetch,
    calendarId: string,
    accessToken: string,
): Promise<GoogleCalendarEventLabel[]> {
    const response = await authorizedFetch(
        CALENDAR_DETAIL_ENDPOINT(calendarId),
        accessToken,
    );
    const calendar = await response.json<GoogleCalendarWithLabels>();
    return calendar.labelProperties?.eventLabels ?? [];
}

/**
 * 不足している Event Label を既存のラベルとマージして calendars.patch で登録する。
 * @param authorizedFetch - 認証済み fetch 関数
 * @param calendarId - 対象カレンダーID
 * @param accessToken - Bearer アクセストークン
 * @param existingLabels - 既存の Event Label 一覧
 * @param missingColors - 未登録の色定義一覧
 */
async function patchMissingEventLabels(
    authorizedFetch: AuthorizedFetch,
    calendarId: string,
    accessToken: string,
    existingLabels: GoogleCalendarEventLabel[],
    missingColors: readonly (typeof GOOGLE_CALENDAR_ALL_COLORS)[number][],
): Promise<void> {
    const mergedLabels: GoogleCalendarEventLabel[] = [
        ...existingLabels,
        ...missingColors.map((color) => ({
            id: color.labelId,
            name: color.labelName,
            backgroundColor: color.backgroundColor,
        })),
    ];

    await authorizedFetch(CALENDAR_DETAIL_ENDPOINT(calendarId), accessToken, {
        method: 'PATCH',
        body: JSON.stringify({
            labelProperties: { eventLabels: mergedLabels },
        } satisfies GoogleCalendarWithLabels),
    });
}

/**
 * カレンダーの既存 Event Label を確認し、不足分があれば calendars.patch で登録する。
 * @param authorizedFetch - 認証済み fetch 関数
 * @param calendarId - 対象カレンダーID
 * @param accessToken - Bearer アクセストークン
 */
async function syncMissingEventLabels(
    authorizedFetch: AuthorizedFetch,
    calendarId: string,
    accessToken: string,
): Promise<void> {
    const existingLabels = await fetchExistingEventLabels(
        authorizedFetch,
        calendarId,
        accessToken,
    );
    const existingLabelIds = new Set(existingLabels.map((label) => label.id));
    const missingColors = GOOGLE_CALENDAR_ALL_COLORS.filter(
        (color) => !existingLabelIds.has(color.labelId),
    );

    if (missingColors.length > 0) {
        await patchMissingEventLabels(
            authorizedFetch,
            calendarId,
            accessToken,
            existingLabels,
            missingColors,
        );
    }
}

/** カレンダーごとの Event Label 登録確認をキャッシュ付きで行うマネージャ。 */
export interface GoogleCalendarEventLabelManager {
    ensureEventLabels: (
        calendarId: string,
        accessToken: string,
    ) => Promise<void>;
}

/**
 * Event Label 管理の状態（登録確認済みカレンダーIDのキャッシュ）をカプセル化した
 * インスタンスを作る。
 * @param authorizedFetch - 認証済み fetch 関数（`GoogleCalendarGateway.authorizedFetch` を渡す）
 * @returns カレンダーに必要な Event Label の登録を保証できるオブジェクト
 */
export function createGoogleCalendarEventLabelManager(
    authorizedFetch: AuthorizedFetch,
): GoogleCalendarEventLabelManager {
    // calendars.get/patch は不要なAPIクォータ消費を避けるため、
    // 同一インスタンス内ではカレンダーごとに一度だけラベル登録確認を行う
    const ensuredLabelCalendarIds = new Set<string>();

    return {
        async ensureEventLabels(
            calendarId: string,
            accessToken: string,
        ): Promise<void> {
            if (ensuredLabelCalendarIds.has(calendarId)) {
                return;
            }

            await syncMissingEventLabels(
                authorizedFetch,
                calendarId,
                accessToken,
            );

            ensuredLabelCalendarIds.add(calendarId);
        },
    };
}
