import type { ZodType } from 'zod';
import { z } from 'zod';

import { appLogger } from '../utilities/appLogger';
import { isStringValue } from '../utilities/validation';
import { ValidationError } from '../utilities/validationError';
import { raceTypeArraySchema } from './raceValidation';

/**
 * RaceTypeList を正規化する（文字列またはカンマ区切り文字列を配列に変換）
 * `value` の型は `string | string[]` だが、Zodの`.transform()`は実行時に型定義を
 * 超えた値（例: 数値）を渡し得るため、防御的に isStringValue で確認する
 * （T-05: 非文字列・非配列の入力は空配列を返す）。
 * @param value
 */
export const normalizeRaceTypeList = (value: string | string[]): string[] => {
    if (Array.isArray(value)) {
        return value;
    }
    // カンマ区切りの文字列を分割、または単一の値を配列にラップ
    if (isStringValue(value)) {
        if (value.includes(',')) {
            return value.split(',').map((v) => v.trim());
        }
        return [value];
    }
    return [];
};

/**
 * #24: raceTypeList フィールドの共通Zodスキーマ
 * 文字列またはカンマ区切り文字列を正規化・小文字化してRaceType配列に変換します。
 */
export const raceTypeListField = z
    .union([z.string(), z.array(z.string())])
    .transform(normalizeRaceTypeList)
    .transform((array: string[]) => array.map((v) => v.toLowerCase()))
    .pipe(raceTypeArraySchema);

/**
 * Zod の issue 配列を表示用メッセージ文字列へ整形する共通関数。
 * 各パーサに散在していた `issues.map(i => path.join('.') + ': ' + i.message).join(...)` を集約し、
 * 全エンドポイントで単一フォーマット（`path: message` を `, ` で連結）に統一する。
 * @param issues - Zod の issue 配列
 * @returns 整形済みメッセージ文字列（`path: message` を `, ` で連結）
 */
export const formatZodIssues = (
    issues: readonly { path: readonly PropertyKey[]; message: string }[],
): string =>
    issues
        .map((issue) => {
            const path =
                issue.path.length > 0 ? issue.path.join('.') : 'unknown';
            return `${path}: ${issue.message}`;
        })
        .join(', ');

/**
 * #25: Zodスキーマを使ったバリデーション汎用関数
 * safeParse + ValidationError スローパターンを共通化します。
 * @param schema
 * @param input
 */
export const parseWithValidation = <T>(
    schema: ZodType<T>,
    input: unknown,
): T => {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw new ValidationError(formatZodIssues(result.error.issues), 400);
    }
    return result.data;
};

/**
 * 文字列・文字列配列いずれも受け取り、常に配列へ正規化する任意フィールドの共通定義。
 * locationList / gradeList など「単一値でもカンマ無しの多値でも配列化したい」用途で共有する。
 *
 * `z.number()` も受け付けて文字列へ変換する: `queryParamParser.ts` の
 * `normalizeSearchParams` が先頭ゼロ無しの数字のみの文字列（`'31'` 等）を
 * 数値へ自動変換してしまうため、locationCode（先頭ゼロ無しの場所コードが多数存在する。
 * 例: 高知31・小倉81・大垣44 等）を含む `locationList` がここに到達する時点で
 * 既に number 型になっているケースがある。number を素通しで拒否すると
 * 「locationCodeがたまたま先頭ゼロ無しの数字のみ」の場合にのみ 400 になるという
 * 気づきにくい不具合になるため（front の旅程グループ機能で発覚）、number も受理し
 * 文字列へ正規化する。
 */
export const optionalStringListField = z
    .union([
        z.string().min(1),
        z.number(),
        z.array(z.union([z.string().min(1), z.number()])),
    ])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .transform((arr) => arr.map((item) => String(item)))
    .optional();

/** {@link extractIndexedIssue} が返す、配列インデックス付き Zod issue */
export interface IndexedIssue {
    index: number;
    message: string;
}

/**
 * 値が配列インデックス（number）かどうかを判定する型ガード。
 * Zod issue の path 要素は `PropertyKey`（string | number | symbol）のため、
 * typeof を呼び出し側へ直接書かせず名前付き述語関数として切り出す。
 * @param value - 判定対象の値（Zod issue の path 要素）
 * @returns number であれば true
 */
const isNumericIndex = (value: PropertyKey): value is number =>
    typeof value === 'number';

/**
 * Zod issue の先頭要素が「配列インデックスに紐づく検証エラー」であれば、
 * そのインデックスとメッセージを取り出す。
 * `issue && typeof issue.path[0] === 'number'` という複合条件を独立関数へ切り出し、
 * place/race の upsert スキーマで共有することで C2（条件網羅）の組み合わせ爆発を回避する。
 * @param issue - Zod の issue（配列の先頭要素。存在しない場合は undefined）
 * @returns 配列インデックスを持つ issue であれば `{ index, message }`、そうでなければ undefined
 */
export const extractIndexedIssue = (
    issue: { path: readonly PropertyKey[]; message: string } | undefined,
): IndexedIssue | undefined => {
    if (issue === undefined) {
        return;
    }
    const index = issue.path[0];
    return isNumericIndex(index)
        ? { index, message: issue.message }
        : undefined;
};

/**
 * 配列内でIDが重複する要素を検知し、後勝ち（最後に出現した要素）を採用して一意化する。
 *
 * 同一バッチ内でのUPSERT対象ID重複はDB上の挙動（どちらが反映されるか）が不定になるため、
 * 検証エラーでバッチ全体を弾く代わりに後勝ちで一意化し、破棄した重複を`appLogger.warn`で
 * 可視化する（VAL-05）。バッチ全体が失敗するとスクレイピングが正常に取得した他の
 * 大多数のレース/開催場も道連れで保存されなくなるため、後勝ち採用の方が安全と判断した。
 * @param items - 重複除去対象の配列
 * @param getId - 各要素からID文字列を取り出す関数
 * @param idLabel - 警告メッセージに使うIDの名前（例: 'raceId'）
 */
export function dedupeByLastOccurrence<T>(
    items: T[],
    getId: (item: T) => string,
    idLabel: string,
): T[] {
    const lastIndexById = new Map<string, number>();
    items.forEach((item, index) => {
        const id = getId(item);
        if (lastIndexById.has(id)) {
            appLogger.warn(
                `${idLabel}が重複しています: ${id}（先に出現した要素を破棄し、最後の要素を採用します）`,
            );
        }
        lastIndexById.set(id, index);
    });
    return items.filter(
        (item, index) => lastIndexById.get(getId(item)) === index,
    );
}

/**
 * #30: 開催場名の共通フィールド定義
 */
export const RaceCourseField = z.string().min(1, '開催場名は必須です');

/**
 * #31: レースグレードの共通フィールド定義
 */
export const RaceGradeField = z.string().min(1, 'グレードは必須です');

/**
 * #26: race/place 検索フィルターに共通のフィールド定義。
 * `searchRaceFilterParamsSchema` / `searchPlaceFilterParamsSchema` の共通部分を集約する
 * （place のみ `isDisplayPlaceGrade` を追加で持つ）。
 */
export const searchFilterBaseFields = {
    startDate: z.date(),
    finishDate: z.date(),
    raceTypeList: raceTypeListField,
    locationList: optionalStringListField,
    gradeList: optionalStringListField,
    isDisplayPlaceHeldDays: z.boolean().optional(),
};
