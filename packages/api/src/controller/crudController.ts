import type { UpsertResult } from '@race-schedule/core';
import {
    handleControllerError,
    json,
    parseOrBadRequest,
    parseQueryParams,
} from '@race-schedule/core';
import type { ZodType } from 'zod';

import { formatEntities } from './utility/formatEntities';
import { runEntityUpsert } from './utility/runEntityUpsert';

/** datetime を持つ Entity の最小構造 */
interface FormattableEntity {
    datetime: Date | string;
}

/** get/upsert を持つ usecase（`CrudController` が委譲する最小契約） */
export interface CrudUsecaseLike<TEntity, TFilter> {
    fetch: (filter: TFilter) => Promise<TEntity[]>;
    upsert: (entityList: TEntity[]) => Promise<UpsertResult>;
}

export interface CrudControllerConfig<TEntity, TFilter> {
    /** ログ・エラーメッセージに使うコントローラ名（例: 'PlaceController'） */
    controllerName: string;
    /** レスポンスJSONの一覧キー名（例: 'places'） */
    listKey: string;
    filterSchema: ZodType<TFilter>;
    parseUpsert: (body: unknown) => TEntity[];
    /** DTOへ追加フィールドを合成する関数（省略時は何も追加しない。race の isCalendarSpecified 等） */
    augment?: (entity: TEntity) => Record<string, unknown>;
    /**
     * 一覧全体に対して非同期のバッチ問い合わせを行い、DTOへ追加フィールドを合成する関数
     * （省略時は何も追加しない。race の isWatched 等）。
     * `entities` と同じ長さ・同じ並び順の配列を返すこと（index で対応付けるため）。
     * 1件ずつのSQLではなくバッチ問い合わせが必要な場合（IN句での注目選手判定等）に、
     * 同期的な `augment` の代わりに使う。
     */
    augmentBatch?: (entities: TEntity[]) => Promise<Record<string, unknown>[]>;
}

/**
 * 一覧取得(get)/登録更新(upsert)のみで完結するCRUD controllerの共通実装
 * @remarks
 * Controller層：外部入力（HTTPリクエスト）をdomain層の検証関数に通し、
 * domain検証済みの型をusecaseに送る。検証ロジック自体はdomain層（Zodスキーマ）が持つ。
 *
 * `@LogAllMethods` はクラス自身の own property のみをラップするため、
 * ログにクラス名（PlaceController 等）を正しく出すには各具象クラス側に
 * `get`/`upsert` を薄いオーバーライドとして持たせる必要がある
 * （`doGet`/`doUpsert` を呼ぶだけの1行実装）。
 */
export abstract class CrudController<
    TEntity extends FormattableEntity,
    TFilter,
> {
    protected constructor(
        private readonly usecase: CrudUsecaseLike<TEntity, TFilter>,
        private readonly config: CrudControllerConfig<TEntity, TFilter>,
    ) {}

    /**
     * 一覧取得API
     * @param searchParams クエリパラメータをdomainのZodスキーマ（`config.filterSchema`）で検証する
     * @returns 一覧を含むレスポンス
     */
    protected async doGet(searchParams: URLSearchParams): Promise<Response> {
        try {
            // domainのZodスキーマで入力パラメータを検証
            // ValidationError は badRequest に変換し、それ以外は外側 try に委ねる
            const parsed = parseOrBadRequest(() =>
                parseQueryParams(this.config.filterSchema, searchParams),
            );
            if (!parsed.ok) return parsed.response;
            const filter = parsed.value;

            // domain検証済みのfilterをusecaseに送る（locationList/gradeListによる
            // 絞り込みはrepository層のSQLで完結する。PERF-045参照）
            const data = await this.usecase.fetch(filter);

            // augmentBatch（例: isWatchedのIN句判定）は1件ずつではなく一覧全体に対して
            // 1回だけ問い合わせるため、formatEntitiesの同期的なaugmentとは別に先に合成する
            const batchExtra = this.config.augmentBatch
                ? await this.config.augmentBatch(data)
                : undefined;
            const dataWithBatchExtra = batchExtra
                ? data.map((entity, index) => ({
                      ...entity,
                      ...batchExtra[index],
                  }))
                : data;

            // Entity→DTO変換（datetime の JST 文字列化 + augment）
            const entities = formatEntities(
                dataWithBatchExtra,
                this.config.augment,
            );
            return json({
                count: entities.length,
                [this.config.listKey]: entities,
            });
        } catch (error) {
            return handleControllerError(
                error,
                `${this.config.controllerName}.get`,
            );
        }
    }

    /**
     * 登録/更新API
     * @param request リクエストボディをdomainのZodスキーマ（`config.parseUpsert`）で検証する
     * @returns upsert結果を含むレスポンス
     */
    protected async doUpsert(request: Request): Promise<Response> {
        return runEntityUpsert(
            request,
            this.config.parseUpsert,
            (entityList) => this.usecase.upsert(entityList),
            `${this.config.controllerName}.upsert`,
        );
    }
}
