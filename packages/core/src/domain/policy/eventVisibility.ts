/**
 * Google Calendar 上のイベントを取得結果に含めるべきかを判定する。
 *
 * | eventDate                    | status    | 表示判定 | 説明 |
 * | ----------------------------- | --------- | ------ | ---- |
 * | ≤today                        | predicted | 削除   | 予測データは過去・当日は不要 |
 * | ≤today                        | confirmed | 表示   | 確定データは常に表示 |
 * | ≤today                        | 無印      | 表示   | 無印は「確定」扱いで表示 |
 * | =tomorrow                      | predicted | 削除   | 翌日時点で予測データは不要 |
 * | =tomorrow                      | confirmed | 表示   | 確定データは常に表示 |
 * | =tomorrow                      | 無印      | 削除   | 無印は不要 |
 * | =afterTomorrow                 | predicted | 表示   | 直近2日間の予測は表示 |
 * | =afterTomorrow                 | confirmed | 表示   | 確定データは常に表示 |
 * | =afterTomorrow                 | 無印      | 表示   | 無印は「確定」扱いで表示 |
 * | ≥afterTomorrowの翌日以降        | predicted | 表示   | 未来の予測データは確定前なので表示 |
 * | ≥afterTomorrowの翌日以降        | confirmed | 表示   | 確定データは常に表示 |
 * | ≥afterTomorrowの翌日以降        | 無印      | 表示   | 無印は「確定」扱いで表示 |
 * @param eventDate - イベントの開催日（YYYY-MM-DD）
 * @param status - イベントのステータス（'predicted' | 'confirmed' | ''）
 * @param today - 基準日（実行時点、YYYY-MM-DD）
 * @param tomorrow - today の翌日（YYYY-MM-DD）
 * @param afterTomorrow - today の翌々日（YYYY-MM-DD）
 * @returns 表示すべき場合は true
 */
export const shouldDisplayCalendarEvent = (
    eventDate: string,
    status: string,
    today: string,
    tomorrow: string,
    afterTomorrow: string,
): boolean => {
    if (eventDate <= today) {
        return status !== 'predicted';
    }
    if (eventDate === tomorrow) {
        return status === 'confirmed';
    }
    return eventDate >= afterTomorrow;
};

/**
 * Google Calendar 上のイベントが、開催日・ステータスの観点から物理削除対象かを判定する。
 * （cleanseStaleEvents の「対象外開催場・日付」判定と組み合わせて使う想定）
 * @param eventDate - イベントの開催日（YYYY-MM-DD）
 * @param status - イベントのステータス（'predicted' | 'confirmed' | ''）
 * @param today - 基準日（実行時点、YYYY-MM-DD）
 * @param tomorrow - today の翌日（YYYY-MM-DD）
 * @returns 削除対象の場合は true
 */
export const isCalendarEventDeleteTarget = (
    eventDate: string,
    status: string,
    today: string,
    tomorrow: string,
): boolean => {
    if (eventDate <= today) {
        return status === 'predicted';
    }
    if (eventDate === tomorrow) {
        return status === 'predicted' || !status;
    }
    return false;
};
