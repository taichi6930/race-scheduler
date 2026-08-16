/**
 * メインAPI（@race-schedule/api）の `GET`/`POST /internal/feature-flags` が
 * 返す1フラグ分の状態。api側の `FeatureFlagStatus`（
 * `packages/api/src/usecase/interface/IFeatureFlagUsecase.ts`）と同じ形の
 * レスポンスJSONを表す、admin側で見たDTO（パッケージ境界を越えて型を共有しないため
 * 個別に定義している）。
 *
 * gateway/repository/usecase いずれの層からも参照するため、レイヤー境界の外
 * （`dto/`）に置く（`gateway/interface`に置くと usecase からの参照が
 * `noRestrictedImports`（usecase → gateway 禁止）に抵触するため）。
 */
export interface FeatureFlagStatus {
    key: string;
    label: string;
    storedEnabled: boolean | undefined;
    envDefault: boolean;
    effectiveEnabled: boolean;
    updatedAt: string | undefined;
}
