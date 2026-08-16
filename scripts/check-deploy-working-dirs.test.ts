/**
 * check-deploy-working-dirs.ts の自己テスト
 *
 * ## デシジョンテーブル
 *
 * ### extractWorkingDirectories
 * | # | workflowContent | 期待 |
 * |---|------------------|------|
 * | T-01 | `deploy-cloudflare-workers`ステップの`working-directory: packages/admin` | ['packages/admin'] |
 * | T-02 | 複数ジョブ・複数ステップ（重複含む） | 重複を除いた一覧 |
 * | T-03 | `deploy-cloudflare-workers`以外のアクション（例: Pages）の`working-directory` | 対象外として除外される |
 *
 * ### findMissingWranglerConfigs
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-04 | 全て存在する | [] |
 * | T-05 | 一部が存在しない | 存在しないディレクトリのみ |
 */
import { describe, expect, it } from 'bun:test';

import {
    extractWorkingDirectories,
    findMissingWranglerConfigs,
} from './check-deploy-working-dirs';

describe('extractWorkingDirectories', () => {
    it('T-01_working-directoryを含むYAML_該当パスを返す', () => {
        const content = `
jobs:
  deploy-admin:
    steps:
      - uses: ./.github/actions/deploy-cloudflare-workers
        with:
          working-directory: packages/admin
`;

        expect(extractWorkingDirectories(content)).toEqual(['packages/admin']);
    });

    it('T-02_複数ジョブ複数ステップ_重複を除いた一覧を返す', () => {
        const content = `
jobs:
  deploy-calendar:
    steps:
      - uses: actions/checkout@v7
      - uses: ./.github/actions/deploy-cloudflare-workers
        with:
          working-directory: packages/calendar
  deploy-api:
    steps:
      - uses: ./.github/actions/deploy-cloudflare-workers
        with:
          working-directory: packages/api
      - uses: ./.github/actions/deploy-cloudflare-workers
        with:
          working-directory: packages/api
`;

        expect(extractWorkingDirectories(content)).toEqual([
            'packages/calendar',
            'packages/api',
        ]);
    });

    it('T-03_deploy-cloudflare-workers以外のアクションのworking-directory_除外される', () => {
        const content = `
jobs:
  deploy-front:
    steps:
      - uses: cloudflare/pages-action@v1
        with:
          working-directory: packages/front
      - run: echo hello
`;

        expect(extractWorkingDirectories(content)).toEqual([]);
    });
});

describe('findMissingWranglerConfigs', () => {
    it('T-04_全て存在する場合_空配列を返す', () => {
        const result = findMissingWranglerConfigs(
            ['packages/admin', 'packages/calendar'],
            () => true,
        );

        expect(result).toEqual([]);
    });

    it('T-05_一部が存在しない場合_存在しないディレクトリのみ返す', () => {
        const exists = (path: string): boolean =>
            !path.startsWith('packages/admin');

        const result = findMissingWranglerConfigs(
            ['packages/admin', 'packages/calendar'],
            exists,
        );

        expect(result).toEqual(['packages/admin']);
    });
});
