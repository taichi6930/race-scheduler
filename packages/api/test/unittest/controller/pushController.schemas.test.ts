/**
 * pushController.schemas テスト
 *
 * ## デシジョンテーブル（PushSubscriptionUpsertRequestSchema）
 *
 * | #    | endpoint       | keys                          | 期待結果 |
 * |------|----------------|-------------------------------|----------|
 * | T-01 | 有効なURL      | 有効な p256dh/auth             | success  |
 * | T-02 | URLでない文字列 | 有効な p256dh/auth             | failure  |
 * | T-03 | 有効なURL      | keys欠落                       | failure  |
 * | T-04 | 有効なURL      | p256dh が空文字                | failure  |
 *
 * ## デシジョンテーブル（PushSubscriptionDeleteRequestSchema）
 *
 * | #    | endpoint       | 期待結果 |
 * |------|----------------|----------|
 * | T-05 | 有効なURL      | success  |
 * | T-06 | URLでない文字列 | failure  |
 *
 * ## デシジョンテーブル（PushRequestUpsertRequestSchema）
 *
 * | #    | 条件                          | 期待結果 |
 * |------|-------------------------------|----------|
 * | T-07 | 必須項目すべて指定（urlなし） | success（urlはundefined）|
 * | T-08 | url も指定                    | success  |
 * | T-09 | fireAtMs が負の数              | failure  |
 * | T-10 | fireAtMs が整数でない           | failure  |
 * | T-11 | title が空文字                 | failure  |
 * | T-16 | fireAtMs が上限超過             | failure  |
 * | T-17 | title が201文字                 | failure  |
 * | T-18 | body が1001文字                 | failure  |
 *
 * ## デシジョンテーブル（PushRequestDeleteRequestSchema）
 *
 * | #    | 条件                              | 期待結果 |
 * |------|------------------------------------|----------|
 * | T-12 | subscriptionId, raceId 指定       | success  |
 * | T-13 | subscriptionId が空文字            | failure  |
 *
 * ## デシジョンテーブル（PushTestSendRequestSchema）
 *
 * | #    | 条件                    | 期待結果 |
 * |------|-------------------------|----------|
 * | T-14 | subscriptionId を指定    | success  |
 * | T-15 | subscriptionId が空文字  | failure  |
 */
import { describe, expect, it } from 'bun:test';

import {
    PushRequestDeleteRequestSchema,
    PushRequestUpsertRequestSchema,
    PushSubscriptionDeleteRequestSchema,
    PushSubscriptionUpsertRequestSchema,
    PushTestSendRequestSchema,
} from '../../../src/controller/pushController.schemas';

describe('PushSubscriptionUpsertRequestSchema', () => {
    it('T-01: 有効なendpointとkeysならsuccessすること', () => {
        const result = PushSubscriptionUpsertRequestSchema.safeParse({
            endpoint: 'https://push.example.com/subscription/abc',
            keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
        });

        expect(result.success).toBe(true);
    });

    it('T-02: endpointがURLでない場合はfailureすること', () => {
        const result = PushSubscriptionUpsertRequestSchema.safeParse({
            endpoint: 'not-a-url',
            keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
        });

        expect(result.success).toBe(false);
    });

    it('T-03: keysが欠落している場合はfailureすること', () => {
        const result = PushSubscriptionUpsertRequestSchema.safeParse({
            endpoint: 'https://push.example.com/subscription/abc',
        });

        expect(result.success).toBe(false);
    });

    it('T-04: p256dhが空文字の場合はfailureすること', () => {
        const result = PushSubscriptionUpsertRequestSchema.safeParse({
            endpoint: 'https://push.example.com/subscription/abc',
            keys: { p256dh: '', auth: 'auth-value' },
        });

        expect(result.success).toBe(false);
    });
});

describe('PushSubscriptionDeleteRequestSchema', () => {
    it('T-05: 有効なendpointならsuccessすること', () => {
        const result = PushSubscriptionDeleteRequestSchema.safeParse({
            endpoint: 'https://push.example.com/subscription/abc',
        });

        expect(result.success).toBe(true);
    });

    it('T-06: endpointがURLでない場合はfailureすること', () => {
        const result = PushSubscriptionDeleteRequestSchema.safeParse({
            endpoint: 'not-a-url',
        });

        expect(result.success).toBe(false);
    });
});

describe('PushRequestUpsertRequestSchema', () => {
    const baseParams = {
        subscriptionId: 'sub-123',
        raceId: 'jra202601010101',
        fireAtMs: 1_700_000_000_000,
        title: '皐月賞（GⅠ）',
        body: '中山 11R ・ 発走 5分前',
    };

    it('T-07: 必須項目すべて指定（urlなし）ならsuccessしurlがundefinedであること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse(baseParams);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.url).toBeUndefined();
        }
    });

    it('T-08: urlも指定した場合はsuccessすること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse({
            ...baseParams,
            url: '/timeline',
        });

        expect(result.success).toBe(true);
    });

    it('T-09: fireAtMsが負の数の場合はfailureすること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse({
            ...baseParams,
            fireAtMs: -1,
        });

        expect(result.success).toBe(false);
    });

    it('T-10: fireAtMsが整数でない場合はfailureすること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse({
            ...baseParams,
            fireAtMs: 1.5,
        });

        expect(result.success).toBe(false);
    });

    it('T-11: titleが空文字の場合はfailureすること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse({
            ...baseParams,
            title: '',
        });

        expect(result.success).toBe(false);
    });

    it('T-16: fireAtMsが上限を超える場合はfailureすること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse({
            ...baseParams,
            fireAtMs: 4_102_444_800_001,
        });

        expect(result.success).toBe(false);
    });

    it('T-17: titleが201文字の場合はfailureすること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse({
            ...baseParams,
            title: 'あ'.repeat(201),
        });

        expect(result.success).toBe(false);
    });

    it('T-18: bodyが1001文字の場合はfailureすること', () => {
        const result = PushRequestUpsertRequestSchema.safeParse({
            ...baseParams,
            body: 'あ'.repeat(1001),
        });

        expect(result.success).toBe(false);
    });
});

describe('PushRequestDeleteRequestSchema', () => {
    it('T-12: subscriptionIdとraceIdを指定するとsuccessすること', () => {
        const result = PushRequestDeleteRequestSchema.safeParse({
            subscriptionId: 'sub-123',
            raceId: 'jra202601010101',
        });

        expect(result.success).toBe(true);
    });

    it('T-13: subscriptionIdが空文字の場合はfailureすること', () => {
        const result = PushRequestDeleteRequestSchema.safeParse({
            subscriptionId: '',
            raceId: 'jra202601010101',
        });

        expect(result.success).toBe(false);
    });
});

describe('PushTestSendRequestSchema', () => {
    it('T-14: subscriptionIdを指定するとsuccessすること', () => {
        const result = PushTestSendRequestSchema.safeParse({
            subscriptionId: 'sub-123',
        });

        expect(result.success).toBe(true);
    });

    it('T-15: subscriptionIdが空文字の場合はfailureすること', () => {
        const result = PushTestSendRequestSchema.safeParse({
            subscriptionId: '',
        });

        expect(result.success).toBe(false);
    });
});
