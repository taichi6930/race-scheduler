/**
 * find-stale-aidlc-docs.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * DOC-21で追加した「既知の履歴ログ（audit.md / loop-engineering/journal.md）を
 * 対応不要バケットへ分離する」ロジックは、誤って実装すると本来対応すべき
 * ドキュメントドリフトの検出結果に紛れ込んでしまう（または逆に、履歴ログの
 * 参照切れが毎回ノイズとして表示され続ける）ため、UTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### isKnownHistoricalLog
 * | # | docFile | 期待 |
 * |---|---------|------|
 * | T-01 | `aidlc-docs/audit.md` | true（既知の履歴ログ） |
 * | T-02 | `aidlc-docs/loop-engineering/journal.md` | true（既知の履歴ログ） |
 * | T-03 | `docs/tasks/BACKLOG.md` | false（履歴ログではない） |
 *
 * ### partitionReferences
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-04 | audit.md由来1件 + BACKLOG.md由来1件 | historicalに1件、staleに1件へ分離 |
 * | T-05 | 空配列 | 両方とも空配列 |
 */
import { describe, expect, it } from 'bun:test';

import {
    isKnownHistoricalLog,
    partitionReferences,
} from './find-stale-aidlc-docs';

describe('isKnownHistoricalLog', () => {
    it('T-01_audit.mdの場合_trueを返す', () => {
        const result = isKnownHistoricalLog('aidlc-docs/audit.md');

        expect(result).toBe(true);
    });

    it('T-02_loop-engineering-journal.mdの場合_trueを返す', () => {
        const result = isKnownHistoricalLog(
            'aidlc-docs/loop-engineering/journal.md',
        );

        expect(result).toBe(true);
    });

    it('T-03_履歴ログではないファイルの場合_falseを返す', () => {
        const result = isKnownHistoricalLog('docs/tasks/BACKLOG.md');

        expect(result).toBe(false);
    });
});

describe('partitionReferences', () => {
    it('T-04_履歴ログと通常ファイルが混在する場合_それぞれのバケットへ分離する', () => {
        const references = [
            {
                docFile: 'aidlc-docs/audit.md',
                referencedPath: 'packages/foo/old.ts',
                reason: 'missing-file' as const,
            },
            {
                docFile: 'docs/tasks/BACKLOG.md',
                referencedPath: 'packages/bar/old.ts',
                reason: 'missing-file' as const,
            },
        ];

        const result = partitionReferences(references);

        expect(result.historical).toHaveLength(1);
        expect(result.historical[0]?.docFile).toBe('aidlc-docs/audit.md');
        expect(result.stale).toHaveLength(1);
        expect(result.stale[0]?.docFile).toBe('docs/tasks/BACKLOG.md');
    });

    it('T-05_空配列の場合_両方とも空配列を返す', () => {
        const result = partitionReferences([]);

        expect(result.stale).toHaveLength(0);
        expect(result.historical).toHaveLength(0);
    });
});
