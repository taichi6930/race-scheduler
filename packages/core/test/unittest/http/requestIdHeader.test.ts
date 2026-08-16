/**
 * requestIdHeader.ts のユニットテスト（CFARCH-09）
 *
 * ## デシジョンテーブル: withRequestIdHeader
 *
 * | #    | runWithRequestIdのスコープ | headers引数           | 期待結果                                        |
 * |------|-----------------------------|------------------------|---------------------------------------------------|
 * | T-01 | スコープ内                  | undefined              | X-Request-Idのみを含むヘッダを返す                |
 * | T-02 | スコープ内                  | 既存ヘッダあり         | 既存ヘッダを保ちつつX-Request-Idを追加する        |
 * | T-03 | スコープ外                  | undefined              | 空のヘッダを返す（X-Request-Idを付けない）        |
 * | T-04 | スコープ外                  | 既存ヘッダあり         | 既存ヘッダのみそのまま返す                        |
 */

import { describe, expect, it } from 'bun:test';

import {
    REQUEST_ID_HEADER,
    runWithRequestId,
    withRequestIdHeader,
} from '@race-schedule/core';

describe('withRequestIdHeader', () => {
    it('[T-01] スコープ内_headers未指定ならX-Request-Idのみを含むヘッダを返す', () => {
        const result = runWithRequestId('req-123', () => withRequestIdHeader());

        expect(result).toEqual({ [REQUEST_ID_HEADER]: 'req-123' });
    });

    it('[T-02] スコープ内_既存ヘッダを保ちつつX-Request-Idを追加する', () => {
        const result = runWithRequestId('req-456', () =>
            withRequestIdHeader({ 'Content-Type': 'application/json' }),
        );

        expect(result).toEqual({
            'Content-Type': 'application/json',
            [REQUEST_ID_HEADER]: 'req-456',
        });
    });

    it('[T-03] スコープ外_headers未指定なら空のヘッダを返す', () => {
        const result = withRequestIdHeader();

        expect(result).toEqual({});
    });

    it('[T-04] スコープ外_既存ヘッダのみそのまま返す', () => {
        const result = withRequestIdHeader({
            'Content-Type': 'application/json',
        });

        expect(result).toEqual({ 'Content-Type': 'application/json' });
    });
});
