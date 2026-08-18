import { toJstISOString } from '@race-schedule/core';

/** datetime を持つ Entity の最小構造 */
interface FormattableEntity {
    datetime: Date | string;
}

/**
 * GET 一覧 API の Entity→DTO 変換共通処理。
 * datetime の JST 文字列化と augment（追加フィールド合成）のみを行う。
 * place / race コントローラの get() で重複していたロジックを共通化する。
 * @remarks
 * PERF-045: 従来は locationList / gradeList による絞り込みもここで再度
 * 行っていたが（旧 `filterAndFormatEntities`）、`RaceRepository.fetch` /
 * `PlaceRepository.fetch` が同じ locationList / gradeList を使って
 * SQL 側（`WHERE ... IN (...)`）で既に絞り込み済みのため、コントローラ層
 * での再フィルタは完全な二重処理だった（同じ判定を2回行うだけでCPUを
 * 消費し、結果には影響しない）。SQL側のフィルタを唯一の判定箇所とし、
 * こちらの責務は DTO整形（datetime文字列化・augment）のみに絞った。
 * @param entities - 変換対象のエンティティ配列（SQL側で既にフィルタ済み）
 * @param augment - DTOへ追加フィールドを合成する関数（省略時は何も追加しない。race の isCalendarSpecified 等）
 * @returns datetime を JST 文字列化した DTO 配列
 */
export const formatEntities = <
    T extends FormattableEntity,
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- augment関数の戻り値の上限型（呼び出し元entity種別ごとに形が異なる汎用拡張ポイント、crudController.tsのaugmentと同じ設計）
    A extends Record<string, unknown> = Record<string, never>,
>(
    entities: T[],
    augment?: (entity: T) => A,
): (Omit<T, 'datetime'> & { datetime: string } & A)[] => {
    return entities.map((entity) => ({
        ...entity,
        ...(augment?.(entity) ?? ({} as A)),
        datetime:
            typeof entity.datetime === 'string'
                ? entity.datetime
                : toJstISOString(entity.datetime),
    }));
};
