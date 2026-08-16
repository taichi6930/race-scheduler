/**
 * controller/response ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | json | body=object, status=200 | 200 JSON Response | Line |
 * | 2  | json | body=object, status=201 | 201 JSON Response | Branch |
 * | 3  | json | body=object, headers指定 | headers が統合されている | Branch |
 * | 4  | badRequest | message="Error" | 400 JSON Response | Line |
 * | 5  | badRequest | message="Error", status=422 | 422 JSON Response | Branch |
 * | 6  | internalError | なし | 500 JSON Response | Line |
 * | 7  | json | なし（SEC-031） | セキュリティヘッダー（CSP/X-Content-Type-Options/Referrer-Policy）が付与される | Line |
 * | 8  | badRequest | status=400 | code: 'BAD_REQUEST' が付与される（QAPI-08） | Line |
 * | 9  | badRequest | status=404 | code: 'NOT_FOUND' が付与される（QAPI-08） | Branch |
 * | 10 | errorCodeForStatus | 未知のstatus（418） | 'ERROR' にフォールバックする（QAPI-08） | Branch |
 * | 11 | internalError | なし | code: 'INTERNAL_ERROR' が付与される（QAPI-08） | Line |
 */

import { describe, expect, it } from 'bun:test';

import {
    badRequest,
    errorCodeForStatus,
    internalError,
    json,
} from '../../../src/http/response';

describe('json', () => {
    it('#1: デフォルトの200 JSONレスポンスを生成する', async () => {
        const body = { message: 'hello' };

        const response = json(body);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual(body);
    });

    it('#2: 指定したステータスコードで生成する', async () => {
        const body = { id: 1 };

        const response = json(body, 201);

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data).toEqual(body);
    });

    it('#3: 追加ヘッダーが正しく含まれる', () => {
        const response = json({}, 200, { 'X-Custom': 'test' });

        expect(response.headers.get('X-Custom')).toBe('test');
    });

    it('#7: セキュリティヘッダーが付与される', () => {
        const response = json({});

        expect(response.headers.get('Content-Security-Policy')).toBe(
            "default-src 'none'",
        );
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    });
});

describe('badRequest', () => {
    it('#4: デフォルトの400エラーレスポンスを生成する', async () => {
        const message = 'Invalid input';

        const response = badRequest(message);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect((data as { message: string }).message).toBe(message);
        expect((data as { status: number }).status).toBe(400);
    });

    it('#5: 指定したステータスコードでエラーレスポンスを生成する', async () => {
        const message = 'Unprocessable Entity';

        const response = badRequest(message, 422);

        expect(response.status).toBe(422);
        const data = await response.json();
        expect((data as { status: number }).status).toBe(422);
    });

    it('#8: status=400の場合にcode: BAD_REQUESTが付与される', async () => {
        const response = badRequest('Invalid input');

        const data = await response.json();
        expect((data as { code: string }).code).toBe('BAD_REQUEST');
    });

    it('#9: status=404の場合にcode: NOT_FOUNDが付与される', async () => {
        const response = badRequest('Not found', 404);

        const data = await response.json();
        expect((data as { code: string }).code).toBe('NOT_FOUND');
    });
});

describe('errorCodeForStatus', () => {
    it('#10: 未知のstatus(418)はERRORにフォールバックする', () => {
        expect(errorCodeForStatus(418)).toBe('ERROR');
    });
});

describe('internalError', () => {
    it('#6: 500エラーレスポンスを生成する', async () => {
        const response = internalError();

        expect(response.status).toBe(500);
        const data = await response.json();
        expect((data as { status: number }).status).toBe(500);
        expect((data as { message: string }).message).toBe(
            'Internal Server Error',
        );
    });

    it('#11: code: INTERNAL_ERRORが付与される', async () => {
        const response = internalError();

        const data = await response.json();
        expect((data as { code: string }).code).toBe('INTERNAL_ERROR');
    });
});
