/**
 * domain/policy/raceDetailUi/resolveRaceDetailUi テスト
 *
 * ## デシジョンテーブル: resolveRaceDetailUi
 *
 * | #    | 入力                                                    | 期待結果                                    |
 * |------|-----------------------------------------------------------|----------------------------------------------|
 * | T-01 | 既定KEIRIN構成 + グレード/ステージ有り                     | kvセクションの全行が揃う                     |
 * | T-02 | kvセクションにグレードが空文字のレース                     | グレード行が省略される                       |
 * | T-03 | linksセクション                                            | buildRaceLinksの結果がitemsに入る            |
 * | T-04 | playersセクション                                          | 渡したplayersがrowsにそのまま入る            |
 * | T-05 | kvのfieldにlabel指定あり                                   | 指定したlabelが使われる（defaultLabel無視）  |
 * | T-06 | kvのfieldにlabel指定なし                                   | defaultLabelが使われる                       |
 */

import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    type RacePlayerEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';

import { buildDefaultRaceDetailConfig } from '../../../../../src/domain/policy/raceDetailUi/defaultConfig';
import { resolveRaceDetailUi } from '../../../../../src/domain/policy/raceDetailUi/resolveRaceDetailUi';

const KEIRIN_ENTITY: RaceEntity = {
    raceId: validateRaceId('keirin202608023601'),
    placeId: validatePlaceId('keirin2026080236'),
    raceType: RaceType.KEIRIN,
    datetime: new Date('2026-08-02T14:33:00+09:00'),
    raceName: 'S級準決勝',
    raceNumber: 10,
    raceCourse: '和歌山',
    locationCode: validateLocationCode('36'),
    raceGrade: 'GⅢ',
    raceStage: 'S級準決勝',
};

const PLAYERS: RacePlayerEntity[] = [
    {
        carNumber: 1,
        frameNumber: 1,
        playerNo: '012345',
        playerName: '柴崎淳',
        term: 91,
        branch: '三重',
    },
];

describe('resolveRaceDetailUi', () => {
    it('T-01: 既定KEIRIN構成でkvセクションの全行が揃うこと', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.KEIRIN);
        const result = resolveRaceDetailUi(KEIRIN_ENTITY, PLAYERS, config);

        const kvSection = result.sections.find((s) => s.type === 'kv');
        expect(kvSection?.type === 'kv' && kvSection.rows).toEqual([
            { label: '発走', value: '14:33' },
            { label: '競技', value: '競輪' },
            { label: '会場', value: '和歌山' },
            { label: 'レース', value: '10R' },
            { label: 'グレード', value: 'GⅢ' },
            { label: 'ステージ', value: 'S級準決勝' },
        ]);
    });

    it('T-02: グレードが空文字の場合その行が省略されること', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.KEIRIN);
        const noGradeEntity: RaceEntity = { ...KEIRIN_ENTITY, raceGrade: '' };
        const result = resolveRaceDetailUi(noGradeEntity, PLAYERS, config);

        const kvSection = result.sections.find((s) => s.type === 'kv');
        expect(
            kvSection?.type === 'kv' &&
                kvSection.rows.some((row) => row.label === 'グレード'),
        ).toBe(false);
    });

    it('T-03: linksセクションはbuildRaceLinksの結果を返すこと', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.KEIRIN);
        const result = resolveRaceDetailUi(KEIRIN_ENTITY, PLAYERS, config);

        const linksSection = result.sections.find((s) => s.type === 'links');
        expect(
            linksSection?.type === 'links' && linksSection.items.length > 0,
        ).toBe(true);
        expect(
            linksSection?.type === 'links' &&
                linksSection.items.some((item) =>
                    item.label.includes('netkeirin'),
                ),
        ).toBe(true);
    });

    it('T-04: playersセクションは渡したplayersをそのままrowsに入れること', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.KEIRIN);
        const result = resolveRaceDetailUi(KEIRIN_ENTITY, PLAYERS, config);

        const playersSection = result.sections.find(
            (s) => s.type === 'players',
        );
        expect(
            playersSection?.type === 'players' && playersSection.rows,
        ).toEqual(PLAYERS);
    });

    it('T-05: fieldにlabel指定がある場合そのlabelが使われること', () => {
        const config = {
            sections: [
                {
                    type: 'kv' as const,
                    fields: [{ key: 'grade' as const, label: '級・グレード' }],
                },
            ],
        };
        const result = resolveRaceDetailUi(KEIRIN_ENTITY, [], config);

        const kvSection = result.sections.find((s) => s.type === 'kv');
        expect(kvSection?.type === 'kv' && kvSection.rows).toEqual([
            { label: '級・グレード', value: 'GⅢ' },
        ]);
    });

    it('T-06: fieldにlabel指定が無い場合defaultLabelが使われること', () => {
        const config = {
            sections: [
                { type: 'kv' as const, fields: [{ key: 'grade' as const }] },
            ],
        };
        const result = resolveRaceDetailUi(KEIRIN_ENTITY, [], config);

        const kvSection = result.sections.find((s) => s.type === 'kv');
        expect(kvSection?.type === 'kv' && kvSection.rows).toEqual([
            { label: 'グレード', value: 'GⅢ' },
        ]);
    });
});
