#!/usr/bin/env bun
/**
 * check-app-name-sync.ts (QSYNC-10)
 *
 * アプリ名「開催盤」と説明文「公営競技のレーススケジュールを管理するアプリ」は、
 * `packages/front/web/manifest.json`・`packages/front/web/index.html`・
 * `packages/front/lib/app.dart` の3ファイル7箇所以上に散在している（index.html内の
 * QCOPY-10/QPWA-09コメントで注意喚起済みだが、コメントは追従漏れの検知にはならない）。
 * 本スクリプトは、同一であるべき文字列（アプリ名・説明文）の一致を機械的に検証する。
 *
 * 使い方: bun scripts/check-app-name-sync.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MANIFEST_PATH = join(
    import.meta.dir,
    '../packages/front/web/manifest.json',
);
const INDEX_HTML_PATH = join(
    import.meta.dir,
    '../packages/front/web/index.html',
);
const APP_DART_PATH = join(import.meta.dir, '../packages/front/lib/app.dart');

interface NamedValue {
    /** 値の出所を表すラベル（エラーメッセージ用）。 */
    label: string;
    value: string;
}

interface AppNameSources {
    names: NamedValue[];
    descriptions: NamedValue[];
}

/**
 * manifest.json・index.html・app.dart からアプリ名・説明文の出現箇所をすべて抽出する。
 * @param manifestContent - manifest.json の内容
 * @param indexHtmlContent - index.html の内容
 * @param appDartContent - app.dart の内容
 * @returns アプリ名・説明文それぞれの出現箇所一覧
 */
export function extractAppNameSources(
    manifestContent: string,
    indexHtmlContent: string,
    appDartContent: string,
): AppNameSources {
    const manifest = JSON.parse(manifestContent) as {
        name?: string;
        short_name?: string;
        description?: string;
    };

    const names: NamedValue[] = [];
    const descriptions: NamedValue[] = [];

    if (manifest.name !== undefined) {
        names.push({ label: 'manifest.json name', value: manifest.name });
    }
    if (manifest.short_name !== undefined) {
        names.push({
            label: 'manifest.json short_name',
            value: manifest.short_name,
        });
    }
    if (manifest.description !== undefined) {
        descriptions.push({
            label: 'manifest.json description',
            value: manifest.description,
        });
    }

    const htmlNamePatterns: [string, RegExp][] = [
        ['index.html og:title', /<meta property="og:title" content="([^"]+)">/],
        [
            'index.html og:site_name',
            /<meta property="og:site_name" content="([^"]+)">/,
        ],
        [
            'index.html twitter:title',
            /<meta name="twitter:title" content="([^"]+)">/,
        ],
        [
            'index.html apple-mobile-web-app-title',
            /<meta name="apple-mobile-web-app-title" content="([^"]+)">/,
        ],
        ['index.html <title>', /<title>([^<]+)<\/title>/],
    ];
    for (const [label, pattern] of htmlNamePatterns) {
        const match = indexHtmlContent.match(pattern);
        if (match) names.push({ label, value: match[1] });
    }

    const htmlDescriptionPatterns: [string, RegExp][] = [
        [
            'index.html meta description',
            /<meta name="description" content="([^"]+)">/,
        ],
        [
            'index.html og:description',
            /<meta property="og:description" content="([^"]+)">/,
        ],
        [
            'index.html twitter:description',
            /<meta name="twitter:description" content="([^"]+)">/,
        ],
    ];
    for (const [label, pattern] of htmlDescriptionPatterns) {
        const match = indexHtmlContent.match(pattern);
        if (match) descriptions.push({ label, value: match[1] });
    }

    const dartTitleMatch = appDartContent.match(/title:\s*'([^']+)'/);
    if (dartTitleMatch) {
        names.push({ label: 'app.dart title', value: dartTitleMatch[1] });
    }

    return { names, descriptions };
}

/**
 * 同一グループ内の値がすべて一致するかを検証する。
 * @param label - グループ名（エラーメッセージ用、例: 'アプリ名'）
 * @param values - {@link extractAppNameSources} が抽出した1グループ分の値
 * @returns 不一致の説明メッセージ一覧（一致していれば空配列。値が0件・1件なら常に空配列）
 */
export function findInconsistentValues(
    label: string,
    values: NamedValue[],
): string[] {
    if (values.length <= 1) return [];
    const first = values[0];
    const mismatches = values.filter((v) => v.value !== first.value);
    if (mismatches.length === 0) return [];
    return [
        `${label}が一致していません:`,
        ...values.map((v) => `  - ${v.label}: '${v.value}'`),
    ];
}

if (import.meta.main) {
    const manifestContent = readFileSync(MANIFEST_PATH, 'utf-8');
    const indexHtmlContent = readFileSync(INDEX_HTML_PATH, 'utf-8');
    const appDartContent = readFileSync(APP_DART_PATH, 'utf-8');

    const { names, descriptions } = extractAppNameSources(
        manifestContent,
        indexHtmlContent,
        appDartContent,
    );

    const messages = [
        ...findInconsistentValues('アプリ名', names),
        ...findInconsistentValues('説明文', descriptions),
    ];

    if (messages.length > 0) {
        console.error('❌ アプリ名/説明文が複数ファイル間で一致していません:');
        for (const message of messages) {
            console.error(`  ${message}`);
        }
        console.error(
            '  manifest.json / index.html / app.dart の該当箇所をすべて同じ値に揃えてください（QCOPY-10）。',
        );
        process.exit(1);
    }

    console.log(
        `✅ アプリ名（${String(names.length)}箇所）・説明文（${String(descriptions.length)}箇所）が一致しています。`,
    );
}
