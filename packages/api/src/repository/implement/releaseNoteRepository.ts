import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';
import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { desc, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { releaseNote } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { IReleaseNoteRepository } from '../interface/IReleaseNoteRepository';

/**
 * 更新履歴（`release_note` テーブル）リポジトリのDB実装。
 */
@LogAllMethods
@injectable()
export class ReleaseNoteRepository implements IReleaseNoteRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async findAll(): Promise<ReleaseNote[]> {
        const rows = await this.drizzleGateway.db
            .select()
            .from(releaseNote)
            .orderBy(desc(releaseNote.publishedAt));

        return rows.map((row) => ({
            tag_name: row.tagName,
            name: row.name,
            body: row.body,
            published_at: row.publishedAt,
            draft: row.draft !== 0,
            prerelease: row.prerelease !== 0,
            source_repo: row.sourceRepo,
        }));
    }

    public async upsert(note: ReleaseNoteWrite): Promise<void> {
        await this.drizzleGateway.db
            .insert(releaseNote)
            .values({
                tagName: note.tag_name,
                name: note.name,
                body: note.body,
                publishedAt: note.published_at,
                draft: note.draft ? 1 : 0,
                prerelease: note.prerelease ? 1 : 0,
                sourceRepo: note.source_repo,
            })
            .onConflictDoUpdate({
                target: [releaseNote.tagName, releaseNote.sourceRepo],
                set: {
                    name: sql`excluded.name`,
                    body: sql`excluded.body`,
                    publishedAt: sql`excluded.published_at`,
                    draft: sql`excluded.draft`,
                    prerelease: sql`excluded.prerelease`,
                },
            });
    }
}
