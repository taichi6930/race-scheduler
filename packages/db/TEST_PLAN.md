# Database Test Plan

このドキュメントは、`packages/db` のテスト計画を定義します。

## 概要

DBパッケージは以下の責務を持ちます:

1. **マイグレーション管理** - D1スキーマバージョン管理

> 以前は「型定義」「クエリ・モデルヘルパー」も本パッケージの責務としていましたが、どのパッケージからも参照されず api 側が独自の Zod スキーマでクエリ結果を検証・型付けしていたため、該当コード（`src/types`, `src/models`）は削除しました（2026-07 モジュール再編調査 ISSUE-01）。以下の型定義・クエリ関連の計画は当時の未実装計画であり、現状は対象外です。

```
Migration
  ↓
D1 Database (Cloudflare)
```

## 現状分析

| 責務             | UT  | IT  | 備考           |
| ---------------- | :-: | :-: | -------------- |
| マイグレーション | ❌  | ✅  | 手動テスト済み |

**現状: 0 自動テスト / 部分的な手動テスト済み**

## マイグレーション検証計画

### 優先度: 高 🔴 - Phase 1

マイグレーションの適切性を検証します。

| 検証項目               | 内容                                       | ファイル                     |
| ---------------------- | ------------------------------------------ | ---------------------------- |
| マイグレーション順序   | 全マイグレーションが正しい順序で実行される | test/migrations.test.ts      |
| マイグレーション冪等性 | 同じマイグレーションを複数回実行可能       | test/migrations.test.ts      |
| 障害時の復旧手段       | wrangler d1 migrationsは前進のみでdown-migration機構が無いため、自動ロールバックではなくバックアップからの復元が復旧手段になる（OPS-01対応・2026-08-03: `deploy-db-reusable.yml`にマイグレーション適用前の`wrangler d1 export`によるバックアップ取得＋artifact保存を追加済み） | `.github/workflows/deploy-db-reusable.yml` |
| スキーマ競合検出       | マイグレーション間の競合を早期発見         | test/schema-conflict.test.ts |

### マイグレーションテストケース

#### 1. マイグレーション実行順序

```
test/migrations.test.ts - sequence验证
```

| マイグレーションファイル    | チェック内容                         |
| --------------------------- | ------------------------------------ |
| 001_create-place-table.sql  | tableが正しく作成される              |
| 002_create-race-table.sql   | 外部キー制約が正しく張られる         |
| 003_create-player-table.sql | プレイヤーテーブルが正しく作成される |
| 004_add_index.sql           | インデックスが適切に張られる         |
| ...（全マイグレーション）   | スキーマが段階的に正しく構築される   |

#### 2. マイグレーション冪等性

```
test/idempotency.test.ts
```

| テストケース           | 検証内容                 |
| ---------------------- | ------------------------ |
| 重複実行でエラーなし   | Duplicate key エラーなし |
| IF NOT EXISTS チェック | 条件付き実行が機能       |
| 既存データの保全性     | データが変更されない     |

#### 3. スキーマ競合検出

```
test/schema-conflict.test.ts
```

| 潜在的な競合         | 検出方法                 |
| -------------------- | ------------------------ |
| 重複した列名         | スキーマ定義での自動検出 |
| 矛盾する外部キー設定 | 制約チェック             |
| インデックス競合     | インデックス定義検証     |

## 型定義テスト計画 - Phase 1

### UT (ユニットテスト)

```
test/types/schemas.test.ts
```

| テスト対象   | テストすべき内容           |
| ------------ | -------------------------- |
| PlaceSchema  | 型チェック・バリデーション |
| RaceSchema   | 型チェック・バリデーション |
| PlayerSchema | 型チェック・バリデーション |
| 型の相互参照 | 型安全性が保証される       |

### 型定義テストケース

#### 1. PlaceSchema型テスト

```typescript
// test/types/place.schema.test.ts
describe('PlaceSchema', () => {
    test('正常系: Place型が正しく定義される', () => {
        const place: Place = {
            id: '1',
            name: '東京競馬場',
            location: '東京',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        expect(place).toBeDefined();
    });

    test('異常系: 必須フィールドがない', () => {
        // @ts-expect-error
        const place: Place = { id: '1' }; // idのみ
        // コンパイルエラーで検出
    });
});
```

#### 2. RaceSchema型テスト

```typescript
test('正常系: Race型が外部キー参照できる', () => {
    const race: Race = {
        id: 'r1',
        name: 'レース名',
        placeId: '1', // Place の外部キー
        playerIds: ['p1', 'p2'], // Player の外部キー
        // ...
    };
    expect(race.placeId).toBe('1');
});
```

## クエリ・モデルヘルパーテスト計画 - Phase 2 🟡

### クエリの正確性検証

```
test/queries/ 配下で各ドメインのクエリをテスト
```

| クエリヘルパー         | テストすべき内容               |
| ---------------------- | ------------------------------ |
| place.queries.ts       | SELECT, INSERT, UPDATE, DELETE |
| race.queries.ts        | JOINを含む複合クエリ           |
| player.queries.ts      | 複数テーブル参照クエリ         |
| race-player.queries.ts | 中間テーブルクエリ             |

#### 1. Place Query Tests

```
test/queries/place.queries.test.ts
```

| クエリ                  | テスト                       | 優先度 |
| ----------------------- | ---------------------------- | ------ |
| `selectPlaceById(id)`   | 正常系: 正しいPlaceが返却    | 高     |
| `selectPlaceById(id)`   | 異常系: 存在しないID         | 高     |
| `insertPlace(data)`     | 正常系: Placeが登録される    | 高     |
| `updatePlace(id, data)` | 正常系: Placeが更新される    | 中     |
| `deletePlace(id)`       | 異常系: 外部キー制約チェック | 中     |

#### 2. Race Query Tests （複合クエリ）

```
test/queries/race.queries.test.ts
```

| クエリ                                       | テスト                         | 優先度 |
| -------------------------------------------- | ------------------------------ | ------ |
| `selectRacesByPlace(placeId)`                | 正常系: 複数のRaceが返却       | 高     |
| `selectRacesByDateRange(startDate, endDate)` | 正常系: 期間内のRaceを抽出     | 高     |
| `selectRaceWithPlayers(raceId)`              | 正常系: Race+Players情報をJOIN | 高     |
| `insertRaceWithPlayers(race, players)`       | 正常系: トランザクション成功   | 中     |

## 統合テスト計画 - Phase 2 🟡

### ローカル環境でのマイグレーション検証

```bash
bun run migrations:apply:local
bun test:integration:local
```

| テストシナリオ       | 検証内容                       |
| -------------------- | ------------------------------ |
| 初期マイグレーション | 全テーブルが正しく作成される   |
| データ挿入           | 制約を満たすデータが登録される |
| データ更新           | 更新が正しく反映される         |
| データ削除           | 外部キー制約が確認される       |
| マイグレーション追加 | 新マイグレーションが実行される |

### テスト環境でのマイグレーション検証

```bash
bun run migrations:apply:test
bun test:integration:test
```

Cloudflareのテスト環境D1データベースに対する検証。

## E2E テスト計画 - Phase 3 🟢

実環境での動作確認（本番デプロイ前）:

```bash
bun run migrations:apply:production
```

| チェック項目     | 確認内容                             |
| ---------------- | ------------------------------------ |
| 本番DBの状態     | 破損していないか、スキーマが正しいか |
| 復旧手段         | `deploy-db-reusable.yml`が取得するバックアップからの復元手順確認 |
| パフォーマンス   | クエリが許容範囲内で実行される       |

## テスト実行コマンド

### 全テスト

```bash
bun test
```

### マイグレーションテスト

```bash
bun test migrations.test.ts
```

### 型定義テスト

```bash
bun test types/
```

### 統合テスト（ローカル環境）

```bash
bun test:integration:local
```

### 統合テスト（テスト環境）

```bash
bun test:integration:test
```

### Watch モード

```bash
bun test --watch
```

## マイグレーション手動確認

### ローカルでのマイグレーション確認

```bash
# マイグレーション実行
bun run migrations:apply:local

# マイグレーション一覧確認
bun run migrations:list:local

# DBシェル起動（確認用）
bun run db:shell:local
```

### マイグレーション状態確認

```sql
-- マイグレーション履歴確認（D1）
SELECT * FROM __d1_migrations ORDER BY id DESC LIMIT 10;

-- テーブル一覧確認
.tables

-- テーブルスキーマ確認
.schema place
.schema race
.schema player
```

## テスト実装ロードマップ

### Phase 1（現在）

- [ ] マイグレーション順序テスト
- [ ] マイグレーション冪等性テスト
- [ ] 型定義ユニットテスト
- [ ] スキーマ競合検出テスト

### Phase 2

- [ ] クエリテスト（place, race, player）
- [ ] 統合テスト（ローカル環境）
- [ ] 統合テスト（テスト環境）

### Phase 3

- [ ] E2E検証
- [ ] パフォーマンステスト
- [x] マイグレーション適用前バックアップ（OPS-01対応・2026-08-03、`deploy-db-reusable.yml`）

## テストチェックリスト

マイグレーション前に以下をすべて確認:

- [ ] 全ユニットテストが成功
    ```bash
    bun test
    ```
- [ ] 型チェック エラーなし

    ```bash
    bun run type-check
    ```

- [ ] マイグレーション冪等性確認

    ```bash
    bun run migrations:apply:test
    ```

- [ ] ローカル環境で正常動作

    ```bash
    bun run migrations:apply:local
    bun test:integration:local
    ```

- [ ] テスト環境で正常動作
    ```bash
    bun run migrations:apply:test
    bun test:integration:test
    ```

## 参考ドキュメント

- [README.md](README.md) - パッケージ概要
- [SETUP.md](SETUP.md) - セットアップガイド
- [wrangler.toml](wrangler.toml) - D1バインディング設定
- [migrations/](migrations/) - マイグレーションファイル
