/** feature_flag テーブルの1行（管理画面表示用）。 */
export interface FeatureFlagRow {
    flagKey: string;
    enabled: boolean;
    updatedAt: string;
}

/**
 * 機能フラグ（feature_flag テーブル）リポジトリインターフェース
 * （feature-flag-design.md 参照）。
 */
export interface IFeatureFlagRepository {
    /** 登録済みの全フラグ行を返す（管理画面の一覧表示用）。 */
    list: () => Promise<FeatureFlagRow[]>;
    /**
     * 指定キーの行があればその enabled 値を返す。行が無ければ undefined
     * （呼び出し側で環境変数の既定値へフォールバックする）。
     */
    get: (flagKey: string) => Promise<boolean | undefined>;
    /** 指定キーの行を作成または更新する。 */
    upsert: (flagKey: string, enabled: boolean) => Promise<void>;
}
