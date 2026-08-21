/**
 * schemas/releaseNoteSchema テスト
 *
 * ## デシジョンテーブル: releaseNoteSchema
 *
 * | #    | 入力                                                    | 期待結果      |
 * |------|-----------------------------------------------------------|---------------|
 * | T-01 | 必須フィールドすべて + source_repo あり                    | success:true  |
 * | T-02 | source_repo 省略（optional）                               | success:true  |
 * | T-03 | name/body/published_at が null（nullable）                | success:true  |
 * | T-04 | tag_name 省略                                              | success:false |
 * | T-05 | tag_name が空文字（min(1)違反）                            | success:false |
 * | T-06 | draft 省略（必須boolean）                                  | success:false |
 * | T-07 | prerelease 省略（必須boolean）                             | success:false |
 * | T-08 | source_repo が未知の値（enum違反）                         | success:false |
 * | T-11 | source_repo が 'race-schedule'                             | success:true  |
 *
 * ## デシジョンテーブル: releaseNoteWriteSchema
 *
 * | #    | 入力                                                    | 期待結果      |
 * |------|-----------------------------------------------------------|---------------|
 * | T-09 | source_repo あり（'race-schedule'）                        | success:true  |
 * | T-10 | source_repo 省略（write版では必須）                        | success:false |
 * | T-12 | source_repo が 'race-scheduler'                            | success:true  |
 */

import { describe, expect, it } from 'bun:test';

import {
    releaseNoteSchema,
    releaseNoteWriteSchema,
} from '../../../src/schemas/releaseNoteSchema';

const validReleaseNote = {
    tag_name: 'v1.0.0',
    name: 'Release 1.0.0',
    body: '初回リリース',
    published_at: '2026-08-21T00:00:00Z',
    draft: false,
    prerelease: false,
};

describe('schemas/releaseNoteSchema', () => {
    it('T-01: 必須フィールドすべて＋source_repoありの場合パースに成功すること', () => {
        const result = releaseNoteSchema.safeParse({
            ...validReleaseNote,
            source_repo: 'race-scheduler',
        });

        expect(result.success).toBe(true);
    });

    it('T-02: source_repoを省略した場合パースに成功すること', () => {
        const result = releaseNoteSchema.safeParse(validReleaseNote);

        expect(result.success).toBe(true);
    });

    it('T-03: name/body/published_atがnullの場合パースに成功すること', () => {
        const result = releaseNoteSchema.safeParse({
            ...validReleaseNote,
            name: null,
            body: null,
            published_at: null,
        });

        expect(result.success).toBe(true);
    });

    it('T-04: tag_nameを省略した場合パースに失敗すること', () => {
        const { tag_name: _tagName, ...withoutTagName } = validReleaseNote;
        const result = releaseNoteSchema.safeParse(withoutTagName);

        expect(result.success).toBe(false);
    });

    it('T-05: tag_nameが空文字の場合パースに失敗すること', () => {
        const result = releaseNoteSchema.safeParse({
            ...validReleaseNote,
            tag_name: '',
        });

        expect(result.success).toBe(false);
    });

    it('T-06: draftを省略した場合パースに失敗すること', () => {
        const { draft: _draft, ...withoutDraft } = validReleaseNote;
        const result = releaseNoteSchema.safeParse(withoutDraft);

        expect(result.success).toBe(false);
    });

    it('T-07: prereleaseを省略した場合パースに失敗すること', () => {
        const { prerelease: _prerelease, ...withoutPrerelease } =
            validReleaseNote;
        const result = releaseNoteSchema.safeParse(withoutPrerelease);

        expect(result.success).toBe(false);
    });

    it('T-08: source_repoが未知の値の場合パースに失敗すること', () => {
        const result = releaseNoteSchema.safeParse({
            ...validReleaseNote,
            source_repo: 'unknown-repo',
        });

        expect(result.success).toBe(false);
    });

    it("T-11: source_repoが'race-schedule'の場合パースに成功すること", () => {
        const result = releaseNoteSchema.safeParse({
            ...validReleaseNote,
            source_repo: 'race-schedule',
        });

        expect(result.success).toBe(true);
    });
});

describe('schemas/releaseNoteWriteSchema', () => {
    it('T-09: source_repoありの場合パースに成功すること', () => {
        const result = releaseNoteWriteSchema.safeParse({
            ...validReleaseNote,
            source_repo: 'race-schedule',
        });

        expect(result.success).toBe(true);
    });

    it('T-10: source_repoを省略した場合パースに失敗すること（write版では必須）', () => {
        const result = releaseNoteWriteSchema.safeParse(validReleaseNote);

        expect(result.success).toBe(false);
    });

    it("T-12: source_repoが'race-scheduler'の場合パースに成功すること", () => {
        const result = releaseNoteWriteSchema.safeParse({
            ...validReleaseNote,
            source_repo: 'race-scheduler',
        });

        expect(result.success).toBe(true);
    });
});
