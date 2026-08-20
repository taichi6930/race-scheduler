/**
 * frontConfig ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件 | Input | Expected | Coverage |
 * |----|------|-------|----------|----------|
 * | 1  | 正常系 | process.env.FRONT_BASE_URL 設定済み | その値を基準にした絶対URLを返す | Line |
 * | 2  | フォールバック | 未設定 | 相対パス `/invite/<token>` を返す | Branch |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { buildInviteUrl } from '../../../src/utility/frontConfig';

describe('buildInviteUrl', () => {
    const originalEnv = process.env.FRONT_BASE_URL;

    beforeEach(() => {
        delete process.env.FRONT_BASE_URL;
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.FRONT_BASE_URL;
        } else {
            process.env.FRONT_BASE_URL = originalEnv;
        }
    });

    it('#1: process.env.FRONT_BASE_URLが設定されている場合その値を基準にした絶対URLを返す', () => {
        process.env.FRONT_BASE_URL = 'https://race-schedule-front.pages.dev';

        expect(buildInviteUrl('invite-token')).toBe(
            'https://race-schedule-front.pages.dev/invite/invite-token',
        );
    });

    it('#2: 未設定の場合は相対パスを返す', () => {
        expect(buildInviteUrl('invite-token')).toBe('/invite/invite-token');
    });
});
