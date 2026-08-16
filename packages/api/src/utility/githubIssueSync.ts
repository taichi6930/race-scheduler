/**
 * 「異常検知→Issue作成／復旧→Close」を行う通知の共通制御フロー。
 *
 * dataFreshnessNotifier/errorMonitorNotifier/uptimeCheckNotifierの3つが
 * 同型の「固定タイトルでIssue検索→復旧/異常で分岐→addComment/createIssue/closeIssue」
 * ロジックを個別実装していたため、制御フローをここに集約し、各ファイルは
 * タイトル・本文生成・復旧判定などのドメイン固有部分だけを渡す。
 */

import type {
    GithubIssueSummary,
    IGithubIssueGateway,
} from '@race-schedule/core';
import { appLogger } from '@race-schedule/core';

/** GitHub Issue同期の挙動を定義するハンドラ群（ドメイン固有部分）。 */
export interface GithubIssueSyncHandlers<T> {
    /** ログのプレフィックス（例: '[dataFreshnessNotifier]'） */
    logPrefix: string;
    /** Issue検索・作成のキーとなるタイトル */
    title: (result: T) => string;
    /** 復旧（Close対象）かどうか */
    isRecovered: (result: T) => boolean;
    /** ログメッセージの対象キー部分（無ければ空文字。あれば末尾に': 'を含む） */
    keyPrefix: (result: T) => string;
    /** 既存Issue無し・復旧側で出すログの理由部分（末尾の句読点は含まない） */
    noOpReason: (result: T) => string;
    /** Close時ログの理由部分（末尾の読点は含まない） */
    recoveredReason: (result: T) => string;
    /** 異常検知時のIssue本文 */
    buildAlertBody: (result: T) => string;
    /** 復旧確認時のコメント本文 */
    buildRecoveryComment: (result: T) => string;
}

/**
 * 復旧を検知したときの同期処理。
 * 既存Issueが無ければ何もしない。あればコメント追加後にCloseする。
 * @param result
 * @param existing
 * @param gateway
 * @param token
 * @param handlers
 */
async function syncOnRecovery<T>(
    result: T,
    existing: GithubIssueSummary | undefined,
    gateway: IGithubIssueGateway,
    token: string,
    handlers: GithubIssueSyncHandlers<T>,
): Promise<void> {
    if (!existing) {
        appLogger.debug(
            `${handlers.logPrefix} ${handlers.keyPrefix(result)}${handlers.noOpReason(result)}。対象Issueもなし（何もしません）`,
        );
        return;
    }
    await gateway.addComment(
        token,
        existing.number,
        handlers.buildRecoveryComment(result),
    );
    await gateway.closeIssue(token, existing.number);
    appLogger.info(
        `${handlers.logPrefix} ${handlers.keyPrefix(result)}${handlers.recoveredReason(result)}、Issue #${existing.number} をCloseしました`,
    );
}

/**
 * 異常を検知したときの同期処理。
 * 既存Issueがあればコメント追加、無ければ新規作成する。
 * @param result
 * @param existing
 * @param gateway
 * @param token
 * @param handlers
 */
async function syncOnAlert<T>(
    result: T,
    existing: GithubIssueSummary | undefined,
    gateway: IGithubIssueGateway,
    token: string,
    handlers: GithubIssueSyncHandlers<T>,
): Promise<void> {
    const body = handlers.buildAlertBody(result);
    if (existing) {
        await gateway.addComment(token, existing.number, body);
        appLogger.info(
            `${handlers.logPrefix} ${handlers.keyPrefix(result)}既存Issue #${existing.number} にコメントを追加しました`,
        );
        return;
    }
    const issueNumber = await gateway.createIssue(
        token,
        handlers.title(result),
        body,
    );
    appLogger.info(
        `${handlers.logPrefix} ${handlers.keyPrefix(result)}新規Issueを作成しました: #${issueNumber}`,
    );
}

/**
 * チェック結果をGitHub Issueへ同期する（作成・コメント追加・Close）。
 * 失敗しても例外を投げず警告ログのみ出力する（通知処理はベストエフォート）。
 * @param result - チェック結果
 * @param gateway - GitHub Issues ゲートウェイ
 * @param token - GitHub API トークン
 * @param handlers - タイトル・本文生成などドメイン固有の挙動
 */
export async function syncGithubIssueByCondition<T>(
    result: T,
    gateway: IGithubIssueGateway,
    token: string,
    handlers: GithubIssueSyncHandlers<T>,
): Promise<void> {
    try {
        const issues = await gateway.fetchAllOpenIssues(token);
        const title = handlers.title(result);
        const existing = issues.find((issue) => issue.title === title);

        if (handlers.isRecovered(result)) {
            await syncOnRecovery(result, existing, gateway, token, handlers);
            return;
        }
        await syncOnAlert(result, existing, gateway, token, handlers);
    } catch (error) {
        appLogger.warn(`${handlers.logPrefix} 通知処理に失敗しました`, error);
    }
}
