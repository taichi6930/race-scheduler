import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { eq, inArray, lt, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { pushNotificationRequest, pushSubscription } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import {
    decryptPushAuth,
    encryptPushAuth,
} from '../../utility/pushAuthEncryption';
import type {
    IPushSubscriptionRepository,
    PushSubscriptionRecord,
} from '../interface/IPushSubscriptionRepository';

/**
 * Web Push 購読リポジトリの DB 実装。
 */
@LogAllMethods
@injectable()
export class PushSubscriptionRepository implements IPushSubscriptionRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async upsert(record: PushSubscriptionRecord): Promise<void> {
        // SEC-053: PUSH_AUTH_ENCRYPTION_KEY設定時はauthを暗号化して保存する
        // （未設定時はencryptPushAuthが平文をそのまま返す）。
        const encryptedAuth = await encryptPushAuth(record.auth);
        await this.drizzleGateway.db
            .insert(pushSubscription)
            .values({ ...record, auth: encryptedAuth })
            .onConflictDoUpdate({
                target: pushSubscription.id,
                set: {
                    endpoint: record.endpoint,
                    p256dh: record.p256dh,
                    auth: encryptedAuth,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                    // secretHash未指定（既存行の検証済みupsert）の場合は
                    // 既存の secret_hash を上書きしない（push-ownership-design.md §2.4）。
                    ...(record.secretHash === undefined
                        ? {}
                        : { secretHash: record.secretHash }),
                },
            });
    }

    public async findSecretHashById(
        id: string,
    ): Promise<string | null | undefined> {
        const rows = await this.drizzleGateway.db
            .select({ secretHash: pushSubscription.secretHash })
            .from(pushSubscription)
            .where(eq(pushSubscription.id, id));
        return rows[0]?.secretHash;
    }

    public async remove(id: string): Promise<void> {
        await this.drizzleGateway.db
            .delete(pushSubscription)
            .where(eq(pushSubscription.id, id));
    }

    public async removeWithDependentRequests(id: string): Promise<void> {
        // CONC-08: 購読と紐づく予約の削除を1つのD1バッチにまとめ、
        // 片方だけ成功して残存する不整合状態を防ぐ（D1/SQLiteは外部キーの
        // カスケード削除を強制しないため、web-push-design.md §3と同じ理由で
        // アプリコードから明示的に両テーブルを削除する）。
        await this.drizzleGateway.db.batch([
            this.drizzleGateway.db
                .delete(pushNotificationRequest)
                .where(eq(pushNotificationRequest.subscriptionId, id)),
            this.drizzleGateway.db
                .delete(pushSubscription)
                .where(eq(pushSubscription.id, id)),
        ]);
    }

    public async removeWithDependentRequestsBatch(
        ids: string[],
    ): Promise<void> {
        if (ids.length === 0) return;
        // CONC-08と同じ理由（外部キーのカスケード削除が無いため両テーブルを
        // アプリコードから明示的に削除する）を、CFDATA-06で複数購読分まとめて行う。
        await this.drizzleGateway.db.batch([
            this.drizzleGateway.db
                .delete(pushNotificationRequest)
                .where(inArray(pushNotificationRequest.subscriptionId, ids)),
            this.drizzleGateway.db
                .delete(pushSubscription)
                .where(inArray(pushSubscription.id, ids)),
        ]);
    }

    public async findById(
        id: string,
    ): Promise<PushSubscriptionRecord | undefined> {
        const rows = await this.drizzleGateway.db
            .select({
                id: pushSubscription.id,
                endpoint: pushSubscription.endpoint,
                p256dh: pushSubscription.p256dh,
                auth: pushSubscription.auth,
            })
            .from(pushSubscription)
            .where(eq(pushSubscription.id, id));
        const row = rows[0];
        if (!row) return;
        // SEC-053: 保存時に暗号化されている場合のみ復号する（decryptPushAuthが判定）。
        return { ...row, auth: await decryptPushAuth(row.auth) };
    }

    public async incrementFailureCount(
        id: string,
    ): Promise<number | undefined> {
        const rows = await this.drizzleGateway.db
            .update(pushSubscription)
            .set({
                failureCount: sql`${pushSubscription.failureCount} + 1`,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(pushSubscription.id, id))
            .returning({ failureCount: pushSubscription.failureCount });
        return rows[0]?.failureCount;
    }

    public async incrementFailureCountBatch(
        ids: string[],
    ): Promise<Map<string, number>> {
        if (ids.length === 0) return new Map();
        // ponytail: 重複IDは1回分の加算にまとめる（IPushSubscriptionRepository
        // のJSDoc参照）。
        const distinctIds = [...new Set(ids)];
        const rows = await this.drizzleGateway.db
            .update(pushSubscription)
            .set({
                failureCount: sql`${pushSubscription.failureCount} + 1`,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(inArray(pushSubscription.id, distinctIds))
            .returning({
                id: pushSubscription.id,
                failureCount: pushSubscription.failureCount,
            });
        return new Map(rows.map((row) => [row.id, row.failureCount]));
    }

    public async resetFailureCount(id: string): Promise<void> {
        await this.drizzleGateway.db
            .update(pushSubscription)
            .set({
                failureCount: 0,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(pushSubscription.id, id));
    }

    public async resetFailureCountBatch(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.drizzleGateway.db
            .update(pushSubscription)
            .set({
                failureCount: 0,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(inArray(pushSubscription.id, ids));
    }

    public async purgeStale(retentionDays: number): Promise<number> {
        const staleRows = await this.drizzleGateway.db
            .select({ id: pushSubscription.id })
            .from(pushSubscription)
            .where(
                lt(
                    pushSubscription.updatedAt,
                    sql`datetime('now', ${`-${retentionDays} days`})`,
                ),
            );
        const staleIds = staleRows.map((row) => row.id);
        await this.removeWithDependentRequestsBatch(staleIds);
        return staleIds.length;
    }
}
