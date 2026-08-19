import {
    type GradeType,
    generatePlaceEntity,
    type LocationCode,
    type PlaceEntity,
    type PlaceHeldDays,
    type RaceDateTime,
    RaceType,
    validatePlaceEntity,
} from '@race-schedule/core';

export interface PlaceFactoryOverrides {
    raceType?: RaceType;
    datetime?: RaceDateTime;
    locationCode?: LocationCode;
    placeGrade?: GradeType;
    placeHeldDays?: PlaceHeldDays;
    overrides?: Partial<PlaceEntity>;
}

// SAFETY: テストファクトリの固定デフォルト値であり、有効な日付文字列・実在する開催場コード
// （'05'=JRA東京）を直接指定しているため、ブランド型としての実行時制約を常に満たす。
const DEFAULTS = {
    raceType: RaceType.JRA,
    datetime: new Date('2026-04-26T10:00:00+09:00') as RaceDateTime,
    locationCode: '05' as LocationCode,
};

/**
 * PlaceEntity を生成するファクトリ
 *
 * 利用例:
 *   const place = PlaceFactory.create();
 *   const keirin = PlaceFactory.create({ raceType: 'KEIRIN', locationCode: '11', placeGrade: 'GⅠ' as GradeType });
 */
export const PlaceFactory = {
    create(input: PlaceFactoryOverrides = {}): PlaceEntity {
        const raceType = input.raceType ?? DEFAULTS.raceType;
        const datetime = input.datetime ?? DEFAULTS.datetime;
        const locationCode = input.locationCode ?? DEFAULTS.locationCode;

        const base = generatePlaceEntity(
            raceType,
            datetime,
            locationCode,
            input.placeGrade,
            input.placeHeldDays,
        );

        if (!input.overrides) {
            return base;
        }
        return validatePlaceEntity({ ...base, ...input.overrides });
    },

    /**
     * count 件の PlaceEntity をまとめて生成する。
     *
     * 既定では datetime のみが1日ずつずれ、raceType/grade 等は全件同一になる。
     * filter/sort/mapping を検証するテストがこの均質なリストを使うと、
     * 選別・順序のバグが複数要素でも顕在化しない（test-quality-audit.md R2）。
     * 型・グレード等を意図的に混在させたい場合は [variantAt] で
     * インデックスごとの上書きを指定する。
     * @param count - 生成する件数
     * @param input - 全件共通の基本オーバーライド
     * @param variantAt - インデックス（0始まり）ごとに追加で適用するオーバーライド
     */
    createMany(
        count: number,
        input: PlaceFactoryOverrides = {},
        variantAt?: (index: number) => Partial<PlaceFactoryOverrides>,
    ): PlaceEntity[] {
        return Array.from({ length: count }, (_, index) => {
            const baseDate = input.datetime ?? DEFAULTS.datetime;
            // SAFETY: baseDate は既に RaceDateTime（有効な Date）であり、日数を加算しても
            // Date として不正にはならないため、ブランド型への再キャストは安全。
            const datetime = new Date(
                baseDate.getTime() + index * 24 * 60 * 60 * 1000,
            ) as RaceDateTime;
            return PlaceFactory.create({
                ...input,
                datetime,
                ...variantAt?.(index),
            });
        });
    },
};
