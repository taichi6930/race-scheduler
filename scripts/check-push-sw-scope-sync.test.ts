/**
 * check-push-sw-scope-sync.ts の自己テスト（QSYNC-05）
 *
 * ## デシジョンテーブル
 *
 * ### extractJsConfig
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-01 | `.register('push-sw.js', { scope: '/push/' })` を含む | `{ scriptUrl: 'push-sw.js', scope: '/push/' }` |
 * | T-02 | registerが無い | 両方null |
 *
 * ### extractDartConfig
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-03 | 両定数を含む | 両方抽出 |
 * | T-04 | 定数が無い | 両方null |
 *
 * ### diffPushSwConfig
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-05 | 両方一致 | 空配列 |
 * | T-06 | scriptUrlのみ不一致 | scriptUrl不一致メッセージのみ |
 * | T-07 | scopeのみ不一致 | scope不一致メッセージのみ |
 * | T-08 | 片方が抽出できない | 抽出失敗メッセージ |
 */

import { describe, expect, it } from 'bun:test';

import {
    diffPushSwConfig,
    extractDartConfig,
    extractJsConfig,
} from './check-push-sw-scope-sync';

describe('check-push-sw-scope-sync/extractJsConfig', () => {
    it('T-01: register呼び出しからスクリプト名・scopeを抽出すること', () => {
        const content = `
        navigator.serviceWorker
            .register('push-sw.js', { scope: '/push/' })
            .catch((error) => {});
`;
        expect(extractJsConfig(content)).toEqual({
            scriptUrl: 'push-sw.js',
            scope: '/push/',
        });
    });

    it('T-02: registerが無い場合は両方nullを返すこと', () => {
        expect(extractJsConfig('// no register call')).toEqual({
            scriptUrl: null,
            scope: null,
        });
    });
});

describe('check-push-sw-scope-sync/extractDartConfig', () => {
    it('T-03: 両定数からスクリプト名・scopeを抽出すること', () => {
        const content = `
const _pushServiceWorkerScriptUrl = 'push-sw.js';
const _pushServiceWorkerScope = '/push/';
`;
        expect(extractDartConfig(content)).toEqual({
            scriptUrl: 'push-sw.js',
            scope: '/push/',
        });
    });

    it('T-04: 定数が無い場合は両方nullを返すこと', () => {
        expect(extractDartConfig('// no constants')).toEqual({
            scriptUrl: null,
            scope: null,
        });
    });
});

describe('check-push-sw-scope-sync/diffPushSwConfig', () => {
    it('T-05: 両方一致する場合は空配列を返すこと', () => {
        const config = { scriptUrl: 'push-sw.js', scope: '/push/' };
        expect(diffPushSwConfig(config, { ...config })).toEqual([]);
    });

    it('T-06: scriptUrlのみ不一致の場合はscriptUrlのメッセージのみ返すこと', () => {
        const diffs = diffPushSwConfig(
            { scriptUrl: 'push-sw.js', scope: '/push/' },
            { scriptUrl: 'other-sw.js', scope: '/push/' },
        );
        expect(diffs).toEqual([
            "スクリプト名が不一致: app-bootstrap.js='push-sw.js' / web_push_client_web.dart='other-sw.js'",
        ]);
    });

    it('T-07: scopeのみ不一致の場合はscopeのメッセージのみ返すこと', () => {
        const diffs = diffPushSwConfig(
            { scriptUrl: 'push-sw.js', scope: '/push/' },
            { scriptUrl: 'push-sw.js', scope: '/other/' },
        );
        expect(diffs).toEqual([
            "scopeが不一致: app-bootstrap.js='/push/' / web_push_client_web.dart='/other/'",
        ]);
    });

    it('T-08: 片方が抽出できない場合は抽出失敗メッセージを返すこと', () => {
        const diffs = diffPushSwConfig(
            { scriptUrl: null, scope: null },
            { scriptUrl: 'push-sw.js', scope: '/push/' },
        );
        expect(diffs).toEqual([
            'スクリプト名を両ファイルから抽出できませんでした',
            'scopeを両ファイルから抽出できませんでした',
        ]);
    });
});
