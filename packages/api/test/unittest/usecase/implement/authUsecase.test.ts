/**
 * AuthUsecase のデシジョンテーブル
 *
 * | #    | メソッド                 | 状況                                     | 期待                          |
 * | ---- | -------------------------- | ------------------------------------------- | -------------------------------- |
 * | T-01 | issueInvite                | 正常系                                     | tokenを含む結果を返しrepositoryへ委譲 |
 * | T-02 | verifyInvite                | 有効な招待                                 | { valid: true }               |
 * | T-03 | verifyInvite                | 無効な招待                                 | { valid: false }               |
 * | T-04 | getRegistrationOptions      | WEBAUTHN_RP_ID未設定                       | null                          |
 * | T-05 | getRegistrationOptions      | 招待が無効                                 | null                          |
 * | T-06 | getRegistrationOptions      | 正常系                                     | challengeId・optionsを返す      |
 * | T-07 | verifyRegistration          | WEBAUTHN_RP_ID未設定                       | null                          |
 * | T-08 | verifyRegistration          | challengeが存在しない                       | null                          |
 * | T-09 | verifyRegistration          | challengeのpurposeがregister以外            | null                          |
 * | T-10 | verifyRegistration          | 招待が既に無効化されている（TOCTOU対策）    | null                          |
 * | T-11 | verifyRegistration          | credentialResponseの検証に失敗              | null                          |
 * | T-12 | getLoginOptions             | WEBAUTHN_RP_ID未設定                       | 例外を投げる                   |
 * | T-13 | getLoginOptions             | 正常系                                     | challengeId・optionsを返す      |
 * | T-14 | verifyLogin                  | challengeが存在しない                       | null                          |
 * | T-15 | verifyLogin                  | credentialが見つからない                    | null                          |
 * | T-16 | logout                      | 正常系                                     | repository.deleteSessionへ委譲  |
 * | T-17 | listParticipants             | 正常系                                     | repository.listParticipantsへ委譲 |
 * | T-18 | renameCredential             | 正常系                                     | repository.renameCredentialへ委譲 |
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { EnvStore } from '@race-schedule/core';
import 'reflect-metadata';

import type { IAuthRepository } from '../../../../src/repository/interface/IAuthRepository';
import { AuthUsecase } from '../../../../src/usecase/implement/authUsecase';

const RP_ENV = { WEBAUTHN_RP_ID: 'front.example.com' } as never;

const buildRepository = (
    overrides?: Partial<IAuthRepository>,
): IAuthRepository =>
    ({
        createInvite: mock(() => Promise.resolve()),
        findValidInvite: mock(() => Promise.resolve(null)),
        markInviteUsed: mock(() => Promise.resolve()),
        createUser: mock(() => Promise.resolve()),
        findUserNickname: mock(() => Promise.resolve(null)),
        createCredential: mock(() => Promise.resolve()),
        findCredentialById: mock(() => Promise.resolve(null)),
        touchCredential: mock(() => Promise.resolve()),
        renameCredential: mock(() => Promise.resolve(true)),
        createChallenge: mock(() => Promise.resolve()),
        consumeChallenge: mock(() => Promise.resolve(null)),
        createSession: mock(() => Promise.resolve()),
        validateAndRefreshSession: mock(() => Promise.resolve(null)),
        deleteSession: mock(() => Promise.resolve()),
        listParticipants: mock(() => Promise.resolve([])),
        ...overrides,
    }) as IAuthRepository;

const GARBAGE_CREDENTIAL_RESPONSE = {
    id: 'broken',
    rawId: 'broken',
    type: 'public-key',
    response: { clientDataJSON: 'broken', attestationObject: 'broken' },
    clientExtensionResults: {},
};

describe('AuthUsecase', () => {
    beforeEach(() => {
        EnvStore.reset();
    });

    describe('issueInvite', () => {
        it('[T-01] tokenを生成しrepository.createInviteへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            const result = await usecase.issueInvite('メモ');

            expect(result.token).toBeTruthy();
            expect(repository.createInvite).toHaveBeenCalledWith(
                result.token,
                'メモ',
                expect.any(String),
            );
        });
    });

    describe('verifyInvite', () => {
        it('[T-02] 有効な招待でvalid:trueを返すこと', async () => {
            const repository = buildRepository({
                findValidInvite: mock(() =>
                    Promise.resolve({ token: 't', memo: null }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyInvite('t')).toEqual({ valid: true });
        });

        it('[T-03] 無効な招待でvalid:falseを返すこと', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyInvite('t')).toEqual({ valid: false });
        });
    });

    describe('getRegistrationOptions', () => {
        it('[T-04] WEBAUTHN_RP_ID未設定でnullを返すこと', async () => {
            EnvStore.setEnv({} as never);
            const repository = buildRepository({
                findValidInvite: mock(() =>
                    Promise.resolve({ token: 't', memo: null }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            expect(await usecase.getRegistrationOptions('t')).toBeNull();
        });

        it('[T-05] 招待が無効な場合nullを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            expect(await usecase.getRegistrationOptions('t')).toBeNull();
        });

        it('[T-06] 正常系でchallengeId・optionsを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository({
                findValidInvite: mock(() =>
                    Promise.resolve({ token: 't', memo: 'メモ' }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            const result = await usecase.getRegistrationOptions('t');

            expect(result?.challengeId).toBeTruthy();
            expect(repository.createChallenge).toHaveBeenCalled();
        });
    });

    describe('verifyRegistration', () => {
        const baseInput = {
            challengeId: 'c1',
            nickname: 'たなか',
            userAgent: null,
            credentialResponse: GARBAGE_CREDENTIAL_RESPONSE,
        };

        it('[T-07] WEBAUTHN_RP_ID未設定でnullを返すこと', async () => {
            EnvStore.setEnv({} as never);
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyRegistration(baseInput)).toBeNull();
        });

        it('[T-08] challengeが存在しない場合nullを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyRegistration(baseInput)).toBeNull();
        });

        it('[T-09] challengeのpurposeがregister以外なら null を返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository({
                consumeChallenge: mock(() =>
                    Promise.resolve({
                        challenge: 'raw',
                        purpose: 'login' as const,
                        inviteToken: null,
                    }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyRegistration(baseInput)).toBeNull();
        });

        it('[T-10] 招待がverify時点で無効化されている場合nullを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository({
                consumeChallenge: mock(() =>
                    Promise.resolve({
                        challenge: 'raw',
                        purpose: 'register' as const,
                        inviteToken: 'invite-token',
                    }),
                ),
                findValidInvite: mock(() => Promise.resolve(null)),
            });
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyRegistration(baseInput)).toBeNull();
        });

        it('[T-11] credentialResponseの検証に失敗した場合nullを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository({
                consumeChallenge: mock(() =>
                    Promise.resolve({
                        challenge: 'raw',
                        purpose: 'register' as const,
                        inviteToken: 'invite-token',
                    }),
                ),
                findValidInvite: mock(() =>
                    Promise.resolve({ token: 'invite-token', memo: null }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyRegistration(baseInput)).toBeNull();
            expect(repository.createUser).not.toHaveBeenCalled();
        });
    });

    describe('getLoginOptions', () => {
        it('[T-12] WEBAUTHN_RP_ID未設定で例外を投げること', async () => {
            EnvStore.setEnv({} as never);
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            await expect(usecase.getLoginOptions()).rejects.toThrow();
        });

        it('[T-13] 正常系でchallengeId・optionsを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            const result = await usecase.getLoginOptions();

            expect(result.challengeId).toBeTruthy();
            expect(repository.createChallenge).toHaveBeenCalled();
        });
    });

    describe('verifyLogin', () => {
        it('[T-14] challengeが存在しない場合nullを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            expect(
                await usecase.verifyLogin({
                    challengeId: 'c1',
                    credentialResponse: GARBAGE_CREDENTIAL_RESPONSE,
                }),
            ).toBeNull();
        });

        it('[T-15] credentialが見つからない場合nullを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository({
                consumeChallenge: mock(() =>
                    Promise.resolve({
                        challenge: 'raw',
                        purpose: 'login' as const,
                        inviteToken: null,
                    }),
                ),
                findCredentialById: mock(() => Promise.resolve(null)),
            });
            const usecase = new AuthUsecase(repository);

            expect(
                await usecase.verifyLogin({
                    challengeId: 'c1',
                    credentialResponse: GARBAGE_CREDENTIAL_RESPONSE,
                }),
            ).toBeNull();
        });
    });

    describe('logout', () => {
        it('[T-16] repository.deleteSessionへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            await usecase.logout('session-token');

            expect(repository.deleteSession).toHaveBeenCalledWith(
                'session-token',
            );
        });
    });

    describe('listParticipants', () => {
        it('[T-17] repository.listParticipantsへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            await usecase.listParticipants();

            expect(repository.listParticipants).toHaveBeenCalled();
        });
    });

    describe('renameCredential', () => {
        it('[T-18] repository.renameCredentialへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            await usecase.renameCredential('user-1', 'cred-1', '新ラベル');

            expect(repository.renameCredential).toHaveBeenCalledWith(
                'cred-1',
                'user-1',
                '新ラベル',
            );
        });
    });
});
