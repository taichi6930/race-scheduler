/**
 * raceTypeIndexedCache ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | シナリオ                                          | 期待                                          |
 * |------|-----------------------------------------------------|-----------------------------------------------|
 * | T-01 | 同一raceTypeで2回呼び出す                          | compute は1回だけ実行され、同一の結果を返す   |
 * | T-02 | 異なるraceTypeで呼び出す                           | raceType ごとに個別に compute が実行される    |
 * | T-03 | list省略で2回呼び出す                              | list省略時専用のキャッシュ領域が使われる      |
 * | T-04 | 異なるlist（参照違い）で同一raceTypeを呼び出す      | list の参照ごとに別キャッシュ領域になる       |
 * | T-05 | 同一のlist参照・同一raceTypeで2回呼び出す           | 2回目はキャッシュされた結果を返す（再計算なし）|
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '../../../src/domain/model/valueObject/raceType';
import { buildRaceTypeIndexedCache } from '../../../src/utilities/raceTypeIndexedCache';

describe('buildRaceTypeIndexedCache', () => {
    it('[T-01] buildRaceTypeIndexedCache_同一raceTypeで2回呼び出す_computeは1回だけ実行され同一の結果を返す', () => {
        // Arrange
        let callCount = 0;
        const cached = buildRaceTypeIndexedCache((raceType: RaceType) => {
            callCount++;
            return `${raceType}-result`;
        });

        // Act
        const first = cached(RaceType.JRA);
        const second = cached(RaceType.JRA);

        // Assert
        expect(first).toBe('jra-result');
        expect(second).toBe('jra-result');
        expect(callCount).toBe(1);
    });

    it('[T-02] buildRaceTypeIndexedCache_異なるraceTypeで呼び出す_raceTypeごとに個別にcomputeが実行される', () => {
        // Arrange
        let callCount = 0;
        const cached = buildRaceTypeIndexedCache((raceType: RaceType) => {
            callCount++;
            return `${raceType}-result`;
        });

        // Act
        const jra = cached(RaceType.JRA);
        const nar = cached(RaceType.NAR);

        // Assert
        expect(jra).toBe('jra-result');
        expect(nar).toBe('nar-result');
        expect(callCount).toBe(2);
    });

    it('[T-03] buildRaceTypeIndexedCache_list省略で2回呼び出す_list省略時専用のキャッシュ領域が使われる', () => {
        // Arrange
        let callCount = 0;
        const cached = buildRaceTypeIndexedCache(
            (raceType: RaceType, list?: readonly string[]) => {
                callCount++;
                return `${raceType}:${list?.length ?? 0}`;
            },
        );

        // Act
        const first = cached(RaceType.KEIRIN);
        const second = cached(RaceType.KEIRIN);

        // Assert
        expect(first).toBe('keirin:0');
        expect(second).toBe('keirin:0');
        expect(callCount).toBe(1);
    });

    it('[T-04] buildRaceTypeIndexedCache_異なるlist参照で同一raceTypeを呼び出す_list参照ごとに別キャッシュ領域になる', () => {
        // Arrange
        let callCount = 0;
        const cached = buildRaceTypeIndexedCache(
            (raceType: RaceType, list?: readonly string[]) => {
                callCount++;
                return `${raceType}:${list?.join(',') ?? 'default'}`;
            },
        );
        const listA = ['a'];
        const listB = ['b'];

        // Act
        const resultA = cached(RaceType.BOATRACE, listA);
        const resultB = cached(RaceType.BOATRACE, listB);

        // Assert
        expect(resultA).toBe('boatrace:a');
        expect(resultB).toBe('boatrace:b');
        expect(callCount).toBe(2);
    });

    it('[T-05] buildRaceTypeIndexedCache_同一list参照かつ同一raceTypeで2回呼び出す_2回目はキャッシュされた結果を返す', () => {
        // Arrange
        let callCount = 0;
        const cached = buildRaceTypeIndexedCache(
            (raceType: RaceType, list?: readonly string[]) => {
                callCount++;
                return `${raceType}:${list?.join(',') ?? 'default'}`;
            },
        );
        const list = ['x', 'y'];

        // Act
        const first = cached(RaceType.AUTORACE, list);
        const second = cached(RaceType.AUTORACE, list);

        // Assert
        expect(first).toBe('autorace:x,y');
        expect(second).toBe('autorace:x,y');
        expect(callCount).toBe(1);
    });
});
