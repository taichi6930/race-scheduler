/**
 * releaseNotesController.test.ts - ReleaseNotesController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                     | 期待値                           |
 * |---|----------|----------------------------|--------------------------------------|
 * | 1 | page     | test環境（既定）             | 200・HTML（テスト環境向けfavicon/バッジ） |
 * | 2 | list     | usecase.list()が正常         | 200 + リリースノート配列          |
 * | 3 | list     | usecase.list()が例外         | 500                                  |
 * | 4 | page     | production環境               | 200・HTML（production向けfavicon/バッジ） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, describe, expect, it, type Mock, mock } from 'bun:test';
import type { ReleaseNote } from '@race-schedule/core';
import 'reflect-metadata';

import { ReleaseNotesController } from '../../../src/controller/releaseNotesController';
import type { IReleaseNotesUsecase } from '../../../src/usecase/interface/IReleaseNotesUsecase';

interface MockReleaseNotesUsecase {
    list: Mock<IReleaseNotesUsecase['list']>;
}

const SAMPLE_NOTES: ReleaseNote[] = [
    {
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        body: '本文',
        published_at: '2026-08-16T00:00:00Z',
        draft: false,
        prerelease: false,
        source_repo: 'race-schedule',
    },
];

const createMockUsecase = (
    overrides: Partial<MockReleaseNotesUsecase> = {},
): MockReleaseNotesUsecase => ({
    list: mock(() => Promise.resolve(SAMPLE_NOTES)),
    ...overrides,
});

describe('admin/controller/ReleaseNotesController', () => {
    describe('page', () => {
        it('1: test環境（既定）では200とテスト環境向けHTMLを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new ReleaseNotesController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('<!doctype html>');
            expect(html).toContain('テスト環境');
        });
    });

    describe('list', () => {
        it('2: usecase.list()が正常な場合は200とリリースノート配列を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new ReleaseNotesController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(200);
            const body = (await res.json()) as ReleaseNote[];
            expect(body).toEqual(SAMPLE_NOTES);
        });

        it('3: usecase.list()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                list: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new ReleaseNotesController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(500);
        });
    });

    describe('production環境', () => {
        const originalAdminEnvironment = process.env.ADMIN_ENVIRONMENT;

        afterEach(() => {
            process.env.ADMIN_ENVIRONMENT = originalAdminEnvironment;
        });

        it('4: pageはproduction向けfaviconとバッジを含むHTMLを返すこと', async () => {
            process.env.ADMIN_ENVIRONMENT = 'production';
            const usecase = createMockUsecase();
            const controller = new ReleaseNotesController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('本番環境');
        });
    });
});
