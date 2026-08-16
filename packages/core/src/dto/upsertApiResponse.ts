import type { UpsertResult } from '../utilities/upsertResult';

/**
 * API Upsert レスポンス形式。
 *
 * {@link UpsertResult} と構造的に同一だったため、api の内部処理で使う
 * UpsertResult をそのまま batch のクライアント向け型として再利用する
 * （重複していた `successCount/failureCount/failures` フィールド定義を集約）。
 */
export type UpsertApiResponse = UpsertResult;
