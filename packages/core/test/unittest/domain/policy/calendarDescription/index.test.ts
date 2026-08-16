import { describe, expect, it } from 'bun:test';

describe('calendarDescription public API', () => {
    it('indexからbuildCalendarDescriptionをエクスポートする', async () => {
        const module = await import(
            '../../../../../src/domain/policy/calendarDescription'
        );
        expect(module.buildCalendarDescription).toBeDefined();
        expect(typeof module.buildCalendarDescription).toBe('function');
    });

    it('内部builderを公開APIに露出しない', async () => {
        const module = await import(
            '../../../../../src/domain/policy/calendarDescription'
        );
        // buildCalendarDescription・buildRaceLinks のみが公開され、jra/keirin/nar
        // 各 builder 等の内部実装が漏れて公開されていないことを export キー集合の
        // 完全一致で検証する（RaceLink は型のみのエクスポートのため実行時には
        // 現れない）
        expect(Object.keys(module)).toEqual([
            'buildCalendarDescription',
            'buildRaceLinks',
        ]);
    });
});
