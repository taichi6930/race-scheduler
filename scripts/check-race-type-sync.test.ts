/**
 * check-race-type-sync.ts の自己テスト（QSYNC-03）
 *
 * ## デシジョンテーブル
 *
 * ### extractCoreRaceTypeValues
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-01 | `RaceType = { JRA: 'jra', NAR: 'nar' } as const` | `['jra', 'nar']` |
 * | T-02 | `RaceType`ブロックが無い | 空配列 |
 *
 * ### extractFrontRaceTypeValues
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-03 | `enum RaceType { jra('jra'); const RaceType(this.value); }` | `['jra']`（`;`以降の本体は無視） |
 * | T-04 | 本体に`'...'`を含むメソッド呼び出しがある | 値宣言部のみを抽出し誤検出しない |
 *
 * ### diffRaceTypeValues
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-05 | 完全一致 | 空配列 |
 * | T-06 | core側にのみ値がある | core側のみメッセージ |
 * | T-07 | front側にのみ値がある | front側のみメッセージ |
 */

import { describe, expect, it } from 'bun:test';

import {
    diffRaceTypeValues,
    extractCoreRaceTypeValues,
    extractFrontRaceTypeValues,
} from './check-race-type-sync';

describe('check-race-type-sync/extractCoreRaceTypeValues', () => {
    it('T-01: RaceTypeオブジェクトから値を抽出すること', () => {
        const content = `
export const RaceType = {
    JRA: 'jra', // 中央競馬
    NAR: 'nar', // 地方競馬
} as const;
`;
        expect(extractCoreRaceTypeValues(content)).toEqual(['jra', 'nar']);
    });

    it('T-02: RaceTypeブロックが無い場合は空配列を返すこと', () => {
        expect(extractCoreRaceTypeValues('export const Foo = 1;')).toEqual([]);
    });
});

describe('check-race-type-sync/extractFrontRaceTypeValues', () => {
    it('T-03: enum値宣言部から値を抽出し、本体は無視すること', () => {
        const content = `
enum RaceType {
  jra('jra'),
  nar('nar');

  const RaceType(this.value);
  final String value;
}
`;
        expect(extractFrontRaceTypeValues(content)).toEqual(['jra', 'nar']);
    });

    it('T-04: メソッド本体内の引用符付き文字列を値として誤検出しないこと', () => {
        const content = `
enum RaceType {
  jra('jra');

  static RaceType fromValue(String value) => RaceType.values.firstWhere(
    (type) => type.value == value.toLowerCase(),
    orElse: () => throw ArgumentError('Unknown raceType: \\$value'),
  );
}
`;
        expect(extractFrontRaceTypeValues(content)).toEqual(['jra']);
    });
});

describe('check-race-type-sync/diffRaceTypeValues', () => {
    it('T-05: 完全一致する場合は空配列を返すこと', () => {
        expect(diffRaceTypeValues(['jra', 'nar'], ['jra', 'nar'])).toEqual([]);
    });

    it('T-06: core側にのみ値がある場合はcore側のメッセージを返すこと', () => {
        expect(diffRaceTypeValues(['jra', 'keirin'], ['jra'])).toEqual([
            "'keirin': core(raceType.ts)にのみ存在し、front(race_type.dart)に存在しません",
        ]);
    });

    it('T-07: front側にのみ値がある場合はfront側のメッセージを返すこと', () => {
        expect(diffRaceTypeValues(['jra'], ['jra', 'keirin'])).toEqual([
            "'keirin': front(race_type.dart)にのみ存在し、core(raceType.ts)に存在しません",
        ]);
    });
});
