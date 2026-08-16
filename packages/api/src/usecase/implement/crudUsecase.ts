import type { UpsertResult } from '@race-schedule/core';

/**
 * fetch/upsert を持つ repository（`CrudUsecase` が委譲する最小契約）
 */
export interface ICrudRepository<TEntity, TFilter> {
    fetch: (filter: TFilter) => Promise<TEntity[]>;
    upsert: (entityList: TEntity[]) => Promise<UpsertResult>;
}

/**
 * repository への薄い委譲だけで完結する usecase の共通実装
 * @remarks
 * usecase層の重要な設計原則：
 * - 引数はdomain層で検証済みの型（Zodスキーマ・branded型）を受け取る前提で実装し、
 *   呼び出し元のレイヤーを前提にした再検証は行わない
 * - ビジネスロジックに集中する
 *
 * `@LogAllMethods` はクラス自身の own property のみをラップするため、
 * ログにクラス名（PlaceUsecase 等）を正しく出すには各具象クラス側に
 * `fetch`/`upsert` を薄いオーバーライドとして持たせる必要がある
 * （`doFetch`/`doUpsert` を呼ぶだけの1行実装）。
 */
export abstract class CrudUsecase<TEntity, TFilter> {
    protected constructor(
        private readonly repository: ICrudRepository<TEntity, TFilter>,
    ) {}

    protected doFetch(filter: TFilter): Promise<TEntity[]> {
        return this.repository.fetch(filter);
    }

    protected doUpsert(entityList: TEntity[]): Promise<UpsertResult> {
        return this.repository.upsert(entityList);
    }
}
