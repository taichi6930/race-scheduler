/**
 * knownCoverageArtifacts.ts
 *
 * bun のカバレッジ計測が構造的に100%へ到達できない既知のファイルの許容リスト。
 * `test-gap-analysis.ts` の出力コメント（パターン2・3）で説明されている
 * インストゥルメンテーション由来の恒久的な未検出であり、テスト追加では解消できない:
 *
 * - `packages/batch/src/cli.ts`: `if (import.meta.main)` ブロックは `Bun.spawnSync`
 *   によるサブプロセス実行でしか到達できず、親プロセスの coverage instrumentation が
 *   子プロセスの実行を観測できないため常に未カバー扱いになる（`cli.test.ts` の
 *   E2Eテストで機能的には検証済み）。
 * - `packages/api/src/router.ts`: `registerDebugRoutes` の `} catch (error) {` 行が、
 *   分岐自体は `router.coverage.test.ts` の T-06（throw→500）で実行されているにも
 *   関わらず bun のカバレッジ計測で 0 カウントと報告される（switch/catch の
 *   ヘッダ行に対する既知の計測アーティファクト）。
 * - `packages/batch/src/client/http.ts`: `fetchWithTimeout` の `for` ループの
 *   閉じ括弧行が、H-09/H-10（`http.test.ts`）でループが2回以上反復し実際には
 *   実行されているにも関わらず 0 カウントと報告される（ブロックの閉じ括弧に対する
 *   既知の計測アーティファクト、上記 router.ts の catch ヘッダ行と同型）。
 *   もう1行（ループ直後の `throw lastError;`）は、ループが常に内部で throw/return
 *   するため型チェッカーを満たすためだけに存在する防御的で到達不能なコード
 *   （`isLastAttempt` が `attempt === maxRetries` を捕捉するため、ループが
 *   全反復を消化してこの行へフォールスルーすることは無い）。
 * - `packages/scraping/src/utility/unzip.ts`: `findEndOfCentralDirectory` の
 *   `for` ループ内 `if` ブロックの閉じ括弧行が、EOCDシグネチャが必ず見つかる
 *   正常系テスト（T-01〜T-04, T-08, T-09）で毎回実行されているにも関わらず
 *   0 カウントと報告される（`if` ブロック閉じ括弧行に対する既知の計測アーティファクト、
 *   上記 http.ts の `for` ループ閉じ括弧行と同型。`continue` を使った書き方に変えても
 *   閉じ括弧行自体が移動するだけで同じ現象が再現することを確認済み）。
 *
 * `check-patch-coverage.ts`（PR単位のpatchゲート）と `check-coverage-baseline.ts`
 * （main push後のプロジェクト全体ゲート）の両方がこのリストを共有する。片方だけ
 * 更新して他方が追随せず本番でだけ落ちる、という事故（PR #2118 参照）を防ぐため、
 * 新しい既知アーティファクトを追加する際は必ずこのファイルを更新すること。
 *
 * `funcsPct === 100`（全関数は実行されている）を必須条件にすることで、真に未実行の
 * 関数を含む新規ギャップが紛れ込んだ場合はこの許可リストでは救済されずブロックされる
 * ようにしている。
 */

export interface GapFile {
    file: string;
    funcsPct: number;
    linesPct: number;
    uncoveredLines: string;
}

const KNOWN_INSTRUMENTATION_ARTIFACT_FILES = new Set([
    'packages/batch/src/cli.ts',
    'packages/api/src/router.ts',
    'packages/batch/src/client/http.ts',
]);

export const isKnownInstrumentationArtifact = (gapFile: GapFile): boolean =>
    KNOWN_INSTRUMENTATION_ARTIFACT_FILES.has(gapFile.file) &&
    gapFile.funcsPct === 100;
