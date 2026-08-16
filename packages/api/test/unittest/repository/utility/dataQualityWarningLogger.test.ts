/**
 * recordDataQualityWarning のテスト
 *
 * @spec なし（DATA-01: データ品質警告のGitHub Issue化）
 *
 * ## デシジョンテーブル
 *
 * | #    | messages | DB(insert) | 期待挙動                                |
 * |------|----------|------------|------------------------------------------|
 * | T-01 | 空配列   | -          | insertが呼ばれない（早期return）          |
 * | T-02 | 1件以上  | 成功       | insertが1回、source/messageで呼ばれる     |
 * | T-03 | 1件以上  | 失敗       | 例外を投げずcatchされ警告ログのみ出す      |
 */

import { describe, expect, it, mock } from 'bun:test';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type * as schema from '../../../../src/db/schema';
import { recordDataQualityWarning } from '../../../../src/repository/utility/dataQualityWarningLogger';

type WarningDb = DrizzleD1Database<typeof schema>;

describe('recordDataQualityWarning', () => {
    it('T-01: messagesが空配列ならinsertを呼ばない', async () => {
        const insertMock = mock(() => ({
            values: mock(() => Promise.resolve()),
        }));
        const db = { insert: insertMock } as unknown as WarningDb;

        await recordDataQualityWarning(db, 'place_mapper', []);

        expect(insertMock).not.toHaveBeenCalled();
    });

    it('T-02: messagesがあればinsertが1回呼ばれる', async () => {
        const valuesMock = mock(() => Promise.resolve());
        const insertMock = mock(() => ({ values: valuesMock }));
        const db = { insert: insertMock } as unknown as WarningDb;

        await recordDataQualityWarning(db, 'place_mapper', [
            'bad row 1',
            'bad row 2',
        ]);

        expect(insertMock).toHaveBeenCalledTimes(1);
        expect(valuesMock).toHaveBeenCalledWith([
            { source: 'place_mapper', message: 'bad row 1' },
            { source: 'place_mapper', message: 'bad row 2' },
        ]);
    });

    it('T-03: insertが失敗しても例外を投げずcatchされる', async () => {
        const insertMock = mock(() => ({
            values: mock(() => Promise.reject(new Error('DB error'))),
        }));
        const db = { insert: insertMock } as unknown as WarningDb;

        await expect(
            recordDataQualityWarning(db, 'place_mapper', ['bad row']),
        ).resolves.toBeUndefined();
    });
});
