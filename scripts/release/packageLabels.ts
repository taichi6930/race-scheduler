/**
 * packageLabels.ts
 *
 * PRの `pkg:*` ラベル（`.github/workflows/pull_request.yml` の
 * `detect-changed-packages` ジョブが、変更されたパッケージに応じて自動的に付け外しする）
 * から、レイヤー名を取り出す共通ヘルパー。`generateReleaseSummary.ts`（更新履歴本文への
 * `[api]` 等のレイヤー表示）が使う。
 *
 * ラベル名一覧はCI側（pull_request.yml、YAML+bashでTypeScript側の定数を直接
 * importできない）とここで二重管理になる。ラベルの追加・削除時は両方を更新すること。
 */

export const PACKAGE_LABEL_PREFIX = 'pkg:';

export const PACKAGE_LAYERS = [
    'admin',
    'api',
    'batch',
    'core',
    'db',
    'front',
] as const;

export type PackageLayer = (typeof PACKAGE_LAYERS)[number];

/** ラベル名一覧（`pkg:api`等）から、既知のレイヤー名だけを一定の順序で取り出す。 */
export const extractLayerLabels = (
    labelNames: readonly string[],
): PackageLayer[] =>
    PACKAGE_LAYERS.filter((layer) =>
        labelNames.includes(`${PACKAGE_LABEL_PREFIX}${layer}`),
    );

/** レイヤー名一覧を、更新履歴の箇条書き先頭に付ける表示用プレフィックスへ整形する。 */
export const formatLayerPrefix = (layers: readonly string[]): string =>
    layers.length > 0 ? `[${layers.join('/')}] ` : '';
