#!/usr/bin/env bun
/**
 * check-race-type-sync.ts (QSYNC-03)
 *
 * `RaceType` の6値（jra/nar/overseas/keirin/autorace/boatrace）は
 * `packages/core/src/domain/model/valueObject/raceType.ts` の `RaceType` オブジェクトと
 * `packages/front/lib/domain/entities/race_type.dart` の `RaceType` enum に二重定義されている。
 * Dart側の `fromValue` は未知の値で `ArgumentError` を投げるため、バックエンドに7つ目の種別が
 * 増えると、そのレースを含むレスポンス全体のパースが例外で落ちる（1レコードのために画面全体が
 * エラーカードになる）。
 *
 * 本スクリプトは両ファイルから値集合を抽出し、一致を検証する（挙動変更＝fromValueの
 * 例外設計の是非はQSYNC-03の対象外。検知のみ）。
 *
 * 使い方: bun scripts/check-race-type-sync.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CORE_PATH = join(
    import.meta.dir,
    '../packages/core/src/domain/model/valueObject/raceType.ts',
);
const FRONT_PATH = join(
    import.meta.dir,
    '../packages/front/lib/domain/entities/race_type.dart',
);

/**
 * `export const RaceType = { KEY: 'value', ... } as const;` から値集合を抽出する。
 * @param content - raceType.ts の内容
 * @returns 抽出した値（小文字文字列）の配列
 */
export function extractCoreRaceTypeValues(content: string): string[] {
    const blockMatch = content.match(
        /export const RaceType = \{([\s\S]*?)\} as const;/,
    );
    if (!blockMatch) return [];
    const values: string[] = [];
    const entryRegex = /^\s*\w+:\s*'([^']+)'/gm;
    for (const entryMatch of blockMatch[1].matchAll(entryRegex)) {
        values.push(entryMatch[1]);
    }
    return values;
}

/**
 * `enum RaceType { jra('jra'), nar('nar'), ... }` から値集合を抽出する。
 * @param content - race_type.dart の内容
 * @returns 抽出した値（小文字文字列）の配列
 */
export function extractFrontRaceTypeValues(content: string): string[] {
    // Dartの拡張enumは「値宣言部; 本体（メソッド等）」を`;`で区切るため、
    // 値宣言部（fromValue等のメソッド本体を含まない範囲）だけを対象にする。
    const blockMatch = content.match(/enum RaceType \{([\s\S]*?);/);
    if (!blockMatch) return [];
    const values: string[] = [];
    const entryRegex = /^\s*\w+\('([^']+)'\)/gm;
    for (const entryMatch of blockMatch[1].matchAll(entryRegex)) {
        values.push(entryMatch[1]);
    }
    return values;
}

/**
 * 2つの値集合が一致するかを検証する（順序は無視、集合として比較）。
 * @param coreValues - core側の値配列
 * @param frontValues - front側の値配列
 * @returns 不一致の説明メッセージ一覧（一致していれば空配列）
 */
export function diffRaceTypeValues(
    coreValues: string[],
    frontValues: string[],
): string[] {
    const messages: string[] = [];
    const coreSet = new Set(coreValues);
    const frontSet = new Set(frontValues);
    for (const value of coreValues) {
        if (!frontSet.has(value)) {
            messages.push(
                `'${value}': core(raceType.ts)にのみ存在し、front(race_type.dart)に存在しません`,
            );
        }
    }
    for (const value of frontValues) {
        if (!coreSet.has(value)) {
            messages.push(
                `'${value}': front(race_type.dart)にのみ存在し、core(raceType.ts)に存在しません`,
            );
        }
    }
    return messages;
}

if (import.meta.main) {
    const coreContent = readFileSync(CORE_PATH, 'utf-8');
    const frontContent = readFileSync(FRONT_PATH, 'utf-8');

    const coreValues = extractCoreRaceTypeValues(coreContent);
    const frontValues = extractFrontRaceTypeValues(frontContent);

    if (coreValues.length === 0 || frontValues.length === 0) {
        console.error(
            '❌ RaceTypeの値を抽出できませんでした（正規表現の見直しが必要です）。',
        );
        process.exit(1);
    }

    const diffs = diffRaceTypeValues(coreValues, frontValues);

    if (diffs.length > 0) {
        console.error('❌ RaceTypeの値集合が core/front 間で一致していません:');
        for (const message of diffs) {
            console.error(`  - ${message}`);
        }
        console.error(
            '  packages/core/src/domain/model/valueObject/raceType.ts と ' +
                'packages/front/lib/domain/entities/race_type.dart の両方を揃えてください。',
        );
        process.exit(1);
    }

    console.log(
        `✅ RaceTypeの値集合（${String(coreValues.length)}件）が core/front 間で一致しています。`,
    );
}
