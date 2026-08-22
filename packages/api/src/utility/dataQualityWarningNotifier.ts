/**
 * データ品質警告監視の通知ロジック。
 *
 * `data_quality_warning_log`（PlaceRepository.fetch 等でマッピング失敗時に
 * ベストエフォートで記録される警告）を直近ウィンドウで集計した結果を見て、
 * 1件以上あればGitHub Issueを作成し、0件（解消）になれば既存Issueをコメント後に
 * Closeする。
 *
 * Issue検索→復旧/異常分岐→addComment/createIssue/closeIssueという制御フロー自体は
 * `errorMonitorNotifier.ts`と同型のため`@race-schedule/core`の`syncGithubIssueByCondition`に
 * 共通化している（QRUN-01: batchからも使えるよう core へ移設済み）。
 */

import type { IGithubIssueGateway } from '@race-schedule/core';
import {
    syncGithubIssueByCondition,
    toJstISOString,
} from '@race-schedule/core';

/**
 * UTC ISO8601文字列をJST併記の表示用文字列に変換する（QJST-13）。
 * 運用者はJSTで追うため、UTC表記のみだと毎回+9時間の変換が必要だった。
 * @param iso - UTC ISO8601文字列
 */
function withJst(iso: string): string {
    return `${iso} (${toJstISOString(new Date(iso))} JST)`;
}

/** 1回分のデータ品質警告チェック結果。 */
export interface DataQualityWarningCheckResult {
    /** 記録元の識別子（例: 'place_mapper'） */
    source: string;
    /** 集計期間内の警告件数 */
    count: number;
    /** 警告メッセージのサンプル（先頭数件、Issue本文に埋め込む） */
    sampleMessages: string[];
    /** 集計期間の開始時刻（ISO8601、UTC） */
    windowStartIso: string;
    /** 集計期間の終了時刻（ISO8601、UTC） */
    windowEndIso: string;
}

/**
 * 対象sourceの警告監視Issueタイトル（Issue検索・新規作成の両方でキーとして使う）。
 * @param source - 記録元の識別子
 */
function issueTitleFor(source: string): string {
    return `[データ品質] ${source} で不正なデータを検知`;
}

/**
 * 異常検知時のIssue本文を組み立てる。
 * @param result
 */
function buildAlertBody(result: DataQualityWarningCheckResult): string {
    const sampleList = result.sampleMessages
        .map((message) => `- ${message}`)
        .join('\n');
    return `## データ品質の警告を検知しました

- 記録元: \`${result.source}\`
- 期間: ${withJst(result.windowStartIso)} 〜 ${withJst(result.windowEndIso)}
- 件数: ${result.count}

### サンプル（最大5件）
${sampleList}

このIssueは \`data_quality_warning_log\` テーブルの直近ウィンドウ集計により自動作成されました。件数が0件になれば次回チェック時に自動でCloseされます。

_このIssueは api Worker の scheduled ハンドラ（データ品質警告監視）により自動作成されました。_`;
}

/**
 * 復旧確認時のコメント本文を組み立てる。
 * @param result
 */
function buildRecoveryComment(result: DataQualityWarningCheckResult): string {
    return `直近1時間（${withJst(result.windowStartIso)} 〜 ${withJst(result.windowEndIso)}）は${result.source}の警告が検知されなかったため、自動的にCloseします。再発した場合は新しいIssueが作成されます。`;
}

/**
 * データ品質警告チェックの結果をGitHub Issueへ同期する（作成・コメント追加・Close）。
 * @param result - データ品質警告チェックの結果
 * @param gateway - GitHub Issues ゲートウェイ
 * @param token - GitHub API トークン
 */
export async function syncDataQualityWarningIssue(
    result: DataQualityWarningCheckResult,
    gateway: IGithubIssueGateway,
    token: string,
): Promise<void> {
    return syncGithubIssueByCondition(result, gateway, token, {
        logPrefix: '[dataQualityWarningNotifier]',
        title: (r) => issueTitleFor(r.source),
        isRecovered: (r) => r.count === 0,
        keyPrefix: (r) => `${r.source}: `,
        noOpReason: () => '警告なし',
        recoveredReason: () => '警告解消を確認し',
        buildAlertBody,
        buildRecoveryComment,
    });
}
