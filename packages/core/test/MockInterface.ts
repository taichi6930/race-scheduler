import { type Mock, mock } from 'bun:test';

/**
 * Bun test のモック関数型定義
 * テスト全体で一貫性を保つため、このファイルで統一的なモック型を定義する。
 *
 * 型パラメータ `T` は「あらゆる関数を受け付ける」制約 `(...args: never[]) => unknown`
 * を用いており、`any` を排除している（引数は反変なので never[]、戻り値は unknown）。
 */

/** 対象関数の型（unknown 化した可変長引数） */
type AnyFn = (...args: never[]) => unknown;

/**
 * mock() の戻り値を拡張した型
 * mockImplementationOnce()、mockResolvedValue() などをサポートする。
 */
export type MockFn<T extends AnyFn = AnyFn> = Mock<T> & {
    mockImplementationOnce(implementation: T): void;
    mockResolvedValue(value: unknown): MockFn<T>;
    mockRejectedValue(error: unknown): MockFn<T>;
    mockReturnValue(value: unknown): MockFn<T>;
};

/**
 * オブジェクトのプロパティをモック関数でラップする型
 */
export type Mocked<T> = {
    [K in keyof T]: T[K] extends AnyFn ? MockFn<T[K]> : T[K];
};

/**
 * 拡張 mock 関数を作成する。
 * mockImplementationOnce()、mockResolvedValue() などをサポートする。
 *
 * 型引数 `T` は呼び出し側で対象メソッドのシグネチャを指定する
 * （例: `createMockFn<IRaceRepository['fetch']>()`）。
 * @param implementation - 省略可能なデフォルト実装
 */
export function createMockFn<T extends AnyFn>(implementation?: T): MockFn<T> {
    // 追加のモックメソッド用の状態管理
    const implementationQueue: T[] = [];
    let resolvedValue: unknown;
    let rejectedValue: unknown;
    let returnValue: unknown;

    // T を「緩い可変長引数関数」として呼び出すためのヘルパー（any を使わない）
    const asLoose = (fn: T): ((...args: unknown[]) => unknown) =>
        fn as unknown as (...args: unknown[]) => unknown;

    // カスタムのモック挙動を処理するラッパー関数
    const customImpl = (...args: unknown[]): unknown => {
        // mockImplementationOnce でキューに入っている場合
        if (implementationQueue.length > 0) {
            const nextImpl = implementationQueue.shift()!;
            return asLoose(nextImpl)(...args);
        }

        // mockRejectedValue で設定されている場合
        if (rejectedValue !== undefined) {
            const err = rejectedValue;
            rejectedValue = undefined;
            return Promise.reject(err);
        }

        // mockResolvedValue で設定されている場合
        if (resolvedValue !== undefined) {
            const val = resolvedValue;
            resolvedValue = undefined;
            return Promise.resolve(val);
        }

        // mockReturnValue で設定されている場合
        if (returnValue !== undefined) {
            const val = returnValue;
            returnValue = undefined;
            return val;
        }

        // デフォルト実装があればフォールバック
        if (implementation) {
            return asLoose(implementation)(...args);
        }

        return undefined;
    };

    // Bun の mock を用いて実体を作成
    const mockFn = mock(customImpl);

    // カスタムメソッドを付与する（readonly プロパティ対策で try-catch）
    const customMethods = {
        mockImplementationOnce: (impl: T) => {
            implementationQueue.push(impl);
            return mockFn;
        },
        mockResolvedValue: (value: unknown) => {
            resolvedValue = value;
            return mockFn;
        },
        mockRejectedValue: (error: unknown) => {
            rejectedValue = error;
            return mockFn;
        },
        mockReturnValue: (value: unknown) => {
            returnValue = value;
            return mockFn;
        },
    };

    const target = mockFn as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(customMethods)) {
        try {
            target[key] = value;
        } catch {
            // 直接代入が失敗した場合は Object.defineProperty を試す
            try {
                Object.defineProperty(mockFn, key, {
                    value,
                    writable: true,
                    configurable: true,
                    enumerable: false,
                });
            } catch {
                // 両方失敗した場合のセーフティフォールバック（通常発生しない）
            }
        }
    }

    return mockFn as unknown as MockFn<T>;
}
