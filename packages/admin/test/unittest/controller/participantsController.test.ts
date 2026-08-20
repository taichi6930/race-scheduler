/**
 * participantsController.test.ts - ParticipantsController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                          | 期待値                     |
 * |---|----------|--------------------------------|------------------------------|
 * | 1 | page     | test環境（既定）                | 200・HTML（テスト環境向けfavicon/バッジ） |
 * | 2 | list     | usecase.list()が正常            | 200 + {participants:[...]}  |
 * | 3 | list     | usecase.list()が例外            | 500                          |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it, type Mock, mock } from 'bun:test';
import 'reflect-metadata';

import { ParticipantsController } from '../../../src/controller/participantsController';
import type { ParticipantSummary } from '../../../src/dto/participant';
import type { IParticipantsUsecase } from '../../../src/usecase/interface/IParticipantsUsecase';

interface MockParticipantsUsecase {
    list: Mock<IParticipantsUsecase['list']>;
}

const SAMPLE_PARTICIPANTS: ParticipantSummary[] = [
    {
        userId: 'user-1',
        nickname: 'にっくねーむ',
        inviteMemo: 'メモ',
        credentialId: 'credential-1',
        deviceLabel: 'iPhone',
        lastUsedAt: '2026-08-19T00:00:00.000Z',
        userCreatedAt: '2026-08-01T00:00:00.000Z',
    },
];

const createMockUsecase = (
    overrides: Partial<MockParticipantsUsecase> = {},
): MockParticipantsUsecase => ({
    list: mock(() => Promise.resolve(SAMPLE_PARTICIPANTS)),
    ...overrides,
});

describe('admin/controller/ParticipantsController', () => {
    describe('page', () => {
        it('1: test環境（既定）では200とテスト環境向けHTMLを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new ParticipantsController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('<!doctype html>');
            expect(html).toContain('テスト環境');
        });
    });

    describe('list', () => {
        it('2: usecase.list()が正常な場合は200と参加者一覧を返す', async () => {
            const usecase = createMockUsecase();
            const controller = new ParticipantsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                participants: ParticipantSummary[];
            };
            expect(body.participants).toEqual(SAMPLE_PARTICIPANTS);
        });

        it('3: usecase.list()が例外を投げた場合は500を返す', async () => {
            const usecase = createMockUsecase({
                list: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new ParticipantsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(500);
        });
    });
});
