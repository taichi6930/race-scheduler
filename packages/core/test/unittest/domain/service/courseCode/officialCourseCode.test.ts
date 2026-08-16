/**
 * domain/service/courseCode/officialCourseCode テスト
 *
 * ## デシジョンテーブル
 *
 * | #  | Function            | RaceType | 入力          | Expected              | Coverage        |
 * |----|---------------------|----------|---------------|-----------------------|-----------------|
 * | 1  | findPlaceCodeByName | JRA      | '東京'        | '05'                  | 正常系・一致    |
 * | 2  | findPlaceCodeByName | JRA      | '存在しない'  | '00'                  | 異常系・未一致  |
 * | 3  | findPlaceCodeByName | AUTORACE | '船橋'        | '01'                  | 正常系・別種別  |
 * | 4  | findPlaceCodeByName | JRA      | '船橋'        | '00'                  | 異常系・種別不一致 |
 * | 5  | findPlaceNameByCode | JRA      | '05'          | '東京'                | 正常系・ゼロ付き |
 * | 6  | findPlaceNameByCode | JRA      | '5'           | '東京'                | 正常系・ゼロなし |
 * | 7  | findPlaceNameByCode | JRA      | '99'          | null                  | 異常系・未一致  |
 * | 8  | findPlaceNameByCode | AUTORACE | '01'          | '船橋'                | 正常系・別種別  |
 * | 9  | findPlaceNameByCode | JRA      | '01'          | '札幌'                | 正常系・別コード |
 */

import { describe, expect, it } from 'bun:test';

import type { LocationCode } from '../../../../../src/domain/model/valueObject/locationCode';
import { validateLocationCode } from '../../../../../src/domain/model/valueObject/locationCode';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';
import {
    findPlaceCodeByName,
    findPlaceNameByCode,
} from '../../../../../src/domain/service/courseCode/officialCourseCode';

describe('findPlaceCodeByName', () => {
    describe('正常系', () => {
        it('JRA_東京_プレースコード05を返す', () => {
            // Arrange & Act
            const result = findPlaceCodeByName('東京', RaceType.JRA);

            // Assert
            expect(result).toBe(validateLocationCode('05'));
        });

        it('AUTORACE_船橋_プレースコード01を返す', () => {
            // Arrange & Act
            const result = findPlaceCodeByName('船橋', RaceType.AUTORACE);

            // Assert
            expect(result).toBe(validateLocationCode('01'));
        });

        it('JRA_札幌_プレースコード01を返す', () => {
            // Arrange & Act
            const result = findPlaceCodeByName('札幌', RaceType.JRA);

            // Assert
            expect(result).toBe(validateLocationCode('01'));
        });
    });

    describe('異常系', () => {
        it('JRA_存在しない場名_00を返す', () => {
            // Arrange & Act
            const result = findPlaceCodeByName('存在しない', RaceType.JRA);

            // Assert
            expect(result).toBe(validateLocationCode('00'));
        });

        it('JRA_他種別の場名（船橋）_00を返す（種別不一致）', () => {
            // Arrange & Act
            const result = findPlaceCodeByName('船橋', RaceType.JRA);

            // Assert
            expect(result).toBe(validateLocationCode('00'));
        });
    });
});

describe('findPlaceNameByCode', () => {
    describe('正常系', () => {
        it('JRA_locationCode=05_東京を返す', () => {
            // Arrange & Act
            const result = findPlaceNameByCode(
                validateLocationCode('05'),
                RaceType.JRA,
            );

            // Assert
            expect(result).toBe('東京');
        });

        it('JRA_locationCode=5（ゼロなし）_nullを返す（placeCodeはゼロ付き固定）', () => {
            // Arrange & Act
            // マスタは placeCode='05' 形式なので '5' では一致しない。
            // LocationCodeSchema は2桁の数字のみを許容するため、本来この形は
            // validateLocationCode を通過できないが、正規化ロジックの防御的な
            // 挙動を直接検証するためここでは意図的に型を迂回する。
            const result = findPlaceNameByCode(
                '5' as unknown as LocationCode,
                RaceType.JRA,
            );

            // Assert
            expect(result).toBeNull();
        });

        it('JRA_locationCode=01_札幌を返す', () => {
            // Arrange & Act
            const result = findPlaceNameByCode(
                validateLocationCode('01'),
                RaceType.JRA,
            );

            // Assert
            expect(result).toBe('札幌');
        });

        it('AUTORACE_locationCode=01_船橋を返す', () => {
            // Arrange & Act
            const result = findPlaceNameByCode(
                validateLocationCode('01'),
                RaceType.AUTORACE,
            );

            // Assert
            expect(result).toBe('船橋');
        });
    });

    describe('異常系', () => {
        it('JRA_locationCode=99_nullを返す', () => {
            // Arrange & Act
            const result = findPlaceNameByCode(
                validateLocationCode('99'),
                RaceType.JRA,
            );

            // Assert
            expect(result).toBeNull();
        });
    });
});
