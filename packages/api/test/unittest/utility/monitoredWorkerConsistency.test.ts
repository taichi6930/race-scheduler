/**
 * uptimeCheck.ts と errorMonitorCheck.ts の監視対象キー一致検証（QSYNC-04）
 *
 * 両ファイルは同じ「監視対象Worker（api/admin/batch/calendar/scraping）」の
 * キー集合を、`TARGET_URLS`（uptimeCheck.ts）/`TARGET_SCRIPT_NAMES`
 * （errorMonitorCheck.ts）としてそれぞれ独立に保持している（意図的に共有
 * ソース化はしていない。呼び出し箇所が2つのみのためRule of Threeに満たず、
 * 過度な抽象化を避ける方針）。このテストは、2箇所の定義が将来ドリフトした
 * 場合にCIで検知できるようにするための最小限のセーフティネットとして追加する。
 *
 * ## デシジョンテーブル
 *
 * | #    | 検証内容                                                        | 期待挙動 |
 * |------|------------------------------------------------------------------|----------|
 * | T-01 | ALL_UPTIME_CHECK_TARGETS と ALL_ERROR_MONITOR_TARGETS のキー集合 | 完全一致（Set equality） |
 */

import { describe, expect, it } from 'bun:test';

import { ALL_ERROR_MONITOR_TARGETS } from '../../../src/utility/errorMonitorCheck';
import { ALL_UPTIME_CHECK_TARGETS } from '../../../src/utility/uptimeCheck';

describe('監視対象Workerキーの一致（uptimeCheck vs errorMonitorCheck）', () => {
    it('T-01: ALL_UPTIME_CHECK_TARGETSとALL_ERROR_MONITOR_TARGETSのキー集合が完全一致する', () => {
        const uptimeTargets = new Set(ALL_UPTIME_CHECK_TARGETS);
        const errorMonitorTargets = new Set(ALL_ERROR_MONITOR_TARGETS);

        expect(uptimeTargets).toEqual(errorMonitorTargets);
    });
});
