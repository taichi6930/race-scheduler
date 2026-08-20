/**
 * 開催場名 → YoutubeのユーザーID の対応表。
 *
 * 開催場名は `RaceEntity.raceCourse`（実行時に決まる文字列）で引かれるため、
 * キーを固定できない索引型として定義する。
 */
export interface YoutubeUserIdMap {
    [raceCourse: string]: string;
}
