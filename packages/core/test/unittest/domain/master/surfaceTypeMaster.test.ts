/**
 * domain/master の RaceSurfaceTypeList（馬場種別マスタ）のテスト。
 *
 * `surfaceTypeMaster.ts` は分岐を持たない定数定義（`Set` リテラル）だが、
 * `domain/model/valueObject/surfaceType.ts` の型ガード（`RaceSurfaceTypeList.has(value)`）が
 * 依拠する唯一のマスタデータであるため、収録内容（想定される馬場種別が過不足なく
 * 含まれているか）自体を固定し、意図しない追加・削除を検知できるようにする。
 *
 * ## デシジョンテーブル
 *
 * | # | 検証内容 | 期待 |
 * |---|---------|------|
 * | T-01 | RaceSurfaceTypeList が Set のインスタンスである | true |
 * | T-02 | '芝' を含む | true |
 * | T-03 | 'ダート' を含む | true |
 * | T-04 | '障害' を含む | true |
 * | T-05 | 'AW' を含む | true |
 * | T-06 | '不明' を含む | true |
 * | T-07 | 要素数が想定の5件と一致する（想定外の値が紛れ込んでいない） | 5 |
 * | T-08 | 想定外の値（'未知'）を含まない | false |
 *
 * ## Coverage Target: 100% Line & Branch Coverage
 */

import { describe, expect, it } from 'bun:test';
import { RaceSurfaceTypeList } from '../../../../src/domain/master/surfaceTypeMaster';

describe('RaceSurfaceTypeList', () => {
    it('T-01_RaceSurfaceTypeList_インスタンス種別_Setである', () => {
        expect(RaceSurfaceTypeList).toBeInstanceOf(Set);
    });

    it('T-02_RaceSurfaceTypeList_芝の所属確認_含まれる', () => {
        expect(RaceSurfaceTypeList.has('芝')).toBe(true);
    });

    it('T-03_RaceSurfaceTypeList_ダートの所属確認_含まれる', () => {
        expect(RaceSurfaceTypeList.has('ダート')).toBe(true);
    });

    it('T-04_RaceSurfaceTypeList_障害の所属確認_含まれる', () => {
        expect(RaceSurfaceTypeList.has('障害')).toBe(true);
    });

    it('T-05_RaceSurfaceTypeList_AWの所属確認_含まれる', () => {
        expect(RaceSurfaceTypeList.has('AW')).toBe(true);
    });

    it('T-06_RaceSurfaceTypeList_不明の所属確認_含まれる', () => {
        expect(RaceSurfaceTypeList.has('不明')).toBe(true);
    });

    it('T-07_RaceSurfaceTypeList_要素数_想定の5件と一致する', () => {
        expect(RaceSurfaceTypeList.size).toBe(5);
    });

    it('T-08_RaceSurfaceTypeList_想定外の値の所属確認_含まれない', () => {
        expect(RaceSurfaceTypeList.has('未知')).toBe(false);
    });
});
