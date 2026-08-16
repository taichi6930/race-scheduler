import {
    findPlaceNameByCode,
    generatePlaceId,
    generateRaceId,
    type LocationCode,
    type PlaceId,
    type RaceDateTime,
    type RaceEntity,
    type RaceId,
    type RaceNumber,
    RaceType,
    validateRaceEntity,
} from '@race-schedule/core';

export interface RaceFactoryOverrides {
    raceType?: RaceType;
    datetime?: RaceDateTime;
    locationCode?: LocationCode;
    raceNumber?: RaceNumber;
    overrides?: Partial<RaceEntity>;
}

const DEFAULTS = {
    raceType: RaceType.JRA,
    datetime: new Date('2026-04-26T10:00:00+09:00') as RaceDateTime,
    locationCode: '05' as LocationCode, // JRA 東京
    raceNumber: 1 as RaceNumber,
};

/**
 * raceType に応じたデフォルトの raceGrade を返す
 */
const defaultRaceGrade = (raceType: RaceType): string => {
    switch (raceType) {
        case RaceType.BOATRACE:
        case RaceType.AUTORACE: {
            return 'SG';
        }
        default: {
            return 'GⅠ';
        }
    }
};

/**
 * raceType に応じた conditionData / raceStage を組み立てる
 */
const buildConditionalFields = (
    raceType: RaceType,
): Pick<RaceEntity, 'conditionData' | 'raceStage'> => {
    switch (raceType) {
        case RaceType.JRA:
        case RaceType.NAR:
        case RaceType.OVERSEAS: {
            return {
                conditionData: {
                    surfaceType: '芝',
                    distance: 2000,
                },
            };
        }
        case RaceType.KEIRIN: {
            return { raceStage: 'S級決勝' };
        }
        case RaceType.AUTORACE:
        case RaceType.BOATRACE: {
            return { raceStage: '優勝戦' };
        }
        default: {
            return {};
        }
    }
};

/**
 * RaceEntity を生成するファクトリ
 *
 * - raceCourse は locationCode から自動解決
 * - raceGrade / conditionData / raceStage は raceType に応じてデフォルト設定
 * - overrides で任意に上書き可能
 */
export const RaceFactory = {
    create(input: RaceFactoryOverrides = {}): RaceEntity {
        const raceType = input.raceType ?? DEFAULTS.raceType;
        const datetime = input.datetime ?? DEFAULTS.datetime;
        const locationCode = input.locationCode ?? DEFAULTS.locationCode;
        const raceNumber = input.raceNumber ?? DEFAULTS.raceNumber;

        const raceCourse = findPlaceNameByCode(locationCode, raceType);
        if (!raceCourse) {
            throw new Error(
                `RaceFactory: locationCode "${locationCode}" は raceType "${raceType}" に対する有効な開催場ではありません`,
            );
        }

        const placeId: PlaceId = generatePlaceId(
            raceType,
            datetime,
            locationCode,
        );
        const raceId: RaceId = generateRaceId(
            raceType,
            datetime,
            locationCode,
            raceNumber,
        );

        const base: RaceEntity = {
            raceId,
            placeId,
            raceType,
            datetime,
            raceName: 'テストレース',
            raceNumber,
            raceCourse,
            locationCode,
            raceGrade: defaultRaceGrade(raceType),
            ...buildConditionalFields(raceType),
        };

        return validateRaceEntity({ ...base, ...input.overrides });
    },

    /**
     * count 件の RaceEntity をまとめて生成する。
     *
     * 既定では raceNumber のみが連番で変わり、raceType/grade/datetime 等は
     * 全件同一になる。filter/sort/mapping を検証するテストがこの均質な
     * リストを使うと、選別・順序のバグが複数要素でも顕在化しない
     * （test-quality-audit.md R2）。型・グレード・日付を意図的に混在させたい
     * 場合は [variantAt] でインデックスごとの上書きを指定する。
     * @param count - 生成する件数
     * @param input - 全件共通の基本オーバーライド
     * @param variantAt - インデックス（0始まり）ごとに追加で適用するオーバーライド
     */
    createMany(
        count: number,
        input: RaceFactoryOverrides = {},
        variantAt?: (index: number) => Partial<RaceFactoryOverrides>,
    ): RaceEntity[] {
        return Array.from({ length: count }, (_, index) =>
            RaceFactory.create({
                ...input,
                raceNumber: ((input.raceNumber ?? 1) + index) as RaceNumber,
                ...variantAt?.(index),
            }),
        );
    },
};
