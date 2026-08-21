/**
 * AuthController のデシジョンテーブル
 *
 * | #    | メソッド            | 状況                                 | 期待               |
 * | ---- | -------------------- | ------------------------------------- | -------------------- |
 * | T-01 | issueInvite           | 正常系                               | 201                 |
 * | T-02 | issueInvite           | bodyが不正                           | 400                 |
 * | T-03 | issueInvite           | usecaseが例外                        | 500                 |
 * | T-04 | verifyInvite           | 正常系                               | 200                 |
 * | T-05 | verifyInvite           | bodyが不正                           | 400                 |
 * | T-06 | registrationOptions    | 正常系                               | 200                 |
 * | T-07 | registrationOptions    | bodyが不正                           | 400                 |
 * | T-08 | registrationOptions    | usecaseがnullを返す（招待無効）       | 400                 |
 * | T-09 | registrationVerify     | 正常系                               | 201                 |
 * | T-10 | registrationVerify     | bodyが不正                           | 400                 |
 * | T-11 | registrationVerify     | usecaseがnullを返す（検証失敗）       | 400                 |
 * | T-12 | loginOptions           | 正常系                               | 200                 |
 * | T-13 | loginOptions           | usecaseが例外                        | 500                 |
 * | T-14 | loginVerify            | 正常系                               | 200                 |
 * | T-15 | loginVerify            | bodyが不正                           | 400                 |
 * | T-16 | loginVerify            | usecaseがnullを返す（検証失敗）       | 401                 |
 * | T-17 | logout                 | トークン有り                         | 200・usecase.logoutが呼ばれる |
 * | T-18 | logout                 | トークン無し                         | 200・usecase.logoutは呼ばれない |
 * | T-19 | participants           | 正常系                               | 200                 |
 * | T-20 | participants           | usecaseが例外                        | 500                 |
 * | T-21 | renameCredential       | 未ログイン                           | 401                 |
 * | T-22 | renameCredential       | bodyが不正                           | 400                 |
 * | T-23 | renameCredential       | usecaseがfalseを返す（対象なし/他人） | 404                 |
 * | T-24 | renameCredential       | 正常系                               | 200                 |
 */

import { describe, expect, it, mock } from 'bun:test';
import { runWithCurrentUserId } from '@race-schedule/core';
import 'reflect-metadata';

import { AuthController } from '../../../src/controller/authController';
import type { IAuthUsecase } from '../../../src/usecase/interface/IAuthUsecase';

const buildUsecase = (overrides?: Partial<IAuthUsecase>): IAuthUsecase =>
    ({
        issueInvite: mock(() => Promise.resolve({ token: 'invite-token' })),
        verifyInvite: mock(() => Promise.resolve({ valid: true })),
        getRegistrationOptions: mock(() =>
            Promise.resolve({ challengeId: 'c1', options: {} }),
        ),
        verifyRegistration: mock(() =>
            Promise.resolve({ sessionToken: 's1', nickname: 'たなか' }),
        ),
        getLoginOptions: mock(() =>
            Promise.resolve({ challengeId: 'c1', options: {} }),
        ),
        verifyLogin: mock(() =>
            Promise.resolve({ sessionToken: 's1', nickname: 'たなか' }),
        ),
        logout: mock(() => Promise.resolve()),
        listParticipants: mock(() => Promise.resolve([])),
        renameCredential: mock(() => Promise.resolve(true)),
        ...overrides,
    }) as IAuthUsecase;

const jsonRequest = (path: string, body: unknown): Request =>
    new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

describe('AuthController', () => {
    describe('issueInvite', () => {
        it('[T-01] 正常なbodyの場合201を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.issueInvite(
                jsonRequest('/auth/invite', { memo: 'メモ' }),
            );

            expect(res.status).toBe(201);
            expect(usecase.issueInvite).toHaveBeenCalledWith('メモ');
        });

        it('[T-02] bodyが不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.issueInvite(
                jsonRequest('/auth/invite', { memo: 123 }),
            );

            expect(res.status).toBe(400);
        });

        it('[T-03] usecaseが例外を投げた場合500を返すこと', async () => {
            const usecase = buildUsecase({
                issueInvite: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new AuthController(usecase);

            const res = await controller.issueInvite(
                jsonRequest('/auth/invite', {}),
            );

            expect(res.status).toBe(500);
        });
    });

    describe('verifyInvite', () => {
        it('[T-04] 正常なbodyの場合200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.verifyInvite(
                jsonRequest('/auth/invite/verify', { token: 't' }),
            );

            expect(res.status).toBe(200);
        });

        it('[T-05] bodyが不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.verifyInvite(
                jsonRequest('/auth/invite/verify', {}),
            );

            expect(res.status).toBe(400);
        });
    });

    describe('registrationOptions', () => {
        it('[T-06] 正常なbodyの場合200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.registrationOptions(
                jsonRequest('/auth/register/options', {
                    inviteToken: 'invite-token',
                }),
            );

            expect(res.status).toBe(200);
        });

        it('[T-07] bodyが不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.registrationOptions(
                jsonRequest('/auth/register/options', {}),
            );

            expect(res.status).toBe(400);
        });

        it('[T-08] usecaseがnullを返した場合400を返すこと', async () => {
            const usecase = buildUsecase({
                getRegistrationOptions: mock(() => Promise.resolve(null)),
            });
            const controller = new AuthController(usecase);

            const res = await controller.registrationOptions(
                jsonRequest('/auth/register/options', {
                    inviteToken: 'invalid-token',
                }),
            );

            expect(res.status).toBe(400);
        });
    });

    describe('registrationVerify', () => {
        // deviceLabelを含めない: frontは送らず、サーバー側で自動生成するため
        // （回帰テスト。authController.schemas.tsのコメント参照）。
        const validBody = {
            challengeId: 'c1',
            nickname: 'たなか',
            credentialResponse: {
                id: 'cred-1',
                rawId: 'cred-1',
                type: 'public-key',
                response: {},
            },
        };

        it('[T-09] 正常なbodyの場合201を返しUser-Agentを渡すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);
            const request = jsonRequest('/auth/register/verify', validBody);
            request.headers.set('User-Agent', 'TestAgent/1.0');

            const res = await controller.registrationVerify(request);

            expect(res.status).toBe(201);
            expect(usecase.verifyRegistration).toHaveBeenCalledWith(
                expect.objectContaining({ userAgent: 'TestAgent/1.0' }),
            );
        });

        it('[T-10] bodyが不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.registrationVerify(
                jsonRequest('/auth/register/verify', {}),
            );

            expect(res.status).toBe(400);
        });

        it('[T-11] usecaseがnullを返した場合400を返すこと', async () => {
            const usecase = buildUsecase({
                verifyRegistration: mock(() => Promise.resolve(null)),
            });
            const controller = new AuthController(usecase);

            const res = await controller.registrationVerify(
                jsonRequest('/auth/register/verify', validBody),
            );

            expect(res.status).toBe(400);
        });
    });

    describe('loginOptions', () => {
        it('[T-12] 正常系で200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.loginOptions();

            expect(res.status).toBe(200);
        });

        it('[T-13] usecaseが例外を投げた場合500を返すこと', async () => {
            const usecase = buildUsecase({
                getLoginOptions: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new AuthController(usecase);

            const res = await controller.loginOptions();

            expect(res.status).toBe(500);
        });
    });

    describe('loginVerify', () => {
        const validBody = {
            challengeId: 'c1',
            credentialResponse: {
                id: 'cred-1',
                rawId: 'cred-1',
                type: 'public-key',
                response: {},
            },
        };

        it('[T-14] 正常なbodyの場合200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.loginVerify(
                jsonRequest('/auth/login/verify', validBody),
            );

            expect(res.status).toBe(200);
        });

        it('[T-15] bodyが不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.loginVerify(
                jsonRequest('/auth/login/verify', {}),
            );

            expect(res.status).toBe(400);
        });

        it('[T-16] usecaseがnullを返した場合401を返すこと', async () => {
            const usecase = buildUsecase({
                verifyLogin: mock(() => Promise.resolve(null)),
            });
            const controller = new AuthController(usecase);

            const res = await controller.loginVerify(
                jsonRequest('/auth/login/verify', validBody),
            );

            expect(res.status).toBe(401);
        });
    });

    describe('logout', () => {
        it('[T-17] トークンがある場合usecase.logoutが呼ばれ200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);
            const request = new Request('http://localhost/auth/logout', {
                method: 'POST',
                headers: { Authorization: 'Bearer session-token' },
            });

            const res = await controller.logout(request);

            expect(res.status).toBe(200);
            expect(usecase.logout).toHaveBeenCalledWith('session-token');
        });

        it('[T-18] トークンが無い場合usecase.logoutが呼ばれず200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);
            const request = new Request('http://localhost/auth/logout', {
                method: 'POST',
            });

            const res = await controller.logout(request);

            expect(res.status).toBe(200);
            expect(usecase.logout).not.toHaveBeenCalled();
        });
    });

    describe('participants', () => {
        it('[T-19] 正常系で200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.participants();

            expect(res.status).toBe(200);
        });

        it('[T-20] usecaseが例外を投げた場合500を返すこと', async () => {
            const usecase = buildUsecase({
                listParticipants: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new AuthController(usecase);

            const res = await controller.participants();

            expect(res.status).toBe(500);
        });
    });

    describe('renameCredential', () => {
        it('[T-21] 未ログインの場合401を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await controller.renameCredential(
                jsonRequest('/auth/credential/cred-1', {
                    deviceLabel: '新ラベル',
                }),
                'cred-1',
            );

            expect(res.status).toBe(401);
        });

        it('[T-22] bodyが不正な場合400を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.renameCredential(
                    jsonRequest('/auth/credential/cred-1', {}),
                    'cred-1',
                ),
            );

            expect(res.status).toBe(400);
        });

        it('[T-23] usecaseがfalseを返した場合404を返すこと', async () => {
            const usecase = buildUsecase({
                renameCredential: mock(() => Promise.resolve(false)),
            });
            const controller = new AuthController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.renameCredential(
                    jsonRequest('/auth/credential/cred-1', {
                        deviceLabel: '新ラベル',
                    }),
                    'cred-1',
                ),
            );

            expect(res.status).toBe(404);
        });

        it('[T-24] 正常系で200を返すこと', async () => {
            const usecase = buildUsecase();
            const controller = new AuthController(usecase);

            const res = await runWithCurrentUserId('user-1', () =>
                controller.renameCredential(
                    jsonRequest('/auth/credential/cred-1', {
                        deviceLabel: '新ラベル',
                    }),
                    'cred-1',
                ),
            );

            expect(res.status).toBe(200);
            expect(usecase.renameCredential).toHaveBeenCalledWith(
                'user-1',
                'cred-1',
                '新ラベル',
            );
        });
    });
});
