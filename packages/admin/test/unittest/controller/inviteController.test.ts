/**
 * inviteController.test.ts - InviteController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                               | 期待値                     |
 * |---|----------|-------------------------------------|------------------------------|
 * | 1 | page     | test環境（既定）                     | 200・HTML（テスト環境向けfavicon/バッジ） |
 * | 2 | issue    | usecase.issueInvite()が正常          | 201 + {token, inviteUrl}    |
 * | 3 | issue    | bodyが不正（memoが長すぎる）         | 400                          |
 * | 4 | issue    | usecase.issueInvite()が例外          | 500                          |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it, type Mock, mock } from 'bun:test';
import 'reflect-metadata';

import { InviteController } from '../../../src/controller/inviteController';
import type { InviteIssueResult } from '../../../src/dto/invite';
import type { IInviteUsecase } from '../../../src/usecase/interface/IInviteUsecase';

interface MockInviteUsecase {
    issueInvite: Mock<IInviteUsecase['issueInvite']>;
}

const SAMPLE_RESULT: InviteIssueResult = { token: 'invite-token' };

const createMockUsecase = (
    overrides: Partial<MockInviteUsecase> = {},
): MockInviteUsecase => ({
    issueInvite: mock(() => Promise.resolve(SAMPLE_RESULT)),
    ...overrides,
});

const buildIssueRequest = (body: unknown): Request =>
    new Request('http://localhost/invite/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

describe('admin/controller/InviteController', () => {
    describe('page', () => {
        it('1: test環境（既定）では200とテスト環境向けHTMLを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InviteController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('<!doctype html>');
            expect(html).toContain('テスト環境');
        });
    });

    describe('issue', () => {
        it('2: usecase.issueInvite()が正常な場合は201と{token, inviteUrl}を返す', async () => {
            const usecase = createMockUsecase();
            const controller = new InviteController(usecase);
            const req = buildIssueRequest({ memo: 'テストメモ' });

            const res = await controller.issue(req);

            expect(res.status).toBe(201);
            expect(usecase.issueInvite).toHaveBeenCalledWith('テストメモ');
            const body = (await res.json()) as {
                token: string;
                inviteUrl: string;
            };
            expect(body.token).toBe('invite-token');
            expect(body.inviteUrl).toBe('/invite/invite-token');
        });

        it('3: bodyが不正な場合は400を返す', async () => {
            const usecase = createMockUsecase();
            const controller = new InviteController(usecase);
            const req = buildIssueRequest({ memo: 'a'.repeat(201) });

            const res = await controller.issue(req);

            expect(res.status).toBe(400);
        });

        it('4: usecase.issueInvite()が例外を投げた場合は500を返す', async () => {
            const usecase = createMockUsecase({
                issueInvite: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new InviteController(usecase);
            const req = buildIssueRequest({ memo: null });

            const res = await controller.issue(req);

            expect(res.status).toBe(500);
        });
    });
});
