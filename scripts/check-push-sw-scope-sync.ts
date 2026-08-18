#!/usr/bin/env bun
/**
 * check-push-sw-scope-sync.ts (QSYNC-05)
 *
 * Web Push の Service Worker スクリプト名（`push-sw.js`）とスコープ（`/push/`）は、
 * `packages/front/web/app-bootstrap.js`（`navigator.serviceWorker.register(...)`）と
 * `packages/front/lib/notifications/data/web_push_client/web_push_client_web.dart`
 * （`_pushServiceWorkerScriptUrl` / `_pushServiceWorkerScope`）という、静的JSとDartコードの
 * 別々のビルド成果物にまたがって二重管理されている（SEC-062コメントに「値を変更する場合は
 * 両方を直すこと」と明記）。不一致になると購読は成功したように見えて通知だけが永久に届かない
 * （登録済みSWと購読要求先のscopeが食い違うため）。
 *
 * 使い方: bun scripts/check-push-sw-scope-sync.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const JS_PATH = join(import.meta.dir, '../packages/front/web/app-bootstrap.js');
const DART_PATH = join(
    import.meta.dir,
    '../packages/front/lib/notifications/data/web_push_client/web_push_client_web.dart',
);

interface PushSwConfig {
    scriptUrl: string | null;
    scope: string | null;
}

/**
 * `navigator.serviceWorker.register('push-sw.js', { scope: '/push/' })` からスクリプト名・スコープを抽出する。
 * @param content - app-bootstrap.js の内容
 * @returns 抽出したスクリプト名・スコープ（見つからなければ null）
 */
export function extractJsConfig(content: string): PushSwConfig {
    const match = content.match(
        /\.register\(\s*'([^']+)'\s*,\s*\{\s*scope:\s*'([^']+)'\s*\}\s*\)/,
    );
    return {
        scriptUrl: match?.[1] ?? null,
        scope: match?.[2] ?? null,
    };
}

/**
 * `_pushServiceWorkerScriptUrl = 'push-sw.js';` / `_pushServiceWorkerScope = '/push/';` から
 * スクリプト名・スコープを抽出する。
 * @param content - web_push_client_web.dart の内容
 * @returns 抽出したスクリプト名・スコープ（見つからなければ null）
 */
export function extractDartConfig(content: string): PushSwConfig {
    const scriptMatch = content.match(
        /_pushServiceWorkerScriptUrl\s*=\s*'([^']+)';/,
    );
    const scopeMatch = content.match(
        /_pushServiceWorkerScope\s*=\s*'([^']+)';/,
    );
    return {
        scriptUrl: scriptMatch?.[1] ?? null,
        scope: scopeMatch?.[1] ?? null,
    };
}

/**
 * JS側・Dart側のconfigが一致するかを検証する。
 * @param jsConfig - {@link extractJsConfig} の戻り値
 * @param dartConfig - {@link extractDartConfig} の戻り値
 * @returns 不一致の説明メッセージ一覧（一致していれば空配列）
 */
export function diffPushSwConfig(
    jsConfig: PushSwConfig,
    dartConfig: PushSwConfig,
): string[] {
    const messages: string[] = [];
    if (jsConfig.scriptUrl === null || dartConfig.scriptUrl === null) {
        messages.push('スクリプト名を両ファイルから抽出できませんでした');
    } else if (jsConfig.scriptUrl !== dartConfig.scriptUrl) {
        messages.push(
            `スクリプト名が不一致: app-bootstrap.js='${jsConfig.scriptUrl}' / web_push_client_web.dart='${dartConfig.scriptUrl}'`,
        );
    }
    if (jsConfig.scope === null || dartConfig.scope === null) {
        messages.push('scopeを両ファイルから抽出できませんでした');
    } else if (jsConfig.scope !== dartConfig.scope) {
        messages.push(
            `scopeが不一致: app-bootstrap.js='${jsConfig.scope}' / web_push_client_web.dart='${dartConfig.scope}'`,
        );
    }
    return messages;
}

if (import.meta.main) {
    const jsContent = readFileSync(JS_PATH, 'utf-8');
    const dartContent = readFileSync(DART_PATH, 'utf-8');

    const jsConfig = extractJsConfig(jsContent);
    const dartConfig = extractDartConfig(dartContent);

    const diffs = diffPushSwConfig(jsConfig, dartConfig);

    if (diffs.length > 0) {
        console.error(
            '❌ Web PushのService Workerスクリプト名/scopeが不一致です:',
        );
        for (const message of diffs) {
            console.error(`  - ${message}`);
        }
        console.error(
            '  packages/front/web/app-bootstrap.js と ' +
                'packages/front/lib/notifications/data/web_push_client/web_push_client_web.dart の' +
                '両方を同じ値に揃えてください（SEC-062）。',
        );
        process.exit(1);
    }

    console.log(
        `✅ Web PushのService Worker設定（script='${String(jsConfig.scriptUrl)}', scope='${String(jsConfig.scope)}'）が一致しています。`,
    );
}
