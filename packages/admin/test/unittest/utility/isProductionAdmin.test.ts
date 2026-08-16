/**
 * isProductionAdmin ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 条件   | Input                                       | Expected | Coverage |
 * |------|--------|----------------------------------------------|----------|----------|
 * | T-01 | 正常系 | process.env.ADMIN_ENVIRONMENT === 'production' | true     | Branch   |
 * | T-02 | 異常系 | process.env.ADMIN_ENVIRONMENT === 'test'       | false    | Branch   |
 * | T-03 | 異常系 | process.env.ADMIN_ENVIRONMENT 未設定           | false    | Line     |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { isProductionAdmin } from '../../../src/utility/isProductionAdmin';

describe('isProductionAdmin', () => {
    const originalEnv = process.env.ADMIN_ENVIRONMENT;

    beforeEach(() => {
        delete process.env.ADMIN_ENVIRONMENT;
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.ADMIN_ENVIRONMENT;
        } else {
            process.env.ADMIN_ENVIRONMENT = originalEnv;
        }
    });

    it("[T-01] ADMIN_ENVIRONMENTが'production'の場合trueを返す", () => {
        process.env.ADMIN_ENVIRONMENT = 'production';

        expect(isProductionAdmin()).toBe(true);
    });

    it("[T-02] ADMIN_ENVIRONMENTが'test'の場合falseを返す", () => {
        process.env.ADMIN_ENVIRONMENT = 'test';

        expect(isProductionAdmin()).toBe(false);
    });

    it('[T-03] ADMIN_ENVIRONMENTが未設定の場合falseを返す', () => {
        expect(isProductionAdmin()).toBe(false);
    });
});
