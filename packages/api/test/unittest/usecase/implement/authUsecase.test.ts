/**
 * AuthUsecase のデシジョンテーブル
 *
 * | #    | メソッド                 | 状況                                     | 期待                          |
 * | ---- | -------------------------- | ------------------------------------------- | -------------------------------- |
 * | T-01 | issueInvite                | 正常系                                     | tokenを含む結果を返しrepositoryへ委譲（expiresAtは発行から24時間後） |
 * | T-02 | verifyInvite                | 有効な招待                                 | { valid: true }               |
 * | T-03 | verifyInvite                | 無効な招待                                 | { valid: false }               |
 * | T-04 | getRegistrationOptions      | WEBAUTHN_RP_ID未設定                       | null                          |
 * | T-05 | getRegistrationOptions      | 招待が無効                                 | null                          |
 * | T-06 | getRegistrationOptions      | 正常系                                     | challengeId・optionsを返しcreateChallengeへpurpose='register'・inviteToken・5分後のexpiresAtを渡す |
 * | T-07 | verifyRegistration          | WEBAUTHN_RP_ID未設定                       | null                          |
 * | T-08 | verifyRegistration          | challengeが存在しない                       | null                          |
 * | T-09 | verifyRegistration          | challengeのpurposeがregister以外            | null                          |
 * | T-10 | verifyRegistration          | 招待が既に無効化されている（TOCTOU対策）    | null                          |
 * | T-11 | verifyRegistration          | credentialResponseの検証に失敗              | null                          |
 * | T-26 | verifyRegistration          | purposeはregisterだがinviteTokenがnull      | null                          |
 * | T-12 | getLoginOptions             | WEBAUTHN_RP_ID未設定                       | 例外を投げる                   |
 * | T-13 | getLoginOptions             | 正常系                                     | challengeId・optionsを返す      |
 * | T-14 | verifyLogin                  | challengeが存在しない                       | null                          |
 * | T-15 | verifyLogin                  | credentialが見つからない                    | null                          |
 * | T-16 | logout                      | 正常系                                     | repository.deleteSessionへ委譲  |
 * | T-17 | listParticipants             | 正常系                                     | repository.listParticipantsへ委譲 |
 * | T-18 | renameCredential             | 正常系                                     | repository.renameCredentialへ委譲 |
 * | T-19 | requestJoin                  | 正常系                                     | requestIdを生成しrepository.createJoinRequestへ委譲 |
 * | T-20 | getJoinRequestStatus          | 存在するリクエスト                          | status/inviteTokenを返す        |
 * | T-21 | getJoinRequestStatus          | 存在しないリクエスト                        | null                          |
 * | T-22 | listJoinRequests              | 正常系                                     | repository.listPendingJoinRequestsへ委譲 |
 * | T-23 | approveJoinRequest            | pending状態                                | issueInviteを呼びrepository.approveJoinRequestへ委譲 |
 * | T-24 | approveJoinRequest            | 存在しない/pending以外                      | false・issueInviteは呼ばれない  |
 * | T-25 | rejectJoinRequest             | 正常系                                     | repository.rejectJoinRequestへ委譲 |
 *
 * expiresAtの検証について: TTL定数（INVITE_TTL_MS=24h/CHALLENGE_TTL_MS=5min/
 * SESSION_TTL_MS=7day）はauthUsecase.ts内のprivate定数でexportされていないため、
 * テスト側では「発行時刻から期待される期間だけ後」であることを許容誤差
 * （TOLERANCE_MS）付きで検証する。`expect.any(String)`だけでは算術ミューテーション
 * （TTL定数の演算子破壊等）を検知できないため。
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
        createJoinRequest: mock(() => Promise.resolve()),
        findJoinRequestById: mock(() => Promise.resolve(null)),
        listPendingJoinRequests: mock(() => Promise.resolve([])),
        approveJoinRequest: mock(() => Promise.resolve(true)),
        rejectJoinRequest: mock(() => Promise.resolve(true)),
        ...overrides,
    }) as IAuthRepository;

/** authUsecase.ts内のTTL定数（非export）に対応する期待値。 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
/** Date.now()呼び出しのタイミングずれを許容する誤差。 */
const TOLERANCE_MS = 2000;

/**
 * ISO文字列の日時が期待するタイムスタンプ（ms）に近いことを検証する。
 * TTL算出の演算子が壊れる（例: `*`が`/`になる）ミューテーションは、
 * 結果の桁が大きくずれるため許容誤差を超えて検知できる。
 * @param actual - 検証対象のISO文字列
 * @param expectedMs - 期待するタイムスタンプ（エポックミリ秒）
 */
const expectIsoCloseTo = (actual: unknown, expectedMs: number): void => {
    if (typeof actual !== 'string') {
        throw new TypeError('expected an ISO date string');
    }
    const diff = Math.abs(new Date(actual).getTime() - expectedMs);
    expect(diff).toBeLessThanOrEqual(TOLERANCE_MS);
};

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
        it('[T-01] tokenを生成しrepository.createInviteへ委譲すること（expiresAtは24時間後）', async () => {
            const createInvite = mock(
                (_token: string, _memo: string | null, _expiresAt: string) =>
                    Promise.resolve(),
            );
            const repository = buildRepository({ createInvite });
            const usecase = new AuthUsecase(repository);

            const before = Date.now();
            const result = await usecase.issueInvite('メモ');

            expect(result.token).toBeTruthy();
            expect(createInvite).toHaveBeenCalledWith(
                result.token,
                'メモ',
                expect.any(String),
            );
            expectIsoCloseTo(
                createInvite.mock.calls[0]?.[2],
                before + ONE_DAY_MS,
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

        it('[T-06] 正常系でchallengeId・optionsを返しcreateChallengeへpurpose=register・inviteToken・5分後のexpiresAtを渡すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const createChallenge = mock(
                (
                    _id: string,
                    _challenge: string,
                    _purpose: 'register' | 'login',
                    _inviteToken: string | null,
                    _expiresAt: string,
                ) => Promise.resolve(),
            );
            const repository = buildRepository({
                findValidInvite: mock(() =>
                    Promise.resolve({ token: 't', memo: 'メモ' }),
                ),
                createChallenge,
            });
            const usecase = new AuthUsecase(repository);

            const before = Date.now();
            const result = await usecase.getRegistrationOptions('t');

            expect(result?.challengeId).toBeTruthy();
            expect(createChallenge).toHaveBeenCalledWith(
                result?.challengeId,
                expect.any(String),
                'register',
                't',
                expect.any(String),
            );
            expectIsoCloseTo(
                createChallenge.mock.calls[0]?.[4],
                before + FIVE_MINUTES_MS,
            );
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

        it('[T-26] purposeはregisterだがinviteTokenがnullの場合nullを返すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const repository = buildRepository({
                consumeChallenge: mock(() =>
                    Promise.resolve({
                        challenge: 'raw',
                        purpose: 'register' as const,
                        inviteToken: null,
                    }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            expect(await usecase.verifyRegistration(baseInput)).toBeNull();
            expect(repository.findValidInvite).not.toHaveBeenCalled();
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

        it('[T-13] 正常系でchallengeId・optionsを返しcreateChallengeへpurpose=login・inviteToken=null・5分後のexpiresAtを渡すこと', async () => {
            EnvStore.setEnv(RP_ENV);
            const createChallenge = mock(
                (
                    _id: string,
                    _challenge: string,
                    _purpose: 'register' | 'login',
                    _inviteToken: string | null,
                    _expiresAt: string,
                ) => Promise.resolve(),
            );
            const repository = buildRepository({ createChallenge });
            const usecase = new AuthUsecase(repository);

            const before = Date.now();
            const result = await usecase.getLoginOptions();

            expect(result.challengeId).toBeTruthy();
            expect(createChallenge).toHaveBeenCalledWith(
                result.challengeId,
                expect.any(String),
                'login',
                null,
                expect.any(String),
            );
            expectIsoCloseTo(
                createChallenge.mock.calls[0]?.[4],
                before + FIVE_MINUTES_MS,
            );
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

    describe('requestJoin', () => {
        it('[T-19] requestIdを生成しrepository.createJoinRequestへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            const result = await usecase.requestJoin('たなか');

            expect(result.requestId).toBeTruthy();
            expect(repository.createJoinRequest).toHaveBeenCalledWith(
                result.requestId,
                'たなか',
            );
        });
    });

    describe('getJoinRequestStatus', () => {
        it('[T-20] 存在するリクエストのstatus/inviteTokenを返すこと', async () => {
            const repository = buildRepository({
                findJoinRequestById: mock(() =>
                    Promise.resolve({
                        id: 'req-1',
                        nickname: 'たなか',
                        status: 'approved' as const,
                        inviteToken: 'invite-token',
                    }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            expect(await usecase.getJoinRequestStatus('req-1')).toEqual({
                status: 'approved',
                inviteToken: 'invite-token',
            });
        });

        it('[T-21] 存在しないリクエストはnullを返すこと', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            expect(
                await usecase.getJoinRequestStatus('no-such-request'),
            ).toBeNull();
        });
    });

    describe('listJoinRequests', () => {
        it('[T-22] repository.listPendingJoinRequestsへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            await usecase.listJoinRequests();

            expect(repository.listPendingJoinRequests).toHaveBeenCalled();
        });
    });

    describe('approveJoinRequest', () => {
        it('[T-23] pending状態はissueInviteを呼びrepository.approveJoinRequestへ委譲すること', async () => {
            const repository = buildRepository({
                findJoinRequestById: mock(() =>
                    Promise.resolve({
                        id: 'req-1',
                        nickname: 'たなか',
                        status: 'pending' as const,
                        inviteToken: null,
                    }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            const approved = await usecase.approveJoinRequest('req-1');

            expect(approved).toBe(true);
            expect(repository.createInvite).toHaveBeenCalled();
            expect(repository.approveJoinRequest).toHaveBeenCalledWith(
                'req-1',
                expect.any(String),
            );
        });

        it('[T-24] 存在しない/pending以外はfalseを返しissueInviteを呼ばないこと', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            const approved =
                await usecase.approveJoinRequest('no-such-request');

            expect(approved).toBe(false);
            expect(repository.createInvite).not.toHaveBeenCalled();
            expect(repository.approveJoinRequest).not.toHaveBeenCalled();
        });
    });

    describe('rejectJoinRequest', () => {
        it('[T-25] repository.rejectJoinRequestへ委譲すること', async () => {
            const repository = buildRepository();
            const usecase = new AuthUsecase(repository);

            await usecase.rejectJoinRequest('req-1');

            expect(repository.rejectJoinRequest).toHaveBeenCalledWith('req-1');
        });
    });
});
