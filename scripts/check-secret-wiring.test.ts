/**
 * check-secret-wiring.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * ADMIN_TOKEN配線漏れ（feature-flag-design.md）の再発防止ゲートの中核ロジック
 * のためUTを用意する。実ファイルには触れず、合成データのみで検証する（hermetic）。
 *
 * ## デシジョンテーブル
 *
 * ### extractStringFieldNames
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | E1 | 必須のstring型フィールド | 抽出される |
 * | E2 | 任意（`?`）のstring型フィールド | 抽出される |
 * | E3 | バインディング型（D1Database等）のフィールド | 抽出されない |
 * | E4 | 行末コメント付きのフィールド | コメントを含まずフィールド名のみ抽出される |
 *
 * ### extractReferencedFieldNames
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | R1 | `EnvStore.env.X` で参照されているフィールド | 抽出される |
 * | R2 | `c.env.X` で参照されているフィールド | 抽出される |
 * | R3 | どのソースファイルでも参照されていないフィールド | 抽出されない |
 * | R4 | 別フィールド名の接頭辞に一致するだけ（`Y_X`）のフィールド | 誤って抽出されない（単語境界） |
 *
 * ### findUnwiredFields
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | F1 | secrets-json内に登場するフィールド | ギャップとして検出されない |
 * | F2 | wrangler.toml内に登場するフィールド | ギャップとして検出されない |
 * | F3 | デプロイ設定のどこにも登場しないフィールド | ギャップとして検出される |
 */

import { describe, expect, it } from 'bun:test';

import {
    extractReferencedFieldNames,
    extractStringFieldNames,
    findUnwiredFields,
} from './check-secret-wiring';

describe('extractStringFieldNames', () => {
    it('E1: 必須のstring型フィールドが抽出されること', () => {
        const source = `
export interface CloudFlareEnv {
    SERVICE_AUTH_TOKEN: string;
}
`;
        expect(extractStringFieldNames(source)).toEqual(['SERVICE_AUTH_TOKEN']);
    });

    it('E2: 任意(?)のstring型フィールドが抽出されること', () => {
        const source = `
export interface CloudFlareEnv {
    ADMIN_TOKEN?: string;
}
`;
        expect(extractStringFieldNames(source)).toEqual(['ADMIN_TOKEN']);
    });

    it('E3: バインディング型のフィールドは抽出されないこと', () => {
        const source = `
export interface CloudFlareEnv {
    DB: D1Database;
    R2_BUCKET: R2Bucket;
}
`;
        expect(extractStringFieldNames(source)).toEqual([]);
    });

    it('E4: 行末コメント付きのフィールドはコメントを含まず抽出されること', () => {
        const source = `
export interface CloudFlareEnv {
    JRA_CALENDAR_ID: string; // 中央競馬
}
`;
        expect(extractStringFieldNames(source)).toEqual(['JRA_CALENDAR_ID']);
    });
});

describe('extractReferencedFieldNames', () => {
    it('R1: EnvStore.env.Xで参照されているフィールドが抽出されること', () => {
        const result = extractReferencedFieldNames(['ADMIN_TOKEN'], {
            'a.ts': 'const t = EnvStore.env.ADMIN_TOKEN;',
        });

        expect(result).toEqual(['ADMIN_TOKEN']);
    });

    it('R2: c.env.Xで参照されているフィールドが抽出されること', () => {
        const result = extractReferencedFieldNames(['ADMIN_TOKEN'], {
            'a.ts': 'const t = c.env.ADMIN_TOKEN;',
        });

        expect(result).toEqual(['ADMIN_TOKEN']);
    });

    it('R3: どのソースファイルでも参照されていないフィールドは抽出されないこと', () => {
        const result = extractReferencedFieldNames(['UNUSED_FIELD'], {
            'a.ts': 'const t = EnvStore.env.ADMIN_TOKEN;',
        });

        expect(result).toEqual([]);
    });

    it('R4: 別フィールド名の接頭辞に一致するだけのフィールドは誤って抽出されないこと', () => {
        const result = extractReferencedFieldNames(['TOKEN'], {
            'a.ts': 'const t = EnvStore.env.ADMIN_TOKEN;',
        });

        expect(result).toEqual([]);
    });
});

describe('findUnwiredFields', () => {
    it('F1: secrets-json内に登場するフィールドはギャップとして検出されないこと', () => {
        const result = findUnwiredFields(['ADMIN_TOKEN'], {
            'deploy-api-reusable.yml':
                '"ADMIN_TOKEN": "${{ secrets.ADMIN_TOKEN }}"',
        });

        expect(result).toEqual([]);
    });

    it('F2: wrangler.toml内に登場するフィールドはギャップとして検出されないこと', () => {
        const result = findUnwiredFields(
            ['FEATURE_ANNOUNCEMENT_BANNER_ENABLED'],
            {
                'wrangler.toml':
                    'FEATURE_ANNOUNCEMENT_BANNER_ENABLED = "false"',
            },
        );

        expect(result).toEqual([]);
    });

    it('F3: デプロイ設定のどこにも登場しないフィールドはギャップとして検出されること', () => {
        const result = findUnwiredFields(['ADMIN_TOKEN'], {
            'deploy-api-reusable.yml':
                '"SERVICE_AUTH_TOKEN": "${{ secrets.SERVICE_AUTH_TOKEN }}"',
        });

        expect(result).toEqual([{ field: 'ADMIN_TOKEN' }]);
    });
});
