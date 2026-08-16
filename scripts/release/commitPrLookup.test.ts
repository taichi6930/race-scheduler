/**
 * commitPrLookup.ts の自己テスト（純粋関数のみ。fetch依存の関数はスコープ外）
 *
 * ## デシジョンテーブル
 *
 * ### extractPrNumberFromCommitMessage
 * | # | message | 期待 |
 * |---|---------|------|
 * | T-01 | 'fix: バグ修正 (#123)' | 123 |
 * | T-02 | 'fix: バグ修正 (#123)\n\n本文' | 123（1行目のみ見る） |
 * | T-03 | 'Merge branch main' | null（PR番号なし） |
 */
import { describe, expect, it } from 'bun:test';

import { extractPrNumberFromCommitMessage } from './commitPrLookup';

describe('extractPrNumberFromCommitMessage', () => {
    it('T-01_1行のメッセージにPR番号がある場合_番号を返す', () => {
        const result = extractPrNumberFromCommitMessage('fix: バグ修正 (#123)');

        expect(result).toBe(123);
    });

    it('T-02_複数行メッセージの場合_1行目のみを見る', () => {
        const result = extractPrNumberFromCommitMessage(
            'fix: バグ修正 (#123)\n\n本文',
        );

        expect(result).toBe(123);
    });

    it('T-03_PR番号が無い場合_nullを返す', () => {
        const result = extractPrNumberFromCommitMessage('Merge branch main');

        expect(result).toBeNull();
    });
});
