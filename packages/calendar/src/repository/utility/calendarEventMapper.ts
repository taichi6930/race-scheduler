import type { CalendarDataEntity, RaceType } from '@race-schedule/core';
import {
    shouldDisplayCalendarEvent,
    validateCalendarDataEntity,
} from '@race-schedule/core';
import type { calendar_v3 } from 'googleapis';

/**
 * Google Calendar イベント → CalendarDataEntity 変換まわりのロジック。
 * `GoogleCalendarRepository` から表示判定・変換の詳細を切り離すために独立させたモジュール。
 */

/**
 * イベントが表示対象かどうかを判定する。
 * 判定条件そのものは shouldDisplayCalendarEvent（domain/policy/eventVisibility）に集約されている。
 * @param event - 判定対象のイベント
 * @param dateToday - 基準日（YYYY-MM-DD）
 * @param dateTomorrow - 基準日の翌日
 * @param dateAfterTomorrow - 基準日の翌々日
 */
export const isDisplayableEvent = (
    event: calendar_v3.Schema$Event,
    dateToday: string,
    dateTomorrow: string,
    dateAfterTomorrow: string,
): boolean => {
    const start = event.start?.dateTime ?? event.start?.date;
    if (!start) return false;
    const eventDate = start.slice(0, 10); // YYYY-MM-DD
    const status = event.extendedProperties?.private?.status ?? '';

    return shouldDisplayCalendarEvent(
        eventDate,
        status,
        dateToday,
        dateTomorrow,
        dateAfterTomorrow,
    );
};

/**
 * Google Calendar イベントを CalendarDataEntity に変換・検証する。
 * @param event - 変換対象のイベント
 * @param raceType - 対象のレース種別
 */
export const toCalendarDataEntity = (
    event: calendar_v3.Schema$Event,
    raceType: RaceType,
): CalendarDataEntity =>
    validateCalendarDataEntity({
        id: event.id ?? '',
        raceType,
        title: event.summary ?? '',
        startTime: event.start?.dateTime ?? event.start?.date ?? '',
        endTime: event.end?.dateTime ?? event.end?.date ?? '',
        location: event.location ?? '',
        description: event.description ?? '',
    });

/**
 * イベント一覧を表示対象のみフィルタし、CalendarDataEntity に変換・検証する。
 * filter→map の2パス走査ではなく reduce による1パス走査で行う（PERF-137）。
 * @param eventList - Gateway から取得したイベント一覧
 * @param raceType - 対象のレース種別
 * @param dates - 表示判定の基準日（今日/翌日/翌々日）
 * @param dates.dateToday
 * @param dates.dateTomorrow
 * @param dates.dateAfterTomorrow
 */
export const filterDisplayableAndConvert = (
    eventList: calendar_v3.Schema$Event[],
    raceType: RaceType,
    dates: {
        dateToday: string;
        dateTomorrow: string;
        dateAfterTomorrow: string;
    },
): CalendarDataEntity[] =>
    eventList.reduce<CalendarDataEntity[]>((acc, event) => {
        if (
            isDisplayableEvent(
                event,
                dates.dateToday,
                dates.dateTomorrow,
                dates.dateAfterTomorrow,
            )
        ) {
            acc.push(toCalendarDataEntity(event, raceType));
        }
        return acc;
    }, []);
