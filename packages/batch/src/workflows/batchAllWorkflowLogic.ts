/**
 * batch-all.yml の Cloudflare ネイティブ Workflows 移行版（CICD-73）のロジック本体。
 *
 * `batchAllWorkflow.ts`（`WorkflowEntrypoint` を継承する薄いエントリポイント）から
 * 呼ばれる実処理をここに集約する。`cloudflare:workers`（値としての
 * `WorkflowEntrypoint`）を import せず、`@cloudflare/workers-types` の型のみに
 * 依存することで、bun test 実行環境（`cloudflare:workers` は Workers ランタイム
 * 固有の仮想モジュールで Node.js/bun からは解決できない）でもユニットテスト可能に
 * している（`cli.ts`/`batchCli.ts` の分離と同じ設計方針）。
 * @remarks
 * - 現時点では **直列実行**（raceType 間の並列化はしない）。既存の
 *   `orchestrator.ts`（`runForRaceTypes`）は `Promise.allSettled` で
 *   raceType を並列実行しているが、Workflows の `step.do()` を
 *   `Promise.all` で束ねて安全に並列化できるかは公式ドキュメントで
 *   裏取りできておらず（`docs/tasks/cicd-73-batch-cron-migration.md` §7-4、
 *   要検証）、まずシンプルな直列実装で動作を確認してから並列化を検討する。
 *   §2-2 の実測では直列でも合計169秒程度（6時間おきのcron間隔に対して
 *   無視できる長さ）に収まる見込み。
 * - 各 step のコールバック内で毎回 `EnvStore.setEnv(env)` を呼ぶ。
 *   Workflows の step は再実行・リトライされうるため、`router.ts` の
 *   `handleBatchPost` と同じ「実行のたびに設定し直す」方針に合わせている。
 * - production環境は `wrangler.toml` に `schedules` を登録済み（CICD-73/CONC-03、
 *   §11-12）。GitHub Actions側（`batch-all.yml`）のcronトリガーは並行稼働の
 *   検証期間として維持しており、段階的カットオーバー完了後に削除する予定。
 */

// `WorkflowEvent`/`WorkflowStep` は `cloudflare:workers` からのみ公開される型
// （`@cloudflare/workers-types` パッケージのトップレベル named export には無い）。
// `import type` のため実行時にはモジュール解決されず、bun test でも問題ない。
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import type { CloudFlareEnv } from '@race-schedule/core';
import { EnvStore, GithubIssueGateway, RaceType } from '@race-schedule/core';

import { runCalendarBatch } from '../batch/calendar';
import { runPlaceBatch } from '../batch/place';
import { runRaceBatch } from '../batch/race';
import { acquireBatchLock, releaseBatchLock } from '../client/batchLock';
import type { BatchConfig, BatchExecTarget } from '../types';
import type { BatchDateRange } from './dateRange';
import { buildFixedDateRange, computeScheduledDateRange } from './dateRange';
import type { BatchStepFailure } from './notifyBatchWorkflowFailure';
import { syncBatchWorkflowFailureIssue } from './notifyBatchWorkflowFailure';
import { ALL_RACE_TYPES_FOR_BATCH } from './raceTypes';

/** place/race/calendarの全ターゲット（既定値）。 */
const ALL_TARGETS: BatchExecTarget[] = ['place', 'race', 'calendar'];

/**
 * Workflowインスタンス作成時のペイロード。
 * batch-all.yml のcron相当（省略時）に加え、batch-race/place/calendar.yml が
 * 統合された手動トリガー（CICD-73/CONC-03の排他制御統一）にも対応する。
 * 省略されたフィールドはcron実行時と同じ既定値（全raceType・全target・
 * event.timestamp基準の日付レンジ）にフォールバックする。
 */
export interface BatchAllWorkflowPayload {
    /** 対象レース種別（省略時: ALL_RACE_TYPES_FOR_BATCH） */
    raceTypes?: RaceType[];
    /** 対象ターゲット（省略時: place/race/calendarの全て） */
    targets?: BatchExecTarget[];
    /**
     * 開始日（YYYY-MM-DD）。finishDateとセットで指定した場合のみ、
     * computeScheduledDateRangeの代わりにbuildFixedDateRangeを使う
     * （手動トリガー相当。NAR延長・calendar+4日の自動拡張はしない）。
     */
    startDate?: string;
    /** 終了日（YYYY-MM-DD）。startDateとセットで指定した場合のみ使う。 */
    finishDate?: string;
}

/** 1 step あたりのリトライ設定。既存 CLI 版の `DEFAULT_MAX_RETRIES = 2` と揃える。 */
const STEP_RETRY_CONFIG = {
    retries: {
        limit: 2,
        delay: '10 seconds',
        backoff: 'exponential',
    },
    timeout: '5 minutes',
} as const;

/**
 * `step.do(...)` の呼び出し結果（Promise）を待ち、リトライ上限到達後も失敗した
 * 場合は例外を投げずに `failures` へ積む。OBS-013（raceType単位で失敗が独立して
 * 分かるようにする設計方針）を維持するため、1件の失敗が他のraceType×targetの
 * 実行を妨げないようにしている（`step.do` 自体のリトライは維持したまま、
 * 最終的な失敗のみをここで捕捉する）。
 *
 * `step.do(...)` の呼び出し自体は各呼び出し元で行う（`WorkflowStep.do` は
 * コールバックの戻り値の型によってオーバーロード解決されるため、本関数の
 * 引数として汎用的にコールバックを受け取ると`Serializable<T>`制約が満たせず
 * 型エラーになる。呼び出し済みの`Promise`を受け取る形にすることでこれを回避する）。
 * @param raceType 対象レース種別
 * @param target 対象ターゲット
 * @param failures 失敗を積み込む配列（呼び出し側で保持）
 * @param stepPromise 呼び出し済みの `step.do(...)` の Promise
 */
async function collectStepFailure(
    raceType: RaceType,
    target: BatchExecTarget,
    failures: BatchStepFailure[],
    stepPromise: Promise<unknown>,
): Promise<void> {
    try {
        await stepPromise;
    } catch (error) {
        failures.push({ raceType, target, error });
    }
}

/**
 * `runPlaceStep`/`runRaceStep`/`runCalendarStep` へ渡す共通コンテキスト。
 * 引数を1オブジェクトへまとめることで各関数呼び出し元（`runOneRaceType`）を
 * 1行に収め、`noExcessiveLinesPerFunction`（30行制限）を満たしている。
 */
interface RaceTypeStepContext {
    step: WorkflowStep;
    env: CloudFlareEnv;
    raceType: RaceType;
    baseConfig: Pick<BatchConfig, 'raceType' | 'startDate'>;
    failures: BatchStepFailure[];
}

/**
 * place 1 raceType 分の `step.do(...)` を実行し、失敗を `ctx.failures` へ積む。
 * `step.do` のコールバックはリテラルの矢印関数として直接渡す必要がある
 * （汎用的な `run: () => Promise<unknown>` を経由すると `Serializable<T>` の
 * オーバーロード解決に失敗するため、place/race/calendarでそれぞれ専用の
 * 関数として用意している）。
 */
async function runPlaceStep(
    ctx: RaceTypeStepContext,
    finishDate: string,
): Promise<void> {
    const { step, env, raceType, baseConfig, failures } = ctx;
    await collectStepFailure(
        raceType,
        'place',
        failures,
        step.do(`${raceType}-place`, STEP_RETRY_CONFIG, async () => {
            EnvStore.setEnv(env);
            return runPlaceBatch({ ...baseConfig, finishDate });
        }),
    );
}

/** race 1 raceType 分の `step.do(...)` を実行し、失敗を `ctx.failures` へ積む。 */
async function runRaceStep(
    ctx: RaceTypeStepContext,
    finishDate: string,
): Promise<void> {
    const { step, env, raceType, baseConfig, failures } = ctx;
    await collectStepFailure(
        raceType,
        'race',
        failures,
        step.do(`${raceType}-race`, STEP_RETRY_CONFIG, async () => {
            EnvStore.setEnv(env);
            return runRaceBatch({ ...baseConfig, finishDate });
        }),
    );
}

/** calendar 1 raceType 分の `step.do(...)` を実行し、失敗を `ctx.failures` へ積む。 */
async function runCalendarStep(
    ctx: RaceTypeStepContext,
    finishDate: string,
): Promise<void> {
    const { step, env, raceType, baseConfig, failures } = ctx;
    await collectStepFailure(
        raceType,
        'calendar',
        failures,
        step.do(`${raceType}-calendar`, STEP_RETRY_CONFIG, async () => {
            EnvStore.setEnv(env);
            return runCalendarBatch({ ...baseConfig, finishDate });
        }),
    );
}

/**
 * 1 raceType 分の対象ターゲット（place/race/calendarの部分集合）を順に実行する。
 * @param step Workflow のステップ実行コンテキスト
 * @param env Worker の環境変数（各 step 内で EnvStore に設定する）
 * @param raceType 対象レース種別
 * @param dateRange 日付レンジ
 * @param targets 実行するターゲット（部分集合可、記載順で実行）
 * @returns このraceTypeで発生した失敗一覧（無ければ空配列）
 */
async function runOneRaceType(
    step: WorkflowStep,
    env: CloudFlareEnv,
    raceType: RaceType,
    dateRange: ReturnType<typeof computeScheduledDateRange>,
    targets: BatchExecTarget[],
): Promise<BatchStepFailure[]> {
    const baseConfig: Pick<BatchConfig, 'raceType' | 'startDate'> = {
        raceType,
        startDate: dateRange.startDate,
    };
    const failures: BatchStepFailure[] = [];
    const ctx: RaceTypeStepContext = {
        step,
        env,
        raceType,
        baseConfig,
        failures,
    };

    if (targets.includes('place')) {
        await runPlaceStep(ctx, dateRange.finishDate);
    }
    if (targets.includes('race')) {
        await runRaceStep(ctx, dateRange.raceFinishDateFor(raceType));
    }
    if (targets.includes('calendar')) {
        await runCalendarStep(ctx, dateRange.calendarFinishDate);
    }

    return failures;
}

/**
 * payloadのstartDate/finishDateから日付レンジを解決する。
 * 両方セットで指定された場合のみ`buildFixedDateRange`（手動トリガー相当）を使い、
 * それ以外（両方省略、または片方のみ指定）は`computeScheduledDateRange`
 * （cron相当）にフォールバックする。ネストしたガード節で複合条件（&&）を避けている
 * （local/no-compound-condition）。
 * @param payload Workflowインスタンス作成時のペイロード
 * @param timestamp Workflowの起動イベント基準時刻（cron相当のフォールバックに使用）
 * @returns 解決済みの日付レンジ
 */
export function resolveDateRange(
    payload: BatchAllWorkflowPayload,
    timestamp: Date,
): BatchDateRange {
    if (payload.startDate === undefined) {
        return computeScheduledDateRange(timestamp);
    }
    if (payload.finishDate === undefined) {
        return computeScheduledDateRange(timestamp);
    }
    return buildFixedDateRange(payload.startDate, payload.finishDate);
}

/**
 * Workflow の `run()` から呼ばれるロジック本体。
 * payload省略時（cron相当）は全raceType・全target・event.timestamp基準の
 * 日付レンジで実行する。payloadで指定された場合は、その部分集合・固定日付
 * レンジ（手動トリガー相当）で実行する。
 *
 * 排他制御ロック（CICD-73/CONC-03）はこのWorkflow自身の最初のstepで取得する。
 * `router.ts` の `handleBatchTriggerPost`（HTTPトリガー経由）も事前に取得を
 * 試みるが、Cloudflareのネイティブcronトリガー（`wrangler.toml`の`schedules`）は
 * `router.ts`を一切経由せず直接Workflowインスタンスを作成するため、
 * Workflow自身での取得が唯一の排他判定になりうる。`BatchLockRepository.acquire`は
 * 同一instanceIdでの再取得を冪等に成功させるため、router.ts側で既に取得済みの
 * インスタンスがこのstepで再取得しても失敗しない。取得できなかった場合
 * （他のインスタンスが実行中）は何もせず終了する。取得できた場合のみ実行し、
 * 成功・失敗を問わずWorkflow終了時に必ずロックを解放する（`finally`）。
 * 解放自体が失敗した場合でも、api側の`BatchLockUsecase`（30分の失効判定）が
 * フェイルセーフとして機能する。
 *
 * raceType×targetの失敗（step.doのリトライ上限到達後）はOBS-013の方針通り
 * 互いに独立させ、1件の失敗が他のraceType×targetの実行を止めない
 * （`runOneRaceType`が例外を投げず失敗一覧を返す）。全raceType完了後、
 * 失敗が1件でもあればGitHub Issueへ通知し（`GITHUB_TOKEN`未設定時はスキップ、
 * 通知自体の失敗はベストエフォート）、最後にこのWorkflowインスタンス自体を
 * 失敗（errored）として終わらせるため例外を投げる
 * （旧batch-all.ymlがGitHub Actions標準の失敗通知で担っていた役割の引き継ぎ、
 * docs/tasks/cicd-73-batch-cron-migration.md §11-4/§12参照）。
 * @param env Worker の環境変数
 * @param event Workflow の起動イベント（`timestamp` を日付レンジ計算の基準に使う）
 * @param step Workflow のステップ実行コンテキスト
 * @throws {Error} raceType×targetの失敗が1件以上あった場合
 */
/** 排他制御ロックを取得する（取得可否を返す）。 */
async function acquireLockStep(
    step: WorkflowStep,
    env: CloudFlareEnv,
    instanceId: string,
): Promise<boolean> {
    return step.do('acquire-batch-lock', STEP_RETRY_CONFIG, async () => {
        EnvStore.setEnv(env);
        const result = await acquireBatchLock(instanceId);
        return result.acquired;
    });
}

/** 排他制御ロックを解放する。 */
async function releaseLockStep(
    step: WorkflowStep,
    env: CloudFlareEnv,
    instanceId: string,
): Promise<void> {
    await step.do('release-batch-lock', STEP_RETRY_CONFIG, async () => {
        EnvStore.setEnv(env);
        await releaseBatchLock(instanceId);
    });
}

/**
 * BOATRACEのrace同期を一時的に無効化する暫定対応（ユーザー指示、2026-08-05）。
 * @remarks
 * PR #2320（D1バインド変数上限超過の修正）を本番反映後も `boatrace-race` の
 * `/sync/race` 500エラーが再現し続けたため、恒久対応の原因調査を後回しにして
 * まず実害（cronの度に失敗・リトライで無駄なリクエストが飛ぶ）を止める。
 * place/calendarはBOATRACEでも通常どおり実行する。
 * 恒久対応が終わったらこの分岐ごと削除すること。
 */
const RACE_TYPES_SKIPPING_RACE_TARGET: readonly RaceType[] = [
    RaceType.BOATRACE,
];

/**
 * raceType単位で、実行するtargetを絞り込む（暫定対応の適用のみ）。
 * @param raceType - 対象レース種別
 * @param targets - Workflow全体で指定されたtarget一覧
 */
function resolveTargetsForRaceType(
    raceType: RaceType,
    targets: BatchExecTarget[],
): BatchExecTarget[] {
    if (!RACE_TYPES_SKIPPING_RACE_TARGET.includes(raceType)) {
        return targets;
    }
    return targets.filter((target) => target !== 'race');
}

/**
 * 全raceTypeを順に実行し、成功・失敗を問わず最後にロックを解放する
 * （`runBatchAllWorkflow` の行数制限対応で切り出したロック確保後の本体）。
 */
async function runAllRaceTypesWithLock(
    step: WorkflowStep,
    env: CloudFlareEnv,
    raceTypes: RaceType[],
    dateRange: ReturnType<typeof computeScheduledDateRange>,
    targets: BatchExecTarget[],
    instanceId: string,
): Promise<BatchStepFailure[]> {
    const allFailures: BatchStepFailure[] = [];
    try {
        for (const raceType of raceTypes) {
            const failures = await runOneRaceType(
                step,
                env,
                raceType,
                dateRange,
                resolveTargetsForRaceType(raceType, targets),
            );
            allFailures.push(...failures);
        }
    } finally {
        await releaseLockStep(step, env, instanceId);
    }
    return allFailures;
}

/** GitHub Issueへ失敗を通知する（`GITHUB_TOKEN`未設定時はスキップ）。 */
async function notifyFailuresStep(
    step: WorkflowStep,
    env: CloudFlareEnv,
    allFailures: BatchStepFailure[],
    instanceId: string,
): Promise<void> {
    await step.do('notify-batch-failures', STEP_RETRY_CONFIG, async () => {
        EnvStore.setEnv(env);
        const token = env.GITHUB_TOKEN;
        if (!token) {
            return;
        }
        await syncBatchWorkflowFailureIssue(
            allFailures,
            instanceId,
            new GithubIssueGateway('race-schedule-batch'),
            token,
        );
    });
}

export async function runBatchAllWorkflow(
    env: CloudFlareEnv,
    event: Readonly<WorkflowEvent<BatchAllWorkflowPayload | null | undefined>>,
    step: WorkflowStep,
): Promise<void> {
    const payload = event.payload ?? {};
    const raceTypes = payload.raceTypes ?? ALL_RACE_TYPES_FOR_BATCH;
    const targets = payload.targets ?? ALL_TARGETS;
    const dateRange = resolveDateRange(payload, event.timestamp);

    const lockAcquired = await acquireLockStep(step, env, event.instanceId);
    if (!lockAcquired) {
        return;
    }

    const allFailures = await runAllRaceTypesWithLock(
        step,
        env,
        raceTypes,
        dateRange,
        targets,
        event.instanceId,
    );

    if (allFailures.length === 0) {
        return;
    }

    await notifyFailuresStep(step, env, allFailures, event.instanceId);
    throw new Error(
        `batch実行が${allFailures.length}件失敗しました: ${allFailures
            .map((failure) => `${failure.raceType}-${failure.target}`)
            .join(', ')}`,
    );
}
