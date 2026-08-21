/**
 * auth.controller.usecase.repository.component.test.ts
 *
 * パスキー(WebAuthn)認証の招待発行→登録→ログイン→端末名変更のコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → AuthController → AuthUsecase → AuthRepository → InMemory D1（Drizzle）
 *
 * ## シナリオテーブル
 *
 * | #      | 事前状態                     | リクエスト                                  | 期待                         |
 * |---------|-------------------------------|-----------------------------------------------|--------------------------------|
 * | AUTH-1  | 招待未発行                     | POST /auth/invite（サービス間認証）           | 201・token を返す              |
 * | AUTH-1b | AUTH-1のtoken                 | POST /auth/invite/verify                      | 200・valid:true                |
 * | AUTH-2  | AUTH-1のtoken                 | POST /auth/register/options                   | 200・challengeId/optionsを返す |
 * | AUTH-3  | AUTH-2のchallenge・正当な登録レスポンス | POST /auth/register/verify           | 201・sessionToken/nicknameを返す |
 * | AUTH-4  | 有効なセッション               | PATCH /auth/credential/:id（本人のcredential） | 200・deviceLabelが更新される  |
 * | AUTH-5  | 登録済みのパスキー             | POST /auth/login/options→/auth/login/verify   | 200・sessionToken/nicknameを返す |
 * | AUTH-6  | 登録済みの参加者               | GET /auth/participants（サービス間認証）      | 200・参加者一覧に含まれる      |
 * | AUTH-7  | 有効なセッション               | POST /auth/logout                             | 200・ok:true                   |
 * | AUTH-8  | 招待コード無し                 | POST /auth/join-request→承認→登録            | 承認後の招待トークンで登録まで完走する |
 * | AUTH-9  | AUTH-8のリクエスト             | POST /auth/join-requests/:id/reject           | 200・statusがrejectedになる    |
 * | AUTH-10 | 存在しないrequestId            | approve/reject（サービス間認証）              | 404                            |
 * | AUTH-11 | 未処理の参加リクエストが存在   | GET /auth/join-requests（サービス間認証）     | 200・一覧に含まれる            |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { SERVICE_AUTH_HEADER } from '@race-schedule/core';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import {
    insertTestSession,
    TEST_SESSION_USER_ID,
} from '../../common/sessionAuth';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';
import {
    buildValidAuthenticationResponse,
    buildValidNoneAttestationResponse,
    exportRawXY,
    generateP256KeyPair,
} from '../../common/webauthnTestFixtures';

const RP_ID = 'front.example.com';
const ORIGIN = 'https://front.example.com';

/**
 * 招待発行→登録オプション取得→登録検証まで一連のパスキー登録を実行する。
 * AUTH-1〜3・AUTH-5・AUTH-6・AUTH-7の4シナリオ全てが「登録済みの参加者」を
 * 前提とするため共通化した（Rule of Three超）。
 * `keyPair`を渡すと、その鍵ペアの公開鍵で登録する（AUTH-5のようにログインまで
 * 検証する場合、同じ鍵ペアを`buildValidAuthenticationResponse`にも渡すことで
 * 保存される公開鍵と署名鍵を一致させる。省略時はダミー公開鍵で登録する）。
 * @param d1 - テストごとのInMemory D1
 * @param credentialId - 登録するcredentialのID（テストごとに変えて識別する）
 * @param keyPair - 登録する公開鍵の元になる鍵ペア（省略可）
 */
const registerViaCeremony = async (
    d1: D1Database,
    credentialId: Uint8Array<ArrayBuffer>,
    keyPair?: CryptoKeyPair,
): Promise<{ sessionToken: string; nickname: string }> => {
    const issueRes = await requestApi(d1, '/auth/invite', {
        method: 'POST',
        headers: {
            [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            'content-type': 'application/json',
        },
        body: JSON.stringify({ memo: 'テスト招待' }),
    });
    const { token: inviteToken } = (await issueRes.json()) as {
        token: string;
    };

    const optionsRes = await requestApi(d1, '/auth/register/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken }),
    });
    const { challengeId, options } = (await optionsRes.json()) as {
        challengeId: string;
        options: { challenge: string };
    };

    const credentialResponse = await buildValidNoneAttestationResponse(
        RP_ID,
        ORIGIN,
        options.challenge,
        credentialId,
        keyPair ? await exportRawXY(keyPair) : undefined,
    );
    const verifyRes = await requestApi(d1, '/auth/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            challengeId,
            nickname: 'たなか',
            credentialResponse,
        }),
    });
    return (await verifyRes.json()) as {
        sessionToken: string;
        nickname: string;
    };
};

describe('コンポーネントテスト: Auth Router → Controller → Usecase → Repository → InMemory D1', () => {
    let d1: D1Database;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('AUTH-1〜3: 招待発行→登録オプション取得→登録検証で一連のパスキー登録が完走すること', async () => {
        const issueRes = await requestApi(d1, '/auth/invite', {
            method: 'POST',
            headers: {
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ memo: 'テスト招待' }),
        });
        expect(issueRes.status).toBe(201);
        const { token: inviteToken } = (await issueRes.json()) as {
            token: string;
        };

        const verifyInviteRes = await requestApi(d1, '/auth/invite/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: inviteToken }),
        });
        expect(verifyInviteRes.status).toBe(200);
        expect(
            ((await verifyInviteRes.json()) as { valid: boolean }).valid,
        ).toBe(true);

        const optionsRes = await requestApi(d1, '/auth/register/options', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ inviteToken }),
        });
        expect(optionsRes.status).toBe(200);
        const { challengeId, options } = (await optionsRes.json()) as {
            challengeId: string;
            options: { challenge: string };
        };
        expect(challengeId).toBeTruthy();

        const credentialId = new Uint8Array([1, 2, 3, 4]);
        const credentialResponse = await buildValidNoneAttestationResponse(
            RP_ID,
            ORIGIN,
            options.challenge,
            credentialId,
        );

        const verifyRes = await requestApi(d1, '/auth/register/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                challengeId,
                nickname: 'たなか',
                credentialResponse,
            }),
        });

        expect(verifyRes.status).toBe(201);
        const { sessionToken, nickname } = (await verifyRes.json()) as {
            sessionToken: string;
            nickname: string;
        };
        expect(sessionToken).toBeTruthy();
        expect(nickname).toBe('たなか');
    });

    it('AUTH-5: 登録済みのパスキーでログインできること', async () => {
        const credentialId = new Uint8Array([5, 6, 7, 8]);
        const keyPair = await generateP256KeyPair();
        await registerViaCeremony(d1, credentialId, keyPair);

        const optionsRes = await requestApi(d1, '/auth/login/options', {
            method: 'POST',
        });
        expect(optionsRes.status).toBe(200);
        const { challengeId, options } = (await optionsRes.json()) as {
            challengeId: string;
            options: { challenge: string };
        };

        const { response: credentialResponse } =
            await buildValidAuthenticationResponse(
                RP_ID,
                ORIGIN,
                options.challenge,
                credentialId,
                keyPair,
            );
        const verifyRes = await requestApi(d1, '/auth/login/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ challengeId, credentialResponse }),
        });

        expect(verifyRes.status).toBe(200);
        const { sessionToken, nickname } = (await verifyRes.json()) as {
            sessionToken: string;
            nickname: string;
        };
        expect(sessionToken).toBeTruthy();
        expect(nickname).toBe('たなか');
    });

    it('AUTH-6: 登録済みの参加者がparticipants一覧に含まれること', async () => {
        await registerViaCeremony(d1, new Uint8Array([9, 9, 9, 9]));

        const res = await requestApi(d1, '/auth/participants', {
            headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
        });

        expect(res.status).toBe(200);
        const { participants } = (await res.json()) as {
            participants: { nickname: string }[];
        };
        expect(participants.some((p) => p.nickname === 'たなか')).toBe(true);
    });

    it('AUTH-7: 有効なセッションでログアウトできること', async () => {
        const { sessionToken } = await registerViaCeremony(
            d1,
            new Uint8Array([1, 1, 1, 1]),
        );

        const res = await requestApi(d1, '/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${sessionToken}` },
        });

        expect(res.status).toBe(200);
        expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    });

    it('AUTH-4: 有効なセッションで本人のcredentialのdeviceLabelを変更できること', async () => {
        const db = drizzle(d1, { schema });
        const sessionHeaders = await insertTestSession(db);

        const res = await requestApi(
            d1,
            '/auth/credential/test-user-1-credential',
            {
                method: 'PATCH',
                headers: {
                    ...sessionHeaders,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ deviceLabel: '新しいラベル' }),
            },
        );

        expect(res.status).toBe(200);
        const rows = await db
            .select()
            .from(schema.credential)
            .where(eq(schema.credential.userId, TEST_SESSION_USER_ID));
        expect(rows[0]?.deviceLabel).toBe('新しいラベル');
    });

    it('AUTH-8: 招待コード無しの参加リクエストが承認後に登録まで完走すること', async () => {
        const joinRes = await requestApi(d1, '/auth/join-request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ nickname: 'たなか' }),
        });
        expect(joinRes.status).toBe(201);
        const { requestId } = (await joinRes.json()) as {
            requestId: string;
        };

        const pendingStatusRes = await requestApi(
            d1,
            `/auth/join-request/${requestId}`,
        );
        expect(pendingStatusRes.status).toBe(200);
        expect(
            ((await pendingStatusRes.json()) as { status: string }).status,
        ).toBe('pending');

        const approveRes = await requestApi(
            d1,
            `/auth/join-requests/${requestId}/approve`,
            {
                method: 'POST',
                headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
            },
        );
        expect(approveRes.status).toBe(200);

        const approvedStatusRes = await requestApi(
            d1,
            `/auth/join-request/${requestId}`,
        );
        const { status, inviteToken } = (await approvedStatusRes.json()) as {
            status: string;
            inviteToken: string;
        };
        expect(status).toBe('approved');
        expect(inviteToken).toBeTruthy();

        // 承認で発行された招待トークンが、既存の招待登録フローへそのまま使えることを確認する
        const optionsRes = await requestApi(d1, '/auth/register/options', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ inviteToken }),
        });
        expect(optionsRes.status).toBe(200);
        const { challengeId, options } = (await optionsRes.json()) as {
            challengeId: string;
            options: { challenge: string };
        };
        const credentialResponse = await buildValidNoneAttestationResponse(
            RP_ID,
            ORIGIN,
            options.challenge,
            new Uint8Array([7, 7, 7, 7]),
        );
        const verifyRes = await requestApi(d1, '/auth/register/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                challengeId,
                nickname: 'たなか',
                credentialResponse,
            }),
        });
        expect(verifyRes.status).toBe(201);
    });

    it('AUTH-9: 参加リクエストを却下するとstatusがrejectedになること', async () => {
        const joinRes = await requestApi(d1, '/auth/join-request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ nickname: 'さとう' }),
        });
        const { requestId } = (await joinRes.json()) as {
            requestId: string;
        };

        const rejectRes = await requestApi(
            d1,
            `/auth/join-requests/${requestId}/reject`,
            {
                method: 'POST',
                headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
            },
        );
        expect(rejectRes.status).toBe(200);

        const statusRes = await requestApi(
            d1,
            `/auth/join-request/${requestId}`,
        );
        expect(((await statusRes.json()) as { status: string }).status).toBe(
            'rejected',
        );
    });

    it('AUTH-10: 存在しないrequestIdのapprove/rejectは404になること', async () => {
        const approveRes = await requestApi(
            d1,
            '/auth/join-requests/no-such-request/approve',
            {
                method: 'POST',
                headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
            },
        );
        const rejectRes = await requestApi(
            d1,
            '/auth/join-requests/no-such-request/reject',
            {
                method: 'POST',
                headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
            },
        );

        expect(approveRes.status).toBe(404);
        expect(rejectRes.status).toBe(404);
    });

    it('AUTH-11: 未処理の参加リクエスト一覧が取得できること（サービス間認証）', async () => {
        await requestApi(d1, '/auth/join-request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ nickname: '未処理さん' }),
        });

        const res = await requestApi(d1, '/auth/join-requests', {
            headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
        });

        expect(res.status).toBe(200);
        const { requests } = (await res.json()) as {
            requests: { nickname: string }[];
        };
        expect(requests.some((r) => r.nickname === '未処理さん')).toBe(true);
    });
});
