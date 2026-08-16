/**
 * pushIds.test.ts - hashSubscriptionEndpoint / buildPushRequestId /
 * generateSubscriptionSecret / hashSubscriptionSecret ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### hashSubscriptionEndpoint
 * | # | 条件 | 期待値 |
 * |---|------|--------|
 * | H1 | 同一 endpoint を2回ハッシュ化 | 常に同一のIDを返す（決定的） |
 * | H2 | 異なる endpoint | 異なるIDを返す |
 *
 * ### buildPushRequestId
 * | # | 条件 | 期待値 |
 * |---|------|--------|
 * | B1 | subscriptionId, raceId | `{subscriptionId}:{raceId}` 形式の文字列 |
 *
 * ### generateSubscriptionSecret（push-ownership-design.md §2.1）
 * | # | 条件 | 期待値 |
 * |---|------|--------|
 * | S1 | 2回生成 | 毎回異なる値を返す（乱数） |
 * | S2 | 生成した値 | Base64URL文字（`+`/`/`/`=`を含まない）のみで構成される |
 *
 * ### hashSubscriptionSecret
 * | # | 条件 | 期待値 |
 * |---|------|--------|
 * | HS1 | 同一シークレットを2回ハッシュ化 | 常に同一の値を返す（決定的） |
 * | HS2 | 異なるシークレット | 異なる値を返す |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import { describe, expect, it } from 'bun:test';

import {
    buildPushRequestId,
    generateSubscriptionSecret,
    hashSubscriptionEndpoint,
    hashSubscriptionSecret,
} from '../../../src/utility/pushIds';

describe('hashSubscriptionEndpoint', () => {
    it('H1: 同一endpointを2回ハッシュ化すると常に同一IDを返すこと', async () => {
        const endpoint = 'https://push.example.com/subscription/abc';

        const first = await hashSubscriptionEndpoint(endpoint);
        const second = await hashSubscriptionEndpoint(endpoint);

        expect(first).toBe(second);
    });

    it('H2: 異なるendpointは異なるIDを返すこと', async () => {
        const idA = await hashSubscriptionEndpoint(
            'https://push.example.com/subscription/a',
        );
        const idB = await hashSubscriptionEndpoint(
            'https://push.example.com/subscription/b',
        );

        expect(idA).not.toBe(idB);
    });
});

describe('buildPushRequestId', () => {
    it('B1: subscriptionIdとraceIdを`:`で結合した文字列を返すこと', () => {
        const result = buildPushRequestId('sub-123', 'jra202601010101');

        expect(result).toBe('sub-123:jra202601010101');
    });
});

describe('generateSubscriptionSecret', () => {
    it('S1: 2回生成すると毎回異なる値を返すこと', () => {
        const first = generateSubscriptionSecret();
        const second = generateSubscriptionSecret();

        expect(first).not.toBe(second);
    });

    it('S2: Base64URL文字（英数字・`-`・`_`）のみで構成されること', () => {
        const secret = generateSubscriptionSecret();

        expect(secret).toMatch(/^[\w-]+$/);
    });
});

describe('hashSubscriptionSecret', () => {
    it('HS1: 同一シークレットを2回ハッシュ化すると常に同一の値を返すこと', async () => {
        const secret = 'test-secret-value';

        const first = await hashSubscriptionSecret(secret);
        const second = await hashSubscriptionSecret(secret);

        expect(first).toBe(second);
    });

    it('HS2: 異なるシークレットは異なる値を返すこと', async () => {
        const hashA = await hashSubscriptionSecret('secret-a');
        const hashB = await hashSubscriptionSecret('secret-b');

        expect(hashA).not.toBe(hashB);
    });
});
