import type { RaceEntity } from '../../../entity/raceEntity';
import type { RacePlayerEntity } from '../../../entity/racePlayerEntity';
import type { RaceDetailUi } from '../../../schemas/raceDetailUiSchema';
import { buildRaceLinks } from '../calendarDescription';
import type { RaceDetailUiConfig } from './defaultConfig';
import { RACE_DETAIL_FIELDS } from './fieldCatalog';

/**
 * 保存済み/既定の構成（フィールド参照、{@link RaceDetailUiConfig}）と実際の
 * レースデータを突き合わせ、frontへ返す解決済みセクションJSONを組み立てる。
 * @param raceEntity - 対象レース
 * @param players - 対象レースの出走選手一覧（車番順）
 * @param config - 適用する構成
 * @returns 解決済みのセクションJSON
 */
export const resolveRaceDetailUi = (
    raceEntity: RaceEntity,
    players: readonly RacePlayerEntity[],
    config: RaceDetailUiConfig,
): RaceDetailUi => ({
    schemaVersion: 1,
    sections: config.sections.map((section) => {
        switch (section.type) {
            case 'kv':
                return {
                    type: 'kv' as const,
                    rows: section.fields.flatMap((field) => {
                        const value =
                            RACE_DETAIL_FIELDS[field.key].resolve(raceEntity);
                        if (value === null) return [];
                        return [
                            {
                                label:
                                    field.label ??
                                    RACE_DETAIL_FIELDS[field.key].defaultLabel,
                                value,
                            },
                        ];
                    }),
                };
            case 'links':
                return {
                    type: 'links' as const,
                    items: buildRaceLinks(raceEntity),
                };
            case 'players':
                return {
                    type: 'players' as const,
                    title: section.title,
                    watchToggle: section.watchToggle,
                    rows: [...players],
                };
        }
    }),
});
