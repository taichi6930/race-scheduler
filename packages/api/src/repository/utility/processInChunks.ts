import { chunkArray } from './chunkArray';

/**
 * 配列をチャンクに分割して並列処理する共通ヘルパー。
 * 各チャンクの processChunk 失敗は onChunkError に渡し、他チャンクの処理は継続する
 * （1 チャンクの失敗が他チャンクを止めない）。
 *
 * place / race repository の upsert で重複していた
 * 「chunkSize 分割 → try で batchInsert → catch で failure 集計」ループを共通化する。
 * チャンク間に依存関係が無いため、直列 await ではなく Promise.allSettled で並列実行する
 * （PERF-105。チャンク数に比例していたレイテンシを最速チャンク相当に短縮）。
 * @param items - 処理対象の配列
 * @param chunkSize - 1 チャンクの最大件数
 * @param processChunk - チャンクを処理する関数（成功時の集計もここで行う）
 * @param onChunkError - チャンク処理が失敗したときの処理（失敗集計）
 */
export const processInChunks = async <T>(
    items: T[],
    chunkSize: number,
    processChunk: (chunk: T[]) => Promise<void>,
    onChunkError: (chunk: T[], error: unknown) => void,
): Promise<void> => {
    const chunks = chunkArray(items, chunkSize);

    const results = await Promise.allSettled(
        chunks.map((chunk) => processChunk(chunk)),
    );
    for (const [index, result] of results.entries()) {
        if (result.status === 'rejected') {
            onChunkError(chunks[index], result.reason);
        }
    }
};
