/**
 * mainApiConfig ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件 | Input | Expected | Coverage |
 * |----|------|-------|----------|----------|
 * | 1  | 正常系 | process.env.MAIN_API_URL 設定済み | その値を返す | Line |
 * | 2  | 異常系 | 未設定 | Errorをスロー | Branch |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { getMainApiUrl } from '../../../src/utility/mainApiConfig';

describe('getMainApiUrl', () => {
    const originalEnv = process.env.MAIN_API_URL;

    beforeEach(() => {
        delete process.env.MAIN_API_URL;
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.MAIN_API_URL;
        } else {
            process.env.MAIN_API_URL = originalEnv;
        }
    });

    it('#1: process.env.MAIN_API_URLが設定されている場合その値を返す', () => {
        process.env.MAIN_API_URL = 'https://example.com';

        expect(getMainApiUrl()).toBe('https://example.com');
    });

    it('#2: 未設定の場合Errorをスローする', () => {
        expect(() => getMainApiUrl()).toThrow(/MAIN_API_URL/);
    });
});
