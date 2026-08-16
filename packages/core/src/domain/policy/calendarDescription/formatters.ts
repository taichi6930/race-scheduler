import type { RaceEntity } from '../../../entity/raceEntity';
import {
    getJstDate,
    getJstHours,
    getJstMinutes,
    getJstMonth,
    getJstYear,
} from '../../../utilities/dateJst';

/**
 * JST基準で発走時刻をフォーマット (HH:mm形式)
 * @param datetime
 */
export const formatRaceTime = (datetime: Date): string => {
    const hour = String(getJstHours(datetime)).padStart(2, '0');
    const minute = String(getJstMinutes(datetime)).padStart(2, '0');
    return `発走: ${hour}:${minute}`;
};

/**
 * JST基準で更新日時をフォーマット (yyyy/MM/dd HH:mm形式)
 * @param updateDate
 */
export const formatUpdateTime = (updateDate: Date): string => {
    const year = getJstYear(updateDate);
    const month = String(getJstMonth(updateDate)).padStart(2, '0');
    const day = String(getJstDate(updateDate)).padStart(2, '0');
    const hour = String(getJstHours(updateDate)).padStart(2, '0');
    const minute = String(getJstMinutes(updateDate)).padStart(2, '0');
    return `更新日時: ${year}/${month}/${day} ${hour}:${minute}`;
};

/**
 * 複数の行をテンプレート化して整形
 * null/空文字は除外
 * @param parts
 */
export const formatDescriptionTemplate = (parts: (string | null)[]): string => {
    return parts.filter(Boolean).join('\n').replaceAll(/\n\s+/g, '\n');
};

/**
 * 発走時刻と更新時刻のみのシンプルな説明文を生成する。
 * AUTORACE / BOATRACE / OVERSEAS と factory の default で共通の実装。
 * （以前は同一実装が 3 つの builder ファイルに重複していた）
 * @param raceEntity - レースエンティティ
 * @param updateDate - 更新日時
 * @returns 説明文
 */
export const getSimpleDescription = (
    raceEntity: RaceEntity,
    updateDate: Date,
): string =>
    formatDescriptionTemplate([
        formatRaceTime(raceEntity.datetime),
        formatUpdateTime(updateDate),
    ]);

/**
 * カレンダー説明文の共通骨格を組み立てる高階関数。
 *
 * jra/keirin/nar の `getXxxDescription` が
 * 「extraLines → 発走時刻 → アンカータグ群 → 更新時刻」という同一構成だったため集約する。
 * 種別固有の差分はアンカータグ生成関数と先頭の追加行（馬場条件等）のみ。
 * @param raceEntity - レースエンティティ
 * @param updateDate - 更新日時
 * @param buildAnchorTags - 種別ごとのアンカータグ生成関数
 * @param extraLines - 発走時刻より前に差し込む追加行（省略可。null は自動除外）
 * @returns 説明文
 */
export const buildDescription = (
    raceEntity: RaceEntity,
    updateDate: Date,
    buildAnchorTags: (raceEntity: RaceEntity) => string[],
    extraLines: (string | null)[] = [],
): string =>
    formatDescriptionTemplate([
        ...extraLines,
        formatRaceTime(raceEntity.datetime),
        ...buildAnchorTags(raceEntity),
        formatUpdateTime(updateDate),
    ]);
