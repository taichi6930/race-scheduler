/**
 * surfaceType テスト
 *
 * ## デシジョンテーブル: validateRaceSurfaceType
 *
 * | #    | surfaceType   | 期待結果                           |
 * |------|---------------|-------------------------------------|
 * | T-01 | '芝'          | 成功（'芝' を返す）                 |
 * | T-02 | 'ダート'      | 成功（'ダート' を返す）             |
 * | T-03 | '障害'        | 成功（'障害' を返す）               |
 * | T-04 | 'AW'          | 成功（'AW' を返す）                 |
 * | T-05 | '不明'        | 成功（'不明' を返す）               |
 * | T-06 | 'テスト'      | エラー（有効な馬場種別ではありません）|
 * | T-07 | ''（空文字） | エラー（有効な馬場種別ではありません）|
 */

import { describe, expect, it } from 'bun:test';

import { validateRaceSurfaceType } from '../../../../../src/domain/model/valueObject/surfaceType';

describe('validateRaceSurfaceType', () => {
    describe('正常系: マスタに存在する値はそのまま返される', () => {
        it.each([
            ['[T-01]', '芝'],
            ['[T-02]', 'ダート'],
            ['[T-03]', '障害'],
            ['[T-04]', 'AW'],
            ['[T-05]', '不明'],
        ])('%s surfaceType="%s" はそのまま返される', (_caseId, surfaceType) => {
            const result = validateRaceSurfaceType(surfaceType);

            expect(result).toBe(surfaceType);
        });
    });

    describe('異常系: マスタに存在しない値はエラーになる', () => {
        it('[T-06] マスタに存在しない値はエラーになる', () => {
            const surfaceType = 'テスト';

            expect(() => validateRaceSurfaceType(surfaceType)).toThrow(
                '有効な馬場種別ではありません',
            );
        });

        it('[T-07] 空文字はエラーになる', () => {
            const surfaceType = '';

            expect(() => validateRaceSurfaceType(surfaceType)).toThrow(
                '有効な馬場種別ではありません',
            );
        });
    });
});
