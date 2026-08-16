// api Worker の公開エントリポイント。
// `fetch`（Hono router）と `scheduled`（Web Push の毎分ディスパッチ、web-push-design.md §5）
// を持つオブジェクトを default export する（Cloudflare Workers のハンドラとして使用）。
// DI コンテナの初期化は `env` がリクエスト/イベント時にしか得られない Workers の制約により、
// ここでの import 時ではなく router.ts 側で初回呼び出し時に行う（scheduled 経路も同じ関数を共有）。
import 'reflect-metadata';

import { router } from './router';
import { scheduled } from './scheduled';

export default {
    fetch: router.fetch,
    scheduled,
};
