/**
 * packageLabels.ts の自己テスト
 *
 * ## デシジョンテーブル
 *
 * ### extractLayerLabels
 * | # | labelNames | 期待 |
 * |---|------------|------|
 * | T-01 | ['pkg:api', 'pkg:front'] | ['api', 'front']（PACKAGE_LAYERS順） |
 * | T-02 | ['pkg:front', 'pkg:api'] | ['api', 'front']（入力順ではなくPACKAGE_LAYERS順） |
 * | T-03 | ['semver:patch'] | [] （pkg:以外は無視） |
 * | T-04 | [] | [] |
 *
 * ### formatLayerPrefix
 * | # | layers | 期待 |
 * |---|--------|------|
 * | T-05 | ['api'] | '[api] ' |
 * | T-06 | ['api', 'front'] | '[api/front] ' |
 * | T-07 | [] | '' |
 */
import { describe, expect, it } from 'bun:test';

import { extractLayerLabels, formatLayerPrefix } from './packageLabels';

describe('extractLayerLabels', () => {
    it('T-01_pkgラベルが複数ある場合_レイヤー名を抽出する', () => {
        const result = extractLayerLabels(['pkg:api', 'pkg:front']);

        expect(result).toEqual(['api', 'front']);
    });

    it('T-02_入力順が逆でもPACKAGE_LAYERS順で返す', () => {
        const result = extractLayerLabels(['pkg:front', 'pkg:api']);

        expect(result).toEqual(['api', 'front']);
    });

    it('T-03_pkg以外のラベルは無視する', () => {
        const result = extractLayerLabels(['semver:patch']);

        expect(result).toEqual([]);
    });

    it('T-04_ラベルが無い場合_空配列を返す', () => {
        const result = extractLayerLabels([]);

        expect(result).toEqual([]);
    });
});

describe('formatLayerPrefix', () => {
    it('T-05_レイヤーが1件の場合_単一プレフィックスを返す', () => {
        const result = formatLayerPrefix(['api']);

        expect(result).toBe('[api] ');
    });

    it('T-06_レイヤーが複数の場合_スラッシュ区切りで返す', () => {
        const result = formatLayerPrefix(['api', 'front']);

        expect(result).toBe('[api/front] ');
    });

    it('T-07_レイヤーが無い場合_空文字列を返す', () => {
        const result = formatLayerPrefix([]);

        expect(result).toBe('');
    });
});
