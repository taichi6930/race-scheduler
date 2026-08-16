/**
 * schemas/raceDetailUiSchema テスト
 *
 * ## デシジョンテーブル: raceDetailUiSchema
 *
 * | #    | 入力                                                          | 期待結果      |
 * |------|-----------------------------------------------------------------|---------------|
 * | T-01 | schemaVersion:1, kv/links/players全セクション                   | success:true  |
 * | T-02 | schemaVersion:2（未対応バージョン）                              | success:false |
 * | T-03 | sections: []（空配列）                                          | success:true  |
 * | T-04 | 未知のtype（"odds"）を含むセクション                             | success:false |
 * | T-05 | linksセクションのurlが不正なURL                                 | success:false |
 */

import { describe, expect, it } from 'bun:test';

import { raceDetailUiSchema } from '../../../src/schemas/raceDetailUiSchema';

describe('schemas/raceDetailUiSchema', () => {
    it('T-01: kv/links/players全セクションを含む場合パースに成功すること', () => {
        const result = raceDetailUiSchema.safeParse({
            schemaVersion: 1,
            sections: [
                { type: 'kv', rows: [{ label: '発走', value: '14:33' }] },
                {
                    type: 'links',
                    items: [
                        {
                            label: 'レース情報（netkeirin）',
                            url: 'https://keirin.netkeiba.com/',
                        },
                    ],
                },
                {
                    type: 'players',
                    title: '出走選手',
                    watchToggle: true,
                    rows: [
                        {
                            carNumber: 1,
                            frameNumber: 1,
                            playerNo: '012345',
                            playerName: '柴崎淳',
                        },
                    ],
                },
            ],
        });

        expect(result.success).toBe(true);
    });

    it('T-02: schemaVersionが1以外の場合パースに失敗すること', () => {
        const result = raceDetailUiSchema.safeParse({
            schemaVersion: 2,
            sections: [],
        });

        expect(result.success).toBe(false);
    });

    it('T-03: sectionsが空配列の場合パースに成功すること', () => {
        const result = raceDetailUiSchema.safeParse({
            schemaVersion: 1,
            sections: [],
        });

        expect(result.success).toBe(true);
    });

    it('T-04: 未知のtypeを含む場合パースに失敗すること', () => {
        const result = raceDetailUiSchema.safeParse({
            schemaVersion: 1,
            sections: [{ type: 'odds', items: [] }],
        });

        expect(result.success).toBe(false);
    });

    it('T-05: linksセクションのurlが不正な場合パースに失敗すること', () => {
        const result = raceDetailUiSchema.safeParse({
            schemaVersion: 1,
            sections: [
                { type: 'links', items: [{ label: 'x', url: 'not-a-url' }] },
            ],
        });

        expect(result.success).toBe(false);
    });
});
