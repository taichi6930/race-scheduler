/**
 * check-db-er-diagram-drift.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * ER図パース・突き合わせを誤るとドリフト見逃しに直結するため、純粋関数（fs非依存）のUTを用意する。
 * `loadActualTableNames`（bun:sqlite依存）は対象外（checkSchemaDrift.tsと同じ方針）。
 *
 * ## デシジョンテーブル
 *
 * ### extractErDiagramTableNames
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | 属性ブロックを持つエンティティ2件 | 2件とも抽出される |
 * | T-02 | リレーション行のみでブロックが無いエンティティ名 | 抽出されない |
 * | T-03 | `` ```mermaid erDiagram `` ブロックが無い | 空集合 |
 *
 * ### diffTableNames
 * | # | 状況 | 期待 |
 * |---|-----|------|
 * | T-04 | 実テーブルにあるがER図に無い | kind='missing-in-diagram' |
 * | T-05 | ER図にあるが実テーブルに無い | kind='stale-in-diagram' |
 * | T-06 | 完全一致 | 空配列 |
 */
import { describe, expect, it } from 'bun:test';

import {
    diffTableNames,
    extractErDiagramTableNames,
} from './check-db-er-diagram-drift';

describe('extractErDiagramTableNames', () => {
    it('[T-01] 属性ブロックを持つエンティティ名を抽出すること', () => {
        const md = [
            '```mermaid',
            'erDiagram',
            '    place ||--o{ race : "1対多"',
            '    place {',
            '        string place_id PK',
            '    }',
            '    race {',
            '        string race_id PK',
            '    }',
            '```',
        ].join('\n');

        expect(extractErDiagramTableNames(md)).toEqual(
            new Set(['place', 'race']),
        );
    });

    it('[T-02] リレーション行のみに登場する名前は抽出しないこと', () => {
        const md = [
            '```mermaid',
            'erDiagram',
            '    place ||--o{ race : "1対多"',
            '    place {',
            '        string place_id PK',
            '    }',
            '```',
        ].join('\n');

        expect(extractErDiagramTableNames(md)).toEqual(new Set(['place']));
    });

    it('[T-03] mermaid erDiagramブロックが無い場合は空集合を返すこと', () => {
        expect(extractErDiagramTableNames('# タイトルのみ')).toEqual(new Set());
    });
});

describe('diffTableNames', () => {
    it('[T-04] 実テーブルにあるがER図に無い場合はmissing-in-diagramを検出すること', () => {
        const issues = diffTableNames(new Set(['place']), new Set());
        expect(issues).toEqual([
            { kind: 'missing-in-diagram', tableName: 'place' },
        ]);
    });

    it('[T-05] ER図にあるが実テーブルに無い場合はstale-in-diagramを検出すること', () => {
        const issues = diffTableNames(new Set(), new Set(['place']));
        expect(issues).toEqual([
            { kind: 'stale-in-diagram', tableName: 'place' },
        ]);
    });

    it('[T-06] 完全一致していれば空配列を返すこと', () => {
        expect(diffTableNames(new Set(['place']), new Set(['place']))).toEqual(
            [],
        );
    });
});
