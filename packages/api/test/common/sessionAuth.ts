import type { DrizzleD1Database } from 'drizzle-orm/d1';

import * as schema from '../../src/db/schema';

/**
 * `session-only`/`service-or-session`ルートのテストで使うAuthorizationヘッダー名。
 * `appAuthMiddleware.ts`内の同名定数（非export）と値を合わせている。
 */
export const SESSION_AUTH_HEADER = 'Authorization';

/** テストで使うセッショントークンの既定値。 */
export const TEST_SESSION_TOKEN = 'mock-session-token';

/** テストで使うuserIdの既定値。 */
export const TEST_SESSION_USER_ID = 'test-user-1';

/**
 * `session-only`ルートを叩くコンポーネントテスト向けに、有効なuser/credential/session
 * 一式をInMemory D1（テストが保持する`db`）へ直接insertし、`checkSessionAuth`
 * （`appAuthMiddleware.ts`）を通過できる状態にする。
 * @param db - テストが `drizzle(d1, { schema })` で組み立てたDrizzleインスタンス
 * @param overrides - userId/tokenを個別に変えたい場合に指定（既定値で足りるケースが大半）
 * @returns `Authorization: Bearer <token>` の値をそのまま渡せるヘッダーオブジェクト
 */
export const insertTestSession = async (
    db: DrizzleD1Database<typeof schema>,
    overrides?: { userId?: string; token?: string },
): Promise<Record<string, string>> => {
    const userId = overrides?.userId ?? TEST_SESSION_USER_ID;
    const token = overrides?.token ?? TEST_SESSION_TOKEN;
    const credentialId = `${userId}-credential`;

    await db
        .insert(schema.user)
        .values({ id: userId, nickname: 'テストユーザー' });
    await db.insert(schema.credential).values({
        id: credentialId,
        userId,
        publicKey: Buffer.from('test-public-key'),
        deviceLabel: 'テスト端末',
    });
    await db.insert(schema.session).values({
        token,
        userId,
        credentialId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return { [SESSION_AUTH_HEADER]: `Bearer ${token}` };
};
