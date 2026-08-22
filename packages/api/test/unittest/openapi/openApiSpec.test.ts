/**
 * openApiSpec テスト
 *
 * `openApiSpec.ts` は `router.ts` の `APP_AUTH_ROUTES`（招待制ログイン導入時に追加された
 * 認可方針）と手動で同期させている手書きのOpenAPI仕様。両者がずれると、
 * ドキュメント上は認証不要に見えるのに実際は401になる、という利用者を混乱させる状態に
 * 戻ってしまう。本テストはこのドリフトを機械的に検知する。
 *
 * ## デシジョンテーブル
 * | # | Method | Path                  | APP_AUTH_ROUTES上の方針 | 期待するsecurity                                |
 * |---|--------|-----------------------|--------------------------|--------------------------------------------------|
 * | 1 | GET    | /health               | public                   | []                                                |
 * | 2 | GET    | /ui/announcement      | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * | 3 | GET    | /ui/race-detail       | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * | 4 | GET    | /release-notes        | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * | 5 | GET    | /calendar             | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * | 6 | GET    | /place                | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * | 7 | GET    | /race                 | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * | 8 | GET    | /race/calendar-event  | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * | 9 | GET    | /race/players         | service-or-session        | [{ServiceAuthToken},{SessionBearer}]              |
 * |10 | GET    | /player               | session-only              | [{SessionBearer}]                                 |
 * |11 | POST   | /player               | session-only              | [{SessionBearer}]                                 |
 * |12 | POST   | /push/subscription    | session-only              | [{SessionBearer}]                                 |
 * |13 | DELETE | /push/subscription    | session-only              | [{SessionBearer}]                                 |
 * |14 | POST   | /push/request         | session-only              | [{SessionBearer}]                                 |
 * |15 | DELETE | /push/request         | session-only              | [{SessionBearer}]                                 |
 * |16 | POST   | /push/test            | session-only              | [{SessionBearer}]                                 |
 */
import 'reflect-metadata';

import { describe, expect, it } from 'bun:test';

import { openApiSpec } from '../../../src/openapi/openApiSpec';
import { APP_AUTH_ROUTES } from '../../../src/router';

const EXPECTED_SECURITY: Record<string, unknown[]> = {
    'GET /health': [],
    'GET /ui/announcement': [{ ServiceAuthToken: [] }, { SessionBearer: [] }],
    'GET /ui/race-detail': [{ ServiceAuthToken: [] }, { SessionBearer: [] }],
    'GET /release-notes': [{ ServiceAuthToken: [] }, { SessionBearer: [] }],
    'GET /calendar': [{ ServiceAuthToken: [] }, { SessionBearer: [] }],
    'GET /place': [{ ServiceAuthToken: [] }, { SessionBearer: [] }],
    'GET /race': [{ ServiceAuthToken: [] }, { SessionBearer: [] }],
    'GET /race/calendar-event': [
        { ServiceAuthToken: [] },
        { SessionBearer: [] },
    ],
    'GET /race/players': [{ ServiceAuthToken: [] }, { SessionBearer: [] }],
    'GET /player': [{ SessionBearer: [] }],
    'POST /player': [{ SessionBearer: [] }],
    'POST /push/subscription': [{ SessionBearer: [] }],
    'DELETE /push/subscription': [{ SessionBearer: [] }],
    'POST /push/request': [{ SessionBearer: [] }],
    'DELETE /push/request': [{ SessionBearer: [] }],
    'POST /push/test': [{ SessionBearer: [] }],
};

/** `security` を持つべき (method, path) の一覧。`APP_AUTH_ROUTES` は完全一致のみ持つため単純検索でよい。 */
const documentedOperations = Object.keys(EXPECTED_SECURITY).map((key) => {
    const [method, path] = key.split(' ');
    return { key, method, path };
});

describe('openApiSpec', () => {
    it.each(documentedOperations.map(({ key }) => [key] as const))(
        '%s の security は APP_AUTH_ROUTES の方針と一致すること',
        (key) => {
            const { method, path } = documentedOperations.find(
                (entry) => entry.key === key,
            )!;

            const route = APP_AUTH_ROUTES.find(
                (candidate) =>
                    candidate.method === method && candidate.path === path,
            );
            const policy = route?.policy ?? 'service-only';

            const operation = (
                openApiSpec.paths as Record<
                    string,
                    Record<string, { security?: unknown[] }>
                >
            )[path]?.[method.toLowerCase()];

            expect(operation).toBeDefined();
            expect(operation?.security).toEqual(EXPECTED_SECURITY[key]);

            // service-only（未公開の内部エンドポイント）はこのドキュメントに
            // 載せない方針（openApiSpec.tsのヘッダコメント参照）のガード。
            expect(policy).not.toBe('service-only');
        },
    );

    it('components.securitySchemes に ServiceAuthToken と SessionBearer が定義されていること', () => {
        const { securitySchemes } = openApiSpec.components;

        expect(securitySchemes.ServiceAuthToken).toEqual({
            type: 'apiKey',
            in: 'header',
            name: 'X-Service-Auth-Token',
            description: expect.any(String),
        });
        expect(securitySchemes.SessionBearer).toEqual({
            type: 'http',
            scheme: 'bearer',
            description: expect.any(String),
        });
    });
});
