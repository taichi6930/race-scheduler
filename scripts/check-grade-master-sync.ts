#!/usr/bin/env bun
/**
 * check-grade-master-sync.ts (QSYNC-02)
 *
 * グレード表（`gradeName` × `raceType`）は `packages/core/src/domain/master/gradeMaster.ts`
 * の `GradeMaster` を単一の正典とし、`packages/front/lib/domain/entities/grade_tier.dart`
 * の `_gradeTable` へ手動で同期した静的テーブルとして複製されている（コメントに
 * 「バックエンドのグレードマスタが変更された場合は、このテーブルも追従させること」と明記）。
 * 追従漏れが起きると、新設グレードのレースが front で「無印（tier 0）」として表示され、
 * 重賞フィルタから漏れて通知も飛ばない（isSpecified が false 扱いになるため）。
 *
 * 本スクリプトは両ファイルから (raceType, gradeName) の集合を抽出し、front 側の
 * 網羅性（core に存在するgradeが front にも存在すること）を検証する。tier・isSpecified
 * の値そのものは front 固有の判断を含むため検証対象外（QSYNC-02の対象は集合の一致のみ）。
 *
 * 使い方: bun scripts/check-grade-master-sync.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CORE_PATH = join(
    import.meta.dir,
    '../packages/core/src/domain/master/gradeMaster.ts',
);
const FRONT_PATH = join(
    import.meta.dir,
    '../packages/front/lib/domain/entities/grade_tier.dart',
);

/** raceType（小文字）→ そのraceTypeが持つgrade名一覧。 */
interface GradeKeysMap {
    [raceType: string]: string[];
}

/**
 * `GradeMaster` オブジェクトリテラルから `raceType (小文字) -> gradeName配列` を抽出する。
 * `[RaceType.XXX]: { grade: {...}, ... }` ブロックを走査し、ブロック内の
 * トップレベルキー（`Key:` または `'Key':`）をgrade名として収集する。
 * @param content - gradeMaster.ts の内容
 * @returns raceType（小文字）ごとのgrade名配列
 */
export function extractCoreGradeKeys(content: string): GradeKeysMap {
    const result: GradeKeysMap = {};
    const blockRegex = /\[RaceType\.(\w+)\]:\s*\{([\s\S]*?)\n\s{4}\},/g;
    for (const blockMatch of content.matchAll(blockRegex)) {
        const raceType = blockMatch[1].toLowerCase();
        const body = blockMatch[2];
        const keys: string[] = [];
        const keyRegex = /^\s*(?:'([^']+)'|([^\s:'"]+)):\s*\{\s*isSpecified:/gm;
        for (const keyMatch of body.matchAll(keyRegex)) {
            keys.push(keyMatch[1] ?? keyMatch[2]);
        }
        result[raceType] = keys;
    }
    return result;
}

/**
 * `_gradeTable` マップリテラルから `raceType (小文字) -> gradeName配列` を抽出する。
 * `RaceType.xxx: { 'grade': _GradeEntry(...), ... }` ブロックを走査する。
 * @param content - grade_tier.dart の内容
 * @returns raceType（小文字）ごとのgrade名配列
 */
export function extractFrontGradeKeys(content: string): GradeKeysMap {
    const result: GradeKeysMap = {};
    const blockRegex = /RaceType\.(\w+):\s*\{([\s\S]*?)\n\s{2}\},/g;
    for (const blockMatch of content.matchAll(blockRegex)) {
        const raceType = blockMatch[1];
        const body = blockMatch[2];
        const keys: string[] = [];
        const keyRegex = /^\s*'([^']+)':\s*_GradeEntry/gm;
        for (const keyMatch of body.matchAll(keyRegex)) {
            keys.push(keyMatch[1]);
        }
        result[raceType] = keys;
    }
    return result;
}

/**
 * core側の各 (raceType, gradeName) がfront側にも存在するかを検証する。
 * @param coreKeys - {@link extractCoreGradeKeys} の戻り値
 * @param frontKeys - {@link extractFrontGradeKeys} の戻り値
 * @returns front側で欠落しているgradeのメッセージ一覧（無ければ空配列）
 */
export function findMissingGrades(
    coreKeys: GradeKeysMap,
    frontKeys: GradeKeysMap,
): string[] {
    const messages: string[] = [];
    for (const [raceType, grades] of Object.entries(coreKeys)) {
        const frontSet = new Set(frontKeys[raceType] ?? []);
        if (!(raceType in frontKeys)) {
            messages.push(
                `raceType=${raceType}: front側の _gradeTable にraceType自体が存在しません`,
            );
            continue;
        }
        for (const grade of grades) {
            if (!frontSet.has(grade)) {
                messages.push(
                    `raceType=${raceType}, grade=${grade}: front側の _gradeTable に存在しません`,
                );
            }
        }
    }
    return messages;
}

if (import.meta.main) {
    const coreContent = readFileSync(CORE_PATH, 'utf-8');
    const frontContent = readFileSync(FRONT_PATH, 'utf-8');

    const coreKeys = extractCoreGradeKeys(coreContent);
    const frontKeys = extractFrontGradeKeys(frontContent);

    if (Object.keys(coreKeys).length === 0) {
        console.error(
            '❌ gradeMaster.ts からgradeを1件も抽出できませんでした（正規表現の見直しが必要です）。',
        );
        process.exit(1);
    }

    const missing = findMissingGrades(coreKeys, frontKeys);

    if (missing.length > 0) {
        console.error(
            '❌ grade_tier.dart の _gradeTable が gradeMaster.ts に追従していません:',
        );
        for (const message of missing) {
            console.error(`  - ${message}`);
        }
        console.error(
            '  packages/front/lib/domain/entities/grade_tier.dart の _gradeTable へ、' +
                '上記のgradeを追加してください（tier/isSpecifiedの値はdesign-system.mdを参照）。',
        );
        process.exit(1);
    }

    console.log(
        '✅ grade_tier.dart の _gradeTable は gradeMaster.ts のgrade集合を網羅しています。',
    );
}
