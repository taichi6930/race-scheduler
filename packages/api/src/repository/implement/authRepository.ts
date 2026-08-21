import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import {
    credential,
    invite,
    joinRequest,
    session,
    user,
    webauthnChallenge,
} from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type {
    ChallengeRecord,
    CredentialRecord,
    IAuthRepository,
    InviteRecord,
    JoinRequestRecord,
    NewCredentialInput,
    ParticipantRow,
    SessionRecord,
} from '../interface/IAuthRepository';

@LogAllMethods
@injectable()
export class AuthRepository implements IAuthRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async createInvite(
        token: string,
        memo: string | null,
        expiresAt: string,
    ): Promise<void> {
        await this.drizzleGateway.db
            .insert(invite)
            .values({ token, memo, expiresAt });
    }

    /**
     * 有効な招待（期限内・未使用）を取得する。
     * @param token - 招待トークン
     */
    public async findValidInvite(token: string): Promise<InviteRecord | null> {
        const rows = await this.drizzleGateway.db
            .select({ token: invite.token, memo: invite.memo })
            .from(invite)
            .where(
                and(
                    eq(invite.token, token),
                    isNull(invite.usedByUserId),
                    gt(invite.expiresAt, new Date().toISOString()),
                ),
            )
            .limit(1);
        return rows[0] ?? null;
    }

    public async markInviteUsed(token: string, userId: string): Promise<void> {
        await this.drizzleGateway.db
            .update(invite)
            .set({ usedByUserId: userId })
            .where(eq(invite.token, token));
    }

    public async createUser(id: string, nickname: string): Promise<void> {
        await this.drizzleGateway.db.insert(user).values({ id, nickname });
    }

    public async findUserNickname(id: string): Promise<string | null> {
        const rows = await this.drizzleGateway.db
            .select({ nickname: user.nickname })
            .from(user)
            .where(eq(user.id, id))
            .limit(1);
        return rows[0]?.nickname ?? null;
    }

    public async createCredential(input: NewCredentialInput): Promise<void> {
        await this.drizzleGateway.db.insert(credential).values({
            id: input.id,
            userId: input.userId,
            publicKey: Buffer.from(input.publicKey),
            signCount: input.signCount,
            aaguid: input.aaguid,
            userAgent: input.userAgent,
            deviceLabel: input.deviceLabel,
        });
    }

    public async findCredentialById(
        id: string,
    ): Promise<CredentialRecord | null> {
        const rows = await this.drizzleGateway.db
            .select({
                id: credential.id,
                userId: credential.userId,
                publicKey: credential.publicKey,
                signCount: credential.signCount,
            })
            .from(credential)
            .where(eq(credential.id, id))
            .limit(1);
        const row = rows[0];
        if (!row) return null;
        return { ...row, publicKey: new Uint8Array(row.publicKey).slice() };
    }

    public async touchCredential(id: string, signCount: number): Promise<void> {
        await this.drizzleGateway.db
            .update(credential)
            .set({ signCount, lastUsedAt: new Date().toISOString() })
            .where(eq(credential.id, id));
    }

    /**
     * D1の `meta.changes`（更新件数）はテスト用InMemoryアダプタでは常に0を返すダミー値
     * のため検証に使えず、加えて本番D1でも「WHERE条件込みのUPDATEが実際に何件更新したか」
     * という副次的なメタデータに所有権チェックという重要な判定を委ねるのは脆い。
     * 事前にSELECTで所有者を確認してからUPDATEする（TOCTOU: このテーブルへの書き込みは
     * 本人しか行わないため、確認からUPDATEまでの間に他ユーザーが割り込む余地は無い）。
     * @param id
     * @param userId
     * @param deviceLabel
     */
    public async renameCredential(
        id: string,
        userId: string,
        deviceLabel: string,
    ): Promise<boolean> {
        const existing = await this.findCredentialById(id);
        if (!existing) return false;
        if (existing.userId !== userId) return false;

        await this.drizzleGateway.db
            .update(credential)
            .set({ deviceLabel })
            .where(eq(credential.id, id));
        return true;
    }

    public async createChallenge(
        id: string,
        challenge: string,
        purpose: 'register' | 'login',
        inviteToken: string | null,
        expiresAt: string,
    ): Promise<void> {
        await this.drizzleGateway.db.insert(webauthnChallenge).values({
            id,
            challenge,
            purpose,
            inviteToken,
            expiresAt,
        });
    }

    /**
     * challengeを取得し、成否によらず消費（削除）する（リプレイ防止）。
     * @param id - options生成時に発行したchallengeId
     */
    public async consumeChallenge(id: string): Promise<ChallengeRecord | null> {
        const rows = await this.drizzleGateway.db
            .select({
                challenge: webauthnChallenge.challenge,
                purpose: webauthnChallenge.purpose,
                inviteToken: webauthnChallenge.inviteToken,
                expiresAt: webauthnChallenge.expiresAt,
            })
            .from(webauthnChallenge)
            .where(eq(webauthnChallenge.id, id))
            .limit(1);
        await this.drizzleGateway.db
            .delete(webauthnChallenge)
            .where(eq(webauthnChallenge.id, id));

        const row = rows[0];
        if (!row) return null;
        if (row.expiresAt <= new Date().toISOString()) return null;
        return row;
    }

    public async createSession(
        token: string,
        userId: string,
        credentialId: string,
        expiresAt: string,
    ): Promise<void> {
        await this.drizzleGateway.db
            .insert(session)
            .values({ token, userId, credentialId, expiresAt });
    }

    /**
     * 有効なセッションを検証し、あわせて有効期限を延長する（スライディングウィンドウ、
     * 使うたびに7日後へ更新する設計）。呼び出し元（sessionAuthMiddleware）は
     * 検証と延長を1回のDBアクセスで済ませたいため、このメソッドが両方を担う。
     * @param token - セッショントークン
     * @param newExpiresAt - 延長後の有効期限（呼び出し側で「今+7日」を計算して渡す）
     */
    public async validateAndRefreshSession(
        token: string,
        newExpiresAt: string,
    ): Promise<SessionRecord | null> {
        const rows = await this.drizzleGateway.db
            .select({
                userId: session.userId,
                credentialId: session.credentialId,
            })
            .from(session)
            .where(
                and(
                    eq(session.token, token),
                    gt(session.expiresAt, new Date().toISOString()),
                ),
            )
            .limit(1);
        const row = rows[0];
        if (!row) return null;

        await this.drizzleGateway.db
            .update(session)
            .set({ expiresAt: newExpiresAt })
            .where(eq(session.token, token));
        return row;
    }

    public async deleteSession(token: string): Promise<void> {
        await this.drizzleGateway.db
            .delete(session)
            .where(eq(session.token, token));
    }

    /**
     * admin の参加者一覧用（ニックネーム・招待メモ・端末・最終ログイン）。
     * 1人が複数credentialを持つ場合は複数行になる（1credential=1行）。
     */
    public async listParticipants(): Promise<ParticipantRow[]> {
        return this.drizzleGateway.db
            .select({
                userId: user.id,
                nickname: user.nickname,
                inviteMemo: invite.memo,
                credentialId: credential.id,
                deviceLabel: credential.deviceLabel,
                lastUsedAt: credential.lastUsedAt,
                userCreatedAt: user.createdAt,
            })
            .from(user)
            .innerJoin(credential, eq(credential.userId, user.id))
            .leftJoin(invite, eq(invite.usedByUserId, user.id));
    }

    public async createJoinRequest(
        id: string,
        nickname: string,
    ): Promise<void> {
        await this.drizzleGateway.db
            .insert(joinRequest)
            .values({ id, nickname });
    }

    public async findJoinRequestById(
        id: string,
    ): Promise<JoinRequestRecord | null> {
        const rows = await this.drizzleGateway.db
            .select({
                id: joinRequest.id,
                nickname: joinRequest.nickname,
                status: joinRequest.status,
                inviteToken: joinRequest.inviteToken,
            })
            .from(joinRequest)
            .where(eq(joinRequest.id, id))
            .limit(1);
        return rows[0] ?? null;
    }

    public async listPendingJoinRequests(): Promise<JoinRequestRecord[]> {
        return this.drizzleGateway.db
            .select({
                id: joinRequest.id,
                nickname: joinRequest.nickname,
                status: joinRequest.status,
                inviteToken: joinRequest.inviteToken,
            })
            .from(joinRequest)
            .where(eq(joinRequest.status, 'pending'));
    }

    /**
     * renameCredentialと同じ理由（D1の更新件数メタデータに依存しない）で、
     * 事前にSELECTしてpending状態であることを確認してからUPDATEする。
     * @param id
     * @param inviteToken
     */
    public async approveJoinRequest(
        id: string,
        inviteToken: string,
    ): Promise<boolean> {
        const existing = await this.findJoinRequestById(id);
        if (!existing) return false;
        if (existing.status !== 'pending') return false;

        await this.drizzleGateway.db
            .update(joinRequest)
            .set({
                status: 'approved',
                inviteToken,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(joinRequest.id, id));
        return true;
    }

    public async rejectJoinRequest(id: string): Promise<boolean> {
        const existing = await this.findJoinRequestById(id);
        if (!existing) return false;
        if (existing.status !== 'pending') return false;

        await this.drizzleGateway.db
            .update(joinRequest)
            .set({ status: 'rejected', updatedAt: new Date().toISOString() })
            .where(eq(joinRequest.id, id));
        return true;
    }
}
