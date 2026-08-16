/**
 * domain/policy/raceDetailUi/defaultConfig テスト
 *
 * ## デシジョンテーブル: buildDefaultRaceDetailConfig
 *
 * | #    | raceType | 期待結果                                                  |
 * |------|----------|------------------------------------------------------------|
 * | T-01 | KEIRIN   | players セクションの watchToggle が true                   |
 * | T-02 | JRA      | players セクションの watchToggle が false                  |
 * | T-03 | 共通     | kv セクションの fields が RACE_DETAIL_FIELD_KEYS と一致    |
 * | T-04 | 共通     | links セクションを含む                                     |
 * | T-05 | AUTORACE | players セクションの watchToggle が true                   |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { buildDefaultRaceDetailConfig } from '../../../../../src/domain/policy/raceDetailUi/defaultConfig';
import { RACE_DETAIL_FIELD_KEYS } from '../../../../../src/domain/policy/raceDetailUi/fieldCatalog';

describe('buildDefaultRaceDetailConfig', () => {
    it('T-01: KEIRINの場合playersセクションのwatchToggleがtrueであること', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.KEIRIN);
        const playersSection = config.sections.find(
            (section) => section.type === 'players',
        );
        expect(
            playersSection?.type === 'players' && playersSection.watchToggle,
        ).toBe(true);
    });

    it('T-02: JRAの場合playersセクションのwatchToggleがfalseであること', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.JRA);
        const playersSection = config.sections.find(
            (section) => section.type === 'players',
        );
        expect(
            playersSection?.type === 'players' && playersSection.watchToggle,
        ).toBe(false);
    });

    it('T-03: kvセクションのfieldsがRACE_DETAIL_FIELD_KEYSと一致すること', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.KEIRIN);
        const kvSection = config.sections.find(
            (section) => section.type === 'kv',
        );
        expect(
            kvSection?.type === 'kv' && kvSection.fields.map((f) => f.key),
        ).toEqual([...RACE_DETAIL_FIELD_KEYS]);
    });

    it('T-04: linksセクションを含むこと', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.KEIRIN);
        expect(
            config.sections.some((section) => section.type === 'links'),
        ).toBe(true);
    });

    it('T-05: AUTORACEの場合playersセクションのwatchToggleがtrueであること', () => {
        const config = buildDefaultRaceDetailConfig(RaceType.AUTORACE);
        const playersSection = config.sections.find(
            (section) => section.type === 'players',
        );
        expect(
            playersSection?.type === 'players' && playersSection.watchToggle,
        ).toBe(true);
    });
});
