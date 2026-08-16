import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';
import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IReleaseNoteRepository } from '../../repository/interface/IReleaseNoteRepository';
import type { IReleaseNoteUsecase } from '../interface/IReleaseNoteUsecase';

/**
 * 更新履歴（What's New画面）Usecase。
 * `release_note` テーブルの全件をそのまま返す（フィルタ・整形は行わない、
 * front側の既存パースロジックがGitHub Releases APIと同じ形を前提にしているため）。
 */
@LogAllMethods
@injectable()
export class ReleaseNoteUsecase implements IReleaseNoteUsecase {
    public constructor(
        @inject(DI_TOKENS.ReleaseNoteRepository)
        private readonly releaseNoteRepository: IReleaseNoteRepository,
    ) {}

    public list(): Promise<ReleaseNote[]> {
        return this.releaseNoteRepository.findAll();
    }

    public upsert(note: ReleaseNoteWrite): Promise<void> {
        return this.releaseNoteRepository.upsert(note);
    }
}
