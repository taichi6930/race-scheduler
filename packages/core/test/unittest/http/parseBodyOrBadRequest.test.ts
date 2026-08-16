/**
 * controller/parseBodyOrBadRequest ユーティリティテスト
 *
 * ## デシジョンテーブル（parseBodyOrBadRequest）
 *
 * | #    | schema.safeParse(body) の結果 | 期待結果                                    |
 * |------|--------------------------------|---------------------------------------------|
 * | T-01 | 成功（valid body）             | { ok: true, value }                          |
 * | T-02 | 失敗（invalid body）           | { ok: false, response }（badRequest(message, 400)） |
 * | T-05 | 失敗・message省略              | { ok: false, response }（既定文言のbadRequest） |
 *
 * ## デシジョンテーブル（resolveRaceIdOrBadRequest）
 *
 * | #    | validateRaceId(rawRaceId) の挙動 | 期待結果                                    |
 * |------|-----------------------------------|---------------------------------------------|
 * | T-03 | 正常にRaceIdを返す                | { ok: true, value }                          |
 * | T-04 | 例外をthrow（不正な形式）         | { ok: false, response }（badRequest(message, 400)） |
 * | T-06 | 例外をthrow・message省略          | { ok: false, response }（既定文言のbadRequest） |
 */

import { describe, expect, it } from 'bun:test';
import { badRequest, validateRaceId } from '@race-schedule/core';
import { z } from 'zod';

import {
    parseBodyOrBadRequest,
    resolveRaceIdOrBadRequest,
} from '../../../src/http/parseBodyOrBadRequest';

const bodySchema = z.object({ raceId: z.string() });

describe('parseBodyOrBadRequest', () => {
    // T-01: 成功 → ok:true + value
    it('parseBodyOrBadRequest_正常なbody_okTrueと値を返すこと', () => {
        // Arrange
        const body: unknown = { raceId: 'jra202501050101' };

        // Act
        const result = parseBodyOrBadRequest(
            bodySchema,
            body,
            'リクエストボディが不正です',
        );

        // Assert
        expect(result).toEqual({
            ok: true,
            value: { raceId: 'jra202501050101' },
        });
    });

    // T-02: 失敗 → ok:false + badRequest(message, 400)
    it('parseBodyOrBadRequest_不正なbody_okFalseとbadRequestレスポンスを返すこと', async () => {
        // Arrange
        const body: unknown = { raceId: 123 };

        // Act
        const result = parseBodyOrBadRequest(
            bodySchema,
            body,
            'リクエストボディが不正です',
        );

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            const expected = badRequest('リクエストボディが不正です', 400);
            expect(result.response.status).toBe(expected.status);
            expect(await result.response.text()).toBe(await expected.text());
        }
    });

    // T-05: 失敗・message省略 → 既定文言のbadRequest
    it('parseBodyOrBadRequest_不正なbody_message省略時は既定文言を返すこと', async () => {
        // Arrange
        const body: unknown = { raceId: 123 };

        // Act
        const result = parseBodyOrBadRequest(bodySchema, body);

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            const expected = badRequest('リクエストボディが不正です', 400);
            expect(result.response.status).toBe(expected.status);
            expect(await result.response.text()).toBe(await expected.text());
        }
    });
});

describe('resolveRaceIdOrBadRequest', () => {
    // T-03: 正常なraceId → ok:true + value
    it('resolveRaceIdOrBadRequest_正常なraceId_okTrueと値を返すこと', () => {
        // Act
        const result = resolveRaceIdOrBadRequest(
            'jra202501050101',
            'raceIdの形式が不正です',
        );

        // Assert
        expect(result).toEqual({
            ok: true,
            value: validateRaceId('jra202501050101'),
        });
    });

    // T-04: 不正なraceId → ok:false + badRequest(message, 400)
    it('resolveRaceIdOrBadRequest_不正なraceId_okFalseとbadRequestレスポンスを返すこと', async () => {
        // Act
        const result = resolveRaceIdOrBadRequest(
            'invalid-race-id',
            'raceIdの形式が不正です',
        );

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            const expected = badRequest('raceIdの形式が不正です', 400);
            expect(result.response.status).toBe(expected.status);
            expect(await result.response.text()).toBe(await expected.text());
        }
    });

    // T-06: 例外をthrow・message省略 → 既定文言のbadRequest
    it('resolveRaceIdOrBadRequest_不正なraceId_message省略時は既定文言を返すこと', async () => {
        // Act
        const result = resolveRaceIdOrBadRequest('invalid-race-id');

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            const expected = badRequest('raceIdの形式が不正です', 400);
            expect(result.response.status).toBe(expected.status);
            expect(await result.response.text()).toBe(await expected.text());
        }
    });
});
