/**
 * buildSuggestedDeviceLabel のデシジョンテーブル
 *
 * | #    | aaguid       | userAgent                          | 期待                                   |
 * | ---- | ------------ | ----------------------------------- | ---------------------------------------- |
 * | T-01 | 既知         | 既知（Chrome/Windows）              | "プロバイダ名 (Chrome / Windows)"        |
 * | T-02 | 未知         | null                                 | "不明な端末"                             |
 * | T-03 | null         | null                                 | "不明な端末"                             |
 * | T-04 | 既知         | null                                 | プロバイダ名のみ（括弧無し）             |
 * | T-05 | null         | 既知（Safari/iOS）                   | "不明な端末 (Safari / iOS)"              |
 * | T-06 | 既知         | 認識できない文字列                    | プロバイダ名のみ（括弧無し）             |
 */

import { describe, expect, it } from 'bun:test';

import { buildSuggestedDeviceLabel } from '../../../src/utility/aaguidLabels';

const KNOWN_AAGUID = 'dd4ec289-e01d-41c9-bb89-70fa845d4bf2'; // iCloudキーチェーン
const CHROME_WINDOWS_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const SAFARI_IOS_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

describe('buildSuggestedDeviceLabel', () => {
    it('[T-01] 既知aaguid_既知UAでプロバイダ名とブラウザ/OS要約を括弧で付与する', () => {
        const label = buildSuggestedDeviceLabel(
            KNOWN_AAGUID,
            CHROME_WINDOWS_UA,
        );

        expect(label).toBe('iCloudキーチェーン (Chrome / Windows)');
    });

    it('[T-02] 未知aaguid_UA無しで不明な端末を返す', () => {
        const label = buildSuggestedDeviceLabel('unknown-aaguid', null);

        expect(label).toBe('不明な端末');
    });

    it('[T-03] aaguid無し_UA無しで不明な端末を返す', () => {
        const label = buildSuggestedDeviceLabel(null, null);

        expect(label).toBe('不明な端末');
    });

    it('[T-04] 既知aaguid_UA無しでプロバイダ名のみ返す', () => {
        const label = buildSuggestedDeviceLabel(KNOWN_AAGUID, null);

        expect(label).toBe('iCloudキーチェーン');
    });

    it('[T-05] aaguid無し_既知UAで不明な端末とブラウザ/OS要約を返す', () => {
        const label = buildSuggestedDeviceLabel(null, SAFARI_IOS_UA);

        expect(label).toBe('不明な端末 (Safari / iOS)');
    });

    it('[T-06] 既知aaguid_認識できないUAでプロバイダ名のみ返す', () => {
        const label = buildSuggestedDeviceLabel(KNOWN_AAGUID, 'curl/8.0');

        expect(label).toBe('iCloudキーチェーン');
    });
});
