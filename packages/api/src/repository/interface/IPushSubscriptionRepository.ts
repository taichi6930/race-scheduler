/** push_subscription テーブルへの upsert に必要な項目。 */
export interface PushSubscriptionRecord {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    /**
     * 所有権シークレットのハッシュ（push-ownership-design.md §2.1）。
     * 新規発行時のみ指定する。未指定（undefined）の場合、既存行の secret_hash は
     * 変更しない（新規INSERT時はNULLのまま保存される）。
     */
    secretHash?: string;
}

/**
 * Web Push 購読（ブラウザ1つ = 1行）リポジトリのインターフェース定義。
 */
export interface IPushSubscriptionRepository {
    /**
     * 購読を登録する（既に存在する場合は endpoint/keys を更新）。
     * @param record - 保存する購読情報（id は endpoint のハッシュ）
     */
    upsert: (record: PushSubscriptionRecord) => Promise<void>;

    /**
     * 購読を削除する。
     * @param id - 削除対象の購読 ID
     */
    remove: (id: string) => Promise<void>;

    /**
     * 購読と、それに紐づく発火予約（push_notification_request）を
     * 単一のD1バッチでまとめて削除する（CONC-08）。
     * @remarks D1/SQLite は外部キーのカスケード削除を強制しないため、
     * 予約の削除漏れ（片方だけ削除される不整合）を防ぐためバッチ化している。
     * @param id - 削除対象の購読 ID
     */
    removeWithDependentRequests: (id: string) => Promise<void>;

    /**
     * 複数件の購読と、それに紐づく発火予約を単一のD1バッチでまとめて削除する
     * （CFDATA-06、`removeWithDependentRequests` のバッチ版）。
     * @param ids - 削除対象の購読 ID 一覧（空配列の場合は何もしない）
     */
    removeWithDependentRequestsBatch: (ids: string[]) => Promise<void>;

    /**
     * 購読を ID で取得する。
     * @param id - 取得対象の購読 ID
     * @returns 見つかった場合は購読情報、存在しない場合は undefined
     */
    findById: (id: string) => Promise<PushSubscriptionRecord | undefined>;

    /**
     * 連続失敗回数（failure_count）をインクリメントし、更新後の値を返す
     * （OBS-024）。
     * @param id - 対象の購読 ID
     * @returns インクリメント後の連続失敗回数（購読が既に削除済み等で
     * 見つからない場合は undefined）
     */
    incrementFailureCount: (id: string) => Promise<number | undefined>;

    /**
     * 複数件の購読の連続失敗回数を一括でインクリメントし、購読IDごとの
     * 更新後の値を返す（CFDATA-06、`incrementFailureCount` のバッチ版）。
     * @remarks ponytail: 同一チャンク内で同じ購読IDが複数回渡された場合も
     * +1にまとめる（1回のUPDATEで一括加算するため）。`dispatchDue` の
     * チャンクサイズ（`DISPATCH_CONCURRENCY`）程度の粒度では同一購読への
     * 複数予約が同時に失敗するケースはまれで、`MAX_CONSECUTIVE_FAILURES`
     * による無限リトライ防止は次回以降のディスパッチでも積み上がるため
     * 実効性は損なわれない。行ごとに正確な加算量が必要になった場合は
     * SQLのCASE式による可変加算への変更が必要。
     * @param ids - 対象の購読 ID 一覧（空配列の場合は何もしない）
     * @returns 購読IDをキーに、更新後の連続失敗回数を値に持つ Map
     */
    incrementFailureCountBatch: (ids: string[]) => Promise<Map<string, number>>;

    /**
     * 連続失敗回数（failure_count）を0にリセットする（送信成功時に呼ぶ）。
     * @param id - 対象の購読 ID
     */
    resetFailureCount: (id: string) => Promise<void>;

    /**
     * 複数件の購読の連続失敗回数を一括で0にリセットする
     * （CFDATA-06、`resetFailureCount` のバッチ版）。
     * @param ids - 対象の購読 ID 一覧（空配列の場合は何もしない）
     */
    resetFailureCountBatch: (ids: string[]) => Promise<void>;

    /**
     * 購読の所有権シークレットのハッシュ値を取得する
     * （push-ownership-design.md §2.4、SECPUSH-02）。
     * @param id - 対象の購読 ID
     * @returns 行が存在しない場合は `undefined`、行は存在するがシークレットが
     * 未発行の場合は `null`、発行済みの場合はハッシュ値
     */
    findSecretHashById: (id: string) => Promise<string | null | undefined>;

    /**
     * `updated_at` が `retentionDays` 日以上前の購読（＝送信成功・失敗・
     * 再登録のいずれも長期間発生していない未使用購読）と、それに紐づく
     * 発火予約をまとめて削除する（SEC-053、データ最小化）。
     * @remarks 失効（404/410）や連続送信失敗（`MAX_CONSECUTIVE_FAILURES`）
     * による削除とは別軸。あちらは「送信を試みて失敗した」購読、こちらは
     * 「そもそも長期間送信対象にすらならなかった」購読が対象。
     * @param retentionDays - この日数より古い購読を削除対象とする
     * @returns 削除した購読件数
     */
    purgeStale: (retentionDays: number) => Promise<number>;
}
