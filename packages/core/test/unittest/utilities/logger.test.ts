/**
 * Logger デコレータ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Decorator | Input | Expected | Coverage |
 * |----|-----------|-------|----------|----------|
 * | 1  | @LogAllMethods | 複数async method | 各メソッドログ | Line |
 * | 2  | @LogAllMethods | sync method も実行 | sync ログ | Line |
 * | 3  | @LogAllMethods | throw する method | エラーログ | Line |
 * | 4  | @LogAllMethods | getOwnPropertyDescriptor が undefined を返すプロパティ | ログ対象から除外（continue） | Branch |
 * | 5  | @LogAllMethods | 機密フィールドを持つエラーを throw | ログ出力時に [REDACTED] へマスク | Line |
 * | 6  | @LogAllMethods | prototype上の関数でないプロパティ | ログ対象から除外（そのままの値） | Branch |
 * | 7  | @LogAllMethods | async method | 終了ログの経過時間が `{ elapsedMs }` の構造化フィールドで渡される（OBS-019） | Line |
 */

import type { Mock } from 'bun:test';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    mock,
    spyOn,
} from 'bun:test';
import { LogAllMethods } from '@race-schedule/core';

describe('Logger Decorators', () => {
    let consoleLogSpy: Mock<typeof console.log>;
    let consoleErrorSpy: Mock<typeof console.error>;
    const originalLog = console.log;
    const originalError = console.error;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        consoleLogSpy = mock(console.log);
        consoleErrorSpy = mock(console.error);
        console.log = consoleLogSpy;
        console.error = consoleErrorSpy;
        process.env.NODE_ENV = undefined;
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        console.log = originalLog;
        console.error = originalError;
    });

    describe('@LogAllMethods decorator', () => {
        it('async method に自動的にログデコレータが適用される', async () => {
            @LogAllMethods
            class TestClass {
                async method1(): Promise<string> {
                    return 'result1';
                }

                async method2(): Promise<string> {
                    return 'result2';
                }
            }

            const instance = new TestClass();
            const result1 = await instance.method1();
            const result2 = await instance.method2();

            expect(result1).toBe('result1');
            expect(result2).toBe('result2');
            // 2つのメソッド × (開始 + 終了) = 4回
            expect(consoleLogSpy).toHaveBeenCalledTimes(4);
        });

        it('終了ログの経過時間が{ elapsedMs }の構造化フィールドで渡される', async () => {
            @LogAllMethods
            class TestClass {
                async method1(): Promise<string> {
                    return 'result1';
                }
            }

            const instance = new TestClass();
            await instance.method1();

            // calls[0] = 開始ログ（メッセージのみ）、calls[1] = 終了ログ（メッセージ + elapsedMs）
            const endLogArgs = consoleLogSpy.mock.calls[1];
            expect(endLogArgs[1]).toEqual({
                elapsedMs: expect.any(Number),
            });
        });

        it('sync method にもログデコレータが適用される', () => {
            @LogAllMethods
            class TestClass {
                syncMethod(): string {
                    return 'sync result';
                }
            }

            const instance = new TestClass();
            const result = instance.syncMethod();

            expect(result).toBe('sync result');
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
        });

        it('async method でエラーが throw される場合はエラーログが出力される', async () => {
            @LogAllMethods
            class TestClass {
                async failMethod(): Promise<void> {
                    throw new Error('failure');
                }
            }

            const instance = new TestClass();
            try {
                await instance.failMethod();
            } catch (error) {
                // expected to throw
            }

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('エラー');
        });

        it('sync method でエラーが throw される場合もエラーログが出力される', () => {
            @LogAllMethods
            class TestClass {
                syncFailMethod(): void {
                    throw new Error('sync failure');
                }
            }

            const instance = new TestClass();
            try {
                instance.syncFailMethod();
            } catch (error) {
                // expected to throw
            }

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });

        it('機密フィールドを持つエラーはマスクしてログ出力される', async () => {
            @LogAllMethods
            class TestClass {
                async failMethod(): Promise<void> {
                    // eslint-disable-next-line no-throw-literal
                    throw {
                        message: 'auth failed',
                        privateKey: 'super-secret',
                    };
                }
            }

            const instance = new TestClass();
            try {
                await instance.failMethod();
            } catch {
                // expected to throw
            }

            const loggedError = consoleErrorSpy.mock.calls[0][1] as Record<
                string,
                unknown
            >;
            expect(loggedError.privateKey).toBe('[REDACTED]');
            expect(loggedError.message).toBe('auth failed');
        });

        it('NODE_ENV=ci_local の場合はすべてのログが抑制される', async () => {
            process.env.NODE_ENV = 'ci_local';

            @LogAllMethods
            class TestClass {
                async asyncMethod(): Promise<string> {
                    return 'async result';
                }

                syncMethod(): string {
                    return 'sync result';
                }
            }

            const instance = new TestClass();
            const asyncResult = await instance.asyncMethod();
            const syncResult = instance.syncMethod();

            expect(asyncResult).toBe('async result');
            expect(syncResult).toBe('sync result');
            expect(consoleLogSpy).toHaveBeenCalledTimes(0);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
        });

        it('constructor は装飾されない', () => {
            @LogAllMethods
            class TestClass {
                constructor() {
                    // constructor should not be logged
                }

                async testMethod(): Promise<string> {
                    return 'test';
                }
            }

            // Creating instance should not log the constructor
            new TestClass();
            // Only testMethod should be logged, not constructor
            expect(consoleLogSpy).toHaveBeenCalledTimes(0);
        });

        it('getter/setter は装飾されない', async () => {
            @LogAllMethods
            class TestClass {
                private _value = 'initial';

                get value(): string {
                    return this._value;
                }

                set value(v: string) {
                    this._value = v;
                }

                async testMethod(): Promise<string> {
                    return 'test';
                }
            }

            const instance = new TestClass();
            // Access getter/setter (should not be logged)
            instance.value = 'changed';
            const val = instance.value;

            expect(val).toBe('changed');
            // getter/setter are not logged, so still 0 calls before testMethod
            expect(consoleLogSpy).toHaveBeenCalledTimes(0);

            // Call testMethod (should be logged)
            await instance.testMethod();
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
        });

        it('getOwnPropertyDescriptor が undefined を返すプロパティはログ対象から除外される', async () => {
            // Object.getOwnPropertyDescriptor は getOwnPropertyNames が返した
            // プロパティ名に対して仕様上 undefined を返さないため、防御的ガードを
            // 直接検証するには実装を差し替える必要がある。
            const originalGetOwnPropertyDescriptor =
                Object.getOwnPropertyDescriptor;
            const descriptorSpy = spyOn(Object, 'getOwnPropertyDescriptor');
            descriptorSpy.mockImplementation(
                (targetObject: object, propertyKey: PropertyKey) => {
                    if (propertyKey === 'testMethod') {
                        return undefined;
                    }
                    return originalGetOwnPropertyDescriptor(
                        targetObject,
                        propertyKey,
                    );
                },
            );

            try {
                @LogAllMethods
                class TestClass {
                    async testMethod(): Promise<string> {
                        return 'test';
                    }
                }

                const instance = new TestClass();
                const result = await instance.testMethod();

                expect(result).toBe('test');
                // descriptor が undefined のため continue され、ログは出力されない
                expect(consoleLogSpy).toHaveBeenCalledTimes(0);
            } finally {
                descriptorSpy.mockRestore();
            }
        });

        it('prototype上の関数でないプロパティはログ対象から除外される', () => {
            class TestClass {
                async testMethod(): Promise<string> {
                    return 'test';
                }
            }
            Object.defineProperty(TestClass.prototype, 'nonFunctionProp', {
                value: 42,
                enumerable: true,
                configurable: true,
            });

            const Decorated = LogAllMethods(TestClass);
            const instance = new Decorated();

            expect(
                (instance as unknown as { nonFunctionProp: number })
                    .nonFunctionProp,
            ).toBe(42);
        });
    });
});
