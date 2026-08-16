/**
 * confirm-production-access.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 確認文字列の一致判定を誤ると本番リソースへの誤操作防止ゲートが機能しなくなるため、
 * 純粋関数部分（fs/stdin に依存しない）のUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### isConfirmed
 * | # | targetName | answer | 期待 |
 * |---|-----------|--------|------|
 * | T-01 | `race_schedule_db_prod` | `race_schedule_db_prod` | true |
 * | T-02 | `race_schedule_db_prod` | `race_schedule_db_prod\n`（改行混入） | true（trim後一致） |
 * | T-03 | `race_schedule_db_prod` | `` (空文字) | false |
 * | T-04 | `race_schedule_db_prod` | `yes`（別の確認語） | false |
 *
 * ### buildConfirmationPrompt
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-05 | `race_schedule_db_prod` | 対象名を含むプロンプト文字列 |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildConfirmationPrompt,
    isConfirmed,
} from './confirm-production-access';

describe('isConfirmed', () => {
    it('[T-01] 完全一致する入力はtrueを返すこと', () => {
        expect(
            isConfirmed('race_schedule_db_prod', 'race_schedule_db_prod'),
        ).toBe(true);
    });

    it('[T-02] 前後の空白・改行はtrimして比較すること', () => {
        expect(
            isConfirmed('race_schedule_db_prod', 'race_schedule_db_prod\n'),
        ).toBe(true);
    });

    it('[T-03] 空文字はfalseを返すこと', () => {
        expect(isConfirmed('race_schedule_db_prod', '')).toBe(false);
    });

    it('[T-04] 別の確認語はfalseを返すこと', () => {
        expect(isConfirmed('race_schedule_db_prod', 'yes')).toBe(false);
    });
});

describe('buildConfirmationPrompt', () => {
    it('[T-05] 対象名を含むプロンプト文字列を返すこと', () => {
        expect(buildConfirmationPrompt('race_schedule_db_prod')).toContain(
            'race_schedule_db_prod',
        );
    });
});
