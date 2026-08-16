/**
 * report-todo-fixme.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 抽出・整形ロジックを誤ると棚卸しレポート（AIEFF-066）の内容が欠落・誤表示するため、
 * UTを用意する。実ファイルシステムの走査（Bun.Glob）はここでは検証しない
 * （generate-symbol-map.test.ts と同様、fs 依存を伴わない純粋関数のみを対象とする）。
 *
 * ## デシジョンテーブル
 *
 * ### extractTodoFixme
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `// TODO: fix this` | marker='TODO', text='fix this' |
 * | T-02 | `# FIXME sync with backend` | marker='FIXME', text='sync with backend'（コロン無し） |
 * | T-03 | TODO/FIXMEを含まない行のみ | 空配列 |
 * | T-04 | 複数行にまたがりTODO/FIXMEが複数出現 | 出現順に全件抽出、行番号が1始まりで正しい |
 *
 * ### formatMarkdownReport
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-05 | 空配列 | 「検出件数: 0件」を含む |
 * | T-06 | エントリ1件以上 | 件数・表形式の行を含む |
 */
import { describe, expect, it } from 'bun:test';

import {
    extractTodoFixme,
    formatMarkdownReport,
    type TodoEntry,
} from './report-todo-fixme';

describe('extractTodoFixme', () => {
    it("[T-01] '// TODO: ...' からmarker/textを抽出すること", () => {
        const entries = extractTodoFixme('// TODO: fix this', 'a.ts');
        expect(entries).toEqual([
            { file: 'a.ts', line: 1, marker: 'TODO', text: 'fix this' },
        ]);
    });

    it("[T-02] コロン無しの '# FIXME ...' からもtextを抽出すること", () => {
        const entries = extractTodoFixme('# FIXME sync with backend', 'a.py');
        expect(entries).toEqual([
            {
                file: 'a.py',
                line: 1,
                marker: 'FIXME',
                text: 'sync with backend',
            },
        ]);
    });

    it('[T-03] TODO/FIXMEを含まない場合は空配列を返すこと', () => {
        expect(
            extractTodoFixme('const x = 1;\n// normal comment', 'a.ts'),
        ).toEqual([]);
    });

    it('[T-04] 複数行にまたがる複数出現を出現順・正しい行番号で抽出すること', () => {
        const content =
            'const x = 1;\n// TODO: first\nconst y = 2;\n// FIXME: second';
        const entries = extractTodoFixme(content, 'a.ts');
        expect(entries).toEqual([
            { file: 'a.ts', line: 2, marker: 'TODO', text: 'first' },
            { file: 'a.ts', line: 4, marker: 'FIXME', text: 'second' },
        ]);
    });
});

describe('formatMarkdownReport', () => {
    it('[T-05] 空配列の場合は検出件数0件と表示すること', () => {
        expect(formatMarkdownReport([])).toContain('検出件数: 0件');
    });

    it('[T-06] エントリがある場合は件数と表形式の行を含むこと', () => {
        const entries: TodoEntry[] = [
            { file: 'a.ts', line: 3, marker: 'TODO', text: 'do it' },
        ];
        const md = formatMarkdownReport(entries);
        expect(md).toContain('検出件数: 1件');
        expect(md).toContain('| `a.ts:3` | TODO | do it |');
    });
});
