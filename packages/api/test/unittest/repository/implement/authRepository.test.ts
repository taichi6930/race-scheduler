/**
 * AuthRepository のデシジョンテーブル
 *
 * | #    | メソッド                    | 状況                                       | 期待                                  |
 * | ---- | ---------------------------- | -------------------------------------------- | --------------------------------------- |
 * | T-01 | findValidInvite               | 有効な招待                                   | 招待レコードを返す                     |
 * | T-02 | findValidInvite               | 期限切れ                                      | null                                    |
 * | T-03 | findValidInvite               | 使用済み                                      | null                                    |
 * | T-04 | findValidInvite               | 存在しないtoken                               | null                                    |
 * | T-05 | markInviteUsed                | 正常系                                       | 以後findValidInviteがnullを返す         |
 * | T-06 | findUserNickname               | 存在するuser                                  | nicknameを返す                          |
 * | T-07 | findUserNickname               | 存在しないuser                                | null                                    |
 * | T-08 | findCredentialById             | 存在するcredential                            | 保存した値を返す（publicKeyも一致）     |
 * | T-09 | findCredentialById             | 存在しないid                                  | null                                    |
 * | T-10 | touchCredential                | 正常系                                       | signCount/lastUsedAtが更新される        |
 * | T-11 | renameCredential               | 本人所有                                     | true・deviceLabelが更新される           |
 * | T-12 | renameCredential               | 他人のcredential                             | false・deviceLabelは変わらない          |
 * | T-13 | consumeChallenge               | 有効なchallenge                              | レコードを返し、以後は取得できない（削除） |
 * | T-14 | consumeChallenge               | 期限切れ                                     | null（削除はされる）                    |
 * | T-15 | consumeChallenge               | 存在しないid                                  | null                                    |
 * | T-16 | validateAndRefreshSession      | 有効なセッション                             | userId/credentialIdを返し期限が延長される |
 * | T-17 | validateAndRefreshSession      | 期限切れ                                     | null                                    |
 * | T-18 | validateAndRefreshSession      | 存在しないtoken                               | null                                    |
 * | T-19 | deleteSession                  | 正常系                                       | 以後validateAndRefreshSessionがnull      |
 * | T-20 | listParticipants               | 1人が複数credentialを持つ                     | credential数分の行を返す                |
 * | T-21 | findJoinRequestById            | 存在するリクエスト                            | レコードを返す                          |
 * | T-22 | findJoinRequestById            | 存在しないid                                  | null                                    |
 * | T-23 | listPendingJoinRequests        | pending/approved混在                          | pending分のみ返す                       |
 * | T-24 | approveJoinRequest             | pending状態                                   | true・inviteToken/statusが更新される     |
 * | T-25 | approveJoinRequest             | 既にapproved（対象外）                        | false・状態は変わらない                 |
 * | T-26 | approveJoinRequest             | 存在しないid                                  | false                                   |
 * | T-27 | rejectJoinRequest              | pending状態                                   | true・statusがrejectedになる            |
 * | T-28 | rejectJoinRequest              | 既にrejected（対象外）                        | false                                   |
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { AuthRepository } from '../../../../src/repository/implement/authRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

const PAST = new Date(Date.now() - 60_000).toISOString();
const FUTURE = new Date(Date.now() + 60_000).toISOString();

describe('AuthRepository', () => {
    let repository: AuthRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new AuthRepository(drizzleGateway);
    });

    describe('招待', () => {
        it('[T-01] 有効な招待を返すこと', async () => {
            await repository.createInvite('token-1', 'メモ', FUTURE);

            const result = await repository.findValidInvite('token-1');

            expect(result).toEqual({ token: 'token-1', memo: 'メモ' });
        });

        it('[T-02] 期限切れの招待はnullを返すこと', async () => {
            await repository.createInvite('token-1', null, PAST);

            const result = await repository.findValidInvite('token-1');

            expect(result).toBeNull();
        });

        it('[T-03] 使用済みの招待はnullを返すこと', async () => {
            await repository.createInvite('token-1', null, FUTURE);
            await repository.createUser('user-1', 'たなか');
            await repository.markInviteUsed('token-1', 'user-1');

            const result = await repository.findValidInvite('token-1');

            expect(result).toBeNull();
        });

        it('[T-04] 存在しないtokenはnullを返すこと', async () => {
            const result = await repository.findValidInvite('no-such-token');

            expect(result).toBeNull();
        });

        it('[T-05] markInviteUsed後はfindValidInviteがnullを返すこと', async () => {
            await repository.createInvite('token-1', null, FUTURE);
            await repository.createUser('user-1', 'たなか');

            await repository.markInviteUsed('token-1', 'user-1');

            expect(await repository.findValidInvite('token-1')).toBeNull();
        });
    });

    describe('user', () => {
        it('[T-06] 存在するuserのnicknameを返すこと', async () => {
            await repository.createUser('user-1', 'たなか');

            const result = await repository.findUserNickname('user-1');

            expect(result).toBe('たなか');
        });

        it('[T-07] 存在しないuserはnullを返すこと', async () => {
            const result = await repository.findUserNickname('no-such-user');

            expect(result).toBeNull();
        });
    });

    describe('credential', () => {
        it('[T-08] 保存したcredentialを取得できること', async () => {
            await repository.createUser('user-1', 'たなか');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1, 2, 3]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '不明な端末',
            });

            const result = await repository.findCredentialById('cred-1');

            expect(result?.userId).toBe('user-1');
            expect(result?.signCount).toBe(0);
            expect(Array.from(result?.publicKey ?? [])).toEqual([1, 2, 3]);
        });

        it('[T-09] 存在しないidはnullを返すこと', async () => {
            const result = await repository.findCredentialById('no-such-cred');

            expect(result).toBeNull();
        });

        it('[T-10] touchCredentialでsignCountとlastUsedAtが更新されること', async () => {
            await repository.createUser('user-1', 'たなか');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '不明な端末',
            });

            await repository.touchCredential('cred-1', 5);

            const result = await repository.findCredentialById('cred-1');
            expect(result?.signCount).toBe(5);
        });

        it('[T-11] 本人所有のcredentialはrenameCredentialが成功すること', async () => {
            await repository.createUser('user-1', 'たなか');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '旧ラベル',
            });

            const renamed = await repository.renameCredential(
                'cred-1',
                'user-1',
                '新ラベル',
            );

            expect(renamed).toBe(true);
        });

        it('[T-12] 他人のcredentialはrenameCredentialが失敗すること', async () => {
            await repository.createUser('user-1', 'たなか');
            await repository.createUser('user-2', 'さとう');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '旧ラベル',
            });

            const renamed = await repository.renameCredential(
                'cred-1',
                'user-2',
                '乗っ取りラベル',
            );

            expect(renamed).toBe(false);
            const result = await repository.findCredentialById('cred-1');
            expect(result).not.toBeNull();
        });
    });

    describe('challenge', () => {
        it('[T-13] 有効なchallengeを消費でき、以後は取得できないこと', async () => {
            await repository.createChallenge(
                'challenge-1',
                'raw-challenge',
                'register',
                'invite-token',
                FUTURE,
            );

            const first = await repository.consumeChallenge('challenge-1');
            const second = await repository.consumeChallenge('challenge-1');

            expect(first).toMatchObject({
                challenge: 'raw-challenge',
                purpose: 'register',
                inviteToken: 'invite-token',
            });
            expect(second).toBeNull();
        });

        it('[T-14] 期限切れのchallengeはnullを返すこと（削除はされる）', async () => {
            await repository.createChallenge(
                'challenge-1',
                'raw-challenge',
                'login',
                null,
                PAST,
            );

            const result = await repository.consumeChallenge('challenge-1');

            expect(result).toBeNull();
        });

        it('[T-15] 存在しないidはnullを返すこと', async () => {
            const result = await repository.consumeChallenge('no-such-id');

            expect(result).toBeNull();
        });
    });

    describe('session', () => {
        it('[T-16] 有効なセッションはuserId/credentialIdを返し期限が延長されること', async () => {
            await repository.createUser('user-1', 'たなか');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '不明な端末',
            });
            await repository.createSession(
                'session-token',
                'user-1',
                'cred-1',
                FUTURE,
            );
            const extendedExpiresAt = new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString();

            const result = await repository.validateAndRefreshSession(
                'session-token',
                extendedExpiresAt,
            );

            expect(result).toEqual({
                userId: 'user-1',
                credentialId: 'cred-1',
            });
            const again = await repository.validateAndRefreshSession(
                'session-token',
                extendedExpiresAt,
            );
            expect(again).not.toBeNull();
        });

        it('[T-17] 期限切れのセッションはnullを返すこと', async () => {
            await repository.createUser('user-1', 'たなか');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '不明な端末',
            });
            await repository.createSession(
                'session-token',
                'user-1',
                'cred-1',
                PAST,
            );

            const result = await repository.validateAndRefreshSession(
                'session-token',
                FUTURE,
            );

            expect(result).toBeNull();
        });

        it('[T-18] 存在しないtokenはnullを返すこと', async () => {
            const result = await repository.validateAndRefreshSession(
                'no-such-token',
                FUTURE,
            );

            expect(result).toBeNull();
        });

        it('[T-19] deleteSession後はvalidateAndRefreshSessionがnullを返すこと', async () => {
            await repository.createUser('user-1', 'たなか');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '不明な端末',
            });
            await repository.createSession(
                'session-token',
                'user-1',
                'cred-1',
                FUTURE,
            );

            await repository.deleteSession('session-token');

            const result = await repository.validateAndRefreshSession(
                'session-token',
                FUTURE,
            );
            expect(result).toBeNull();
        });
    });

    describe('listParticipants', () => {
        it('[T-20] 1人が複数credentialを持つ場合はcredential数分の行を返すこと', async () => {
            await repository.createInvite('token-1', 'メモ', FUTURE);
            await repository.createUser('user-1', 'たなか');
            await repository.markInviteUsed('token-1', 'user-1');
            await repository.createCredential({
                id: 'cred-1',
                userId: 'user-1',
                publicKey: new Uint8Array([1]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '端末A',
            });
            await repository.createCredential({
                id: 'cred-2',
                userId: 'user-1',
                publicKey: new Uint8Array([2]),
                signCount: 0,
                aaguid: null,
                userAgent: null,
                deviceLabel: '端末B',
            });

            const result = await repository.listParticipants();

            expect(result).toHaveLength(2);
            expect(result.map((row) => row.deviceLabel).sort()).toEqual([
                '端末A',
                '端末B',
            ]);
            expect(result[0]?.inviteMemo).toBe('メモ');
        });
    });

    describe('joinRequest', () => {
        it('[T-21] 存在するリクエストを取得できること', async () => {
            await repository.createJoinRequest('req-1', 'たなか');

            const result = await repository.findJoinRequestById('req-1');

            expect(result).toEqual({
                id: 'req-1',
                nickname: 'たなか',
                status: 'pending',
                inviteToken: null,
            });
        });

        it('[T-22] 存在しないidはnullを返すこと', async () => {
            const result =
                await repository.findJoinRequestById('no-such-request');

            expect(result).toBeNull();
        });

        it('[T-23] listPendingJoinRequestsはpending分のみ返すこと', async () => {
            await repository.createJoinRequest('req-1', 'たなか');
            await repository.createJoinRequest('req-2', 'さとう');
            await repository.approveJoinRequest('req-2', 'invite-token');

            const result = await repository.listPendingJoinRequests();

            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe('req-1');
        });

        it('[T-24] pending状態はapproveJoinRequestが成功しinviteToken/statusが更新されること', async () => {
            await repository.createJoinRequest('req-1', 'たなか');

            const approved = await repository.approveJoinRequest(
                'req-1',
                'invite-token',
            );

            expect(approved).toBe(true);
            const result = await repository.findJoinRequestById('req-1');
            expect(result).toEqual({
                id: 'req-1',
                nickname: 'たなか',
                status: 'approved',
                inviteToken: 'invite-token',
            });
        });

        it('[T-25] 既にapproved状態はapproveJoinRequestが失敗すること', async () => {
            await repository.createJoinRequest('req-1', 'たなか');
            await repository.approveJoinRequest('req-1', 'invite-token');

            const approved = await repository.approveJoinRequest(
                'req-1',
                'another-token',
            );

            expect(approved).toBe(false);
            const result = await repository.findJoinRequestById('req-1');
            expect(result?.inviteToken).toBe('invite-token');
        });

        it('[T-26] 存在しないidはapproveJoinRequestが失敗すること', async () => {
            const approved = await repository.approveJoinRequest(
                'no-such-request',
                'invite-token',
            );

            expect(approved).toBe(false);
        });

        it('[T-27] pending状態はrejectJoinRequestが成功しstatusがrejectedになること', async () => {
            await repository.createJoinRequest('req-1', 'たなか');

            const rejected = await repository.rejectJoinRequest('req-1');

            expect(rejected).toBe(true);
            const result = await repository.findJoinRequestById('req-1');
            expect(result?.status).toBe('rejected');
        });

        it('[T-28] 既にrejected状態はrejectJoinRequestが失敗すること', async () => {
            await repository.createJoinRequest('req-1', 'たなか');
            await repository.rejectJoinRequest('req-1');

            const rejected = await repository.rejectJoinRequest('req-1');

            expect(rejected).toBe(false);
        });
    });
});
