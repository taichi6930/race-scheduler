import { type ZodString, z } from 'zod';

import type { RaceType } from '../domain/model/valueObject/raceType';

/**
 * 「raceType に応じた許可リストに value が含まれるか」を検証する ZodString スキーマを
 * 生成するファクトリ。
 *
 * RaceCourseSchema / GradeTypeSchema / RaceStageSchema はいずれも
 * `(raceType) => z.string().refine((v) => List(raceType).has(v), message)` という同型だったため、
 * 許可リスト取得関数とメッセージ生成関数を差し替えるだけで生成できるよう共通化する。
 * refine の判定・エラーメッセージ文字列は元実装と完全一致する。
 *
 * `listFunction` はマスタ配列（不変）の filter+Set 構築を伴うため、raceType 単位で
 * 一度計算した結果をこのファクトリ呼び出し（＝ `RaceCourseSchema`/`GradeTypeSchema`/
 * `RaceStageSchema` それぞれ）ごとに保持するモジュールスコープのキャッシュを介して呼び出す
 * （PERF-090: 検証1件ごとにマスタ最大155件規模の再フィルタ+新規Set構築が発生していたコスト）。
 * @param listFunction - raceType から許可値の集合を返す関数
 * @param messageBuilder - raceType からエラーメッセージ文字列を生成する関数
 * @returns raceType を受け取り ZodString を返すスキーマ生成関数
 */
export const makeRaceTypeScopedStringSchema = (
    listFunction: (raceType: RaceType) => Set<string>,
    messageBuilder: (raceType: RaceType) => string,
): ((raceType: RaceType) => ZodString) => {
    const listCache = new Map<RaceType, Set<string>>();

    const cachedListFunction = (raceType: RaceType): Set<string> => {
        const cached = listCache.get(raceType);
        if (cached !== undefined) {
            return cached;
        }
        const list = listFunction(raceType);
        listCache.set(raceType, list);
        return list;
    };

    return (raceType: RaceType): ZodString =>
        z
            .string()
            .refine(
                (value) => cachedListFunction(raceType).has(value),
                messageBuilder(raceType),
            );
};
