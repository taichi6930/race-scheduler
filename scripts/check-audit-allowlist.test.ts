/**
 * check-audit-allowlist.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * `bun audit`のブロッキング化に備えるDEP-020の要となる検証ロジックのため
 * UTを用意する。実ファイル（docs/security/audit-allowlist.json）には触れず、
 * 一時ディレクトリのfixtureのみで検証する（hermetic）。
 *
 * ## デシジョンテーブル
 *
 * ### validateEntry
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | V1 | 全フィールドが正しい正常なエントリ | エラー無し |
 * | V2 | オブジェクトでない（文字列等） | 「オブジェクトである必要があります」エラー |
 * | V3 | 必須フィールド（例: reason）が欠落 | 該当フィールドのエラー |
 * | V4 | idがGHSA形式でない | idのフォーマットエラー |
 * | V5 | addedAt/reviewByがYYYY-MM-DD形式でない | 該当フィールドのフォーマットエラー |
 *
 * ### loadAllowlist
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | L1 | ファイルが存在しない | 空のentries・エラー無し |
 * | L2 | 空配列 `[]` | 空のentries・エラー無し |
 * | L3 | 正常なエントリを含む配列 | entriesにパース結果、エラー無し |
 * | L4 | JSON構文エラー | errorsに構文エラーメッセージ |
 * | L5 | 配列でない（オブジェクト等） | 「配列である必要があります」エラー |
 * | L6 | スキーマ違反のエントリを含む | entriesは空、errorsにスキーマ違反 |
 *
 * ### findExpiredEntries
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | E1 | reviewByが基準日より前 | 期限切れとして返る |
 * | E2 | reviewByが基準日以降 | 期限切れに含まれない |
 *
 * ### buildIgnoreFlags
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | F1 | エントリ2件 | `--ignore=<id1> --ignore=<id2>` |
 * | F2 | エントリ0件 | 空文字列 |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    type AllowlistEntry,
    buildIgnoreFlags,
    findExpiredEntries,
    loadAllowlist,
    validateEntry,
} from './check-audit-allowlist';

const validEntry = (): AllowlistEntry => ({
    id: 'GHSA-abcd-1234-wxyz',
    package: 'example-pkg',
    reason: '開発専用依存で本番到達しないため',
    addedAt: '2026-08-02',
    reviewBy: '2026-11-02',
});

describe('validateEntry', () => {
    it('[V1] 全フィールドが正しい正常なエントリはエラー無し', () => {
        expect(validateEntry(validEntry(), 0)).toEqual([]);
    });

    it('[V2] オブジェクトでない場合はエラーになる', () => {
        expect(validateEntry('not-an-object', 0)).toEqual([
            'allowlist[0]: オブジェクトである必要があります',
        ]);
    });

    it('[V3] 必須フィールド（reason）が欠落している場合はエラーになる', () => {
        const { reason: _reason, ...rest } = validEntry();
        const errors = validateEntry(rest, 0);
        expect(errors).toContain(
            'allowlist[0].reason: 必須の文字列フィールドです',
        );
    });

    it('[V4] idがGHSA形式でない場合はエラーになる', () => {
        const errors = validateEntry(
            { ...validEntry(), id: 'CVE-2026-0001' },
            0,
        );
        expect(errors.some((e) => e.includes('GHSA形式'))).toBe(true);
    });

    it('[V5] reviewByがYYYY-MM-DD形式でない場合はエラーになる', () => {
        const errors = validateEntry(
            { ...validEntry(), reviewBy: '2026/11/02' },
            0,
        );
        expect(errors.some((e) => e.includes('reviewBy'))).toBe(true);
    });
});

describe('loadAllowlist', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'audit-allowlist-test-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('[L1] ファイルが存在しない場合は空のentries・エラー無し', () => {
        const result = loadAllowlist(join(dir, 'missing.json'));
        expect(result).toEqual({ entries: [], errors: [] });
    });

    it('[L2] 空配列の場合は空のentries・エラー無し', () => {
        const path = join(dir, 'empty.json');
        writeFileSync(path, '[]');
        expect(loadAllowlist(path)).toEqual({ entries: [], errors: [] });
    });

    it('[L3] 正常なエントリを含む配列はentriesにパース結果が入る', () => {
        const path = join(dir, 'valid.json');
        writeFileSync(path, JSON.stringify([validEntry()]));
        const result = loadAllowlist(path);
        expect(result.errors).toEqual([]);
        expect(result.entries).toEqual([validEntry()]);
    });

    it('[L4] JSON構文エラーの場合はerrorsに構文エラーメッセージが入る', () => {
        const path = join(dir, 'broken.json');
        writeFileSync(path, '{not valid json');
        const result = loadAllowlist(path);
        expect(result.entries).toEqual([]);
        expect(result.errors[0]).toContain('JSON構文エラー');
    });

    it('[L5] 配列でない場合はerrorsに配列違反メッセージが入る', () => {
        const path = join(dir, 'object.json');
        writeFileSync(path, '{}');
        const result = loadAllowlist(path);
        expect(result.entries).toEqual([]);
        expect(result.errors).toEqual(['allowlistは配列である必要があります']);
    });

    it('[L6] スキーマ違反のエントリを含む場合はentries空・errorsにスキーマ違反', () => {
        const path = join(dir, 'invalid-entry.json');
        writeFileSync(path, JSON.stringify([{ id: 'GHSA-abcd-1234-wxyz' }]));
        const result = loadAllowlist(path);
        expect(result.entries).toEqual([]);
        expect(result.errors.length).toBeGreaterThan(0);
    });
});

describe('findExpiredEntries', () => {
    it('[E1] reviewByが基準日より前のエントリは期限切れとして返る', () => {
        const expired = { ...validEntry(), reviewBy: '2026-01-01' };
        const result = findExpiredEntries([expired], new Date('2026-08-02'));
        expect(result).toEqual([expired]);
    });

    it('[E2] reviewByが基準日以降のエントリは期限切れに含まれない', () => {
        const notExpired = { ...validEntry(), reviewBy: '2026-12-31' };
        const result = findExpiredEntries([notExpired], new Date('2026-08-02'));
        expect(result).toEqual([]);
    });
});

describe('buildIgnoreFlags', () => {
    it('[F1] エントリ2件の場合は--ignoreフラグをスペース区切りで連結する', () => {
        const entries: AllowlistEntry[] = [
            validEntry(),
            { ...validEntry(), id: 'GHSA-wxyz-9876-abcd' },
        ];
        expect(buildIgnoreFlags(entries)).toBe(
            '--ignore=GHSA-abcd-1234-wxyz --ignore=GHSA-wxyz-9876-abcd',
        );
    });

    it('[F2] エントリ0件の場合は空文字列', () => {
        expect(buildIgnoreFlags([])).toBe('');
    });
});
