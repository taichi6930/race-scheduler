import type { RaceDetailUiConfig } from '@race-schedule/core';

/**
 * レイアウト構成（`ui_layout` テーブル）リポジトリインターフェース
 * （race-detail-sdui-design.md §1.3 参照）。
 */
export interface IUiLayoutRepository {
    /**
     * 指定キーの構成を返す。行が無い・JSONが不正な場合は undefined
     * （呼び出し側でコード内既定構成へフォールバックする）。
     * @param layoutKey - `race_detail.<raceType>` 形式のキー
     */
    get: (layoutKey: string) => Promise<RaceDetailUiConfig | undefined>;
    /**
     * 指定キーの構成を作成または更新する。
     * @param layoutKey - `race_detail.<raceType>` 形式のキー
     * @param config - 検証済みの構成
     */
    upsert: (layoutKey: string, config: RaceDetailUiConfig) => Promise<void>;
}
