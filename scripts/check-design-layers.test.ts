/**
 * check-design-layers.ts の自己テスト
 *
 * ## デシジョンテーブル
 *
 * ### findRoundedDecorations（角丸を持つ装飾＝"再実装された部品"の検出）
 * | # | source | 期待 |
 * |---|--------|------|
 * | T-01 | `BoxDecoration(color:, borderRadius:)` | 検出する |
 * | T-02 | `Material(color:, borderRadius:)` | 検出する |
 * | T-03 | `BoxDecoration(border: Border(bottom:))`（角丸なし＝区切り線） | 検出しない |
 * | T-04 | `Material(color:)` のみ（角丸なし＝背景面） | 検出しない |
 * | T-05 | 同一ファイルに複数 | 行番号昇順で全件返す |
 * | T-06 | 引数が入れ子（`Border.all(...)`等）で括弧が複数 | 対応する閉じ括弧まで正しく走査する |
 * | T-07 | 文字列リテラル内に `)` を含む | 括弧対応を誤らない |
 *
 * ### findDisallowedImports（レイヤー間import方向）
 * | # | layer | import先 | 期待 |
 * |---|-------|----------|------|
 * | T-08 | atoms | molecules | 違反として検出する |
 * | T-09 | molecules | atoms | 許可（検出しない） |
 * | T-10 | molecules | organisms | 違反として検出する |
 * | T-11 | organisms | atoms / molecules | 許可（検出しない） |
 * | T-12 | molecules | design配下でない相対パス | 対象外（検出しない） |
 *
 * ### findMatchingParen
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-13 | 入れ子の括弧 | 最外の対応する `)` の位置を返す |
 */
import { describe, expect, it } from 'bun:test';

import {
    findDisallowedImports,
    findMatchingParen,
    findRoundedDecorations,
} from './check-design-layers';

describe('findRoundedDecorations', () => {
    it('T-01_BoxDecorationにborderRadiusあり_検出する', () => {
        const source = [
            'Container(',
            '  decoration: BoxDecoration(',
            '    color: colors.surface2,',
            '    borderRadius: BorderRadius.circular(5),',
            '  ),',
            ')',
        ].join('\n');

        expect(findRoundedDecorations(source)).toEqual([
            { line: 2, constructor: 'BoxDecoration' },
        ]);
    });

    it('T-02_MaterialにborderRadiusあり_検出する', () => {
        const source =
            'Material(color: c, borderRadius: BorderRadius.circular(9))';

        expect(findRoundedDecorations(source)).toEqual([
            { line: 1, constructor: 'Material' },
        ]);
    });

    it('T-03_角丸なしのBorder区切り線_検出しない', () => {
        const source = [
            'Container(',
            '  decoration: BoxDecoration(',
            '    color: colors.surface,',
            '    border: Border(bottom: BorderSide(color: colors.line)),',
            '  ),',
            ')',
        ].join('\n');

        expect(findRoundedDecorations(source)).toEqual([]);
    });

    it('T-04_背景色だけのMaterial_検出しない', () => {
        const source = 'Material(color: colors.surface, child: child)';

        expect(findRoundedDecorations(source)).toEqual([]);
    });

    it('T-05_複数箇所_行番号昇順で全件返す', () => {
        const source = [
            'Material(borderRadius: BorderRadius.circular(1), child: x)',
            'const y = 1;',
            'BoxDecoration(borderRadius: BorderRadius.circular(2))',
        ].join('\n');

        expect(findRoundedDecorations(source)).toEqual([
            { line: 1, constructor: 'Material' },
            { line: 3, constructor: 'BoxDecoration' },
        ]);
    });

    it('T-06_入れ子の括弧を含む引数_対応する閉じ括弧まで走査する', () => {
        const source = [
            'BoxDecoration(',
            '  border: Border.all(color: resolve(a, b)),',
            '  borderRadius: BorderRadius.circular(8),',
            ')',
        ].join('\n');

        expect(findRoundedDecorations(source)).toEqual([
            { line: 1, constructor: 'BoxDecoration' },
        ]);
    });

    it('T-07_文字列リテラル内の閉じ括弧_括弧対応を誤らない', () => {
        // ラベル文字列に ')' が含まれても、その手前で走査が打ち切られると
        // borderRadius を見落とす。
        const source = [
            'BoxDecoration(',
            "  label: 'GⅠ)',",
            '  borderRadius: BorderRadius.circular(6),',
            ')',
        ].join('\n');

        expect(findRoundedDecorations(source)).toEqual([
            { line: 1, constructor: 'BoxDecoration' },
        ]);
    });
});

describe('findDisallowedImports', () => {
    it('T-08_atomsがmoleculesを参照_違反として検出する', () => {
        const source = "import '../molecules/filter_chips_bar.dart';";

        expect(findDisallowedImports(source, 'atoms')).toEqual([
            { line: 1, targetLayer: 'molecules' },
        ]);
    });

    it('T-09_moleculesがatomsを参照_許可される', () => {
        const source = "import '../atoms/sub_filter_chip.dart';";

        expect(findDisallowedImports(source, 'molecules')).toEqual([]);
    });

    it('T-10_moleculesがorganismsを参照_違反として検出する', () => {
        const source = "import '../organisms/race_row.dart';";

        expect(findDisallowedImports(source, 'molecules')).toEqual([
            { line: 1, targetLayer: 'organisms' },
        ]);
    });

    it('T-11_organismsがatomsとmoleculesを参照_許可される', () => {
        const source = [
            "import '../atoms/pill.dart';",
            "import '../molecules/empty_state.dart';",
        ].join('\n');

        expect(findDisallowedImports(source, 'organisms')).toEqual([]);
    });

    it('T-12_design配下でないimport_対象外', () => {
        const source = [
            "import 'package:flutter/material.dart';",
            "import '../tokens.dart';",
            "import '../../domain/entities/race_type.dart';",
        ].join('\n');

        expect(findDisallowedImports(source, 'molecules')).toEqual([]);
    });
});

describe('findMatchingParen', () => {
    it('T-13_入れ子の括弧_最外の閉じ括弧の位置を返す', () => {
        const source = 'f(g(1), 2)x';

        expect(findMatchingParen(source, 1)).toBe(source.indexOf(')x'));
    });
});
