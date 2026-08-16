/** batch実行ロックの取得結果。 */
export interface BatchLockAcquireResult {
    acquired: boolean;
}

/**
 * Batch Lock UseCase Interface
 * batch実行（batch-all cron / batch-race・place・calendar手動）の排他制御
 * （CICD-73/CONC-03）専用。
 */
export interface IBatchLockUsecase {
    acquire: (instanceId: string) => Promise<BatchLockAcquireResult>;
    release: (instanceId: string) => Promise<void>;
}
