#!/usr/bin/env bun
/**
 * check-admin-color-drift.ts (QADM-10)
 *
 * `packages/admin/src/controller/adminPageChrome.ts` の `FRONT_COLORS` /
 * `FRONT_COLORS_DARK` は、front の `packages/front/lib/design/tokens.dart` にある
 * `AppColors.light` / `AppColors.dark` の値を手でコピーしたものであり、同期の仕組みが
 * 無い（コメントに「front `AppColors.light`（...）由来の配色」とある通り、意図的な
 * コピー）。front側のトークンを変えてもadminは古い配色のまま気づかれない。
 *
 * 本スクリプトは、adminが持つキー（bg/surface/surface2/ink/ink2/line/brand/danger）
 * について、両ファイルの16進カラー値が一致することを検証する。
 *
 * 使い方: bun scripts/check-admin-color-drift.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_PATH = join(
    import.meta.dir,
    '../packages/admin/src/controller/adminPageChrome.ts',
);
const TOKENS_PATH = join(
    import.meta.dir,
    '../packages/front/lib/design/tokens.dart',
);

/**
 * `export const FRONT_COLORS(_DARK)? = { key: '#RRGGBB', ... };` からキー→色を抽出する。
 * @param content - adminPageChrome.ts の内容
 * @param constName - `FRONT_COLORS` または `FRONT_COLORS_DARK`
 * @returns キー→色（大文字16進、`#`付き）のマップ
 */
export function extractAdminColors(
    content: string,
    constName: 'FRONT_COLORS' | 'FRONT_COLORS_DARK',
): Record<string, string> {
    const blockRegex = new RegExp(
        `export const ${constName} = \\{([\\s\\S]*?)\\n\\};`,
    );
    const blockMatch = content.match(blockRegex);
    if (!blockMatch) return {};
    const colors: Record<string, string> = {};
    const entryRegex = /^\s*(\w+):\s*'(#[0-9A-Fa-f]{6})',?/gm;
    for (const entryMatch of blockMatch[1].matchAll(entryRegex)) {
        colors[entryMatch[1]] = entryMatch[2].toUpperCase();
    }
    return colors;
}

/**
 * `static const light = AppColors(...)` / `static const dark = AppColors(...)` から
 * キー→色を抽出する。`Color(0xFFRRGGBB)` 形式（アルファ`FF`固定）を `#RRGGBB` へ変換する。
 * @param content - tokens.dart の内容
 * @param themeName - `light` または `dark`
 * @returns キー→色（大文字16進、`#`付き）のマップ
 */
export function extractTokensDartColors(
    content: string,
    themeName: 'light' | 'dark',
): Record<string, string> {
    const blockRegex = new RegExp(
        `static const ${themeName} = AppColors\\(([\\s\\S]*?)\\n\\s{2}\\);`,
    );
    const blockMatch = content.match(blockRegex);
    if (!blockMatch) return {};
    const colors: Record<string, string> = {};
    const entryRegex = /^\s*(\w+):\s*Color\(0xFF([0-9A-Fa-f]{6})\),?/gm;
    for (const entryMatch of blockMatch[1].matchAll(entryRegex)) {
        colors[entryMatch[1]] = `#${entryMatch[2].toUpperCase()}`;
    }
    return colors;
}

/**
 * admin側が持つキーについて、front側（tokens.dart）と色値が一致するかを検証する。
 * tokens.dartにのみ存在するキー（surface3等）はadminが追従する必要が無いため対象外。
 * @param adminColors - {@link extractAdminColors} の戻り値
 * @param tokensColors - {@link extractTokensDartColors} の戻り値
 * @param themeLabel - エラーメッセージに使うテーマ名（例: 'light'）
 * @returns 不一致の説明メッセージ一覧（一致していれば空配列）
 */
export function findColorDrift(
    adminColors: Record<string, string>,
    tokensColors: Record<string, string>,
    themeLabel: string,
): string[] {
    const messages: string[] = [];
    for (const [key, adminValue] of Object.entries(adminColors)) {
        const tokensValue = tokensColors[key];
        if (tokensValue === undefined) {
            messages.push(
                `[${themeLabel}] ${key}: tokens.dartに対応するキーが見つかりません`,
            );
        } else if (tokensValue !== adminValue) {
            messages.push(
                `[${themeLabel}] ${key}: admin='${adminValue}' / tokens.dart='${tokensValue}'`,
            );
        }
    }
    return messages;
}

if (import.meta.main) {
    const adminContent = readFileSync(ADMIN_PATH, 'utf-8');
    const tokensContent = readFileSync(TOKENS_PATH, 'utf-8');

    const adminLight = extractAdminColors(adminContent, 'FRONT_COLORS');
    const adminDark = extractAdminColors(adminContent, 'FRONT_COLORS_DARK');
    const tokensLight = extractTokensDartColors(tokensContent, 'light');
    const tokensDark = extractTokensDartColors(tokensContent, 'dark');

    if (
        Object.keys(adminLight).length === 0 ||
        Object.keys(tokensLight).length === 0
    ) {
        console.error(
            '❌ 配色を抽出できませんでした（正規表現の見直しが必要です）。',
        );
        process.exit(1);
    }

    const drift = [
        ...findColorDrift(adminLight, tokensLight, 'light'),
        ...findColorDrift(adminDark, tokensDark, 'dark'),
    ];

    if (drift.length > 0) {
        console.error(
            '❌ admin(FRONT_COLORS) が front(tokens.dart) の配色からドリフトしています:',
        );
        for (const message of drift) {
            console.error(`  - ${message}`);
        }
        console.error(
            '  packages/admin/src/controller/adminPageChrome.ts の FRONT_COLORS / ' +
                'FRONT_COLORS_DARK を packages/front/lib/design/tokens.dart の値に合わせてください。',
        );
        process.exit(1);
    }

    console.log(
        '✅ admin(FRONT_COLORS/FRONT_COLORS_DARK) と front(tokens.dart) の配色が一致しています。',
    );
}
