/**
 * check-app-name-sync.ts の自己テスト（QSYNC-10）
 *
 * ## デシジョンテーブル
 *
 * ### extractAppNameSources
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-01 | 3ファイルすべてに名前・説明文が揃っている | 全箇所を抽出 |
 * | T-02 | 一部のmetaタグが無い | 存在する箇所のみ抽出（欠落は無視） |
 *
 * ### findInconsistentValues
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-03 | 全値が一致 | 空配列 |
 * | T-04 | 1件だけ異なる | 不一致メッセージ（全箇所を列挙） |
 * | T-05 | 値が0件 | 空配列（比較不能なので常にOK） |
 * | T-06 | 値が1件のみ | 空配列（比較対象が無いので常にOK） |
 */

import { describe, expect, it } from 'bun:test';

import {
    extractAppNameSources,
    findInconsistentValues,
} from './check-app-name-sync';

describe('check-app-name-sync/extractAppNameSources', () => {
    it('T-01: 3ファイルすべてから名前・説明文を抽出すること', () => {
        const manifest = JSON.stringify({
            name: '開催盤',
            short_name: '開催盤',
            description: '説明文',
        });
        const html = `
<meta name="description" content="説明文">
<meta property="og:title" content="開催盤">
<meta property="og:site_name" content="開催盤">
<meta property="og:description" content="説明文">
<meta name="twitter:title" content="開催盤">
<meta name="twitter:description" content="説明文">
<meta name="apple-mobile-web-app-title" content="開催盤">
<title>開催盤</title>
`;
        const dart = "title: '開催盤',";

        const { names, descriptions } = extractAppNameSources(
            manifest,
            html,
            dart,
        );

        expect(names.map((n) => n.value)).toEqual(Array(8).fill('開催盤'));
        expect(descriptions.map((d) => d.value)).toEqual(
            Array(4).fill('説明文'),
        );
    });

    it('T-02: 一部のmetaタグが無い場合は存在する箇所のみ抽出すること', () => {
        const manifest = JSON.stringify({ name: '開催盤' });
        const html = '<title>開催盤</title>';
        const dart = '';

        const { names, descriptions } = extractAppNameSources(
            manifest,
            html,
            dart,
        );

        expect(names).toEqual([
            { label: 'manifest.json name', value: '開催盤' },
            { label: 'index.html <title>', value: '開催盤' },
        ]);
        expect(descriptions).toEqual([]);
    });
});

describe('check-app-name-sync/findInconsistentValues', () => {
    it('T-03: 全値が一致する場合は空配列を返すこと', () => {
        const values = [
            { label: 'a', value: '開催盤' },
            { label: 'b', value: '開催盤' },
        ];
        expect(findInconsistentValues('アプリ名', values)).toEqual([]);
    });

    it('T-04: 1件だけ異なる場合は全箇所を列挙したメッセージを返すこと', () => {
        const values = [
            { label: 'a', value: '開催盤' },
            { label: 'b', value: 'front' },
        ];
        expect(findInconsistentValues('アプリ名', values)).toEqual([
            'アプリ名が一致していません:',
            "  - a: '開催盤'",
            "  - b: 'front'",
        ]);
    });

    it('T-05: 値が0件の場合は空配列を返すこと', () => {
        expect(findInconsistentValues('アプリ名', [])).toEqual([]);
    });

    it('T-06: 値が1件のみの場合は空配列を返すこと', () => {
        expect(
            findInconsistentValues('アプリ名', [
                { label: 'a', value: '開催盤' },
            ]),
        ).toEqual([]);
    });
});
