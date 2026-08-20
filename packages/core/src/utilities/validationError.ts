export class ValidationError extends Error {
    public readonly status: number;
    public index?: number;

    /**
     * @param message - エラーメッセージ
     * @param status - HTTPステータスコード
     * @param options - 標準 Error と同じオプション。catch節から詰め替える際に
     *   `{ cause: error }` を渡すと元の例外を辿れる
     */
    public constructor(message: string, status = 400, options?: ErrorOptions) {
        super(message, options);
        this.name = 'ValidationError';
        this.status = status;
    }
}
