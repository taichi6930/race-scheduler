/**
 * releaseNoteUsecase.test.ts - ReleaseNoteUsecase ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド    | ReleaseNoteRepository.findAll()の結果                          | 期待値                                       |
 * |---|-------------|------------------------------------------------------------------|-----------------------------------------------|
 * | 1 | listPublic  | 空配列                                                            | 空配列を返す                                   |
 * | 2 | listPublic  | race-scheduler・race-schedule混在                                | race-schedulerのみへフィルタして返す           |
 * | 3 | listAll     | race-scheduler・race-schedule混在                                | repositoryの返り値をそのまま返す（フィルタ無し） |
 *
 * | # | upsert      | 期待値                                       |
 * |---|-------------|-------------------------------------------------|
 * | 4 | 呼び出し    | repository.upsertへそのまま委譲する            |
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

const MIXED_RELEASE_NOTES: ReleaseNote[] = [
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

describe('api/usecase/ReleaseNoteUsecase', () => {
    describe('listPublic', () => {
        it('1: repositoryが空配列を返す場合は空配列を返すこと', async () => {
            const repository = createMockReleaseNoteRepository([]);
            const usecase = new ReleaseNoteUsecase(repository);

            const result = await usecase.listPublic();

            expect(result).toEqual([]);
        });

        it('2: race-schedule/race-schedulerが混在する場合はrace-schedulerのみ返すこと', async () => {
            const repository =
                createMockReleaseNoteRepository(MIXED_RELEASE_NOTES);
            const usecase = new ReleaseNoteUsecase(repository);

            const result = await usecase.listPublic();

            expect(result).toEqual([MIXED_RELEASE_NOTES[0]]);
            expect(repository.findAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('listAll', () => {
        it('3: race-schedule/race-schedulerが混在する場合はフィルタせずそのまま返すこと', async () => {
            const repository =
                createMockReleaseNoteRepository(MIXED_RELEASE_NOTES);
            const usecase = new ReleaseNoteUsecase(repository);

            const result = await usecase.listAll();

            expect(result).toEqual(MIXED_RELEASE_NOTES);
        });
    });

    describe('upsert', () => {
        it('4: 呼び出された場合はrepository.upsertへそのまま委譲すること', async () => {
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
