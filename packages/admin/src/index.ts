// admin Worker の公開エントリポイント。
// Hono router を default export する（Cloudflare Workers のハンドラとして使用）。
// DI コンテナは import 時に即座に初期化する（`initialized` の named export 束縛は
// `no-top-level-side-effects` を満たすための意図的なパターン）。
// `scheduled` はあえて持たない（cron を必要とする処理を持たないため）。
import 'reflect-metadata';

import { setupDI } from './di';

// import 時に DI を初期化する
// （no-top-level-side-effects を満たすため副作用を named export の束縛にする）
export const initialized = setupDI();

export { router as default } from './router';
