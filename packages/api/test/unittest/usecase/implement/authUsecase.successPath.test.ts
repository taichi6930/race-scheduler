/**
 * AuthUsecase の登録/ログイン成功パスのデシジョンテーブル
 *
 * | #    | メソッド            | 状況                                     | 期待                              |
 * | ---- | -------------------- | ------------------------------------------- | ----------------------------------- |
 * | T-19 | verifyRegistration    | 正当なfmt:none登録レスポンス（成功）        | sessionToken/nicknameを返し永続化される |
 * | T-20 | verifyLogin           | 実ECDSA署名を持つ正当な認証レスポンス（成功） | sessionToken/nicknameを返しsignCountが更新される |
 *
 * `authUsecase.test.ts`はrepositoryをmockして失敗分岐（`verifyRegistration`/
 * `verifyAuthentication`がnullを返す）のみ検証しており、成功分岐
 * （persistNewAccount/finishLogin/issueSession）は`@simplewebauthn/server`の
 * 本物の検証を通す必要があるため別ファイルに分離する。`../../common/webauthnTestFixtures`
 * （`webauthn.test.ts`のT-08/T-09と共通の、mock.moduleを使わないレスポンス構築
 * ヘルパー）で本物の検証ロジックを通し、repository自体はこれまで通りplainな
 * mockオブジェクトを使う。
 */

import { describe, expect, it, mock } from 'bun:test';
import { EnvStore } from '@race-schedule/core';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import 'reflect-metadata';

import type {
    CredentialRecord,
    IAuthRepository,
} from '../../../../src/repository/interface/IAuthRepository';
import { AuthUsecase } from '../../../../src/usecase/implement/authUsecase';
import {
    buildValidAuthenticationResponse,
    buildValidNoneAttestationResponse,
} from '../../../common/webauthnTestFixtures';

const RP_ENV = { WEBAUTHN_RP_ID: 'front.example.com' } as never;
const ORIGIN = 'https://front.example.com';
const RP_ID = 'front.example.com';

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

describe('AuthUsecase（成功パス）', () => {
    describe('verifyRegistration', () => {
        it('[T-19] 正当な登録レスポンスの場合sessionToken/nicknameを返し永続化されること', async () => {
            EnvStore.setEnv(RP_ENV);
            const credentialId = new Uint8Array([1, 2, 3, 4]);
            const credentialResponse = await buildValidNoneAttestationResponse(
                RP_ID,
                ORIGIN,
                'raw-challenge',
                credentialId,
            );
            const repository = buildRepository({
                consumeChallenge: mock(() =>
                    Promise.resolve({
                        challenge: 'raw-challenge',
                        purpose: 'register' as const,
                        inviteToken: 'invite-token',
                    }),
                ),
                findValidInvite: mock(() =>
                    Promise.resolve({ token: 'invite-token', memo: null }),
                ),
            });
            const usecase = new AuthUsecase(repository);

            const result = await usecase.verifyRegistration({
                challengeId: 'c1',
                nickname: 'たなか',
                userAgent: 'TestAgent/1.0',
                credentialResponse,
            });

            expect(result?.nickname).toBe('たなか');
            expect(result?.sessionToken).toBeTruthy();
            expect(repository.createUser).toHaveBeenCalled();
            expect(repository.createCredential).toHaveBeenCalled();
            expect(repository.markInviteUsed).toHaveBeenCalledWith(
                'invite-token',
                expect.any(String),
            );
            expect(repository.createSession).toHaveBeenCalled();
        });
    });

    describe('verifyLogin', () => {
        it('[T-20] 正当な認証レスポンスの場合sessionToken/nicknameを返しsignCountが更新されること', async () => {
            EnvStore.setEnv(RP_ENV);
            const credentialId = new Uint8Array([9, 8, 7, 6]);
            const { response, publicKey } =
                await buildValidAuthenticationResponse(
                    RP_ID,
                    ORIGIN,
                    'raw-challenge',
                    credentialId,
                );
            const storedCredential: CredentialRecord = {
                id: isoBase64URL.fromBuffer(credentialId),
                userId: 'user-1',
                publicKey,
                signCount: 0,
            };
            const repository = buildRepository({
                consumeChallenge: mock(() =>
                    Promise.resolve({
                        challenge: 'raw-challenge',
                        purpose: 'login' as const,
                        inviteToken: null,
                    }),
                ),
                findCredentialById: mock(() =>
                    Promise.resolve(storedCredential),
                ),
                findUserNickname: mock(() => Promise.resolve('たなか')),
            });
            const usecase = new AuthUsecase(repository);

            const result = await usecase.verifyLogin({
                challengeId: 'c1',
                credentialResponse: response,
            });

            expect(result).toEqual({
                sessionToken: expect.any(String),
                nickname: 'たなか',
            });
            expect(repository.touchCredential).toHaveBeenCalledWith(
                storedCredential.id,
                1,
            );
            expect(repository.createSession).toHaveBeenCalled();
        });
    });
});
