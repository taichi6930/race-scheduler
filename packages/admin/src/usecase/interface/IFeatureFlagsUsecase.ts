import type { FeatureFlagStatus } from '../../dto/featureFlagStatus';

/**
 * 機能フラグ管理 Usecase インターフェース（admin-package-design.md 参照）。
 */
export interface IFeatureFlagsUsecase {
    /** 登録済み機能フラグの状態一覧を返す。 */
    list: () => Promise<FeatureFlagStatus[]>;

    /**
     * 指定した機能フラグの値を更新する。
     * @param key - 更新対象のフラグキー
     * @param enabled - 更新後の値
     * @returns 更新後のフラグ状態一覧
     */
    setFlag: (key: string, enabled: boolean) => Promise<FeatureFlagStatus[]>;
}
