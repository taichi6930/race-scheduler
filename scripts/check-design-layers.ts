#!/usr/bin/env bun
/**
 * front（Flutter）のAtomic Designレイヤー規約を機械的に検証する。
 *
 * 背景（2026-08-09、ユーザー指摘）: `design/widgets/` をatoms/molecules/organismsへ
 * 再編した直後、`FilterChipsBar`（molecule）が既存atom `SubFilterChip` を使わず
 * 内部に独自のチップ実装（`_ModeChip`/`_DisciplineChip`）を持っていることが判明した。
 * さらに調査すると `timeline_screen.dart` の `_ViewModeChip` も同じチップの
 * 三重目のコピーだった。「下の階層に有る部品を、上の階層で勝手に作り直す」ことを
 * レビューの目視だけで防ぐのは現実的でないため、CIでブロックする。
 *
 * ## 検証する2つのルール
 *
 * **A. import方向**: 上位層は下位層のみを参照してよい。
 *   atoms → (design配下では何も参照しない) / molecules → atoms /
 *   organisms → atoms, molecules。逆流・同列間の飛び越しを禁止する。
 *
 * **B. 角丸を持つ装飾の封じ込め**: 「塗り + 角丸」の矩形（＝ピル・バッジ・チップ・
 *   カードといった"部品"の見た目）を組み立てられるのは `design/atoms/` だけ。
 *   molecules/organisms/画面は、atoms/moleculesとレイアウト用ウィジェット
 *   （Row/Column/Padding等）の組み合わせのみで構成する。
 *
 *   判定は「`BoxDecoration(` / `ShapeDecoration(` / `Material(` の引数に
 *   `borderRadius:` が直接現れるか」で行う。角丸を持たない装飾
 *   （セクション区切りの `Border(bottom: ...)` や、背景色だけの `Material(color:)`）は
 *   "部品"ではなくレイアウトの一部なので意図的に対象外にしている。この線引きにより
 *   誤検知なしに「再実装されたチップ/ピル/カード」だけを検出できる。
 *
 * ## 使い方
 *
 *   bun run check:design-layers
 *
 * 新しい"部品"が必要になったら、molecules/organisms/画面に直接書かず
 * `packages/front/lib/design/atoms/` にウィジェットを追加し、
 * `packages/front/lib/widgetbook.dart` のAtomsカテゴリへ登録すること。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const FRONT_LIB = 'packages/front/lib';
const DESIGN_DIR = join(FRONT_LIB, 'design');

/** レイヤー名 → そのレイヤーが design 配下で import してよいレイヤー。 */
const ALLOWED_IMPORTS: Record<string, readonly string[]> = {
    atoms: [],
    molecules: ['atoms'],
    organisms: ['atoms', 'molecules'],
};

/** 角丸装飾を直接書いてよい唯一の場所。 */
const DECORATION_ALLOWED_DIR = join(DESIGN_DIR, 'atoms');

/** ルールBの検査対象（atoms以外の全ウィジェット定義箇所）。 */
const DECORATION_CHECKED_DIRS = [
    join(DESIGN_DIR, 'molecules'),
    join(DESIGN_DIR, 'organisms'),
    join(FRONT_LIB, 'features'),
    join(FRONT_LIB, 'navigation'),
];

const DECORATION_CONSTRUCTORS = [
    'BoxDecoration(',
    'ShapeDecoration(',
    'Material(',
];

export interface Violation {
    readonly file: string;
    readonly line: number;
    readonly rule: 'import-direction' | 'rounded-decoration';
    readonly message: string;
}

/** [dir] 配下の .dart ファイル（生成コードを除く）を再帰的に集める。 */
const collectDartFiles = (dir: string): string[] => {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return [];
    }
    return entries.flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return collectDartFiles(full);
        if (!full.endsWith('.dart')) return [];
        // build_runner生成コードは手で書くものではないため対象外。
        if (full.endsWith('.freezed.dart') || full.endsWith('.g.dart'))
            return [];
        return [full];
    });
};

/**
 * [source] の [openIndex]（`(` の位置）に対応する閉じ括弧の位置を返す。
 * 文字列リテラル内の括弧は数えない（`'BoxDecoration('` のような文言対策）。
 */
export const findMatchingParen = (
    source: string,
    openIndex: number,
): number => {
    let depth = 0;
    let quote: string | undefined;
    for (let i = openIndex; i < source.length; i++) {
        const char = source[i];
        if (quote) {
            if (char === '\\') i++;
            else if (char === quote) quote = undefined;
            continue;
        }
        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }
        if (char === '(') depth++;
        else if (char === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return source.length;
};

/** [source] 内の [index] が何行目かを返す（1始まり）。 */
const lineOf = (source: string, index: number): number =>
    source.slice(0, index).split('\n').length;

/**
 * ルールA: [source]（[layer] レイヤーのファイル）が禁止された方向へ
 * import していないかを判定する。
 */
export const findDisallowedImports = (
    source: string,
    layer: string,
): { readonly line: number; readonly targetLayer: string }[] => {
    const allowed = ALLOWED_IMPORTS[layer] ?? [];
    const found: { line: number; targetLayer: string }[] = [];
    source.split('\n').forEach((rawLine, index) => {
        const match = /^import\s+'([^']+)'/.exec(rawLine.trim());
        if (!match) return;
        const layerMatch = /(?:^|\/)(atoms|molecules|organisms)\//.exec(
            match[1],
        );
        if (!layerMatch) return;
        const targetLayer = layerMatch[1];
        if (targetLayer === layer || allowed.includes(targetLayer)) return;
        found.push({ line: index + 1, targetLayer });
    });
    return found;
};

/**
 * ルールB: [source] 内の「角丸を持つ装飾」（＝再実装されたピル/チップ/カード）
 * を検出する。角丸を持たない装飾（区切り線の `Border(bottom:)` や背景色だけの
 * `Material(color:)`）はレイアウトの一部なので検出しない。
 */
export const findRoundedDecorations = (
    source: string,
): { readonly line: number; readonly constructor: string }[] => {
    const found: { line: number; constructor: string }[] = [];
    for (const ctor of DECORATION_CONSTRUCTORS) {
        let from = 0;
        for (;;) {
            const start = source.indexOf(ctor, from);
            if (start === -1) break;
            from = start + ctor.length;
            const openParen = start + ctor.length - 1;
            const args = source.slice(
                openParen,
                findMatchingParen(source, openParen),
            );
            if (!args.includes('borderRadius:')) continue;
            found.push({
                line: lineOf(source, start),
                constructor: ctor.slice(0, -1),
            });
        }
    }
    return found.sort((a, b) => a.line - b.line);
};

/** リポジトリ内の実ファイルを走査して全違反を集める。 */
export const collectViolations = (): Violation[] => {
    const violations: Violation[] = [];

    for (const [layer, allowed] of Object.entries(ALLOWED_IMPORTS)) {
        for (const file of collectDartFiles(join(DESIGN_DIR, layer))) {
            for (const { line, targetLayer } of findDisallowedImports(
                readFileSync(file, 'utf8'),
                layer,
            )) {
                violations.push({
                    file,
                    line,
                    rule: 'import-direction',
                    message: `${layer} から ${targetLayer} を import しています（${layer} が参照してよいのは ${allowed.length === 0 ? '同一レイヤーのみ' : allowed.join('/')}）`,
                });
            }
        }
    }

    const decorationFiles = DECORATION_CHECKED_DIRS.flatMap(
        collectDartFiles,
    ).filter((file) => !file.startsWith(DECORATION_ALLOWED_DIR));
    for (const file of decorationFiles) {
        for (const { line, constructor } of findRoundedDecorations(
            readFileSync(file, 'utf8'),
        )) {
            violations.push({
                file,
                line,
                rule: 'rounded-decoration',
                message: `${constructor} に borderRadius を直接指定しています（角丸+塗りの"部品"は design/atoms/ のウィジェットとして定義し、ここではそれを組み合わせること）`,
            });
        }
    }

    return violations;
};

const main = (): void => {
    const violations = collectViolations();

    if (violations.length === 0) {
        console.log('✅ Atomic Designレイヤー規約に違反はありません');
        return;
    }

    console.error(
        `❌ Atomic Designレイヤー規約の違反が ${violations.length} 件あります\n`,
    );
    for (const violation of violations) {
        console.error(
            `  ${relative(process.cwd(), violation.file)}:${violation.line}`,
        );
        console.error(`    [${violation.rule}] ${violation.message}`);
    }
    console.error(
        '\n詳細な指針: .claude/docs/front-design-layers.md を参照してください。',
    );
    process.exit(1);
};

if (import.meta.main) {
    main();
}
