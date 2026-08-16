/**
 * batchAllWorkflowLogic.ts (runBatchAllWorkflow) UT
 *
 * `step.do` をコールバックへの単純委譲としてモックし、`runBatchAllWorkflow` が
 * 全 raceType × target の組み合わせを正しい step 名・順序で実行することを検証する。
 * fetch は orchestrator.test.ts と同じパターンで全て成功応答にモックし、
 * 実際の HTTP 呼び出し先（scraping/main/calendar/api の batch-lock/GitHub API）に
 * 到達することを確認する。
 *
 * ## デシジョンテーブル
 *
 * | #    | 検証内容                                                    | 期待結果                          |
 * |------|--------------------------------------------------------------|-------------------------------------|
 * | T-01 | 6 raceType × 3 target 分 + ロック取得/解放 step.do が呼ばれる | 19件（BOATRACEのraceは暫定スキップのため6×3-1）、raceType×target単位で重複なし。先頭がacquire・末尾がrelease |
 * | T-02 | 各 raceType の step 順序が place → race → calendar            | 各 raceType 内でこの順に呼ばれる    |
 * | T-03 | payload.raceTypesで1種別のみ指定（CICD-73/CONC-03統合）       | 指定raceType分3件 + ロック取得/解放2件 |
 * | T-04 | payload.targetsで1ターゲットのみ指定                          | 指定target分の5件（BOATRACEを除く5raceType）+ ロック取得/解放2件 |
 * | T-05 | payload.startDate/finishDateを指定                            | 全raceTypeの全stepが指定日付で呼ばれる（NAR延長等が適用されない） |
 * | T-06 | 1つのstep（NAR-race）が失敗（リトライ上限到達後）             | 例外を投げず継続し、同raceTypeの他target・release・notifyは実行される。最終的に集約エラーで例外が伝播する |
 * | T-07 | ロック取得(acquire-batch-lock)が失敗（他インスタンス実行中）  | 以降のstepは一切呼ばれず即終了（releaseも呼ばれない） |
 * | T-08 | 複数raceTypeのうち1raceTypeの1stepのみ失敗（OBS-013独立性）   | 他raceTypeは失敗の影響を受けず全stepが実行される |
 * | T-09 | GITHUB_TOKEN設定時に失敗が発生                                 | GitHub Issues APIへのfetch（Issue作成）が呼ばれる |
 * | T-10 | BOATRACEのrace同期の暫定スキップ（2026-08-05, `/sync/race`のD1エラーが本番修正後も再現するため） | `boatrace-race` は呼ばれない。`boatrace-place`/`boatrace-calendar` は通常どおり呼ばれる |
 *
 * ### resolveDateRange（片方のみ指定時のフォールバック）
 * | #    | 検証内容                                                    | 期待結果                          |
 * |------|--------------------------------------------------------------|-------------------------------------|
 * | R-01 | startDateのみ指定（finishDate省略）                          | computeScheduledDateRange相当にフォールバック |
 * | R-02 | finishDateのみ指定（startDate省略）                          | computeScheduledDateRange相当にフォールバック |
 * | R-03 | 両方省略                                                     | computeScheduledDateRange相当にフォールバック |
 * | R-04 | 両方指定                                                     | buildFixedDateRange相当（拡張なし）  |
 */

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
// import type のため実行時にはモジュール解決されない（batchAllWorkflowLogic.ts と同じ理由）。
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import type { CloudFlareEnv } from '@race-schedule/core';
import { EnvStore, RaceType } from '@race-schedule/core';

import {
    resolveDateRange,
    runBatchAllWorkflow,
} from '../../../src/workflows/batchAllWorkflowLogic';
import { computeScheduledDateRange } from '../../../src/workflows/dateRange';

const emptyOkBody = {
    places: [],
    races: [],
    successCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    failureCount: 0,
    failures: [],
};

/**
 * URLのホスト名が`api.github.com`かつパスが`/issues`を含むかを判定する。
 * `url.includes('api.github.com')`のような部分文字列一致は、
 * `evil.com/api.github.com`や`api.github.com.evil.com`のような文字列にも
 * マッチしてしまう（CodeQL `js/incomplete-url-substring-sanitization`）ため、
 * `URL`でパースしてホスト名を厳密に比較する。
 * @param url 判定対象のURL文字列
 */
function isGithubIssuesApiUrl(url: string): boolean {
    const parsed = new URL(url);
    return (
        parsed.hostname === 'api.github.com' &&
        parsed.pathname.includes('/issues')
    );
}

/**
 * fetch をURLパスで判別してモックする。
 * - `/internal/batch-lock/acquire` → `{ acquired }`（`lockAcquired`引数で制御）
 * - `/internal/batch-lock/release` → `{ success: true }`
 * - `api.github.com/.../issues`（GET） → `[]`（既存Issue無し）
 * - `api.github.com/.../issues`（POST） → `{ number: 123 }`（Issue作成成功）
 * - それ以外（scraping/main/calendar） → 空のバッチ実行結果
 * @param lockAcquired acquire-batch-lockの応答（既定true）
 */
const installSuccessFetchSpy = (
    lockAcquired = true,
): ReturnType<typeof spyOn> => {
    const spy = spyOn(globalThis, 'fetch');
    spy.mockImplementation((async (input: URL | string, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/internal/batch-lock/acquire')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ acquired: lockAcquired }),
            };
        }
        if (url.includes('/internal/batch-lock/release')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
            };
        }
        if (isGithubIssuesApiUrl(url)) {
            if (init?.method === 'POST') {
                return {
                    ok: true,
                    status: 201,
                    json: async () => ({ number: 123 }),
                };
            }
            return { ok: true, status: 200, json: async () => [] };
        }
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify(emptyOkBody),
            json: async () => emptyOkBody,
        };
    }) as unknown as typeof fetch);
    return spy;
};

/** step.do をコールバックへ単純委譲し、呼び出された step 名を記録するモック。 */
function createRecordingStep(): { step: WorkflowStep; calledNames: string[] } {
    const calledNames: string[] = [];
    const step = {
        do: async (
            name: string,
            _config: unknown,
            callback: () => Promise<unknown>,
        ) => {
            calledNames.push(name);
            return callback();
        },
    } as unknown as WorkflowStep;
    return { step, calledNames };
}

/**
 * 指定した step 名の呼び出し時に例外を投げる step.do モック
 * （実際の`step.do`がリトライ上限到達後に例外を投げる状況を再現する）。
 */
function createFailingStep(failingStepName: string): {
    step: WorkflowStep;
    calledNames: string[];
} {
    const calledNames: string[] = [];
    const step = {
        do: async (
            name: string,
            _config: unknown,
            callback: () => Promise<unknown>,
        ) => {
            calledNames.push(name);
            if (name === failingStepName) {
                throw new Error(`forced failure: ${name}`);
            }
            return callback();
        },
    } as unknown as WorkflowStep;
    return { step, calledNames };
}

const mockEnv = {
    SCRAPING_API_URL: 'http://scraping.test',
    MAIN_API_URL: 'http://main.test',
    CALENDAR_API_URL: 'http://calendar.test',
} as unknown as CloudFlareEnv;

const mockEvent = {
    payload: undefined,
    timestamp: new Date('2026-08-15T00:00:00+09:00'),
    instanceId: 'test-instance',
    workflowName: 'batch-all-workflow-test',
} as unknown as Readonly<WorkflowEvent<unknown>>;

describe('runBatchAllWorkflow', () => {
    afterEach(() => {
        // EnvStore はモジュールレベルのシングルトンのため、他テストへの
        // 状態汚染（getApiConfig() が process.env でなく EnvStore を誤って
        // 参照し続ける等）を防ぐために毎回リセットする（router.test.ts /
        // types.test.ts と同じ方針）。
        EnvStore.reset();
    });

    it('T-01_全raceType×targetの組み合わせ_ロック取得解放を含めstep.doが19回呼ばれる', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step, calledNames } = createRecordingStep();

        try {
            // Act
            await runBatchAllWorkflow(mockEnv, mockEvent, step);

            // Assert: BOATRACEのraceは暫定スキップのため6raceType×3target-1件=19件
            expect(calledNames).toHaveLength(19);
            expect(new Set(calledNames).size).toBe(19);
            expect(calledNames.at(0)).toBe('acquire-batch-lock');
            expect(calledNames.at(-1)).toBe('release-batch-lock');
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-02_各raceTypeでplace_race_calendarの順にstep.doが呼ばれる', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step, calledNames } = createRecordingStep();

        try {
            // Act
            await runBatchAllWorkflow(mockEnv, mockEvent, step);

            // Assert
            const jraIndexes = [
                calledNames.indexOf(`${RaceType.JRA}-place`),
                calledNames.indexOf(`${RaceType.JRA}-race`),
                calledNames.indexOf(`${RaceType.JRA}-calendar`),
            ];
            expect(jraIndexes).toEqual([...jraIndexes].sort((a, b) => a - b));
            expect(jraIndexes.every((index) => index !== -1)).toBe(true);
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-03_payload.raceTypesで1種別のみ指定した場合はその3件_ロック2件のみ呼ばれる', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step, calledNames } = createRecordingStep();
        const event = {
            ...mockEvent,
            payload: { raceTypes: [RaceType.NAR] },
        } as unknown as Readonly<WorkflowEvent<unknown>>;

        try {
            // Act
            await runBatchAllWorkflow(mockEnv, event, step);

            // Assert
            expect(calledNames).toEqual([
                'acquire-batch-lock',
                `${RaceType.NAR}-place`,
                `${RaceType.NAR}-race`,
                `${RaceType.NAR}-calendar`,
                'release-batch-lock',
            ]);
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-04_payload.targetsで1ターゲットのみ指定した場合はBOATRACEを除く5raceType分_ロック2件のみ呼ばれる', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step, calledNames } = createRecordingStep();
        const event = {
            ...mockEvent,
            payload: { targets: ['race'] },
        } as unknown as Readonly<WorkflowEvent<unknown>>;

        try {
            // Act
            await runBatchAllWorkflow(mockEnv, event, step);

            // Assert: BOATRACEのraceは暫定スキップのため対象外
            expect(calledNames).toHaveLength(7);
            const raceStepNames = calledNames.filter((name) =>
                name.endsWith('-race'),
            );
            expect(raceStepNames).toHaveLength(5);
            expect(raceStepNames).not.toContain(`${RaceType.BOATRACE}-race`);
            expect(calledNames.at(0)).toBe('acquire-batch-lock');
            expect(calledNames.at(-1)).toBe('release-batch-lock');
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-05_payload.startDate_finishDateを指定した場合は全stepが指定日付で呼ばれる', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step } = createRecordingStep();
        const event = {
            ...mockEvent,
            payload: {
                raceTypes: [RaceType.NAR],
                startDate: '2026-09-01',
                finishDate: '2026-09-02',
            },
        } as unknown as Readonly<WorkflowEvent<unknown>>;

        try {
            // Act
            await runBatchAllWorkflow(mockEnv, event, step);

            // Assert: race step（NAR）が scraping の POST /sync/race を
            // 固定日付（NAR延長された2026-09-04等ではない）のボディで呼ぶこと
            // （NARは`place`データを介さず月間CSVから直接開催日を列挙するため、
            // main API の /place は呼ばれない）
            const narSyncCall = fetchSpy.mock.calls.find((call: unknown[]) =>
                String(call[0]).includes('scraping.test/sync/race'),
            );
            expect(narSyncCall).toBeDefined();
            const requestInit = narSyncCall?.[1] as RequestInit;
            const requestBody = JSON.parse(
                requestInit.body as string,
            ) as Record<string, unknown>;
            expect(requestBody).toEqual({
                raceType: 'nar',
                startDate: '2026-09-01',
                finishDate: '2026-09-02',
            });
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-06_1つのstepが失敗しても継続し_最終的に集約エラーが伝播すること', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step, calledNames } = createFailingStep(`${RaceType.NAR}-race`);
        const event = {
            ...mockEvent,
            payload: { raceTypes: [RaceType.NAR] },
        } as unknown as Readonly<WorkflowEvent<unknown>>;

        try {
            // Act & Assert: 失敗したnar-raceの後もnar-calendarが実行され、
            // release-batch-lock・notify-batch-failuresを経て集約エラーが投げられる
            await expect(
                runBatchAllWorkflow(mockEnv, event, step),
            ).rejects.toThrow(/batch実行が1件失敗しました.*nar-race/);
            expect(calledNames).toEqual([
                'acquire-batch-lock',
                `${RaceType.NAR}-place`,
                `${RaceType.NAR}-race`,
                `${RaceType.NAR}-calendar`,
                'release-batch-lock',
                'notify-batch-failures',
            ]);
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-07_ロック取得に失敗した場合_以降のstepは一切呼ばれず即終了する', async () => {
        // Arrange: acquire-batch-lockが{acquired:false}を返す
        // （Cloudflareのネイティブcronトリガーがrouter.tsの事前チェックを経由せず
        // 直接Workflowを起動した場合でも、他インスタンス実行中なら安全に何もしない
        // ことを検証する）
        const fetchSpy = installSuccessFetchSpy(false);
        const { step, calledNames } = createRecordingStep();

        try {
            // Act
            await runBatchAllWorkflow(mockEnv, mockEvent, step);

            // Assert
            expect(calledNames).toEqual(['acquire-batch-lock']);
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-08_複数raceTypeのうち1raceTypeの1stepのみ失敗しても他raceTypeは全step実行される', async () => {
        // Arrange: JRAのplaceのみ失敗させ、NAR（他raceType）は影響を受けないことを
        // 検証する（OBS-013: raceType単位で失敗が独立している設計方針）
        const fetchSpy = installSuccessFetchSpy();
        const { step, calledNames } = createFailingStep(
            `${RaceType.JRA}-place`,
        );
        const event = {
            ...mockEvent,
            payload: { raceTypes: [RaceType.JRA, RaceType.NAR] },
        } as unknown as Readonly<WorkflowEvent<unknown>>;

        try {
            // Act & Assert
            await expect(
                runBatchAllWorkflow(mockEnv, event, step),
            ).rejects.toThrow(/batch実行が1件失敗しました/);
            expect(calledNames).toEqual([
                'acquire-batch-lock',
                `${RaceType.JRA}-place`,
                `${RaceType.JRA}-race`,
                `${RaceType.JRA}-calendar`,
                `${RaceType.NAR}-place`,
                `${RaceType.NAR}-race`,
                `${RaceType.NAR}-calendar`,
                'release-batch-lock',
                'notify-batch-failures',
            ]);
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-09_GITHUB_TOKEN設定時に失敗が発生するとGitHub_Issue作成のfetchが呼ばれる', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step } = createFailingStep(`${RaceType.NAR}-race`);
        const envWithToken = {
            ...mockEnv,
            GITHUB_TOKEN: 'test-github-token',
        } as unknown as CloudFlareEnv;
        const event = {
            ...mockEvent,
            payload: { raceTypes: [RaceType.NAR] },
        } as unknown as Readonly<WorkflowEvent<unknown>>;

        try {
            // Act
            await expect(
                runBatchAllWorkflow(envWithToken, event, step),
            ).rejects.toThrow();

            // Assert: Issue作成（POST .../issues）が呼ばれたこと
            const githubCreateCalls = fetchSpy.mock.calls.filter(
                (call: unknown[]) => {
                    const url = String(call[0]);
                    const init = call[1] as RequestInit | undefined;
                    return isGithubIssuesApiUrl(url) && init?.method === 'POST';
                },
            );
            expect(githubCreateCalls).toHaveLength(1);
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('T-10_BOATRACEのrace同期は暫定スキップされplace_calendarのみ呼ばれる', async () => {
        // Arrange
        const fetchSpy = installSuccessFetchSpy();
        const { step, calledNames } = createRecordingStep();
        const event = {
            ...mockEvent,
            payload: { raceTypes: [RaceType.BOATRACE] },
        } as unknown as Readonly<WorkflowEvent<unknown>>;

        try {
            // Act
            await runBatchAllWorkflow(mockEnv, event, step);

            // Assert
            expect(calledNames).toEqual([
                'acquire-batch-lock',
                `${RaceType.BOATRACE}-place`,
                `${RaceType.BOATRACE}-calendar`,
                'release-batch-lock',
            ]);
        } finally {
            fetchSpy.mockRestore();
        }
    });
});

describe('resolveDateRange', () => {
    const timestamp = new Date('2026-08-15T00:00:00+09:00');
    const scheduled = computeScheduledDateRange(timestamp);

    it('R-01_startDateのみ指定_computeScheduledDateRangeにフォールバックする', () => {
        // Act
        const result = resolveDateRange({ startDate: '2026-09-01' }, timestamp);

        // Assert
        expect(result.startDate).toBe(scheduled.startDate);
        expect(result.finishDate).toBe(scheduled.finishDate);
    });

    it('R-02_finishDateのみ指定_computeScheduledDateRangeにフォールバックする', () => {
        // Act
        const result = resolveDateRange(
            { finishDate: '2026-09-02' },
            timestamp,
        );

        // Assert
        expect(result.startDate).toBe(scheduled.startDate);
        expect(result.finishDate).toBe(scheduled.finishDate);
    });

    it('R-03_両方省略_computeScheduledDateRangeにフォールバックする', () => {
        // Act
        const result = resolveDateRange({}, timestamp);

        // Assert
        expect(result.startDate).toBe(scheduled.startDate);
        expect(result.finishDate).toBe(scheduled.finishDate);
    });

    it('R-04_両方指定_buildFixedDateRange相当で拡張されない', () => {
        // Act
        const result = resolveDateRange(
            { startDate: '2026-09-01', finishDate: '2026-09-02' },
            timestamp,
        );

        // Assert
        expect(result.startDate).toBe('2026-09-01');
        expect(result.finishDate).toBe('2026-09-02');
        expect(result.calendarFinishDate).toBe('2026-09-02');
        expect(result.raceFinishDateFor(RaceType.NAR)).toBe('2026-09-02');
    });
});
