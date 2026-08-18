/**
 * check-admin-color-drift.ts の自己テスト（QADM-10）
 *
 * ## デシジョンテーブル
 *
 * ### extractAdminColors
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-01 | `FRONT_COLORS = { bg: '#EBEEE9', brand: '#1E6E4C' };` | `{ bg: '#EBEEE9', brand: '#1E6E4C' }` |
 * | T-02 | 対象のconstが存在しない | 空オブジェクト |
 *
 * ### extractTokensDartColors
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-03 | `static const light = AppColors(bg: Color(0xFFEBEEE9), ...);` | `#RRGGBB` 形式に変換して抽出 |
 * | T-04 | 対象テーマ名が存在しない | 空オブジェクト |
 *
 * ### findColorDrift
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-05 | 全キー一致 | 空配列 |
 * | T-06 | 値が異なるキーが1件 | 不一致メッセージ1件 |
 * | T-07 | tokens側にキーが無い | キー欠落メッセージ |
 */

import { describe, expect, it } from 'bun:test';

import {
    extractAdminColors,
    extractTokensDartColors,
    findColorDrift,
} from './check-admin-color-drift';

describe('check-admin-color-drift/extractAdminColors', () => {
    it('T-01: FRONT_COLORSからキー→色を抽出すること', () => {
        const content = `
export const FRONT_COLORS = {
    bg: '#EBEEE9',
    brand: '#1E6E4C',
};
`;
        expect(extractAdminColors(content, 'FRONT_COLORS')).toEqual({
            bg: '#EBEEE9',
            brand: '#1E6E4C',
        });
    });

    it('T-02: 対象のconstが存在しない場合は空オブジェクトを返すこと', () => {
        expect(
            extractAdminColors('export const OTHER = {};', 'FRONT_COLORS'),
        ).toEqual({});
    });
});

describe('check-admin-color-drift/extractTokensDartColors', () => {
    it('T-03: AppColors(...)ブロックから0xFFRRGGBBを#RRGGBBへ変換して抽出すること', () => {
        const content = `
  static const light = AppColors(
    bg: Color(0xFFEBEEE9),
    brand: Color(0xFF1E6E4C),
  );
`;
        expect(extractTokensDartColors(content, 'light')).toEqual({
            bg: '#EBEEE9',
            brand: '#1E6E4C',
        });
    });

    it('T-04: 対象テーマ名が存在しない場合は空オブジェクトを返すこと', () => {
        expect(extractTokensDartColors('// no theme here', 'dark')).toEqual({});
    });
});

describe('check-admin-color-drift/findColorDrift', () => {
    it('T-05: 全キー一致する場合は空配列を返すこと', () => {
        const drift = findColorDrift(
            { bg: '#EBEEE9' },
            { bg: '#EBEEE9' },
            'light',
        );
        expect(drift).toEqual([]);
    });

    it('T-06: 値が異なるキーが1件ある場合は不一致メッセージを返すこと', () => {
        const drift = findColorDrift(
            { bg: '#EBEEE9' },
            { bg: '#000000' },
            'light',
        );
        expect(drift).toEqual([
            "[light] bg: admin='#EBEEE9' / tokens.dart='#000000'",
        ]);
    });

    it('T-07: tokens側にキーが無い場合はキー欠落メッセージを返すこと', () => {
        const drift = findColorDrift({ brand: '#1E6E4C' }, {}, 'dark');
        expect(drift).toEqual([
            '[dark] brand: tokens.dartに対応するキーが見つかりません',
        ]);
    });
});
