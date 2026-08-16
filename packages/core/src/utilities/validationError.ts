export class ValidationError extends Error {
    public readonly status: number;
    public index?: number;

    public constructor(message: string, status = 400) {
        super(message);
        this.name = 'ValidationError';
        this.status = status;
    }
}
