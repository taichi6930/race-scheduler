import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { and, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { pushNotificationRequest, pushSubscription } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import { decryptPushAuth } from '../../utility/pushAuthEncryption';
import type {
    DuePushRequestRecord,
    IPushRequestRepository,
    PushRequestRecord,
} from '../interface/IPushRequestRepository';

/** fetchDue で SELECT する列一覧。 */
const DUE_PUSH_REQUEST_COLUMNS = {
    id: pushNotificationRequest.id,
    subscriptionId: pushNotificationRequest.subscriptionId,
    raceId: pushNotificationRequest.raceId,
    fireAtMs: pushNotificationRequest.fireAtMs,
    title: pushNotificationRequest.title,
    body: pushNotificationRequest.body,
    url: pushNotificationRequest.url,
    endpoint: pushSubscription.endpoint,
    p256dh: pushSubscription.p256dh,
    auth: pushSubscription.auth,
};

/**
 * Web Push 発火予約リポジトリの DB 実装。
 */
@LogAllMethods
@injectable()
export class PushRequestRepository implements IPushRequestRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async upsert(record: PushRequestRecord): Promise<void> {
        await this.drizzleGateway.db
            .insert(pushNotificationRequest)
            .values({
                id: record.id,
                subscriptionId: record.subscriptionId,
                raceId: record.raceId,
                fireAtMs: record.fireAtMs,
                title: record.title,
                body: record.body,
                url: record.url ?? null,
            })
            .onConflictDoUpdate({
                target: pushNotificationRequest.id,
                set: {
                    fireAtMs: record.fireAtMs,
                    title: record.title,
                    body: record.body,
                    url: record.url ?? null,
                    // 再登録（例: 通知タイミング変更による再スケジュール）は
                    // 既に送信済みでも未送信状態に戻す（冪等な上書きの契約）。
                    sentAt: null,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    public async remove(id: string): Promise<void> {
        await this.drizzleGateway.db
            .delete(pushNotificationRequest)
            .where(eq(pushNotificationRequest.id, id));
    }

    public async removeBySubscriptionId(subscriptionId: string): Promise<void> {
        await this.drizzleGateway.db
            .delete(pushNotificationRequest)
            .where(eq(pushNotificationRequest.subscriptionId, subscriptionId));
    }

    /**
     * 期限到来かつ未送信の候補 id 一覧を求める。
     * @remarks
     * CONC-01: この時点の結果はあくまで「候補」であり、まだ何も確保していない。
     * 実際の排他制御は `claimDueIds` の UPDATE 側（`sentAt IS NULL` を条件に含む
     * compare-and-swap）が担うため、ここで得た候補と実際にクレームできた集合が
     * 一致しなくても（他プロセスが先に取った場合）安全性は損なわれない。
     * @param nowMs - 現在時刻（epoch ms）
     * @param limit - 取得する最大件数
     */
    private async selectDueCandidateIds(
        nowMs: number,
        limit: number,
    ): Promise<string[]> {
        const rows = await this.drizzleGateway.db
            .select({ id: pushNotificationRequest.id })
            .from(pushNotificationRequest)
            .where(
                and(
                    isNull(pushNotificationRequest.sentAt),
                    lte(pushNotificationRequest.fireAtMs, nowMs),
                ),
            )
            .orderBy(pushNotificationRequest.fireAtMs)
            .limit(limit);
        return rows.map((row) => row.id);
    }

    /**
     * 候補 id のうち、まだ未送信のままの行だけをアトミックに確保（sentAt を設定）し、
     * 実際に確保できた id 一覧を返す。
     * @remarks
     * CONC-01: `sentAt IS NULL` を WHERE に含めた UPDATE は、この呼び出しと同時に
     * 実行された他の呼び出し（cron の毎分実行と `POST /push/dispatch` の手動実行が
     * 重なった場合等）に対する compare-and-swap になる。既に他プロセスが先に
     * クレーム済みの行は `sentAt IS NULL` を満たさなくなっているため更新されず、
     * `.returning()` で返る id にも含まれない（＝二重送信されない）。
     * @param candidateIds - selectDueCandidateIds で得た候補 id 一覧
     */
    private async claimDueIds(candidateIds: string[]): Promise<string[]> {
        if (candidateIds.length === 0) return [];
        const claimed = await this.drizzleGateway.db
            .update(pushNotificationRequest)
            .set({
                sentAt: sql`CURRENT_TIMESTAMP`,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(
                and(
                    inArray(pushNotificationRequest.id, candidateIds),
                    isNull(pushNotificationRequest.sentAt),
                ),
            )
            .returning({ id: pushNotificationRequest.id });
        return claimed.map((row) => row.id);
    }

    /**
     * 確保済みの id 一覧から、送信に必要な購読情報込みの行を取得する。
     * @param claimedIds - claimDueIds で確保できた id 一覧
     */
    private async fetchClaimedRecords(
        claimedIds: string[],
    ): Promise<DuePushRequestRecord[]> {
        if (claimedIds.length === 0) return [];
        const rows = await this.drizzleGateway.db
            .select(DUE_PUSH_REQUEST_COLUMNS)
            .from(pushNotificationRequest)
            .innerJoin(
                pushSubscription,
                eq(pushNotificationRequest.subscriptionId, pushSubscription.id),
            )
            .where(inArray(pushNotificationRequest.id, claimedIds))
            .orderBy(pushNotificationRequest.fireAtMs);
        // SEC-053: pushSubscription.authをJOINで直接読んでいるため、
        // PushSubscriptionRepository経由の復号（findById）を通らない。
        // ここでも同じdecryptPushAuthで復号する必要がある。
        return Promise.all(
            rows.map(async (row) => ({
                ...row,
                url: row.url ?? undefined,
                auth: await decryptPushAuth(row.auth),
            })),
        );
    }

    public async fetchDue(
        nowMs: number,
        limit: number,
    ): Promise<DuePushRequestRecord[]> {
        const candidateIds = await this.selectDueCandidateIds(nowMs, limit);
        const claimedIds = await this.claimDueIds(candidateIds);
        return this.fetchClaimedRecords(claimedIds);
    }

    public async markSent(id: string): Promise<void> {
        await this.drizzleGateway.db
            .update(pushNotificationRequest)
            .set({
                sentAt: sql`CURRENT_TIMESTAMP`,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(pushNotificationRequest.id, id));
    }

    public async markSentBatch(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.drizzleGateway.db
            .update(pushNotificationRequest)
            .set({
                sentAt: sql`CURRENT_TIMESTAMP`,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(inArray(pushNotificationRequest.id, ids));
    }

    public async releaseClaim(id: string): Promise<void> {
        // CONC-01: fetchDue のクレームは実際の送信より前に sentAt を設定するため、
        // 送信が失敗した場合はここで sentAt を null に戻し、次回のディスパッチで
        // 再試行されるようにする（クレームしたまま放置すると再送されなくなる）。
        await this.drizzleGateway.db
            .update(pushNotificationRequest)
            .set({
                sentAt: null,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(pushNotificationRequest.id, id));
    }

    public async releaseClaimBatch(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.drizzleGateway.db
            .update(pushNotificationRequest)
            .set({
                sentAt: null,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(inArray(pushNotificationRequest.id, ids));
    }

    public async purgeOld(beforeMs: number): Promise<void> {
        await this.drizzleGateway.db
            .delete(pushNotificationRequest)
            .where(lt(pushNotificationRequest.fireAtMs, beforeMs));
    }
}
