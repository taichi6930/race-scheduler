/**
 * DIコンテナ初期化ファクトリ関数
 *
 * 各パッケージの di.ts で重複している初期化パターンを共通化します。
 * インフラストラクチャ層とアプリケーション層の登録関数を受け取り、
 * 自動的に DI コンテナを初期化して返します。
 * @param registerInfrastructure - インフラストラクチャ層の登録関数
 * @param registerApplication - アプリケーション層の登録関数
 * @returns 初期化済みの initializeDI 関数
 */
export const createDIInitializer = (
    registerInfrastructure: () => void,
    registerApplication: () => void,
): (() => void) => {
    const initializeDI = (): void => {
        registerInfrastructure();
        registerApplication();
    };
    return initializeDI;
};
