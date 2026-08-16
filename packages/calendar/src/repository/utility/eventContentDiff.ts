import type { calendar_v3 } from 'googleapis';

/**
 * Google Calendar イベントの内容差分判定まわりのロジック。
 * `GoogleCalendarRepository` の upsert が、内容に変化が無いイベントへの
 * 不要な updateCalendarData（PUT）呼び出しを避けるために使う（PERF-076）。
 */

/**
 * イベント比較に使う正規化済みスナップショット。
 * calendar_v3.Schema$Event はサーバー側の付加フィールド（etag/htmlLink/sequence等）を
 * 含み、それらは書き込みペイロードには存在しないため単純な深い比較はできない。
 * 実際に upsert が書き込む・書き込み済みの意味のあるフィールドだけを抽出して比較する。
 */
interface EventContentSnapshot {
    summary: string;
    description: string;
    location: string;
    startDateTime: string;
    endDateTime: string;
    colorId: string;
    status: string;
}

/**
 * イベントから比較対象フィールドのみを抽出したスナップショットを作る。
 * @param event - 対象イベント
 * @returns 比較用スナップショット
 */
const toContentSnapshot = (
    event: calendar_v3.Schema$Event,
): EventContentSnapshot => ({
    summary: event.summary ?? '',
    description: event.description ?? '',
    location: event.location ?? '',
    startDateTime: event.start?.dateTime ?? event.start?.date ?? '',
    endDateTime: event.end?.dateTime ?? event.end?.date ?? '',
    colorId: event.colorId ?? '',
    status: event.extendedProperties?.private?.status ?? '',
});

/**
 * 2つのスナップショットが完全一致するかどうかを判定する。
 * @param a - 比較対象1
 * @param b - 比較対象2
 * @returns 完全一致すれば true
 */
const isSameContentSnapshot = (
    a: EventContentSnapshot,
    b: EventContentSnapshot,
): boolean =>
    a.summary === b.summary &&
    a.description === b.description &&
    a.location === b.location &&
    a.startDateTime === b.startDateTime &&
    a.endDateTime === b.endDateTime &&
    a.colorId === b.colorId &&
    a.status === b.status;

/**
 * newEvent（これから書き込む内容）と existingEvent（既存イベント）を比較し、
 * 実質的な内容差分があるかどうかを判定する。
 * 差分が無い場合は Google Calendar API への updateCalendarData（PUT）呼び出しを
 * 省略できる（PERF-076）。
 * @param newEvent - 書き込み予定のイベント内容
 * @param existingEvent - 既存イベント（Google Calendar から取得済み）
 * @returns 内容に差分があれば true
 */
export const hasEventContentChanged = (
    newEvent: calendar_v3.Schema$Event,
    existingEvent: calendar_v3.Schema$Event,
): boolean =>
    !isSameContentSnapshot(
        toContentSnapshot(newEvent),
        toContentSnapshot(existingEvent),
    );
