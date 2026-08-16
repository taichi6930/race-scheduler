/**
 * syncRequest のユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | startDate | finishDate | raceTypeList | Expected | Coverage |
 * |----|-----------|------------|--------------|----------|----------|
 * | 1 | '2026-01-01' | '2026-01-31' | ['jra'] | 検証成功（型変換されたDateを返す） | Line |
 * | 2 | '2026-01-01' | '2026-01-01' | ['jra'] | 検証成功（同日は許可） | Branch |
 * | 3 | '2026-01-31' | '2026-01-01' | ['jra'] | エラースロー（startDate > finishDate） | Branch |
 * | 4 | '2026-01-01' | '2026-01-31' | [] | エラースロー（raceTypeListが空配列） | Branch |
 * | 5 | '2026-01-01' | '2026-01-31' | ['invalid'] | エラースロー（不正なraceType） | Branch |
 * | 6 | '2026-01-01' | '2026-01-31' | ['jra', 'nar'] | 検証成功（複数raceType） | Line |
 * | 7 | '2026-01-01' | 390日後 | ['jra'] | 検証成功（上限ちょうど390日は許可） | Branch |
 * | 8 | '2026-01-01' | 391日後 | ['jra'] | エラースロー（390日を超える期間、PERF-083） | Branch |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { SyncCalendarRequestBodySchema } from '../../../src/request/syncRequest';

describe('SyncCalendarRequestBodySchema', () => {
    it('[1] startDate < finishDate かつ raceTypeList が1件の場合_検証成功しDateへ変換される', () => {
        const result = SyncCalendarRequestBodySchema.parse({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: [RaceType.JRA],
        });

        expect(result.startDate).toEqual(new Date('2026-01-01'));
        expect(result.finishDate).toEqual(new Date('2026-01-31'));
        expect(result.raceTypeList).toEqual([RaceType.JRA]);
    });

    it('[2] startDate と finishDate が同日の場合_検証成功する', () => {
        const result = SyncCalendarRequestBodySchema.parse({
            startDate: '2026-01-01',
            finishDate: '2026-01-01',
            raceTypeList: [RaceType.JRA],
        });

        expect(result.startDate).toEqual(result.finishDate);
    });

    it('[3] startDate が finishDate より後の場合_エラースローされる', () => {
        expect(() =>
            SyncCalendarRequestBodySchema.parse({
                startDate: '2026-01-31',
                finishDate: '2026-01-01',
                raceTypeList: [RaceType.JRA],
            }),
        ).toThrow('startDateはfinishDateを超えてはいけません');
    });

    it('[4] raceTypeList が空配列の場合_エラースローされる', () => {
        expect(() =>
            SyncCalendarRequestBodySchema.parse({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
                raceTypeList: [],
            }),
        ).toThrow('raceTypeListは1つ以上必要です');
    });

    it('[5] raceTypeList に不正な値が含まれる場合_エラースローされる', () => {
        expect(() =>
            SyncCalendarRequestBodySchema.parse({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
                raceTypeList: ['invalid'],
            }),
        ).toThrow();
    });

    it('[6] raceTypeList に複数のレース種別を指定した場合_検証成功する', () => {
        const result = SyncCalendarRequestBodySchema.parse({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: [RaceType.JRA, RaceType.NAR],
        });

        expect(result.raceTypeList).toEqual([RaceType.JRA, RaceType.NAR]);
    });

    it('[7] startDateからfinishDateまでがちょうど390日の場合_検証成功する', () => {
        const result = SyncCalendarRequestBodySchema.parse({
            startDate: '2026-01-01',
            finishDate: '2027-01-26', // 2026-01-01から390日後
            raceTypeList: [RaceType.JRA],
        });

        expect(result.finishDate).toEqual(new Date('2027-01-26'));
    });

    it('[8] startDateからfinishDateまでが390日を超える場合_エラースローされる', () => {
        expect(() =>
            SyncCalendarRequestBodySchema.parse({
                startDate: '2026-01-01',
                finishDate: '2027-01-27', // 2026-01-01から391日後
                raceTypeList: [RaceType.JRA],
            }),
        ).toThrow('startDateからfinishDateまでの期間は390日以内にしてください');
    });
});
