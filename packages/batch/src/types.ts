/**
 * バッチ処理の型定義とAPI設定
 * CLI引数から受け取る設定、APIエンドポイント、バッチ対象種別を定義
 */

import type { RaceType } from '@race-schedule/core';
import { requireEnvVar } from '@race-schedule/core';

/**
 * バッチ処理の対象種別
 * - place: 開催場情報の取得・登録
 * - race: レース情報の取得・登録
 * - calendar: カレンダー情報の更新
 * - all: place → race → calendar を順序実行
 */
export type BatchTarget = 'place' | 'race' | 'calendar' | 'all';

/**
 * 'all' を除いた実行単位の対象種別（place / race / calendar の各処理）。
 * executeBatch / executeMultipleBatches の対象を表す単一情報源。
 */
export type BatchExecTarget = Exclude<BatchTarget, 'all'>;

/**
 * 妥当な BatchTarget 値の一覧（検証の単一情報源）。
 */
export const BATCH_TARGETS = [
    'place',
    'race',
    'calendar',
    'all',
] as const satisfies readonly BatchTarget[];

/**
 * 値が BatchTarget か判定する型ガード。
 * 各所に散在していた `as BatchTarget` / `as string[]` / `as unknown[]` キャストを
 * この 1 箇所に集約する。
 * @param value 判定対象の値
 * @returns value が BatchTarget なら true
 */
export function isBatchTarget(value: unknown): value is BatchTarget {
    // SAFETY: BatchTarget自体がstringの部分集合のユニオン型のため、BATCH_TARGETSの要素は
    // 全て実体としてstring。string[].includes(value: string)を呼ぶための型の緩和であり、
    // 直前のtypeof value === 'string'によりvalueもstringに絞り込み済み
    return (
        typeof value === 'string' &&
        (BATCH_TARGETS as readonly string[]).includes(value)
    );
}

/**
 * BatchTarget を実行単位の対象配列へ展開する。
 * - 'all' → ['place', 'race', 'calendar']（順序を維持）
 * - それ以外（place/race/calendar） → その値のみの単一要素配列
 *
 * cli.ts と router.ts に別実装で重複していた 'all' 展開ロジックを集約する。
 * @param target 展開対象の BatchTarget
 * @returns 実行単位の対象配列
 */
export function expandTargets(target: BatchTarget): BatchExecTarget[] {
    if (target === 'all') {
        return ['place', 'race', 'calendar'];
    }
    return [target];
}

/**
 * バッチ処理の実行設定
 * CLI引数から受け取る基本パラメータ
 */
export interface BatchConfig {
    /** レース種別（JRA/NAR/KEIRINなど） */
    raceType: RaceType;
    /** 処理開始日（YYYY-MM-DD形式） */
    startDate: string;
    /** 処理終了日（YYYY-MM-DD形式） */
    finishDate: string;
}

/**
 * API通信の設定（エンドポイントURL）
 * 環境変数またはデフォルト値から取得される
 */
export interface ApiConfig {
    /** スクレイピングAPIのベースURL */
    scrapingApiUrl: string;
    /** メインAPI（データ登録）のベースURL */
    mainApiUrl: string;
}

/**
 * 環境変数からAPIConfig を取得（必須）
 *
 * Worker モード（EnvStore.setEnv 済み）では EnvStore から読み取り、
 * CLI モード（process.env のみ）ではフォールバックとして process.env を使用。
 * @returns API設定オブジェクト
 * @throws Error 必須環境変数が設定されていない場合
 */
export function getApiConfig(): ApiConfig {
    return {
        scrapingApiUrl: requireEnvVar('SCRAPING_API_URL'),
        mainApiUrl: requireEnvVar('MAIN_API_URL'),
    };
}

/**
 * calendar Worker の同期エンドポイントのベースURLを取得する（必須）。
 *
 * `getApiConfig` に含めると place/race バッチ実行時にも
 * CALENDAR_API_URL の設定を要求してしまうため、calendar バッチ専用の
 * 取得関数として分離する。
 * @returns calendar Worker のベースURL
 * @throws Error CALENDAR_API_URL が設定されていない場合
 */
export function getCalendarApiUrl(): string {
    return requireEnvVar('CALENDAR_API_URL');
}
