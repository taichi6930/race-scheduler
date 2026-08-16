/**
 * calendar Worker 通信モジュール
 * Google Calendarへのレース情報同期をトリガーする
 */

import type { CalendarUpsertResult } from '@race-schedule/core';
import {
    calendarUpsertResultSchema,
    withServiceAuthHeader,
} from '@race-schedule/core';

import { getCalendarApiUrl } from '../types';
import { fetchWithTimeout } from './http';

/**
 * calendar Workerにレース種別・期間を指定して、Google Calendarへの同期を依頼する。
 * @param raceTypeList レース種別のリスト
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param finishDate 終了日（YYYY-MM-DD形式）
 * @returns カレンダー更新結果（作成数・更新数・失敗情報）
 */
export async function syncCalendar(
    raceTypeList: string[],
    startDate: string,
    finishDate: string,
): Promise<CalendarUpsertResult> {
    const url = new URL('/sync', getCalendarApiUrl());
    return fetchWithTimeout<CalendarUpsertResult>(
        url,
        calendarUpsertResultSchema,
        {
            method: 'POST',
            headers: withServiceAuthHeader({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ raceTypeList, startDate, finishDate }),
        },
    );
}
