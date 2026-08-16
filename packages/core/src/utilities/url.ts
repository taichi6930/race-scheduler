/**
 * @file URL関連のユーティリティ関数を提供するモジュール
 */

/**
 * netkeibaのJRA出馬表のURLを生成する関数
 * @param raceId
 */
export const createNetkeibaJraShutubaUrl = (raceId: string): string =>
    `https://race.sp.netkeiba.com/race/shutuba.html?race_id=${raceId}`;

/**
 * netkeibaのJRAレース動画のURLを生成する関数
 * @param raceId
 */
export const createNetkeibaJraRaceVideoUrl = (raceId: string): string =>
    `https://race.sp.netkeiba.com/?pid=race_movie&race_id=${raceId}`;

/**
 * netkeibaのNAR出馬表のURLを生成する関数
 * @param raceId
 */
export const createNetkeibaNarShutubaUrl = (raceId: string): string =>
    `https://nar.sp.netkeiba.com/race/shutuba.html?race_id=${raceId}`;

/**
 * netkeibaのNARレース動画のURLを生成する関数
 * @param raceId
 */
export const createNetkeibaNarRaceVideoUrl = (raceId: string): string =>
    `https://nar.sp.netkeiba.com/race/race_movie.html?race_id=${raceId}`;

/**
 * netkeirinの出馬表のURLを生成する関数
 * @param raceId
 */
export const createNetkeirinRaceShutubaUrl = (raceId: string): string =>
    `https://keirin.netkeiba.com/race/entry/?race_id=${raceId}`;

/**
 * netkeibaのリダイレクトURLを生成する関数
 * @param url
 */
export const createNetkeibaRedirectUrl = (url: string): string =>
    `https://netkeiba.page.link/?link=${encodeURIComponent(url)}`;
