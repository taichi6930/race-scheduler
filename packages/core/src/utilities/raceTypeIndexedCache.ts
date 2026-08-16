import type { RaceType } from '../domain/model/valueObject/raceType';

/**
 * list 引数が省略された（デフォルトのマスタ配列を使う）呼び出し用のキャッシュキー。
 * テスト等で list を明示的に差し替えた呼び出しと、キャッシュ領域を分離するために使う。
 */
const DEFAULT_LIST_KEY = Symbol('race-type-indexed-cache-default-list');

/**
 * raceType（実質6種: JRA/NAR/OVERSEAS/KEIRIN/AUTORACE/BOATRACE）をキーとした
 * 計算結果のメモ化キャッシュを作るユーティリティ。
 *
 * マスタ配列（gradeMaster/courseOfficialMaster/gradeStageMaster 等、いずれも
 * モジュール初期化時に確定する不変データ）に対する `.filter()`/`.map()`/`.flatMap()`
 * 等の走査結果は、同一 raceType に対して常に同じ結果になる。にもかかわらず
 * 呼び出しのたびに毎回マスタ全体を再走査しているケースがあったため（PERF-096）、
 * raceType 単位で一度だけ計算した結果を使い回せる汎用ラッパーを提供する。
 *
 * `list` はテスト等でデフォルトのマスタ配列を差し替えたい場合のオプション引数。
 * 未指定時は固定のシンボルをキーにし、list を指定した場合は list の参照ごとに
 * 別のキャッシュ領域を持たせることで、テストでの一時的な差し替えが本番用の
 * キャッシュ結果を汚染しないようにしている。
 * @param compute - raceType（と省略可能な list）から結果を計算する純関数
 * @returns raceType（と省略可能な list）を受け取り、メモ化された結果を返す関数
 */
export const buildRaceTypeIndexedCache = <T, L>(
    compute: (raceType: RaceType, list?: L) => T,
): ((raceType: RaceType, list?: L) => T) => {
    const cacheByList = new Map<
        L | typeof DEFAULT_LIST_KEY,
        Map<RaceType, T>
    >();

    return (raceType: RaceType, list?: L): T => {
        const listKey = list ?? DEFAULT_LIST_KEY;

        let cacheForList = cacheByList.get(listKey);
        if (!cacheForList) {
            cacheForList = new Map<RaceType, T>();
            cacheByList.set(listKey, cacheForList);
        }

        const cached = cacheForList.get(raceType);
        if (cached !== undefined) {
            return cached;
        }

        const result = compute(raceType, list);
        cacheForList.set(raceType, result);
        return result;
    };
};
