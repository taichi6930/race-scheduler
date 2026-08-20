/**
 * generateOpaqueToken のデシジョンテーブル
 *
 * | #    | 観点                     | 期待                                   |
 * | ---- | ------------------------ | --------------------------------------- |
 * | T-01 | URL-safeな文字のみ        | `+`/`/`/`=` を含まない                  |
 * | T-02 | 長さ                     | 43文字（256ビット・パディング無しbase64url） |
 * | T-03 | 一意性                   | 連続生成で衝突しない                     |
 */

import { describe, expect, it } from 'bun:test';

import { generateOpaqueToken } from '../../../src/utility/opaqueToken';

describe('generateOpaqueToken', () => {
    it('[T-01] URLsafeでない文字を含まないこと', () => {
        const token = generateOpaqueToken();

        expect(token).not.toMatch(/[+/=]/);
    });

    it('[T-02] 43文字であること', () => {
        const token = generateOpaqueToken();

        expect(token).toHaveLength(43);
    });

    it('[T-03] 連続生成で衝突しないこと', () => {
        const tokens = new Set(
            Array.from({ length: 1000 }, () => generateOpaqueToken()),
        );

        expect(tokens.size).toBe(1000);
    });
});
