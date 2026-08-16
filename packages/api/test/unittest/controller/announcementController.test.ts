/**
 * announcementController.test.ts - AnnouncementController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件           | 期待値                     |
 * |---|----------|------------------|------------------------------|
 * | 1 | get      | usecase正常終了 | 200 + usecaseの返り値       |
 * | 2 | get      | usecase例外     | 500                          |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import type { Announcement } from '@race-schedule/core';

import { AnnouncementController } from '../../../src/controller/announcementController';
import type { IAnnouncementUsecase } from '../../../src/usecase/interface/IAnnouncementUsecase';

interface MockAnnouncementUsecase {
    getAnnouncement: Mock<IAnnouncementUsecase['getAnnouncement']>;
}

const VALID_ANNOUNCEMENT: Announcement = {
    schemaVersion: 1,
    enabled: false,
    message: 'テストメッセージ',
};

const createMockUsecase = (
    overrides: Partial<MockAnnouncementUsecase> = {},
): MockAnnouncementUsecase => ({
    getAnnouncement: mock(() => Promise.resolve(VALID_ANNOUNCEMENT)),
    ...overrides,
});

describe('api/controller/AnnouncementController', () => {
    describe('get', () => {
        it('1: usecase正常終了の場合は200とusecaseの返り値を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new AnnouncementController(usecase);

            const res = await controller.get();

            expect(res.status).toBe(200);
            const body = (await res.json()) as Announcement;
            expect(body).toEqual(VALID_ANNOUNCEMENT);
        });

        it('2: usecaseが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                getAnnouncement: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new AnnouncementController(usecase);

            const res = await controller.get();

            expect(res.status).toBe(500);
        });
    });
});
