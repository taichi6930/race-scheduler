/**
 * generate-sbom.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * name/versionの分解・重複排除ロジックを誤ると簡易SBOM（SEC-034）の内容が
 * 欠落・誤表示するため、UTを用意する。`bunx license-checker` の実行自体は
 * ネットワーク・環境依存のためここでは検証しない。
 *
 * ## デシジョンテーブル
 *
 * ### parseNameVersion
 * | # | key | 期待 |
 * |---|-----|------|
 * | T-01 | 'lodash@4.17.21' | name='lodash', version='4.17.21' |
 * | T-02 | '@types/node@20.1.0' | name='@types/node', version='20.1.0'（スコープ付き） |
 * | T-03 | 'no-at-sign' | name='no-at-sign', version='unknown'（@が無い） |
 *
 * ### dedupeEntries
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-04 | 同一name@versionが複数dirに存在 | 1件に統合される |
 * | T-05 | 異なるname | name昇順にソートされる |
 */
import { describe, expect, it } from 'bun:test';

import {
    dedupeEntries,
    parseNameVersion,
    type SbomEntry,
} from './generate-sbom';

describe('parseNameVersion', () => {
    it.each([
        ['[T-01] スコープ無し', 'lodash@4.17.21', 'lodash', '4.17.21'],
        ['[T-02] スコープ付き', '@types/node@20.1.0', '@types/node', '20.1.0'],
        ['[T-03] @が無い', 'no-at-sign', 'no-at-sign', 'unknown'],
    ])('%s', (_label, key, expectedName, expectedVersion) => {
        expect(parseNameVersion(key)).toEqual({
            name: expectedName,
            version: expectedVersion,
        });
    });
});

describe('dedupeEntries', () => {
    it('[T-04] 同一name@versionが複数dirに存在する場合は1件に統合されること', () => {
        const entries: SbomEntry[] = [
            { dir: '.', name: 'lodash', version: '4.17.21', licenses: ['MIT'] },
            {
                dir: 'packages/api',
                name: 'lodash',
                version: '4.17.21',
                licenses: ['MIT'],
            },
        ];

        expect(dedupeEntries(entries)).toHaveLength(1);
    });

    it('[T-05] name昇順にソートされること', () => {
        const entries: SbomEntry[] = [
            { dir: '.', name: 'zod', version: '4.0.0', licenses: ['MIT'] },
            { dir: '.', name: 'axios', version: '1.0.0', licenses: ['MIT'] },
        ];

        expect(dedupeEntries(entries).map((e) => e.name)).toEqual([
            'axios',
            'zod',
        ]);
    });
});
