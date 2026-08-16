import { describe, expect, it } from 'bun:test';
import {
    formatDescriptionTemplate,
    formatRaceTime,
    formatUpdateTime,
} from '../../../../../src/domain/policy/calendarDescription/formatters';

describe('formatters', () => {
    describe('formatRaceTime', () => {
        it('レース時刻をHH:mm形式にフォーマットする', () => {
            const datetime = new Date('2025-01-01T09:30:00+09:00');
            const result = formatRaceTime(datetime);
            expect(result).toMatch(/発走: \d{2}:\d{2}/);
            expect(result).toContain('09:30');
        });

        it('先頭ゼロ埋めする', () => {
            const datetime = new Date('2025-01-01T08:05:00+09:00');
            const result = formatRaceTime(datetime);
            expect(result).toContain('08:05');
        });
    });

    describe('formatUpdateTime', () => {
        it('更新時刻をyyyy/MM/dd_HH:mm形式にフォーマットする', () => {
            const updateDate = new Date('2025-01-15T14:30:00+09:00');
            const result = formatUpdateTime(updateDate);
            expect(result).toMatch(/更新日時: \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/);
        });

        it('全日時要素を先頭ゼロ埋めする', () => {
            const updateDate = new Date('2025-01-05T08:05:00+09:00');
            const result = formatUpdateTime(updateDate);
            expect(result).toContain('2025/01/05');
            expect(result).toContain('08:05');
        });
    });

    describe('formatDescriptionTemplate', () => {
        it('null以外のパートを改行で結合する', () => {
            const parts = ['part1', 'part2', 'part3'];
            const result = formatDescriptionTemplate(parts);
            expect(result).toBe('part1\npart2\npart3');
        });

        it('null値を除外する', () => {
            const parts = ['part1', null, 'part2', null];
            const result = formatDescriptionTemplate(parts);
            expect(result).toBe('part1\npart2');
        });

        it('空文字列を除外する', () => {
            const parts = ['part1', '', 'part2'];
            const result = formatDescriptionTemplate(parts);
            expect(result).toBe('part1\npart2');
        });

        it('改行後の余分な空白を除去する', () => {
            // formatDescriptionTemplate removes whitespace after newlines
            // e.g., "part1\n   part2\npart3" becomes "part1\npart2\npart3"
            const parts = ['part1', '   part2', 'part3'];
            const result = formatDescriptionTemplate(parts);
            expect(result).toBe('part1\npart2\npart3');
        });
    });
});
