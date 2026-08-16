/** 管理画面（`GET /admin/flags/api`）が返す1フラグ分の状態。 */
export interface FeatureFlagStatus {
    key: string;
    label: string;
    /** D1に行があればその値。行が無ければ undefined。 */
    storedEnabled: boolean | undefined;
    /** D1に行が無いときに使われる環境変数側の既定値。 */
    envDefault: boolean;
    /** 実際に適用される値（storedEnabled ?? envDefault）。 */
    effectiveEnabled: boolean;
    /** D1の行が最後に更新された日時（行が無ければ undefined）。 */
    updatedAt: string | undefined;
}

/**
 * 機能フラグ Usecase インターフェース（feature-flag-design.md 参照）。
 */
export interface IFeatureFlagUsecase {
    /**
     * 指定キーの実効値を返す（D1優先、行が無ければ環境変数の既定値）。
     * @param key - `FEATURE_FLAG_DEFINITIONS` に定義されたキー
     */
    resolve: (key: string) => Promise<boolean>;
    /** 定義済みの全フラグの状態一覧を返す（管理画面表示用）。 */
    list: () => Promise<FeatureFlagStatus[]>;
    /**
     * 指定キーの値をD1へ書き込む。
     * @throws {ValidationError} `FEATURE_FLAG_DEFINITIONS` に無いキーの場合
     */
    setFlag: (key: string, enabled: boolean) => Promise<void>;
}
