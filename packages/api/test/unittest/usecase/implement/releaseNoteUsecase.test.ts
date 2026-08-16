/**
 * releaseNoteUsecase.test.ts - ReleaseNoteUsecase ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | ReleaseNoteRepository.findAll()の結果 | 期待値                                   |
 * |---|-----------------------------------------|-------------------------------------------|
 * | 1 | 空配列                                    | 空配列をそのまま返す                       |
 * | 2 | 複数件                                    | repositoryの返り値をそのまま返す           |
 *
 * | # | upsert                                    | 期待値                                   |
 * |---|-----------------------------------------|-------------------------------------------|
 * | 3 | 呼び出し                                  | repository.upsertへそのまま委譲する         |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';

import type { IReleaseNoteRepository } from '../../../../src/repository/interface/IReleaseNoteRepository';
import { ReleaseNoteUsecase } from '../../../../src/usecase/implement/releaseNoteUsecase';

interface MockReleaseNoteRepository {
    findAll: Mock<IReleaseNoteRepository['findAll']>;
    upsert: Mock<IReleaseNoteRepository['upsert']>;
}

const createMockReleaseNoteRepository = (
    findAllResult: ReleaseNote[],
): MockReleaseNoteRepository => ({
    findAll: mock(() => Promise.resolve(findAllResult)),
    upsert: mock(() => Promise.resolve(undefined)),
});

describe('api/usecase/ReleaseNoteUsecase', () => {
    describe('list', () => {
        it('1: repositoryが空配列を返す場合は空配列をそのまま返すこと', async () => {
            const repository = createMockReleaseNoteRepository([]);
            const usecase = new ReleaseNoteUsecase(repository);

            const result = await usecase.list();

            expect(result).toEqual([]);
        });

        it('2: repositoryが複数件返す場合はそのまま返すこと', async () => {
            const releaseNotes: ReleaseNote[] = [
                {
                    tag_name: 'v2.0.0',
                    name: 'v2.0.0',
                    body: '本文',
                    published_at: '2026-08-16T00:00:00Z',
                    draft: false,
                    prerelease: false,
                },
            ];
            const repository = createMockReleaseNoteRepository(releaseNotes);
            const usecase = new ReleaseNoteUsecase(repository);

            const result = await usecase.list();

            expect(result).toEqual(releaseNotes);
            expect(repository.findAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('upsert', () => {
        it('3: 呼び出された場合はrepository.upsertへそのまま委譲すること', async () => {
            const repository = createMockReleaseNoteRepository([]);
            const usecase = new ReleaseNoteUsecase(repository);
            const note: ReleaseNoteWrite = {
                tag_name: 'v2.0.0',
                name: 'v2.0.0',
                body: '本文',
                published_at: '2026-08-16T00:00:00Z',
                draft: false,
                prerelease: false,
                source_repo: 'race-scheduler',
            };

            await usecase.upsert(note);

            expect(repository.upsert).toHaveBeenCalledTimes(1);
            expect(repository.upsert).toHaveBeenCalledWith(note);
        });
    });
});
