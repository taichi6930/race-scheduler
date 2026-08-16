import {
    type PlayerEntity,
    RaceType,
    validatePlayerEntity,
} from '@race-schedule/core';

export interface PlayerFactoryOverrides {
    raceType?: RaceType;
    playerNo?: string;
    playerName?: string;
    priority?: number;
    overrides?: Partial<PlayerEntity>;
}

const DEFAULTS = {
    raceType: RaceType.JRA,
    playerNo: '00001',
    playerName: 'テスト太郎',
    priority: 0,
};

/**
 * PlayerEntity を生成するファクトリ
 */
export const PlayerFactory = {
    create(input: PlayerFactoryOverrides = {}): PlayerEntity {
        const base: PlayerEntity = {
            raceType: input.raceType ?? DEFAULTS.raceType,
            playerNo: input.playerNo ?? DEFAULTS.playerNo,
            playerName: input.playerName ?? DEFAULTS.playerName,
            priority: input.priority ?? DEFAULTS.priority,
        };
        return validatePlayerEntity({ ...base, ...input.overrides });
    },

    /**
     * count 件の PlayerEntity をまとめて生成する。
     *
     * 既定では playerNo/playerName のみが連番で変わり、raceType/priority 等は
     * 全件同一になる。filter/sort/mapping を検証するテストがこの均質な
     * リストを使うと、選別・順序のバグが複数要素でも顕在化しない
     * （test-quality-audit.md R2）。型・優先度等を意図的に混在させたい
     * 場合は [variantAt] でインデックスごとの上書きを指定する。
     * @param count - 生成する件数
     * @param input - 全件共通の基本オーバーライド
     * @param variantAt - インデックス（0始まり）ごとに追加で適用するオーバーライド
     */
    createMany(
        count: number,
        input: PlayerFactoryOverrides = {},
        variantAt?: (index: number) => Partial<PlayerFactoryOverrides>,
    ): PlayerEntity[] {
        return Array.from({ length: count }, (_, index) =>
            PlayerFactory.create({
                ...input,
                playerNo: String(index + 1).padStart(5, '0'),
                playerName: `テスト選手${index + 1}`,
                ...variantAt?.(index),
            }),
        );
    },
};
