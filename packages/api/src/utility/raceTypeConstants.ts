import { RaceType } from '@race-schedule/core';

/**
 * docs エンドポイントで公開する raceType 値の一覧。
 * @remarks
 * RaceType の定義順（jra, nar, keirin, overseas, autorace, boatrace）をそのまま維持する。
 * docs のマジック値直書きを排除し、RaceType を単一の出所とする。
 */
export const RACE_TYPE_VALUES: RaceType[] = Object.values(RaceType);
