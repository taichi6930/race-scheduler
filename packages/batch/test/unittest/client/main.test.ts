/**
 * main API クライアント テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | Function            | 条件                                | Expected                                      | Coverage |
 * |------|---------------------|-------------------------------------|-----------------------------------------------|----------|
 * | M-01 | fetchMainPlaceList  | JRA, 正常系                         | isDisplayPlaceHeldDays=true を含む URL で GET  | Line     |
 * | M-02 | fetchMainPlaceList  | NAR, 正常系                         | isDisplayPlaceHeldDays クエリなし              | Branch   |
 * | M-03 | fetchMainPlaceList  | レスポンス places キー               | places 配列を返す                             | Branch   |
 * | M-04 | fetchMainPlaceList  | レスポンス placeList キー（旧形式）  | placeList 配列を返す                          | Branch   |
 * | M-05 | fetchMainPlaceList  | 空レスポンス                         | [] を返す                                     | Branch   |
 * | M-06 | fetchMainPlaceList  | datetimeが既にDate型                | preprocessせずそのままvalidatePlaceEntityへ    | Branch   |
 * | M-07 | fetchMainPlaceList  | places/placeListが配列でない         | TypeErrorをthrowする                          | Branch   |
 * | M-08 | fetchMainPlaceList  | 正常系                              | fetchWithTimeoutがLIGHT_FETCH_TIMEOUT_MSで呼ばれる（PERF-080） | Line |
 * | M-09 | fetchMainPlaceList  | SERVICE_AUTH_TOKEN設定済み          | X-Service-Auth-Tokenヘッダが付与される         | Line |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

// fetchWithTimeout をモジュールレベルでモック
import * as httpModule from '../../../src/client/http';
import { fetchMainPlaceList } from '../../../src/client/main';
import { LIGHT_FETCH_TIMEOUT_MS } from '../../../src/constants';

describe('fetchMainPlaceList', () => {
    let fetchSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        // 環境変数を設定
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.MAIN_API_URL = 'http://main.test';
        fetchSpy = spyOn(httpModule, 'fetchWithTimeout');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        delete process.env.SCRAPING_API_URL;
        delete process.env.MAIN_API_URL;
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    it('M-01_JRA_isDisplayPlaceHeldDays=trueを含むURLでGETする', async () => {
        // Arrange
        fetchSpy.mockResolvedValue({ places: [] });

        // Act
        await fetchMainPlaceList('jra', '2024-04-01', '2024-04-30');

        // Assert
        const urlArg = fetchSpy.mock.calls[0][0] as URL;
        expect(urlArg.searchParams.get('raceTypeList')).toBe('jra');
        expect(urlArg.searchParams.get('isDisplayPlaceHeldDays')).toBe('true');
    });

    it('M-02_NAR_isDisplayPlaceHeldDaysクエリが付かない', async () => {
        // Arrange
        fetchSpy.mockResolvedValue({ places: [] });

        // Act
        await fetchMainPlaceList('nar', '2024-04-01', '2024-04-30');

        // Assert
        const urlArg = fetchSpy.mock.calls[0][0] as URL;
        expect(urlArg.searchParams.get('isDisplayPlaceHeldDays')).toBeNull();
    });

    it('M-03_レスポンスにplacesキーがある_places配列を返す', async () => {
        // Arrange（JSON応答を模した生レコード：datetimeは文字列で届く）
        const rawPlace = {
            placeId: 'jra2024040105',
            raceType: 'jra',
            datetime: '2024-04-01T00:00:00+09:00',
            raceCourse: '東京',
            locationCode: '05',
        };
        fetchSpy.mockResolvedValue({ places: [rawPlace] });

        // Act
        const result = await fetchMainPlaceList(
            'jra',
            '2024-04-01',
            '2024-04-30',
        );

        // Assert（Zod検証を通過し、datetimeがDate型に変換されて返る）
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            placeId: 'jra2024040105',
            raceType: 'jra',
            raceCourse: '東京',
            locationCode: '05',
        });
        expect(result[0].datetime).toEqual(
            new Date('2024-04-01T00:00:00+09:00'),
        );
    });

    it('M-04_レスポンスにplaceListキーがある（旧形式）_placeList配列を返す', async () => {
        // Arrange
        const rawPlace = {
            placeId: 'jra2024040103',
            raceType: 'jra',
            datetime: '2024-04-01T00:00:00+09:00',
            raceCourse: '福島',
            locationCode: '03',
        };
        fetchSpy.mockResolvedValue({ placeList: [rawPlace] });

        // Act
        const result = await fetchMainPlaceList(
            'jra',
            '2024-04-01',
            '2024-04-30',
        );

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            placeId: 'jra2024040103',
            raceType: 'jra',
            raceCourse: '福島',
            locationCode: '03',
        });
    });

    it('M-05_空レスポンス_空配列を返す', async () => {
        // Arrange
        fetchSpy.mockResolvedValue({});

        // Act
        const result = await fetchMainPlaceList(
            'nar',
            '2024-04-01',
            '2024-04-30',
        );

        // Assert
        expect(result).toEqual([]);
    });

    it('M-06_datetimeが既にDate型_preprocessせずそのまま検証される', async () => {
        // Arrange（datetimeが文字列でなくDate型のまま届くケース）
        const rawPlace = {
            placeId: 'jra2024040105',
            raceType: 'jra',
            datetime: new Date('2024-04-01T00:00:00+09:00'),
            raceCourse: '東京',
            locationCode: '05',
        };
        fetchSpy.mockResolvedValue({ places: [rawPlace] });

        // Act
        const result = await fetchMainPlaceList(
            'jra',
            '2024-04-01',
            '2024-04-30',
        );

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].datetime).toEqual(
            new Date('2024-04-01T00:00:00+09:00'),
        );
    });

    it('M-07_placesもplaceListも配列でない_TypeErrorをthrowする', async () => {
        // Arrange
        fetchSpy.mockResolvedValue({ places: 'not-an-array' });

        // Act & Assert
        await expect(
            fetchMainPlaceList('jra', '2024-04-01', '2024-04-30'),
        ).rejects.toThrow(TypeError);
    });

    it('M-08_正常系_fetchWithTimeoutがLIGHT_FETCH_TIMEOUT_MSで呼ばれる', async () => {
        // Arrange
        fetchSpy.mockResolvedValue({ places: [] });

        // Act
        await fetchMainPlaceList('jra', '2024-04-01', '2024-04-30');

        // Assert: DB読み取りのみの軽量エンドポイントのため短いタイムアウトを使う（PERF-080）
        expect(fetchSpy.mock.calls[0][3]).toBe(LIGHT_FETCH_TIMEOUT_MS);
    });

    it('M-09_SERVICE_AUTH_TOKEN設定済み_X-Service-Auth-Tokenヘッダが付与される', async () => {
        // Arrange
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';
        fetchSpy.mockResolvedValue({ places: [] });

        // Act
        await fetchMainPlaceList('jra', '2024-04-01', '2024-04-30');

        // Assert
        const options = fetchSpy.mock.calls[0][2] as RequestInit;
        const headers = options.headers as Record<string, string>;
        expect(headers['X-Service-Auth-Token']).toBe('test-service-auth-token');
    });
});
