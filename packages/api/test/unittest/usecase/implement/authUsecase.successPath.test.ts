/**
 * AuthUsecase の登録/ログイン成功パスのデシジョンテーブル
 *
 * | #    | メソッド            | 状況                                     | 期待                              |
 * | ---- | -------------------- | ------------------------------------------- | ----------------------------------- |
 * | T-19 | verifyRegistration    | 正当なfmt:none登録レスポンス（成功）        | sessionToken/nicknameを返し永続化される。createSessionへ渡すexpiresAtは発行から7日後 |
 * | T-20 | verifyLogin           | 実ECDSA署名を持つ正当な認証レスポンス（成功） | sessionToken/nicknameを返しsignCountが更新される。createSessionへ渡すexpiresAtは発行から7日後 |
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
/** authUsecase.ts内のSESSION_TTL_MS（非export）に対応する期待値（7日）。 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
/** Date.now()呼び出しのタイミングずれを許容する誤差。 */
const TOLERANCE_MS = 2000;

/**
 * ISO文字列の日時が期待するタイムスタンプ（ms）に近いことを検証する。
 * TTL算出の演算子が壊れるミューテーションは結果の桁が大きくずれるため
 * 許容誤差を超えて検知できる（authUsecase.test.tsのexpectIsoCloseToと同趣旨）。
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
            const createSession = mock(
                (
                    _token: string,
                    _userId: string,
                    _credentialId: string,
                    _expiresAt: string,
                ) => Promise.resolve(),
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
                createSession,
            });
            const usecase = new AuthUsecase(repository);

            const before = Date.now();
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
            expect(createSession).toHaveBeenCalledWith(
                result?.sessionToken,
                expect.any(String),
                expect.any(String),
                expect.any(String),
            );
            expectIsoCloseTo(
                createSession.mock.calls[0]?.[3],
                before + SEVEN_DAYS_MS,
            );
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
            const createSession = mock(
                (
                    _token: string,
                    _userId: string,
                    _credentialId: string,
                    _expiresAt: string,
                ) => Promise.resolve(),
            );
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
                createSession,
            });
            const usecase = new AuthUsecase(repository);

            const before = Date.now();
            const result = await usecase.verifyLogin({
                challengeId: 'c1',
                credentialResponse: response,
            });

            expect(result).toEqual({
                sessionToken: expect.any(String),
                nickname: 'たなか',
            });
            if (!result) throw new Error('result must not be null');
            expect(repository.touchCredential).toHaveBeenCalledWith(
                storedCredential.id,
                1,
            );
            expect(createSession).toHaveBeenCalledWith(
                result.sessionToken,
                storedCredential.userId,
                storedCredential.id,
                expect.any(String),
            );
            expectIsoCloseTo(
                createSession.mock.calls[0]?.[3],
                before + SEVEN_DAYS_MS,
            );
        });
    });
});
