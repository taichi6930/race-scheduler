import type { CloudFlareEnv } from '@race-schedule/core';

/**
 * 機能フラグの定義（feature-flag-design.md 参照）。
 * `key` はD1（feature_flag.flag_key）・管理画面での識別子、`envVarKey` はD1に行が
 * 無いときの既定値を読む環境変数キー（`wrangler.toml`の`[env.production.vars]`等）。
 * 新しいSDUI機能を追加する際は、ここに定義を1件足すだけでよい
 * （usecase/管理画面のロジックは変更不要）。
 */
export interface FeatureFlagDefinition {
    readonly key: string;
    readonly envVarKey: keyof CloudFlareEnv;
    readonly label: string;
}

export const FEATURE_FLAG_DEFINITIONS: readonly FeatureFlagDefinition[] = [
    {
        key: 'announcement_banner',
        envVarKey: 'FEATURE_ANNOUNCEMENT_BANNER_ENABLED',
        label: '起動時お知らせバナー（SDUI PoC）',
    },
];
