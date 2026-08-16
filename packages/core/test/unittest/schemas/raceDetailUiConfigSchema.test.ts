/**
 * schemas/raceDetailUiConfigSchema テスト
 *
 * ## デシジョンテーブル: raceDetailUiConfigSchema
 *
 * | #    | 入力                                                          | 期待結果      |
 * |------|-----------------------------------------------------------------|---------------|
 * | T-01 | kv/links/players全セクション（labelあり）                       | success:true  |
 * | T-02 | kvのfieldにlabel省略                                            | success:true  |
 * | T-03 | kvのfieldに未知のkey                                            | success:false |
 * | T-04 | kvのfieldにlabel:""（空文字）                                   | success:false |
 * | T-05 | playersのtitleが空文字                                          | success:false |
 * | T-06 | 未知のtype                                                       | success:false |
 * | T-07 | sections: []（空配列）                                           | success:true  |
 */

import { describe, expect, it } from 'bun:test';

import { raceDetailUiConfigSchema } from '../../../src/schemas/raceDetailUiConfigSchema';

describe('schemas/raceDetailUiConfigSchema', () => {
    it('T-01: kv/links/players全セクション（labelあり）の場合パースに成功すること', () => {
        const result = raceDetailUiConfigSchema.safeParse({
            sections: [
                {
                    type: 'kv',
                    fields: [{ key: 'grade', label: '級・グレード' }],
                },
                { type: 'links' },
                { type: 'players', title: '出走選手', watchToggle: true },
            ],
        });

        expect(result.success).toBe(true);
    });

    it('T-02: kvのfieldにlabelが省略されている場合パースに成功すること', () => {
        const result = raceDetailUiConfigSchema.safeParse({
            sections: [{ type: 'kv', fields: [{ key: 'time' }] }],
        });

        expect(result.success).toBe(true);
    });

    it('T-03: kvのfieldに未知のkeyが含まれる場合パースに失敗すること', () => {
        const result = raceDetailUiConfigSchema.safeParse({
            sections: [{ type: 'kv', fields: [{ key: 'odds' }] }],
        });

        expect(result.success).toBe(false);
    });

    it('T-04: kvのfieldのlabelが空文字の場合パースに失敗すること', () => {
        const result = raceDetailUiConfigSchema.safeParse({
            sections: [{ type: 'kv', fields: [{ key: 'time', label: '' }] }],
        });

        expect(result.success).toBe(false);
    });

    it('T-05: playersのtitleが空文字の場合パースに失敗すること', () => {
        const result = raceDetailUiConfigSchema.safeParse({
            sections: [{ type: 'players', title: '', watchToggle: true }],
        });

        expect(result.success).toBe(false);
    });

    it('T-06: 未知のtypeが含まれる場合パースに失敗すること', () => {
        const result = raceDetailUiConfigSchema.safeParse({
            sections: [{ type: 'odds' }],
        });

        expect(result.success).toBe(false);
    });

    it('T-07: sectionsが空配列の場合パースに成功すること', () => {
        const result = raceDetailUiConfigSchema.safeParse({ sections: [] });

        expect(result.success).toBe(true);
    });
});
