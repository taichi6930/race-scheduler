/**
 * diInitializer ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | createDIInitializer | 2つの登録関数 | initializeDI関数を返す（即時実行なし） | Line |
 * | 2  | initializeDI | 返された関数実行時 | 両関数が呼ばれる | Branch |
 * | 3  | initializeDI | 複数回実行 | 毎回両関数が実行される | Branch |
 */

import { describe, expect, it, mock } from 'bun:test';
import { createDIInitializer } from '@race-schedule/core';

describe('diInitializer', () => {
    describe('createDIInitializer', () => {
        it('関数を返す', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const result = createDIInitializer(mockInfra, mockApp);

            expect(typeof result).toBe('function');
        });

        it('initializeDI関数を返す', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const result = createDIInitializer(mockInfra, mockApp);

            expect(result).toBeInstanceOf(Function);
        });

        it('createDIInitializer呼び出し時は関数を実行しない', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            createDIInitializer(mockInfra, mockApp);

            expect(mockInfra).not.toHaveBeenCalled();
            expect(mockApp).not.toHaveBeenCalled();
        });

        it('返された関数を呼び出すとregisterInfrastructureが実行される', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const initializeDI = createDIInitializer(mockInfra, mockApp);
            initializeDI();

            expect(mockInfra).toHaveBeenCalled();
        });

        it('返された関数を呼び出すとregisterApplicationが実行される', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const initializeDI = createDIInitializer(mockInfra, mockApp);
            initializeDI();

            expect(mockApp).toHaveBeenCalled();
        });

        it('返された関数を呼び出すと両関数が実行される（順序確認）', () => {
            const callOrder: string[] = [];
            const mockInfra = mock(() => {
                callOrder.push('infra');
            });
            const mockApp = mock(() => {
                callOrder.push('app');
            });

            const initializeDI = createDIInitializer(mockInfra, mockApp);
            initializeDI();

            expect(callOrder).toEqual(['infra', 'app']);
        });

        it('返された関数を複数回呼び出すと毎回両関数が実行される', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const initializeDI = createDIInitializer(mockInfra, mockApp);

            // createDIInitializer 時点では未実行
            expect(mockInfra).toHaveBeenCalledTimes(0);
            expect(mockApp).toHaveBeenCalledTimes(0);

            initializeDI();
            expect(mockInfra).toHaveBeenCalledTimes(1);
            expect(mockApp).toHaveBeenCalledTimes(1);

            initializeDI();
            expect(mockInfra).toHaveBeenCalledTimes(2);
            expect(mockApp).toHaveBeenCalledTimes(2);
        });

        it('複数回関数を呼び出しても毎回実行される', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const initializeDI = createDIInitializer(mockInfra, mockApp);

            initializeDI();
            initializeDI();
            initializeDI();

            expect(mockInfra).toHaveBeenCalledTimes(3);
            expect(mockApp).toHaveBeenCalledTimes(3);
        });

        it('返された関数呼び出し時にregisterInfrastructureが例外をthrowする場合', () => {
            const mockInfra = mock(() => {
                throw new Error('Infra error');
            });
            const mockApp = mock(() => {});

            const initializeDI = createDIInitializer(mockInfra, mockApp);
            expect(() => initializeDI()).toThrow('Infra error');
        });

        it('返された関数呼び出し時にregisterApplicationが例外をthrowする場合', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {
                throw new Error('App error');
            });

            const initializeDI = createDIInitializer(mockInfra, mockApp);
            expect(() => initializeDI()).toThrow('App error');
        });

        it('registerInfrastructureが呼ばれた後にregisterApplicationが呼ばれる', () => {
            const callOrder: string[] = [];
            const mockInfra = mock(() => {
                callOrder.push('infra');
            });
            const mockApp = mock(() => {
                callOrder.push('app');
            });

            const initializeDI = createDIInitializer(mockInfra, mockApp);
            initializeDI();

            expect(callOrder[0]).toBe('infra');
            expect(callOrder[1]).toBe('app');
        });

        it('返された関数は何度でも呼び出し可能', () => {
            let infraCount = 0;
            let appCount = 0;

            const mockInfra = mock(() => {
                infraCount++;
            });
            const mockApp = mock(() => {
                appCount++;
            });

            const initializeDI = createDIInitializer(mockInfra, mockApp);

            // createDIInitializer 時点では未実行
            expect(infraCount).toBe(0);
            expect(appCount).toBe(0);

            initializeDI();
            expect(infraCount).toBe(1);
            expect(appCount).toBe(1);

            initializeDI();
            expect(infraCount).toBe(2);
            expect(appCount).toBe(2);
        });

        it('返された関数は同じ実装を持つ', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const initializeDI1 = createDIInitializer(mockInfra, mockApp);
            const initializeDI2 = createDIInitializer(mockInfra, mockApp);

            // 異なるインスタンスだが、両方とも同じ動作をする
            expect(initializeDI1).not.toBe(initializeDI2);
            expect(typeof initializeDI1).toBe(typeof initializeDI2);
        });

        it('registerInfrastructureとregisterApplicationが別々のスコープで実行される', () => {
            const infraVar = { value: 0 };
            const appVar = { value: 0 };

            const mockInfra = mock(() => {
                infraVar.value = 100;
            });
            const mockApp = mock(() => {
                appVar.value = 200;
            });

            const initializeDI = createDIInitializer(mockInfra, mockApp);

            // createDIInitializer 時点では未実行
            expect(infraVar.value).toBe(0);
            expect(appVar.value).toBe(0);

            initializeDI();

            expect(infraVar.value).toBe(100);
            expect(appVar.value).toBe(200);
        });

        it('引数なしの関数として返される', () => {
            const mockInfra = mock(() => {});
            const mockApp = mock(() => {});

            const initializeDI = createDIInitializer(mockInfra, mockApp);

            // 引数なしで呼び出し可能
            expect(() => initializeDI()).not.toThrow();
        });

        it('返す関数の型チェック', () => {
            const initializeDI = createDIInitializer(
                () => {},
                () => {},
            );

            expect(initializeDI).toEqual(expect.any(Function));
        });
    });
});
