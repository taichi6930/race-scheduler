/**
 * cacheControl.test.ts - キャッシュコントロール純ロジックのユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### isCacheableGetResponse
 * | #    | method | isOk  | 期待  |
 * |------|--------|-------|-------|
 * | C-01 | GET    | true  | true  |
 * | C-02 | GET    | false | false |
 * | C-03 | POST   | true  | false |
 * | C-04 | POST   | false | false |
 *
 * ### buildCacheControlHeader
 * | #    | maxAge | sMaxAge | 期待                                  |
 * |------|--------|---------|---------------------------------------|
 * | H-01 | 60     | 300     | 'public, max-age=60, s-maxage=300'    |
 * | H-02 | 0      | 0       | 'public, max-age=0, s-maxage=0'       |
 *
 * ### buildETagFromContent / buildETagFromUpdatedAt (PERF-035)
 * | #    | 入力                                  | 期待                              |
 * |------|----------------------------------------|-----------------------------------|
 * | E-01 | 同一文字列を2回                         | 同一の ETag（決定論的）           |
 * | E-02 | 異なる文字列                             | 異なる ETag                       |
 * | E-03 | 空文字列                                | 'W/"..."' 形式を返す              |
 * | E-04 | buildETagFromUpdatedAt(Date)            | toISOString() 経由と同じ ETag     |
 * | E-05 | buildETagFromUpdatedAt(文字列)          | 同一文字列なら同一 ETag           |
 *
 * ### isNoneMatch (PERF-035)
 * | #    | ifNoneMatch                  | etag              | 期待  |
 * |------|-------------------------------|--------------------|-------|
 * | N-01 | null                          | 'W/"abc"'          | false |
 * | N-02 | undefined                     | 'W/"abc"'          | false |
 * | N-03 | ''                            | 'W/"abc"'          | false |
 * | N-04 | '*'                           | 'W/"abc"'          | true  |
 * | N-05 | 'W/"abc"'（完全一致）          | 'W/"abc"'          | true  |
 * | N-06 | '"abc"'（弱比較・W/無し）      | 'W/"abc"'          | true  |
 * | N-07 | 'W/"xyz"'（不一致）            | 'W/"abc"'          | false |
 * | N-08 | 'W/"xyz", W/"abc"'（複数候補） | 'W/"abc"'          | true  |
 */

import { describe, expect, it } from 'bun:test';
import {
    buildCacheControlHeader,
    buildETagFromContent,
    buildETagFromUpdatedAt,
    isCacheableGetResponse,
    isNoneMatch,
} from '@race-schedule/core';

describe('isCacheableGetResponse', () => {
    it('isCacheableGetResponse_GETかつ2xx_trueを返すこと', () => {
        expect(isCacheableGetResponse('GET', true)).toBe(true);
    });

    it('isCacheableGetResponse_GETだが2xx以外_falseを返すこと', () => {
        expect(isCacheableGetResponse('GET', false)).toBe(false);
    });

    it('isCacheableGetResponse_GET以外かつ2xx_falseを返すこと', () => {
        expect(isCacheableGetResponse('POST', true)).toBe(false);
    });

    it('isCacheableGetResponse_GET以外かつ2xx以外_falseを返すこと', () => {
        expect(isCacheableGetResponse('POST', false)).toBe(false);
    });
});

describe('buildCacheControlHeader', () => {
    it('buildCacheControlHeader_60と300_public_maxage_smaxage文字列を返すこと', () => {
        expect(buildCacheControlHeader(60, 300)).toBe(
            'public, max-age=60, s-maxage=300',
        );
    });

    it('buildCacheControlHeader_0と0_ゼロ秒の文字列を返すこと', () => {
        expect(buildCacheControlHeader(0, 0)).toBe(
            'public, max-age=0, s-maxage=0',
        );
    });
});

describe('buildETagFromContent', () => {
    it('[E-01] buildETagFromContent_同一文字列を2回_同一のETagを返すこと', () => {
        const first = buildETagFromContent('{"id":1}');
        const second = buildETagFromContent('{"id":1}');

        expect(second).toBe(first);
    });

    it('[E-02] buildETagFromContent_異なる文字列_異なるETagを返すこと', () => {
        const first = buildETagFromContent('{"id":1}');
        const second = buildETagFromContent('{"id":2}');

        expect(second).not.toBe(first);
    });

    it('[E-03] buildETagFromContent_空文字列_W形式のETagを返すこと', () => {
        const result = buildETagFromContent('');

        expect(result).toMatch(/^W\/"[0-9a-f]+"$/);
    });
});

describe('buildETagFromUpdatedAt', () => {
    it('[E-04] buildETagFromUpdatedAt_Dateオブジェクト_toISOString経由と同じETagを返すこと', () => {
        const date = new Date('2024-04-26T00:00:00.000Z');

        const fromDate = buildETagFromUpdatedAt(date);
        const fromIsoString = buildETagFromUpdatedAt(date.toISOString());

        expect(fromDate).toBe(fromIsoString);
    });

    it('[E-05] buildETagFromUpdatedAt_同一の文字列_同一ETagを返すこと', () => {
        const first = buildETagFromUpdatedAt('2024-04-26T00:00:00.000Z');
        const second = buildETagFromUpdatedAt('2024-04-26T00:00:00.000Z');

        expect(second).toBe(first);
    });
});

describe('isNoneMatch', () => {
    it.each([
        ['null', null, false],
        ['undefined', undefined, false],
        ['空文字列', '', false],
        ['ワイルドカード(*)', '*', true],
        ['完全一致', 'W/"abc"', true],
        ['弱比較（W/無し）でも一致', '"abc"', true],
        ['不一致', 'W/"xyz"', false],
        ['複数候補のうち1つが一致', 'W/"xyz", W/"abc"', true],
    ])(
        '[N] isNoneMatch_%s_期待通りの真偽値を返すこと',
        (_, ifNoneMatch, expected) => {
            expect(isNoneMatch(ifNoneMatch, 'W/"abc"')).toBe(expected);
        },
    );
});
