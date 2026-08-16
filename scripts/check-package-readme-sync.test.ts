/**
 * check-package-readme-sync.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 表パース・突き合わせを誤るとリンク切れ/記載漏れを見逃すため、純粋関数（fs非依存）のUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### parseDocTable
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `\| **api** \| [README.md](api/README.md) \| - \|` | name='api', リンク1件 |
 * | T-02 | ヘッダー行・区切り行（`---`） | 抽出されない |
 * | T-03 | リンクが `-` のみのセル | linksは空配列 |
 *
 * ### checkSync
 * | # | 状況 | 期待 |
 * |---|-----|------|
 * | T-04 | リンク先が存在しない | kind='broken-link' |
 * | T-05 | 実ディレクトリが表に無い | kind='undocumented-package' |
 * | T-06 | 全て整合 | 空配列 |
 */
import { describe, expect, it } from 'bun:test';

import { checkSync, parseDocTable } from './check-package-readme-sync';

describe('parseDocTable', () => {
    it('[T-01] 太字パッケージ名とリンクを抽出すること', () => {
        const md = '| **api** | [README.md](api/README.md) | - |';
        expect(parseDocTable(md)).toEqual([
            {
                name: 'api',
                links: [{ label: 'README.md', path: 'api/README.md' }],
            },
        ]);
    });

    it('[T-02] ヘッダー行・区切り行は抽出しないこと', () => {
        const md =
            '| パッケージ | README |\n| --- | --- |\n| **api** | [README.md](api/README.md) |';
        expect(parseDocTable(md)).toHaveLength(1);
    });

    it('[T-03] リンクの無いセル（-）はlinksが空配列になること', () => {
        const md = '| **db** | - | - |';
        expect(parseDocTable(md)).toEqual([{ name: 'db', links: [] }]);
    });
});

describe('checkSync', () => {
    it('[T-04] リンク先が存在しない場合はbroken-linkを検出すること', () => {
        const rows = [
            {
                name: 'api',
                links: [{ label: 'README.md', path: 'api/README.md' }],
            },
        ];
        const issues = checkSync(rows, ['api'], () => false);
        expect(issues).toEqual([
            {
                kind: 'broken-link',
                detail: expect.stringContaining(
                    'api/README.md',
                ) as unknown as string,
            },
        ]);
    });

    it('[T-05] 実ディレクトリが表に無い場合はundocumented-packageを検出すること', () => {
        const issues = checkSync([], ['newpkg'], () => true);
        expect(issues).toEqual([
            {
                kind: 'undocumented-package',
                detail: expect.stringContaining('newpkg') as unknown as string,
            },
        ]);
    });

    it('[T-06] 全て整合していれば空配列を返すこと', () => {
        const rows = [
            {
                name: 'api',
                links: [{ label: 'README.md', path: 'api/README.md' }],
            },
        ];
        expect(checkSync(rows, ['api'], () => true)).toEqual([]);
    });
});
