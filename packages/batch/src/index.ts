// batch Worker の公開エントリポイント。
// Hono router を default export する（Cloudflare Workers のハンドラとして使用）。
// batch は DI コンテナを持たず、scraping/api/calendar を HTTP 経由で呼び出すオーケストレータ。
export { router as default } from './router';

// CICD-73対応: wrangler.toml の `class_name = "BatchAllWorkflow"` が
// このエントリファイルからの named export を参照するため、ここで re-export する
// （Cloudflare Workflows の binding 解決の仕様）。
export { BatchAllWorkflow } from './workflows/batchAllWorkflow';
