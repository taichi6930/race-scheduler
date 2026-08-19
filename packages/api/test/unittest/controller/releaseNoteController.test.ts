/**
 * releaseNoteController.test.ts - ReleaseNoteController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件           | 期待値                     |
 * |---|----------|------------------|------------------------------|
 * | 1 | get      | usecase正常終了 | 200 + usecaseの返り値       |
 * | 2 | get      | usecase例外     | 500                          |
 * | 3 | create   | 正常なbody      | 201                          |
 * | 4 | create   | bodyが不正（source_repo不正） | 400            |
 * | 5 | create   | usecase.upsert()がValidationErrorをthrow | 400 |
 * | 6 | create   | usecase.upsert()が予期しない例外をthrow  | 500 |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import {
    type ReleaseNote,
    type ReleaseNoteWrite,
    ValidationError,
} from '@race-schedule/core';

import { ReleaseNoteController } from '../../../src/controller/releaseNoteController';
import type { IReleaseNoteUsecase } from '../../../src/usecase/interface/IReleaseNoteUsecase';

interface MockReleaseNoteUsecase {
    listPublic: Mock<IReleaseNoteUsecase['listPublic']>;
    listAll: Mock<IReleaseNoteUsecase['listAll']>;
    upsert: Mock<IReleaseNoteUsecase['upsert']>;
}

const VALID_RELEASE_NOTES: ReleaseNote[] = [
    {
        tag_name: 'v2.0.0',
        name: 'v2.0.0',
        body: '本文',
        published_at: '2026-08-16T00:00:00Z',
        draft: false,
        prerelease: false,
    },
];

const VALID_WRITE_BODY: ReleaseNoteWrite = {
    tag_name: 'v2.0.0',
    name: 'v2.0.0',
    body: '本文',
    published_at: '2026-08-16T00:00:00Z',
    draft: false,
    prerelease: false,
    source_repo: 'race-scheduler',
};

const createMockUsecase = (
    overrides: Partial<MockReleaseNoteUsecase> = {},
): MockReleaseNoteUsecase => ({
    listPublic: mock(() => Promise.resolve(VALID_RELEASE_NOTES)),
    listAll: mock(() => Promise.resolve(VALID_RELEASE_NOTES)),
    upsert: mock(() => Promise.resolve(undefined)),
    ...overrides,
});

describe('api/controller/ReleaseNoteController', () => {
    describe('get', () => {
        it('1: usecase正常終了の場合は200とusecaseの返り値を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new ReleaseNoteController(usecase);

            const res = await controller.get();

            expect(res.status).toBe(200);
            const body = (await res.json()) as ReleaseNote[];
            expect(body).toEqual(VALID_RELEASE_NOTES);
        });

        it('2: usecaseが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                listPublic: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new ReleaseNoteController(usecase);

            const res = await controller.get();

            expect(res.status).toBe(500);
        });
    });

    describe('create', () => {
        const buildCreateRequest = (body: unknown): Request =>
            new Request('http://localhost/release-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

        it('3: 正常なbodyの場合は201を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new ReleaseNoteController(usecase);
            const req = buildCreateRequest(VALID_WRITE_BODY);

            const res = await controller.create(req);

            expect(res.status).toBe(201);
            expect(usecase.upsert).toHaveBeenCalledWith(VALID_WRITE_BODY);
        });

        it('4: bodyが不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new ReleaseNoteController(usecase);
            const req = buildCreateRequest({
                ...VALID_WRITE_BODY,
                source_repo: 'unknown-repo',
            });

            const res = await controller.create(req);

            expect(res.status).toBe(400);
        });

        it('5: usecase.upsert()がValidationErrorをthrowした場合は400を返すこと', async () => {
            const usecase = createMockUsecase({
                upsert: mock(() => {
                    throw new ValidationError('不正なリリースノートです');
                }),
            });
            const controller = new ReleaseNoteController(usecase);
            const req = buildCreateRequest(VALID_WRITE_BODY);

            const res = await controller.create(req);

            expect(res.status).toBe(400);
        });

        it('6: usecase.upsert()が予期しない例外をthrowした場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                upsert: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new ReleaseNoteController(usecase);
            const req = buildCreateRequest(VALID_WRITE_BODY);

            const res = await controller.create(req);

            expect(res.status).toBe(500);
        });
    });
});
