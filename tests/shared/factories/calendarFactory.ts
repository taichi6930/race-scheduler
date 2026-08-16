import {
    type CalendarDataEntity,
    RaceType,
    validateCalendarDataEntity,
} from '@race-schedule/core';

export interface CalendarFactoryOverrides {
    id?: string;
    raceType?: RaceType;
    title?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
    overrides?: Partial<CalendarDataEntity>;
}

const DEFAULTS = {
    id: 'evt-test-001',
    raceType: RaceType.JRA,
    title: 'テストレース',
    startTime: '2026-04-26T10:00:00+09:00',
    endTime: '2026-04-26T10:30:00+09:00',
    location: '東京',
    description: 'integration test',
};

/**
 * CalendarDataEntity を生成するファクトリ
 */
export const CalendarFactory = {
    create(input: CalendarFactoryOverrides = {}): CalendarDataEntity {
        const base: CalendarDataEntity = {
            id: input.id ?? DEFAULTS.id,
            raceType: input.raceType ?? DEFAULTS.raceType,
            title: input.title ?? DEFAULTS.title,
            startTime: input.startTime ?? DEFAULTS.startTime,
            endTime: input.endTime ?? DEFAULTS.endTime,
            location: input.location ?? DEFAULTS.location,
            description: input.description ?? DEFAULTS.description,
        };
        return validateCalendarDataEntity({ ...base, ...input.overrides });
    },

    /**
     * count 件の CalendarDataEntity をまとめて生成する。
     *
     * 既定では id/title のみが連番で変わり、raceType 等は全件同一になる。
     * filter/sort/mapping を検証するテストがこの均質なリストを使うと、
     * 選別・順序のバグが複数要素でも顕在化しない（test-quality-audit.md R2）。
     * 型等を意図的に混在させたい場合は [variantAt] でインデックスごとの
     * 上書きを指定する。
     * @param count - 生成する件数
     * @param input - 全件共通の基本オーバーライド
     * @param variantAt - インデックス（0始まり）ごとに追加で適用するオーバーライド
     */
    createMany(
        count: number,
        input: CalendarFactoryOverrides = {},
        variantAt?: (index: number) => Partial<CalendarFactoryOverrides>,
    ): CalendarDataEntity[] {
        return Array.from({ length: count }, (_, index) =>
            CalendarFactory.create({
                ...input,
                id: `evt-test-${String(index + 1).padStart(3, '0')}`,
                title: `テストレース${index + 1}`,
                ...variantAt?.(index),
            }),
        );
    },
};
