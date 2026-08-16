/**
 * pushAuthEncryption.test.ts - encryptPushAuth / decryptPushAuth のユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### 関数: encryptPushAuth()
 * | # | PUSH_AUTH_ENCRYPTION_KEY | 期待値 |
 * |---|----------------------------|--------|
 * | 0 | EnvStore自体が未初期化（`EnvStore.setEnv`未実行） | 平文をそのまま返す（fail-open。repository単体テスト等がこの状態で呼ぶ） |
 * | 1 | 未設定 | 平文をそのまま返す（fail-open） |
 * | 2 | 設定済み | `encv1:`で始まる、元の平文とは異なる文字列を返す |
 * | 3 | 設定済み・同一平文を2回暗号化 | IVがランダムなため毎回異なる暗号文になる |
 *
 * ### 関数: decryptPushAuth()
 * | # | 入力 | PUSH_AUTH_ENCRYPTION_KEY | 期待値 |
 * |---|------|----------------------------|--------|
 * | 4 | encryptPushAuthの出力 | 暗号化時と同じ鍵 | 元の平文に復号される（ラウンドトリップ） |
 * | 5 | `encv1:`プレフィックス無しの値（レガシー平文） | 未設定/設定済み問わず | そのまま返す |
 * | 6 | `encv1:`プレフィックス付きの値 | 未設定 | throw |
 * | 7 | `encv1:`プレフィックス付きだがIV部分が欠落した値 | 設定済み | throw |
 * | 8 | `encv1:`プレフィックス付きだが暗号文部分が欠落した値 | 設定済み | throw |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { type CloudFlareEnv, EnvStore } from '@race-schedule/core';
import 'reflect-metadata';

import {
    decryptPushAuth,
    encryptPushAuth,
} from '../../../src/utility/pushAuthEncryption';

const MOCK_ENV_BASE = {
    JRA_CALENDAR_ID: 'mock-jra',
    NAR_CALENDAR_ID: 'mock-nar',
    KEIRIN_CALENDAR_ID: 'mock-keirin',
    AUTORACE_CALENDAR_ID: 'mock-autorace',
    BOATRACE_CALENDAR_ID: 'mock-boatrace',
    GOOGLE_CLIENT_EMAIL: 'mock@example.com',
    GOOGLE_PRIVATE_KEY: 'mock-private-key',
    R2_BUCKET: {},
};

const toBase64Url = (bytes: Uint8Array): string => {
    const binary = String.fromCodePoint(...bytes);
    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
};

/** テスト用のAES-256-GCM鍵（Base64URL、32バイト）を生成する。 */
const generateTestKey = (): string =>
    toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

describe('pushAuthEncryption', () => {
    afterEach(() => {
        EnvStore.reset();
    });

    describe('encryptPushAuth', () => {
        // 0: EnvStore自体が未初期化 → 平文をそのまま返す（EnvStore.envがthrowするcatch分岐）
        it('0: EnvStore.setEnv未実行の場合も平文をそのまま返すこと', async () => {
            const result = await encryptPushAuth('plain-auth-value');

            expect(result).toBe('plain-auth-value');
        });

        // 1: 未設定 → 平文をそのまま返す
        it('1: PUSH_AUTH_ENCRYPTION_KEY未設定の場合は平文をそのまま返すこと', async () => {
            EnvStore.setEnv({ ...MOCK_ENV_BASE } as unknown as CloudFlareEnv);

            const result = await encryptPushAuth('plain-auth-value');

            expect(result).toBe('plain-auth-value');
        });

        // 2: 設定済み → encv1:で始まる別の文字列を返す
        it('2: 設定済みの場合はencv1:で始まる暗号化済み文字列を返すこと', async () => {
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                PUSH_AUTH_ENCRYPTION_KEY: generateTestKey(),
            } as unknown as CloudFlareEnv);

            const result = await encryptPushAuth('plain-auth-value');

            expect(result.startsWith('encv1:')).toBe(true);
            expect(result).not.toBe('plain-auth-value');
        });

        // 3: 同一平文を2回暗号化 → IVがランダムなため異なる暗号文になる
        it('3: 同一平文でも呼び出すたびに異なる暗号文になること', async () => {
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                PUSH_AUTH_ENCRYPTION_KEY: generateTestKey(),
            } as unknown as CloudFlareEnv);

            const first = await encryptPushAuth('plain-auth-value');
            const second = await encryptPushAuth('plain-auth-value');

            expect(first).not.toBe(second);
        });
    });

    describe('decryptPushAuth', () => {
        // 4: encryptPushAuthの出力を同じ鍵で復号 → 元の平文に戻る
        it('4: 暗号化した値を同じ鍵で復号すると元の平文に戻ること', async () => {
            const key = generateTestKey();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                PUSH_AUTH_ENCRYPTION_KEY: key,
            } as unknown as CloudFlareEnv);
            const encrypted = await encryptPushAuth('plain-auth-value');

            const result = await decryptPushAuth(encrypted);

            expect(result).toBe('plain-auth-value');
        });

        // 5: プレフィックス無し（レガシー平文） → 鍵の有無に関わらずそのまま返す
        it('5: encv1:プレフィックスが無い値は未設定でもそのまま返すこと', async () => {
            EnvStore.setEnv({ ...MOCK_ENV_BASE } as unknown as CloudFlareEnv);

            const result = await decryptPushAuth('legacy-plain-auth-value');

            expect(result).toBe('legacy-plain-auth-value');
        });

        it('5b: encv1:プレフィックスが無い値は鍵設定済みでもそのまま返すこと', async () => {
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                PUSH_AUTH_ENCRYPTION_KEY: generateTestKey(),
            } as unknown as CloudFlareEnv);

            const result = await decryptPushAuth('legacy-plain-auth-value');

            expect(result).toBe('legacy-plain-auth-value');
        });

        // 6: プレフィックス付きだが鍵未設定 → throw
        it('6: 暗号化済みの値だが鍵が未設定の場合はthrowすること', async () => {
            const key = generateTestKey();
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                PUSH_AUTH_ENCRYPTION_KEY: key,
            } as unknown as CloudFlareEnv);
            const encrypted = await encryptPushAuth('plain-auth-value');
            EnvStore.setEnv({ ...MOCK_ENV_BASE } as unknown as CloudFlareEnv);

            await expect(decryptPushAuth(encrypted)).rejects.toThrow(
                'PUSH_AUTH_ENCRYPTION_KEY is not set',
            );
        });

        // 7: IV部分が欠落（先頭が':'）→ throw
        it('7: IV部分が欠落している場合はthrowすること', async () => {
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                PUSH_AUTH_ENCRYPTION_KEY: generateTestKey(),
            } as unknown as CloudFlareEnv);

            await expect(
                decryptPushAuth('encv1::onlyCiphertext'),
            ).rejects.toThrow('Malformed encrypted push auth value.');
        });

        // 8: 暗号文部分が欠落（区切り':'が無い）→ throw
        it('8: 暗号文部分が欠落している場合はthrowすること', async () => {
            EnvStore.setEnv({
                ...MOCK_ENV_BASE,
                PUSH_AUTH_ENCRYPTION_KEY: generateTestKey(),
            } as unknown as CloudFlareEnv);

            await expect(decryptPushAuth('encv1:onlyIv')).rejects.toThrow(
                'Malformed encrypted push auth value.',
            );
        });
    });
});
