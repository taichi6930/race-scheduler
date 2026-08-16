/**
 * upsertResultReporter.ts (reportUpsertFailuresOrThrow) のユニットテスト
 *
 * @spec なし
 *
 * ## デシジョンテーブル
 *
 * | #    | failureCount | 期待結果                                             |
 * |------|--------------|--------------------------------------------------------|
 * | T-01 | 0            | successCount をそのまま返す                            |
 * | T-02 | 1件以上      | failures の詳細を含むメッセージで例外を投げる          |
 * | T-03 | 1件以上      | appLogger.error にも失敗詳細を出力する                 |
 */

import { describe, expect, it, spyOn } from 'bun:test';
import { appLogger } from '@race-schedule/core';

import { reportUpsertFailuresOrThrow } from '../../../src/utility/upsertResultReporter';

describe('reportUpsertFailuresOrThrow', () => {
    it('T-01_failureCountが0_successCountをそのまま返すこと', () => {
        // Arrange
        const response = { successCount: 5, failureCount: 0, failures: [] };

        // Act
        const result = reportUpsertFailuresOrThrow('Place sync', response);

        // Assert
        expect(result).toBe(5);
    });

    it('T-02_failureCountが1件以上_失敗詳細を含む例外を投げること', () => {
        // Arrange
        const response = {
            successCount: 2,
            failureCount: 1,
            failures: [{ db: 'main', id: 'race-1', reason: 'upsert failed' }],
        };

        // Act & Assert
        expect(() =>
            reportUpsertFailuresOrThrow('Race sync', response),
        ).toThrow('Race sync failed for 1 item(s): race-1: upsert failed');
    });

    it('T-03_failureCountが1件以上_appLogger.errorにも失敗詳細を出力すること', () => {
        // Arrange
        const response = {
            successCount: 0,
            failureCount: 2,
            failures: [
                { db: 'main', id: 'place-1', reason: 'timeout' },
                { db: 'main', id: 'place-2', reason: 'validation error' },
            ],
        };
        const errorSpy = spyOn(appLogger, 'error').mockImplementation(() => {});

        // Act
        expect(() =>
            reportUpsertFailuresOrThrow('Place sync', response),
        ).toThrow();

        // Assert
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0]?.[0]).toContain(
            'Place sync had 2 failure(s)',
        );
        expect(errorSpy.mock.calls[0]?.[0]).toContain('place-1: timeout');
        expect(errorSpy.mock.calls[0]?.[0]).toContain(
            'place-2: validation error',
        );

        errorSpy.mockRestore();
    });
});
