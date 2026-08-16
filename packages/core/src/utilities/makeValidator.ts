import type { z } from 'zod';

/**
 * zodスキーマから `validateX` 形式のバリデーション関数を生成する汎用ヘルパー。
 *
 * `(value) => schema.parse(value)` と等価な関数を返します。
 * 返される関数の引数は `unknown`、戻り値はスキーマから推論した `z.infer<T>` になります。
 * parse に失敗した場合は zod の例外（ZodError）をそのままスローします。
 * @param schema - バリデーションに使用する zod スキーマ
 * @returns スキーマで値を検証して返すバリデーション関数
 */
export const makeValidator =
    <T extends z.ZodTypeAny>(schema: T) =>
    (value: unknown): z.infer<T> =>
        schema.parse(value);
