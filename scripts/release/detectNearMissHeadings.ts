#!/usr/bin/env bun
/**
 * detectNearMissHeadings.ts
 *
 * PR本文の更新履歴セクションで、カテゴリ見出しのテキストは正しいが見出しレベル
 * （`#`の数）が規約（`## `）と異なる「ニアミス」行を検出する。
 *
 * 実際に本リポで2回連続で発生した失敗（`### 🔧 バックエンドのみ`のように`#`を
 * 1つ多く書いてしまい、`generateReleaseSummary.ts`のパーサーが1文字も認識できず
 * 内容が丸ごと「その他」カテゴリへ落ちた）を機械的に検知するためのガード。
 *
 * CLIとして実行する場合は標準入力からPR本文を受け取り、ニアミスが1件でもあれば
 * 該当行を報告して終了コード1で終了する（`.github/workflows/pr-gates.yml`
 * から呼ばれる想定）。
 */

import { RELEASE_NOTE_CATEGORIES } from './releaseNoteCategories';

/**
 * [body] 内の各行を走査し、「既知カテゴリの見出しテキストと完全一致するが、
 * 見出しレベル（`#`の数）が正しい`## `（2つ）と異なる行」を抽出する。
 * 該当が無ければ空配列。
 */
export const detectNearMissHeadings = (body: string): string[] => {
    const knownCoreTexts = new Set(
        RELEASE_NOTE_CATEGORIES.map((c) => c.heading.replace(/^##\s+/, '')),
    );
    const nearMisses: string[] = [];

    for (const rawLine of body.split('\n')) {
        const line = rawLine.trim();
        const match = /^(#{1,6})\s+(.*)$/.exec(line);
        if (!match) {
            continue;
        }
        const [, hashes, coreText] = match;
        if (knownCoreTexts.has(coreText) && hashes.length !== 2) {
            nearMisses.push(line);
        }
    }

    return nearMisses;
};

if (import.meta.main) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of Bun.stdin.stream()) {
        chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString('utf-8');

    const nearMisses = detectNearMissHeadings(body);
    if (nearMisses.length > 0) {
        console.error(
            '更新履歴の見出しレベルが規約（`## <絵文字> <カテゴリ名>`、ハッシュ2つ）と異なります:',
        );
        for (const line of nearMisses) {
            console.error(`  - "${line}"`);
        }
        console.error(
            '見出しのテキストは正しいので、ハッシュの数だけ2つに直してください。',
        );
        process.exit(1);
    }
    console.log('OK: 見出しレベルのニアミスは見つかりませんでした。');
}
