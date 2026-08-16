# sIT（システム結合テスト）

`tests/shared/env/setupMiniflareEnv.ts`（miniflare/workerd による実 D1・実 R2）を使った
最初の参照実装 `placeRepository.sit.test.ts` を実装済み（2026-07-23）。

## 実装済み

- `PlaceRepository` ↔ 実 D1（miniflare）: upsert → fetch の往復（`placeRepository.sit.test.ts`）

## 未実装（今後の候補）

- `RaceRepository`/`PlayerRepository`/`CalendarFlagRepository` ↔ 実 D1
  （`PlaceRepository` と同じ `setupMiniflareEnv()` パターンで追加できる）
- 外部 SaaS 境界（Google Calendar API）の msw/nock モック
  — **注**: api パッケージは Google Calendar へ直接アクセスしない
  （`GoogleCalendarGateway` は現在 `packages/calendar` 側にあり、api には存在しない。
  カレンダー Worker 分離後の現状に合わせ、本項目は `packages/calendar` 側の
  sIT 候補として扱うこと）。

`it.skip` によるプレースホルダテストは規約で禁止されているため、
実際に実行可能なテストが書けるようになるまで `.test.ts` は追加しない方針は維持する。

## 実行方法

```sh
bun run test:sit                              # 全パッケージのsIT
NODE_ENV=ci_local TZ=jst bun test packages/api/test/integration/system  # apiのみ
```

miniflare は各テストファイルの `beforeAll`/`afterAll` でその中だけ起動・破棄される
（他のテストへ状態が漏れない）。
