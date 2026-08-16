/**
 * Batch CLI 本体ロジック
 *
 * `cli.ts`（薄いエントリーポイント）から呼ばれる実処理をすべてここに集約する。
 * トップレベルの `if (import.meta.main)` 分岐を含まないため、通常の import +
 * 関数呼び出しでユニットテストから 100% カバレッジを達成できる
 * （`import.meta.main` 分岐はサブプロセス経由でしか実行されずカバレッジ
 * 計測対象外になるため `cli.ts` 側へ分離している）。
 */

import {
    appLogger,
    type RaceType,
    validateRaceType,
} from '@race-schedule/core';

import { executeMultipleBatches } from './orchestrator';
import type {
    ApiConfig,
    BatchConfig,
    BatchExecTarget,
    BatchTarget,
} from './types';
import {
    BATCH_TARGETS,
    expandTargets,
    getApiConfig,
    isBatchTarget,
} from './types';
import {
    dateRangeErrorMessage,
    getMaxRangeDays,
    validateDateRange,
    validRaceTypesMessage,
} from './validation';

/**
 * main が呼び出す外部依存。テストからフェイク実装を注入できるように
 * デフォルト値（実装本体）付き引数として受け取る（mock.module によるモジュール
 * レジストリ書き換えは他テストファイルへ波及するリスクがあるため使用しない）。
 */
export interface MainDependencies {
    executeMultipleBatches: typeof executeMultipleBatches;
    getApiConfig: typeof getApiConfig;
}

const defaultMainDependencies: MainDependencies = {
    executeMultipleBatches,
    getApiConfig,
};

/** 引数不足時の使い方メッセージを出力する。 */
const printUsage = (): void => {
    appLogger.error(
        'Usage: bun src/cli.ts <raceType> <startDate> <finishDate> [target]',
    );
    appLogger.error(
        '  raceType: jra, nar, keirin, autorace, boatrace, overseas',
    );
    appLogger.error(
        '            複数指定の場合: jra,nar,boatrace (カンマ区切り)',
    );
    appLogger.error('  startDate: YYYY-MM-DD');
    appLogger.error('  finishDate: YYYY-MM-DD');
    appLogger.error('  target: place, race, calendar, all (default: all)');
    appLogger.error('');
    appLogger.error('Environment variables:');
    appLogger.error(
        '  SCRAPING_API_URL: Override default Scraping API endpoint',
    );
    appLogger.error('  MAIN_API_URL: Override default Main API endpoint');
    appLogger.error('');
    appLogger.error('See SETUP_LOCAL.md for details and examples.');
};

/** parseAndValidateArgs の結果 */
interface ParsedCliArgs {
    validatedRaceTypes: RaceType[];
    targetArgument: BatchTarget;
    startDate: string;
    finishDate: string;
}

/**
 * raceType 引数（カンマ区切り）を検証する。不正な値があればエラーメッセージを出力し process.exit(1) する。
 * @param raceTypeArgument raceType 引数（カンマ区切り）
 * @returns 検証済みの raceType 一覧
 */
const validateRaceTypesArgument = (raceTypeArgument: string): RaceType[] => {
    const raceTypeStrs = raceTypeArgument.split(',').map((s) => s.trim());
    const validatedRaceTypes: RaceType[] = [];

    for (const raceTypeString of raceTypeStrs) {
        try {
            validatedRaceTypes.push(validateRaceType(raceTypeString));
        } catch {
            appLogger.error(`Invalid raceType: ${raceTypeString}`);
            appLogger.error(validRaceTypesMessage());
            process.exit(1);
        }
    }

    return validatedRaceTypes;
};

/**
 * target 引数を検証する。不正な値の場合はエラーメッセージを出力し process.exit(1) する。
 * @param targetArgument target 引数
 * @returns 検証済みの target
 */
const validateTargetArgument = (targetArgument: string): BatchTarget => {
    if (!isBatchTarget(targetArgument)) {
        appLogger.error(`Invalid target: ${targetArgument}`);
        appLogger.error(`Valid values: ${BATCH_TARGETS.join(', ')}`);
        process.exit(1);
    }
    return targetArgument;
};

/**
 * 日付レンジを検証する。不正なレンジの場合はエラーメッセージを出力し process.exit(1) する。
 * disallow ranges based on target type and race type
 * place/calendar: allow up to 390 days (raceType不問。calendarはMain APIから
 *   読むだけでスクレイピングが発生しないため raceType 別の制限が不要)
 * race の JRA: allow up to 35 days / race の OVERSEAS: allow up to 390 days
 * race のその他: allow up to 10 days（対象サイトへの逐次スクレイピング負荷対策）
 * 最も厳しい制限を基準に確認
 * @param startDate 開始日
 * @param finishDate 終了日
 * @param targetArgument 検証済みの target
 * @param validatedRaceTypes 検証済みの raceType 一覧
 */
const validateDateRangeArgument = (
    startDate: string,
    finishDate: string,
    targetArgument: BatchTarget,
    validatedRaceTypes: RaceType[],
): void => {
    const maxDaysNeeded = Math.min(
        ...validatedRaceTypes.map((rt) => getMaxRangeDays(targetArgument, rt)),
    );

    const dateRangeResult = validateDateRange(
        startDate,
        finishDate,
        maxDaysNeeded,
    );
    if (!dateRangeResult.valid) {
        appLogger.error(
            dateRangeErrorMessage(dateRangeResult.reason, maxDaysNeeded),
        );
        process.exit(1);
    }
};

/**
 * CLI引数を検証する。不正な引数の場合はエラーメッセージを出力し process.exit(1) する。
 * @param args process.argv.slice(2) で得られる CLI 引数
 * @returns 検証済みの raceType 一覧・target・日付レンジ
 */
const parseAndValidateArgs = (args: string[]): ParsedCliArgs => {
    if (args.length < 3) {
        printUsage();
        process.exit(1);
    }

    const [raceTypeArgument, startDate, finishDate, targetArgument = 'all'] =
        args;

    const validatedRaceTypes = validateRaceTypesArgument(raceTypeArgument);
    const validatedTarget = validateTargetArgument(targetArgument);
    validateDateRangeArgument(
        startDate,
        finishDate,
        validatedTarget,
        validatedRaceTypes,
    );

    return {
        validatedRaceTypes,
        targetArgument: validatedTarget,
        startDate,
        finishDate,
    };
};

/**
 * バッチ処理開始時のバナーをログ出力する。
 * @param targetArgument
 * @param validatedRaceTypes
 * @param startDate
 * @param finishDate
 * @param apiConfig
 */
const printStartupBanner = (
    targetArgument: BatchTarget,
    validatedRaceTypes: RaceType[],
    startDate: string,
    finishDate: string,
    apiConfig: ApiConfig,
): void => {
    appLogger.info('');
    appLogger.info('==========================================');
    appLogger.info('        Batch Processing Started');
    appLogger.info('==========================================');
    appLogger.info(`Target: ${targetArgument}`);
    appLogger.info(
        `RaceTypes: ${validatedRaceTypes.map((rt) => rt.valueOf()).join(', ')}`,
    );
    appLogger.info(`Period: ${startDate} ~ ${finishDate}`);
    appLogger.info(`Scraping API: ${apiConfig.scrapingApiUrl}`);
    appLogger.info(`Main API: ${apiConfig.mainApiUrl}`);
    appLogger.info('==========================================');
    appLogger.info('');
};

/** {@link runForRaceTypes} の結果 */
interface RunForRaceTypesResult {
    allResults: Awaited<ReturnType<typeof executeMultipleBatches>>;
    raceTypeLevelFailureCount: number;
}

/**
 * 各 raceType に対してバッチ実行し、結果を集約して返す。
 * 複数の raceType を Promise.allSettled で並列実行する（PERF-068）。
 * GitHub Actions 側は raceType ごとに matrix 並列実行されるが、
 * cli.ts を単体実行してカンマ区切りで複数 raceType を指定した場合は
 * 従来完全直列だったため同様の並列化を適用する。
 * 各 raceType は Main API 上で完全に独立したデータ（配信元サイトも
 * raceType 単位で別）を扱うため、raceType 間に処理順の依存関係はない。
 * なお executeMultipleBatches 自体（1 raceType 内の place→race→calendar）は
 * Main API 経由のデータ依存があるため直列のまま変更していない。
 * @param validatedRaceTypes
 * @param targets
 * @param startDate
 * @param finishDate
 * @param dependencies
 */
const runForRaceTypes = async (
    validatedRaceTypes: RaceType[],
    targets: BatchExecTarget[],
    startDate: string,
    finishDate: string,
    dependencies: MainDependencies,
): Promise<RunForRaceTypesResult> => {
    const raceTypeOutcomes = await Promise.allSettled(
        validatedRaceTypes.map((raceType) => {
            const config: BatchConfig = {
                raceType,
                startDate,
                finishDate,
            };
            return dependencies.executeMultipleBatches(targets, config);
        }),
    );

    const allResults: Awaited<ReturnType<typeof executeMultipleBatches>> = [];
    // executeMultipleBatches / executeBatch は内部でエラーを握り失敗結果として
    // 返す設計のため通常は reject しないが、Promise.allSettled として防御的に扱う。
    let raceTypeLevelFailureCount = 0;

    for (const [index, outcome] of raceTypeOutcomes.entries()) {
        if (outcome.status === 'fulfilled') {
            allResults.push(...outcome.value);
            continue;
        }
        raceTypeLevelFailureCount += 1;
        appLogger.error(
            `Batch processing failed unexpectedly for raceType=${validatedRaceTypes[index].valueOf()}:`,
            outcome.reason,
        );
    }

    return { allResults, raceTypeLevelFailureCount };
};

/**
 * バッチ処理結果のサマリをログ出力し、失敗が1件以上あれば process.exit(1) する。
 * @param allResults raceType 毎の実行結果一覧
 * @param raceTypeLevelFailureCount raceType 単位で reject した件数（PERF-068）
 */
const printSummary = (
    allResults: Awaited<ReturnType<typeof executeMultipleBatches>>,
    raceTypeLevelFailureCount: number,
): void => {
    appLogger.info('');
    appLogger.info('==========================================');
    appLogger.info('        Batch Processing Complete');
    appLogger.info('==========================================');

    let totalSuccess = 0;
    let totalFailure = raceTypeLevelFailureCount;

    for (const result of allResults) {
        appLogger.info(
            `[${result.target}] Success: ${result.successCount}, Failure: ${result.failureCount}`,
        );
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;

        if (result.failures.length > 0) {
            appLogger.info('  Failures:');
            for (const failure of result.failures) {
                appLogger.info(`    - ${failure.id}: ${failure.reason}`);
            }
        }
    }

    appLogger.info('------------------------------------------');
    appLogger.info(`Total: Success: ${totalSuccess}, Failure: ${totalFailure}`);
    appLogger.info('==========================================');

    if (totalFailure > 0) {
        process.exit(1);
    }
};

export const main = async (
    dependencies: MainDependencies = defaultMainDependencies,
): Promise<void> => {
    const args = process.argv.slice(2);
    const { validatedRaceTypes, targetArgument, startDate, finishDate } =
        parseAndValidateArgs(args);

    // 実際に使用される API設定を取得
    const apiConfig = dependencies.getApiConfig();
    printStartupBanner(
        targetArgument,
        validatedRaceTypes,
        startDate,
        finishDate,
        apiConfig,
    );

    const targets = expandTargets(targetArgument);
    const { allResults, raceTypeLevelFailureCount } = await runForRaceTypes(
        validatedRaceTypes,
        targets,
        startDate,
        finishDate,
        dependencies,
    );

    printSummary(allResults, raceTypeLevelFailureCount);
};

/**
 * main を実行する。
 * 環境変数（`SCRAPING_API_URL`/`MAIN_API_URL`）は CI の secrets 注入・
 * OS 環境変数・`.env` のいずれかで実行前に設定されている前提とする。
 * @param dependencies main に注入する外部依存（テスト用、省略時は実装本体）
 */
export async function run(
    dependencies: MainDependencies = defaultMainDependencies,
): Promise<void> {
    try {
        await main(dependencies);
    } catch (error: unknown) {
        appLogger.error('Batch processing failed:', error);
        process.exit(1);
    }
}
