import type { RaceDateTime } from '../model/valueObject/raceDateTime';
import { RaceType } from '../model/valueObject/raceType';

/**
 * fetch 単位が「年単位（各年の1月1日）」となる raceType かを判定する。
 * JRA と BOATRACE は年単位、それ以外は月単位で取得する。
 * @param raceType - レース種別
 * @returns 年単位で取得すべき場合は true
 */
export const isYearlyFetchRaceType = (raceType: RaceType): boolean =>
    raceType === RaceType.JRA || raceType === RaceType.BOATRACE;

/**
 * 指定した raceType に対して、fetch に渡す日付リストを作成する。
 * JRA/BOATRACE は年単位（各年の1月1日）、それ以外は月単位（各月の1日）で
 * startDate〜finishDate の範囲を網羅するリストを返す。
 * @param raceType - レース種別
 * @param startDate - 取得開始日
 * @param finishDate - 取得終了日
 * @returns fetch 対象の日付リスト
 */
export const buildFetchDateList = (
    raceType: RaceType,
    startDate: RaceDateTime,
    finishDate: RaceDateTime,
): RaceDateTime[] => {
    const dateList: RaceDateTime[] = [];
    if (isYearlyFetchRaceType(raceType)) {
        // JRA と BOATRACE は年単位で取得（各年の1月1日）
        const startYear = startDate.getFullYear();
        const endYear = finishDate.getFullYear();
        for (let year = startYear; year <= endYear; year++) {
            dateList.push(new Date(year, 0, 1));
        }
    } else {
        // その他は月単位で取得（各月の1日）
        const month = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            1,
        );
        const endMonth = new Date(
            finishDate.getFullYear(),
            finishDate.getMonth(),
            1,
        );
        while (month <= endMonth) {
            dateList.push(new Date(month));
            month.setMonth(month.getMonth() + 1);
        }
    }
    return dateList;
};
