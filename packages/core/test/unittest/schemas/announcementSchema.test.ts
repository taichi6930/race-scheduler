/**
 * schemas/announcementSchema テスト
 *
 * ## デシジョンテーブル: announcementSchema
 *
 * | #    | 入力                                                             | 期待結果      |
 * |------|--------------------------------------------------------------------|---------------|
 * | T-01 | schemaVersion:1, enabled:true, message:"a"                        | success:true  |
 * | T-02 | 上記 + actionLabel:"見る", actionUrl:"https://example.com"        | success:true  |
 * | T-03 | schemaVersion:2（未対応バージョン）                                | success:false |
 * | T-04 | message:""（空文字）                                              | success:false |
 * | T-05 | actionUrl:"not-a-url"（不正なURL）                                 | success:false |
 * | T-06 | enabled欠落                                                        | success:false |
 */

import { describe, expect, it } from 'bun:test';

import { announcementSchema } from '../../../src/schemas/announcementSchema';

describe('schemas/announcementSchema', () => {
    it('T-01: 必須フィールドのみの場合はパースに成功すること', () => {
        const result = announcementSchema.safeParse({
            schemaVersion: 1,
            enabled: true,
            message: 'a',
        });

        expect(result.success).toBe(true);
    });

    it('T-02: 任意フィールド込みの場合はパースに成功すること', () => {
        const result = announcementSchema.safeParse({
            schemaVersion: 1,
            enabled: true,
            message: 'a',
            actionLabel: '見る',
            actionUrl: 'https://example.com',
        });

        expect(result.success).toBe(true);
    });

    it('T-03: schemaVersionが1以外の場合はパースに失敗すること', () => {
        const result = announcementSchema.safeParse({
            schemaVersion: 2,
            enabled: true,
            message: 'a',
        });

        expect(result.success).toBe(false);
    });

    it('T-04: messageが空文字の場合はパースに失敗すること', () => {
        const result = announcementSchema.safeParse({
            schemaVersion: 1,
            enabled: true,
            message: '',
        });

        expect(result.success).toBe(false);
    });

    it('T-05: actionUrlが不正なURLの場合はパースに失敗すること', () => {
        const result = announcementSchema.safeParse({
            schemaVersion: 1,
            enabled: true,
            message: 'a',
            actionUrl: 'not-a-url',
        });

        expect(result.success).toBe(false);
    });

    it('T-06: enabledが欠落している場合はパースに失敗すること', () => {
        const result = announcementSchema.safeParse({
            schemaVersion: 1,
            message: 'a',
        });

        expect(result.success).toBe(false);
    });
});
