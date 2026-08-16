/**
 * types.ts (getApiConfig / isBatchTarget) ユーティリティ テスト
 *
 * ## デシジョンテーブル（getApiConfig）
 *
 * | #  | SCRAPING_API_URL | MAIN_API_URL | Expected                                  | Coverage           |
 * |----|------------------|--------------|-------------------------------------------|--------------------|
 * | 1  | 設定あり          | 設定あり     | ApiConfig オブジェクトを返す               | 正常系             |
 * | 2  | 未設定            | 設定あり     | SCRAPING_API_URL の Error をスロー         | 異常系・scraping欠如 |
 * | 3  | 設定あり          | 未設定       | MAIN_API_URL の Error をスロー             | 異常系・main欠如   |
 * | 4  | 未設定            | 未設定       | SCRAPING_API_URL の Error をスロー（先に） | 異常系・両方欠如   |
 *
 * ## デシジョンテーブル（isBatchTarget）
 *
 * | #    | value                | Expected | Coverage                          |
 * |------|----------------------|----------|-----------------------------------|
 * | B-01 | 'place'（有効文字列）| true     | 文字列 かつ リスト包含            |
 * | B-02 | 'all'（有効文字列）  | true     | 文字列 かつ リスト包含            |
 * | B-03 | 'unknown'（無効文字列）| false  | 文字列 だが リスト非包含          |
 * | B-04 | 123（非文字列）      | false    | typeof !== 'string'（短絡）        |
 * | B-05 | undefined            | false    | typeof !== 'string'（短絡）        |
 *
 * ## デシジョンテーブル（expandTargets）
 *
 * | #    | target                | Expected                          |
 * |------|------------------------|------------------------------------|
 * | E-01 | 'all'                  | ['place', 'race', 'calendar']      |
 * | E-02 | 'place'（'all'以外）   | ['place']                          |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { EnvStore } from '@race-schedule/core';

import { expandTargets, getApiConfig, isBatchTarget } from '../../src/types';

/** テスト前後の環境変数を管理 */
let originalScrapingApiUrl: string | undefined;
let originalMainApiUrl: string | undefined;

describe('getApiConfig', () => {
    beforeEach(() => {
        // 元の値を退避
        originalScrapingApiUrl = process.env.SCRAPING_API_URL;
        originalMainApiUrl = process.env.MAIN_API_URL;
        // 他テストファイルが setEnv 済みでも CLI モード（process.env）を検証できるよう
        // EnvStore をリセットして状態を確定させる
        EnvStore.reset();
    });

    afterEach(() => {
        // 元の値に戻す
        if (originalScrapingApiUrl === undefined) {
            delete process.env.SCRAPING_API_URL;
        } else {
            process.env.SCRAPING_API_URL = originalScrapingApiUrl;
        }
        if (originalMainApiUrl === undefined) {
            delete process.env.MAIN_API_URL;
        } else {
            process.env.MAIN_API_URL = originalMainApiUrl;
        }
        EnvStore.reset();
    });

    describe('正常系', () => {
        it('両方の環境変数が設定済み_ApiConfigオブジェクトを返す', () => {
            // Arrange
            process.env.SCRAPING_API_URL = 'https://scraping.example.com';
            process.env.MAIN_API_URL = 'https://main.example.com';

            // Act
            const result = getApiConfig();

            // Assert
            expect(result.scrapingApiUrl).toBe('https://scraping.example.com');
            expect(result.mainApiUrl).toBe('https://main.example.com');
        });
    });

    describe('異常系', () => {
        it('SCRAPING_API_URLが未設定_Errorをスロー', () => {
            // Arrange
            delete process.env.SCRAPING_API_URL;
            process.env.MAIN_API_URL = 'https://main.example.com';

            // Act & Assert
            expect(() => getApiConfig()).toThrow(
                'SCRAPING_API_URL environment variable is required',
            );
        });

        it('MAIN_API_URLが未設定_Errorをスロー', () => {
            // Arrange
            process.env.SCRAPING_API_URL = 'https://scraping.example.com';
            delete process.env.MAIN_API_URL;

            // Act & Assert
            expect(() => getApiConfig()).toThrow(
                'MAIN_API_URL environment variable is required',
            );
        });

        it('両方未設定_SCRAPING_API_URLのErrorを先にスロー', () => {
            // Arrange
            delete process.env.SCRAPING_API_URL;
            delete process.env.MAIN_API_URL;

            // Act & Assert
            expect(() => getApiConfig()).toThrow(
                'SCRAPING_API_URL environment variable is required',
            );
        });
    });
});

describe('isBatchTarget', () => {
    it('B-01_有効な文字列place_trueを返す', () => {
        // Act & Assert
        expect(isBatchTarget('place')).toBe(true);
    });

    it('B-02_有効な文字列all_trueを返す', () => {
        // Act & Assert
        expect(isBatchTarget('all')).toBe(true);
    });

    it('B-03_無効な文字列_falseを返す', () => {
        // Act & Assert
        expect(isBatchTarget('unknown')).toBe(false);
    });

    it('B-04_非文字列の数値_falseを返す', () => {
        // Act & Assert
        expect(isBatchTarget(123)).toBe(false);
    });

    it('B-05_undefined_falseを返す', () => {
        // Act & Assert
        expect(isBatchTarget(undefined)).toBe(false);
    });
});

describe('expandTargets', () => {
    it('E-01_target_all_place_race_calendarの配列を返す', () => {
        // Act & Assert
        expect(expandTargets('all')).toEqual(['place', 'race', 'calendar']);
    });

    it('E-02_target_all以外_その値のみの単一要素配列を返す', () => {
        // Act & Assert
        expect(expandTargets('place')).toEqual(['place']);
    });
});
