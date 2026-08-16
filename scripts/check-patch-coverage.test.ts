/**
 * check-patch-coverage.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * patchカバレッジのブロッキングゲート本体のロジック（特に既知の
 * instrumentationアーティファクト許可リスト）は誤って実装するとCI全体が
 * 恒久的に赤くなる/逆に本来ブロックすべきギャップを見逃すため、UTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### findBlockingGaps
 * | # | 変更ファイル | gapSrcFiles | 期待 |
 * |---|-------------|-------------|------|
 * | T-01 | 変更なし | 通常ギャップ1件 | ブロックしない（変更ファイル集合に無い） |
 * | T-02 | 通常ファイルを変更 | 同ファイルにギャップ | ブロックする |
 * | T-03 | cli.tsを変更（既知アーティファクト、funcsPct=100） | 同ファイルにギャップ | ブロックしない |
 * | T-04 | router.tsを変更（既知アーティファクト、funcsPct=100） | 同ファイルにギャップ | ブロックしない |
 * | T-05 | cli.tsを変更だがfuncsPct<100（真の未実行関数あり） | 同ファイルにギャップ | ブロックする |
 * | T-06 | 既知アーティファクトと通常ギャップが混在 | 両方 | 通常ギャップのみブロックする |
 *
 * ### formatGapFileAnnotation
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-07 | uncoveredLinesあり | `::error file=<file>::`で始まり、未カバー行を含む |
 * | T-08 | uncoveredLinesが空文字 | `::error file=<file>::`で始まり、「未カバー行あり」を含む |
 */
import { describe, expect, it } from 'bun:test';

import {
    findBlockingGaps,
    formatGapFileAnnotation,
    type GapFile,
    type GapReport,
    isKnownInstrumentationArtifact,
} from './check-patch-coverage';

const makeReport = (gapSrcFiles: GapFile[]): GapReport => ({
    results: [{ package: 'test-pkg', gapSrcFiles }],
});

describe('findBlockingGaps', () => {
    it('[T-01] 変更ファイル集合に含まれないギャップはブロックしない', () => {
        const report = makeReport([
            {
                file: 'packages/core/src/foo.ts',
                funcsPct: 80,
                linesPct: 80,
                uncoveredLines: '10',
            },
        ]);

        const result = findBlockingGaps(report, new Set(['packages/other.ts']));

        expect(result).toEqual([]);
    });

    it('[T-02] 通常ファイルの変更＋ギャップはブロックする', () => {
        const gapFile: GapFile = {
            file: 'packages/core/src/foo.ts',
            funcsPct: 80,
            linesPct: 80,
            uncoveredLines: '10',
        };
        const report = makeReport([gapFile]);

        const result = findBlockingGaps(
            report,
            new Set(['packages/core/src/foo.ts']),
        );

        expect(result).toEqual([gapFile]);
    });

    it('[T-03] cli.tsのfuncsPct=100の既知アーティファクトはブロックしない', () => {
        const report = makeReport([
            {
                file: 'packages/batch/src/cli.ts',
                funcsPct: 100,
                linesPct: 99.48,
                uncoveredLines: '340',
            },
        ]);

        const result = findBlockingGaps(
            report,
            new Set(['packages/batch/src/cli.ts']),
        );

        expect(result).toEqual([]);
    });

    it('[T-04] router.tsのfuncsPct=100の既知アーティファクトはブロックしない', () => {
        const report = makeReport([
            {
                file: 'packages/api/src/router.ts',
                funcsPct: 100,
                linesPct: 99.73,
                uncoveredLines: '639',
            },
        ]);

        const result = findBlockingGaps(
            report,
            new Set(['packages/api/src/router.ts']),
        );

        expect(result).toEqual([]);
    });

    it('[T-05] cli.tsでもfuncsPct<100（真の未実行関数あり）ならブロックする', () => {
        const gapFile: GapFile = {
            file: 'packages/batch/src/cli.ts',
            funcsPct: 90,
            linesPct: 95,
            uncoveredLines: '100,340',
        };
        const report = makeReport([gapFile]);

        const result = findBlockingGaps(
            report,
            new Set(['packages/batch/src/cli.ts']),
        );

        expect(result).toEqual([gapFile]);
    });

    it('[T-06] 既知アーティファクトと通常ギャップが混在する場合、通常ギャップのみブロックする', () => {
        const normalGap: GapFile = {
            file: 'packages/core/src/foo.ts',
            funcsPct: 80,
            linesPct: 80,
            uncoveredLines: '10',
        };
        const artifactGap: GapFile = {
            file: 'packages/api/src/router.ts',
            funcsPct: 100,
            linesPct: 99.73,
            uncoveredLines: '639',
        };
        const report = makeReport([normalGap, artifactGap]);

        const result = findBlockingGaps(
            report,
            new Set(['packages/core/src/foo.ts', 'packages/api/src/router.ts']),
        );

        expect(result).toEqual([normalGap]);
    });
});

describe('formatGapFileAnnotation', () => {
    it('[T-07] uncoveredLinesありの場合、file属性と未カバー行を含むGitHub Actions annotationを返す', () => {
        const gapFile: GapFile = {
            file: 'packages/core/src/foo.ts',
            funcsPct: 80,
            linesPct: 80,
            uncoveredLines: '10,15-18',
        };

        const result = formatGapFileAnnotation(gapFile);

        expect(result).toStartWith('::error file=packages/core/src/foo.ts::');
        expect(result).toContain('未カバー行: 10,15-18');
        expect(result).toContain('Funcs 80% / Lines 80%');
    });

    it('[T-08] uncoveredLinesが空文字の場合、「未カバー行あり」を含むannotationを返す', () => {
        const gapFile: GapFile = {
            file: 'packages/api/src/router.ts',
            funcsPct: 90,
            linesPct: 95,
            uncoveredLines: '',
        };

        const result = formatGapFileAnnotation(gapFile);

        expect(result).toStartWith('::error file=packages/api/src/router.ts::');
        expect(result).toContain('未カバー行あり');
    });
});

describe('isKnownInstrumentationArtifact', () => {
    it('許可リスト外のファイルはfuncsPct=100でもfalse', () => {
        const result = isKnownInstrumentationArtifact({
            file: 'packages/core/src/foo.ts',
            funcsPct: 100,
            linesPct: 99,
            uncoveredLines: '5',
        });

        expect(result).toBe(false);
    });
});
