/**
 * validateEnv ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | requiredKeys                   | envの値              | 期待結果                            |
 * |---|--------------------------------|----------------------|-------------------------------------|
 * | 1 | []                             | 任意                 | エラーなし（空の required keys）    |
 * | 2 | ['JRA_CALENDAR_ID']            | 有効な値             | エラーなし                          |
 * | 3 | ['JRA_CALENDAR_ID']            | 未設定(空文字)       | エラー(必須環境変数が未設定)        |
 * | 4 | ['JRA_CALENDAR_ID']            | スペースのみ         | エラー(必須環境変数が未設定)        |
 * | 5 | ['GOOGLE_PRIVATE_KEY']         | PEM形式              | エラーなし                          |
 * | 6 | ['GOOGLE_PRIVATE_KEY']         | Base64形式(44文字+)  | エラーなし                          |
 * | 7 | ['GOOGLE_PRIVATE_KEY']         | 不正なフォーマット   | エラー(フォーマット不正)            |
 * | 8 | 複数キー（1つ未設定）          | 混在                 | エラー（未設定キーが含まれる）      |
 * | 9 | ['OVERSEAS_CALENDAR_ID']       | 新キーのみ設定       | エラーなし                          |
 * | 10| ['OVERSEAS_CALENDAR_ID']       | 旧キー(WORLD_CALENDAR_ID)のみ設定 | エラーなし（フォールバック成立） |
 * | 11| ['OVERSEAS_CALENDAR_ID']       | 新旧どちらも未設定   | エラー（必須環境変数が未設定）      |
 * | 12| 同一env/requiredKeys参照で2回目 | 1回目検証後にenvを直接書き換え | エラーなし（キャッシュヒットで再検証されない、PERF-092） |
 * | 13| 異なるenv参照                  | 不正な値             | エラー（参照が変わるため再検証される）|
 */

import { describe, expect, it } from 'bun:test';

import type { CloudFlareEnv } from '../../../../src/utilities/platform/cloudFlareEnv';
import { validateEnv } from '../../../../src/utilities/platform/validateEnv';

/**
 * テスト用 CloudFlareEnv モック。
 * DB/R2_BUCKET は Cloudflare Workers 固有の型のため unknown として保持し、
 * 実行時には使用されないフィールドをスタブする。
 */
const createMockEnv = (overrides?: Partial<CloudFlareEnv>): CloudFlareEnv => {
    const base: CloudFlareEnv = {
        DB: {} as unknown as CloudFlareEnv['DB'],
        JRA_CALENDAR_ID: 'jra-calendar-id',
        NAR_CALENDAR_ID: 'nar-calendar-id',
        WORLD_CALENDAR_ID: 'world-calendar-id',
        KEIRIN_CALENDAR_ID: 'keirin-calendar-id',
        AUTORACE_CALENDAR_ID: 'autorace-calendar-id',
        BOATRACE_CALENDAR_ID: 'boatrace-calendar-id',
        GOOGLE_CLIENT_EMAIL: 'test@example.com',
        GOOGLE_PRIVATE_KEY:
            '-----BEGIN RSA PRIVATE KEY-----\nMIItest\n-----END RSA PRIVATE KEY-----',
        R2_BUCKET: {} as unknown as CloudFlareEnv['R2_BUCKET'],
    };
    return { ...base, ...overrides } as CloudFlareEnv;
};

describe('validateEnv', () => {
    describe('ケース#1: requiredKeys が空配列の場合', () => {
        it('エラーをスローしない', () => {
            // Arrange
            const env = createMockEnv();

            // Act & Assert
            expect(() => validateEnv(env, [])).not.toThrow();
        });

        it('デフォルト引数（requiredKeys省略）でもエラーをスローしない', () => {
            // Arrange
            const env = createMockEnv();

            // Act & Assert
            expect(() => validateEnv(env)).not.toThrow();
        });
    });

    describe('ケース#2: 必須キーが設定済みの場合', () => {
        it('JRA_CALENDAR_ID が設定済みならエラーなし', () => {
            // Arrange
            const env = createMockEnv({ JRA_CALENDAR_ID: 'valid-id' });

            // Act & Assert
            expect(() => validateEnv(env, ['JRA_CALENDAR_ID'])).not.toThrow();
        });

        it('複数の必須キーが全て設定済みならエラーなし', () => {
            // Arrange
            const env = createMockEnv();

            // Act & Assert
            expect(() =>
                validateEnv(env, ['JRA_CALENDAR_ID', 'NAR_CALENDAR_ID']),
            ).not.toThrow();
        });
    });

    describe('ケース#3,4: 必須キーが未設定の場合', () => {
        it('ケース#3: 空文字のキーはエラーになる', () => {
            // Arrange
            const env = createMockEnv({ JRA_CALENDAR_ID: '' });

            // Act & Assert
            expect(() => validateEnv(env, ['JRA_CALENDAR_ID'])).toThrow(
                '必須環境変数が未設定です',
            );
        });

        it('ケース#4: スペースのみのキーはエラーになる', () => {
            // Arrange
            const env = createMockEnv({ JRA_CALENDAR_ID: '   ' });

            // Act & Assert
            expect(() => validateEnv(env, ['JRA_CALENDAR_ID'])).toThrow(
                '必須環境変数が未設定です',
            );
        });

        it('エラーメッセージに未設定のキー名が含まれる', () => {
            // Arrange
            const env = createMockEnv({ JRA_CALENDAR_ID: '' });

            // Act & Assert
            expect(() => validateEnv(env, ['JRA_CALENDAR_ID'])).toThrow(
                'JRA_CALENDAR_ID',
            );
        });
    });

    describe('ケース#5,6,7: GOOGLE_PRIVATE_KEY のフォーマット検証', () => {
        it('ケース#5: PEM形式は正常', () => {
            // Arrange
            const env = createMockEnv({
                GOOGLE_PRIVATE_KEY:
                    '-----BEGIN RSA PRIVATE KEY-----\nMIIEtest\n-----END RSA PRIVATE KEY-----',
            });

            // Act & Assert
            expect(() =>
                validateEnv(env, ['GOOGLE_PRIVATE_KEY']),
            ).not.toThrow();
        });

        it('ケース#6: Base64形式（44文字以上）は正常', () => {
            // Arrange
            const base64Key = 'A'.repeat(50); // 50文字のBase64風文字列
            const env = createMockEnv({ GOOGLE_PRIVATE_KEY: base64Key });

            // Act & Assert
            expect(() =>
                validateEnv(env, ['GOOGLE_PRIVATE_KEY']),
            ).not.toThrow();
        });

        it('ケース#7: 不正なフォーマット（短すぎる・非PEM非Base64）はエラー', () => {
            // Arrange
            const env = createMockEnv({ GOOGLE_PRIVATE_KEY: 'invalid-key' });

            // Act & Assert
            expect(() => validateEnv(env, ['GOOGLE_PRIVATE_KEY'])).toThrow(
                'GOOGLE_PRIVATE_KEY のフォーマットが不正です',
            );
        });

        it('GOOGLE_PRIVATE_KEY が requiredKeys に含まれない場合はフォーマット検証スキップ', () => {
            // Arrange
            const env = createMockEnv({ GOOGLE_PRIVATE_KEY: 'invalid-key' });

            // Act & Assert: requiredKeysにGOOGLE_PRIVATE_KEYが含まれない場合はエラーなし
            expect(() => validateEnv(env, ['JRA_CALENDAR_ID'])).not.toThrow();
        });
    });

    describe('ケース#8: 複数の必須キーで一部未設定', () => {
        it('複数キーのうち1つが未設定の場合にエラー', () => {
            // Arrange
            const env = createMockEnv({ NAR_CALENDAR_ID: '' });

            // Act & Assert
            expect(() =>
                validateEnv(env, ['JRA_CALENDAR_ID', 'NAR_CALENDAR_ID']),
            ).toThrow('NAR_CALENDAR_ID');
        });

        it('全キーが未設定の場合、全てのキーがエラーメッセージに含まれる', () => {
            // Arrange
            const env = createMockEnv({
                JRA_CALENDAR_ID: '',
                NAR_CALENDAR_ID: '',
            });

            // Act & Assert
            expect(() =>
                validateEnv(env, ['JRA_CALENDAR_ID', 'NAR_CALENDAR_ID']),
            ).toThrow('JRA_CALENDAR_ID');
        });
    });

    describe('ケース#9,10,11: OVERSEAS_CALENDAR_ID の後方互換フォールバック(旧WORLD_CALENDAR_ID)', () => {
        it('ケース#9: 新キー(OVERSEAS_CALENDAR_ID)のみ設定済みならエラーなし', () => {
            // Arrange
            const env = createMockEnv({
                OVERSEAS_CALENDAR_ID: 'overseas-id',
                WORLD_CALENDAR_ID: undefined,
            });

            // Act & Assert
            expect(() =>
                validateEnv(env, ['OVERSEAS_CALENDAR_ID']),
            ).not.toThrow();
        });

        it('ケース#10: 旧キー(WORLD_CALENDAR_ID)のみ設定済みならフォールバックが成立しエラーなし', () => {
            // Arrange
            const env = createMockEnv({
                OVERSEAS_CALENDAR_ID: undefined,
                WORLD_CALENDAR_ID: 'world-calendar-id',
            });

            // Act & Assert
            expect(() =>
                validateEnv(env, ['OVERSEAS_CALENDAR_ID']),
            ).not.toThrow();
        });

        it('ケース#11: 新旧どちらのキーも未設定の場合はエラー', () => {
            // Arrange
            const env = createMockEnv({
                OVERSEAS_CALENDAR_ID: undefined,
                WORLD_CALENDAR_ID: undefined,
            });

            // Act & Assert
            expect(() => validateEnv(env, ['OVERSEAS_CALENDAR_ID'])).toThrow(
                'OVERSEAS_CALENDAR_ID',
            );
        });
    });

    describe('ケース#12,13: 参照キャッシュ（PERF-092、同一env/requiredKeys参照は再検証をスキップ）', () => {
        it('ケース#12: 同一参照での2回目はキャッシュヒットし、envを直接書き換えても再検証されない', () => {
            // Arrange
            const env = createMockEnv();
            const requiredKeys = ['JRA_CALENDAR_ID'] as const;
            validateEnv(env, requiredKeys);

            // 1回目の検証成功後にenvを直接書き換える（再検証されれば必ずエラーになる状態）
            env.JRA_CALENDAR_ID = '';

            // Act & Assert: 同一のenv/requiredKeys参照のためキャッシュがヒットしエラーにならない
            expect(() => validateEnv(env, requiredKeys)).not.toThrow();
        });

        it('ケース#13: envの参照が変わると再検証され、不正な値ならエラーになる', () => {
            // Arrange
            const requiredKeys = ['JRA_CALENDAR_ID'] as const;
            validateEnv(createMockEnv(), requiredKeys);
            const differentEnv = createMockEnv({ JRA_CALENDAR_ID: '' });

            // Act & Assert: 別インスタンスのためキャッシュがヒットせず再検証される
            expect(() => validateEnv(differentEnv, requiredKeys)).toThrow(
                '必須環境変数が未設定です',
            );
        });
    });
});
