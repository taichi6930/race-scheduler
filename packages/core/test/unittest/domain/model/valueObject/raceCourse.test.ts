/**
 * RaceCourseSchema のユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | RaceType | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1 | JRA | '札幌'（有効） | 検証成功 | Branch |
 * | 2 | JRA | '存在しない競馬場'（無効） | エラースロー | Branch |
 * | 3 | NAR | '北見ば'（有効） | 検証成功 | Line |
 * | 4 | KEIRIN | '函館'（有効） | 検証成功 | Line |
 * | 5 | OVERSEAS | 'ロンシャン'（有効） | 検証成功 | Line |
 * | 6 | AUTORACE | '船橋'（有効） | 検証成功 | Line |
 * | 7 | BOATRACE | '桐生'（有効） | 検証成功 | Line |
 * | 8 | KEIRIN | '船橋'（AUTORACE専用の開催場） | エラースロー（レース種別間の分離） | Branch |
 * | 9 | JRA | ''（空文字） | エラースロー | Branch |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { RaceCourseSchema } from '../../../../../src/domain/model/valueObject/raceCourse';

describe('RaceCourseSchema', () => {
    it('[1] JRA: 札幌 は有効な開催場', () => {
        const schema = RaceCourseSchema(RaceType.JRA);

        const result = schema.parse('札幌');

        expect(result).toBe('札幌');
    });

    it('[2] JRA: 存在しない開催場はエラースロー', () => {
        const schema = RaceCourseSchema(RaceType.JRA);

        expect(() => schema.parse('存在しない競馬場')).toThrow(
            'jraの開催場ではありません',
        );
    });

    it('[3] NAR: 北見ば は有効な開催場', () => {
        const schema = RaceCourseSchema(RaceType.NAR);

        expect(schema.parse('北見ば')).toBe('北見ば');
    });

    it('[4] KEIRIN: 函館 は有効な開催場', () => {
        const schema = RaceCourseSchema(RaceType.KEIRIN);

        expect(schema.parse('函館')).toBe('函館');
    });

    it('[5] OVERSEAS: ロンシャン は有効な開催場', () => {
        const schema = RaceCourseSchema(RaceType.OVERSEAS);

        expect(schema.parse('ロンシャン')).toBe('ロンシャン');
    });

    it('[6] AUTORACE: 船橋 は有効な開催場', () => {
        const schema = RaceCourseSchema(RaceType.AUTORACE);

        expect(schema.parse('船橋')).toBe('船橋');
    });

    it('[7] BOATRACE: 桐生 は有効な開催場', () => {
        const schema = RaceCourseSchema(RaceType.BOATRACE);

        expect(schema.parse('桐生')).toBe('桐生');
    });

    it('[8] KEIRIN: AUTORACE専用の開催場（船橋）はKEIRINでは無効（レース種別間の分離）', () => {
        const schema = RaceCourseSchema(RaceType.KEIRIN);

        expect(() => schema.parse('船橋')).toThrow(
            'keirinの開催場ではありません',
        );
    });

    it('[9] JRA: 空文字はエラースロー', () => {
        const schema = RaceCourseSchema(RaceType.JRA);

        expect(() => schema.parse('')).toThrow();
    });
});
