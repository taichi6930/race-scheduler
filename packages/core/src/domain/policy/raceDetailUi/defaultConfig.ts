import { RaceType } from '../../model/valueObject/raceType';
import {
    RACE_DETAIL_FIELD_KEYS,
    type RaceDetailFieldKey,
} from './fieldCatalog';

/** kv セクションの1フィールド参照（値そのものではなくカタログキー）。 */
export interface RaceDetailKvFieldConfig {
    readonly key: RaceDetailFieldKey;
    /** 省略時は {@link RACE_DETAIL_FIELDS} の `defaultLabel` を使う */
    readonly label?: string;
}

export interface RaceDetailKvSectionConfig {
    readonly type: 'kv';
    readonly fields: readonly RaceDetailKvFieldConfig[];
}

export interface RaceDetailLinksSectionConfig {
    readonly type: 'links';
}

export interface RaceDetailPlayersSectionConfig {
    readonly type: 'players';
    readonly title: string;
    /** ★（注目選手トグル）を表示するか */
    readonly watchToggle: boolean;
}

/**
 * レース詳細のセクション構成（保存・編集対象）。値そのものではなく
 * フィールド参照を持つ点が {@link RaceDetailUi}（解決済みレスポンス）との違い。
 */
export type RaceDetailSectionConfig =
    | RaceDetailKvSectionConfig
    | RaceDetailLinksSectionConfig
    | RaceDetailPlayersSectionConfig;

export interface RaceDetailUiConfig {
    readonly sections: readonly RaceDetailSectionConfig[];
}

/**
 * 保存済み構成が無い場合に使う既定構成。現在frontにベタ書きされている表示内容と
 * 1:1で一致させている（race-detail-sdui-design.md §1.3）。
 *
 * 注目選手トグルの可否のみraceTypeに依存するため引数を取るが、それ以外は
 * 全raceType共通の構成でよい（値が無いフィールド・空のリンク/選手一覧は
 * {@link resolveRaceDetailUi} 側で行/セクションごと空配列になるだけで、
 * raceType別に構成を出し分ける必要が無いため）。
 * @param raceType - 対象レースの競技種別
 * @returns 既定のセクション構成
 */
export const buildDefaultRaceDetailConfig = (
    raceType: RaceType,
): RaceDetailUiConfig => ({
    sections: [
        {
            type: 'kv',
            fields: RACE_DETAIL_FIELD_KEYS.map((key) => ({ key })),
        },
        { type: 'links' },
        {
            type: 'players',
            title: '出走選手',
            watchToggle:
                raceType === RaceType.KEIRIN || raceType === RaceType.AUTORACE,
        },
    ],
});
