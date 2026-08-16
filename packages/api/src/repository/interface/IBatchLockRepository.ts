/**
 * batch実行の排他制御ロック（`batch_run_lock`）専用のデータアクセス（CICD-73/CONC-03）。
 */
export interface IBatchLockRepository {
    /**
     * ロックの取得を試みる。空き（workflowInstanceIdがnull）、または保持中の
     * ロックがstaleBeforeIso時点より古い（放棄されたとみなす）場合のみ取得できる。
     * @param instanceId 取得するWorkflowインスタンスID
     * @param nowIso 現在時刻（ISO8601）
     * @param staleBeforeIso この時刻より古いstartedAtは放棄済みとみなして上書きを許可する
     * @returns 取得できたか
     */
    acquire: (
        instanceId: string,
        nowIso: string,
        staleBeforeIso: string,
    ) => Promise<boolean>;

    /**
     * ロックを解放する。instanceIdが現在の保持者と一致する場合のみ解放する
     * （stale判定で別インスタンスに奪われた後の誤解放を防ぐため）。
     * @param instanceId 解放するWorkflowインスタンスID
     */
    release: (instanceId: string) => Promise<void>;
}
