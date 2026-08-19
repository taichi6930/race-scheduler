import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';
import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IReleaseNoteRepository } from '../../repository/interface/IReleaseNoteRepository';
import type { IReleaseNoteUsecase } from '../interface/IReleaseNoteUsecase';

/** 公開front（`GET /release-notes`）に返してよいリリースの`source_repo`。 */
const PUBLIC_SOURCE_REPO = 'race-scheduler';

/**
 * 更新履歴（What's New画面）Usecase。
 * `release_note` テーブルの内容はフィルタ・整形を行わずそのまま返す
 * （front側の既存パースロジックがGitHub Releases APIと同じ形を前提にしているため）。
 * ただし公開front向け（[listPublic]）は、分割元の非公開リポジトリ（race-schedule）分を
 * 除外する（NFR: 非公開リリースの本文をpublicなfrontへ配信しない）。
 */
@LogAllMethods
@injectable()
export class ReleaseNoteUsecase implements IReleaseNoteUsecase {
    public constructor(
        @inject(DI_TOKENS.ReleaseNoteRepository)
        private readonly releaseNoteRepository: IReleaseNoteRepository,
    ) {}

    public async listPublic(): Promise<ReleaseNote[]> {
        const all = await this.releaseNoteRepository.findAll();
        return all.filter((note) => note.source_repo === PUBLIC_SOURCE_REPO);
    }

    public listAll(): Promise<ReleaseNote[]> {
        return this.releaseNoteRepository.findAll();
    }

    public upsert(note: ReleaseNoteWrite): Promise<void> {
        return this.releaseNoteRepository.upsert(note);
    }
}
