/**
 * joinRequestsController.test.ts - JoinRequestsController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                          | 期待値                     |
 * |---|----------|--------------------------------|------------------------------|
 * | 1 | page     | test環境（既定）                | 200・HTML（テスト環境向けfavicon/バッジ） |
 * | 2 | list     | usecase.list()が正常            | 200 + {requests:[...]}      |
 * | 3 | list     | usecase.list()が例外            | 500                          |
 * | 4 | approve  | usecase.approve()が正常         | 200 + {ok:true}              |
 * | 5 | approve  | usecase.approve()が例外         | 500                          |
 * | 6 | reject   | usecase.reject()が正常          | 200 + {ok:true}              |
 * | 7 | reject   | usecase.reject()が例外          | 500                          |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it, type Mock, mock } from 'bun:test';
import 'reflect-metadata';

import { JoinRequestsController } from '../../../src/controller/joinRequestsController';
import type { JoinRequestSummary } from '../../../src/dto/joinRequest';
import type { IJoinRequestsUsecase } from '../../../src/usecase/interface/IJoinRequestsUsecase';

interface MockJoinRequestsUsecase {
    list: Mock<IJoinRequestsUsecase['list']>;
    approve: Mock<IJoinRequestsUsecase['approve']>;
    reject: Mock<IJoinRequestsUsecase['reject']>;
}

const SAMPLE_REQUESTS: JoinRequestSummary[] = [
    { id: 'request-1', nickname: 'にっくねーむ' },
];

const createMockUsecase = (
    overrides: Partial<MockJoinRequestsUsecase> = {},
): MockJoinRequestsUsecase => ({
    list: mock(() => Promise.resolve(SAMPLE_REQUESTS)),
    approve: mock(() => Promise.resolve()),
    reject: mock(() => Promise.resolve()),
    ...overrides,
});

describe('admin/controller/JoinRequestsController', () => {
    describe('page', () => {
        it('1: test環境（既定）では200とテスト環境向けHTMLを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new JoinRequestsController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('<!doctype html>');
            expect(html).toContain('テスト環境');
        });
    });

    describe('list', () => {
        it('2: usecase.list()が正常な場合は200と参加リクエスト一覧を返す', async () => {
            const usecase = createMockUsecase();
            const controller = new JoinRequestsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                requests: JoinRequestSummary[];
            };
            expect(body.requests).toEqual(SAMPLE_REQUESTS);
        });

        it('3: usecase.list()が例外を投げた場合は500を返す', async () => {
            const usecase = createMockUsecase({
                list: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new JoinRequestsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(500);
        });
    });

    describe('approve', () => {
        it('4: usecase.approve()が正常な場合は200と{ok:true}を返す', async () => {
            const usecase = createMockUsecase();
            const controller = new JoinRequestsController(usecase);

            const res = await controller.approve('request-1');

            expect(res.status).toBe(200);
            expect(usecase.approve).toHaveBeenCalledWith('request-1');
            const body = (await res.json()) as { ok: boolean };
            expect(body.ok).toBe(true);
        });

        it('5: usecase.approve()が例外を投げた場合は500を返す', async () => {
            const usecase = createMockUsecase({
                approve: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new JoinRequestsController(usecase);

            const res = await controller.approve('request-1');

            expect(res.status).toBe(500);
        });
    });

    describe('reject', () => {
        it('6: usecase.reject()が正常な場合は200と{ok:true}を返す', async () => {
            const usecase = createMockUsecase();
            const controller = new JoinRequestsController(usecase);

            const res = await controller.reject('request-1');

            expect(res.status).toBe(200);
            expect(usecase.reject).toHaveBeenCalledWith('request-1');
            const body = (await res.json()) as { ok: boolean };
            expect(body.ok).toBe(true);
        });

        it('7: usecase.reject()が例外を投げた場合は500を返す', async () => {
            const usecase = createMockUsecase({
                reject: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new JoinRequestsController(usecase);

            const res = await controller.reject('request-1');

            expect(res.status).toBe(500);
        });
    });
});
