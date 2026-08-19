/**
 * internalReleaseNoteController.test.ts - InternalReleaseNoteController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                     | 期待値                       |
 * |---|----------|----------------------------|--------------------------------|
 * | 1 | list     | usecase.listAll()が正常    | 200 + リリースノート配列       |
 * | 2 | list     | usecase.listAll()が例外    | 500                             |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import type { ReleaseNote } from '@race-schedule/core';

import { InternalReleaseNoteController } from '../../../src/controller/internalReleaseNoteController';
import type { IReleaseNoteUsecase } from '../../../src/usecase/interface/IReleaseNoteUsecase';

interface MockReleaseNoteUsecase {
    listPublic: Mock<IReleaseNoteUsecase['listPublic']>;
    listAll: Mock<IReleaseNoteUsecase['listAll']>;
    upsert: Mock<IReleaseNoteUsecase['upsert']>;
}

const ALL_RELEASE_NOTES: ReleaseNote[] = [
    {
        tag_name: 'v2.0.0',
        name: 'v2.0.0',
        body: '本文',
        published_at: '2026-08-16T00:00:00Z',
        draft: false,
        prerelease: false,
        source_repo: 'race-scheduler',
    },
    {
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        body: '本文',
        published_at: '2026-01-01T00:00:00Z',
        draft: false,
        prerelease: false,
        source_repo: 'race-schedule',
    },
];

const createMockUsecase = (
    overrides: Partial<MockReleaseNoteUsecase> = {},
): MockReleaseNoteUsecase => ({
    listPublic: mock(() => Promise.resolve(ALL_RELEASE_NOTES)),
    listAll: mock(() => Promise.resolve(ALL_RELEASE_NOTES)),
    upsert: mock(() => Promise.resolve(undefined)),
    ...overrides,
});

describe('api/controller/InternalReleaseNoteController', () => {
    describe('list', () => {
        it('1: usecase.listAll()が正常な場合は200と全件（非公開分含む）を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalReleaseNoteController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(200);
            const body = (await res.json()) as ReleaseNote[];
            expect(body).toEqual(ALL_RELEASE_NOTES);
            expect(usecase.listAll).toHaveBeenCalledTimes(1);
        });

        it('2: usecase.listAll()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                listAll: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new InternalReleaseNoteController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(500);
        });
    });
});
