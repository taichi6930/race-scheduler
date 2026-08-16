/**
 * envFlag ユーティリティ テスト
 *
 * ## デシジョンテーブル: isEnvFlagTrue
 *
 * | #    | env                          | process.env[key]     | 期待値 | 説明                                                     |
 * |------|------------------------------|-----------------------|--------|------------------------------------------------------------|
 * | T-01 | { [key]: 'true' }             | 未設定                | true   | envオブジェクトの該当キーが'true'                          |
 * | T-02 | undefined                    | 'true'                | true   | envが無くprocess.env[key]==='true'                          |
 * | T-03 | { [key]: 'false' }            | 未設定                | false  | envオブジェクトのキーはあるが'true'ではなく、process.envも真でない |
 * | T-04 | undefined                    | 未設定                | false  | envが無くprocess.envも真でない                              |
 * | T-05 | null                          | 'true'                | true   | envがnull（非オブジェクト）なのでprocess.envにフォールバック |
 * | T-06 | 'not-an-object'（文字列）     | 'true'                | true   | envが非オブジェクト（プリミティブ）なのでprocess.envにフォールバック |
 * | T-07 | { otherKey: 'true' }          | 'true'                | true   | envに該当キーが無くても、process.envが真ならtrue            |
 * | T-08 | { [key]: 'true' }             | 'false'               | true   | envが真ならprocess.envの値に関わらずtrue（||の短絡評価）    |
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { isEnvFlagTrue } from '@race-schedule/core';

const KEY = 'USE_IN_MEMORY_DB';

describe('isEnvFlagTrue', () => {
    const originalValue = process.env[KEY];

    afterEach(() => {
        if (originalValue === undefined) {
            delete process.env[KEY];
        } else {
            process.env[KEY] = originalValue;
        }
    });

    it('isEnvFlagTrue_envオブジェクトの該当キーがtrue_trueを返すこと[T-01]', () => {
        // Arrange
        delete process.env[KEY];
        const env = { [KEY]: 'true' };

        // Act
        const result = isEnvFlagTrue(KEY, env);

        // Assert
        expect(result).toBe(true);
    });

    it('isEnvFlagTrue_envなしでprocess.envがtrue_trueを返すこと[T-02]', () => {
        // Arrange
        process.env[KEY] = 'true';

        // Act
        const result = isEnvFlagTrue(KEY);

        // Assert
        expect(result).toBe(true);
    });

    it('isEnvFlagTrue_envのキーがtrue以外かつprocess.envも真でない_falseを返すこと[T-03]', () => {
        // Arrange
        delete process.env[KEY];
        const env = { [KEY]: 'false' };

        // Act
        const result = isEnvFlagTrue(KEY, env);

        // Assert
        expect(result).toBe(false);
    });

    it('isEnvFlagTrue_envなしでprocess.envも真でない_falseを返すこと[T-04]', () => {
        // Arrange
        delete process.env[KEY];

        // Act
        const result = isEnvFlagTrue(KEY);

        // Assert
        expect(result).toBe(false);
    });

    it('isEnvFlagTrue_envがnull_process.envにフォールバックしtrueを返すこと[T-05]', () => {
        // Arrange
        process.env[KEY] = 'true';

        // Act
        const result = isEnvFlagTrue(KEY, null);

        // Assert
        expect(result).toBe(true);
    });

    it('isEnvFlagTrue_envが非オブジェクト（文字列）_process.envにフォールバックしtrueを返すこと[T-06]', () => {
        // Arrange
        process.env[KEY] = 'true';

        // Act
        const result = isEnvFlagTrue(KEY, 'not-an-object');

        // Assert
        expect(result).toBe(true);
    });

    it('isEnvFlagTrue_envに該当キーが無いがprocess.envが真_trueを返すこと[T-07]', () => {
        // Arrange
        process.env[KEY] = 'true';
        const env = { otherKey: 'true' };

        // Act
        const result = isEnvFlagTrue(KEY, env);

        // Assert
        expect(result).toBe(true);
    });

    it('isEnvFlagTrue_envが真でprocess.envが偽_短絡評価でtrueを返すこと[T-08]', () => {
        // Arrange
        process.env[KEY] = 'false';
        const env = { [KEY]: 'true' };

        // Act
        const result = isEnvFlagTrue(KEY, env);

        // Assert
        expect(result).toBe(true);
    });
});
