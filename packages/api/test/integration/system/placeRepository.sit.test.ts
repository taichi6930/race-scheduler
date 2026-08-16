/**
 * placeRepository.sit.test.ts
 *
 * SIT-1 ~ SIT-2: PlaceRepository ↔ 実 D1（miniflare/workerd）のシステム結合テスト（sIT）
 *
 * コンポーネントテスト（`place.get.controller.usecase.repository.component.test.ts`）は `bun:sqlite` ベースの
 * 手作り D1 互換アダプタでビジネスロジックの正しさを検証するのに対し、本テストは
 * `tests/shared/env/setupMiniflareEnv.ts` が起動する**実際の D1 エンジン（workerd）**へ
 * 本物の `PlaceRepository`（DrizzleGateway 経由）で upsert → fetch の往復を行い、
 * 本番と同じ経路（D1 バインディングの実セマンティクス）で動作することを確認する。
 *
 * ## シナリオテーブル
 * | # | 操作 | 期待 |
 * |----|------|------|
 * | SIT-1 | PlaceEntity 1件を upsert → 同条件で fetch | successCount=1、fetch結果が投入内容と一致 |
 * | SIT-2 | 同じ placeId を再度 upsert（値を変更） | successCount=1（failureCount=0）、fetch結果が更新後の値になっている |
 *
 * リポジトリ本体を除くモノレポ全体（api・scraping）で sIT の前例が無かったため、
 * miniflare セットアップと合わせて最初の 1 本として設計した
 * （`packages/api/test/integration/system/README.md` 参照）。
 */

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'bun:test';
import { RaceType, validateLocationCode } from '@race-schedule/core';
import 'reflect-metadata';
import { container } from 'tsyringe';

import type { MiniflareTestEnv } from '../../../../../tests/shared/env/setupMiniflareEnv';
import { setupMiniflareEnv } from '../../../../../tests/shared/env/setupMiniflareEnv';
import { PlaceFactory } from '../../../../../tests/shared/factories';
import { PlaceRepository } from '../../../src/repository/implement/placeRepository';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

describe('sIT: PlaceRepository ↔ 実D1（miniflare）', () => {
    let env: MiniflareTestEnv;

    // bunfig.tomlの[test].timeout(30秒)はbeforeAll/afterAllフックには適用されず、
    // Bunの既定値(5秒)が使われる。Miniflare(workerd)の初回起動はCIランナー上で
    // 5秒を超えることがあるため、フック単位でタイムアウトを明示する。
    beforeAll(async () => {
        env = await setupMiniflareEnv();
    }, 30_000);

    afterAll(async () => {
        await env.dispose();
    });

    beforeEach(() => {
        setupGlobalMocks(env.db);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('SIT-1: upsertしたPlaceEntityを同条件でfetchできること', async () => {
        // Arrange
        const repository = container.resolve(PlaceRepository);
        const place = PlaceFactory.create({
            raceType: RaceType.JRA,
            datetime: new Date('2026-04-26T10:00:00+09:00'),
            locationCode: validateLocationCode('05'),
        });

        // Act
        const upsertResult = await repository.upsert([place]);
        const fetched = await repository.fetch({
            raceTypeList: [RaceType.JRA],
            startDate: new Date('2026-04-26T00:00:00+09:00'),
            finishDate: new Date('2026-04-27T00:00:00+09:00'),
        });

        // Assert
        expect(upsertResult.successCount).toBe(1);
        expect(upsertResult.failureCount).toBe(0);
        expect(fetched).toHaveLength(1);
        expect(fetched[0].placeId).toBe(place.placeId);
        expect(fetched[0].locationCode).toBe(place.locationCode);
    });

    it('SIT-2: 既存placeIdを再upsertすると更新され、fetch結果に反映されること', async () => {
        // Arrange
        const repository = container.resolve(PlaceRepository);
        const original = PlaceFactory.create({
            raceType: RaceType.KEIRIN,
            datetime: new Date('2026-05-01T10:00:00+09:00'),
            locationCode: validateLocationCode('43'),
            placeGrade: 'GⅠ',
        });
        await repository.upsert([original]);

        const updated = {
            ...original,
            placeGrade: 'GⅡ',
        };

        // Act
        const upsertResult = await repository.upsert([updated]);
        const fetched = await repository.fetch({
            raceTypeList: [RaceType.KEIRIN],
            startDate: new Date('2026-05-01T00:00:00+09:00'),
            finishDate: new Date('2026-05-02T00:00:00+09:00'),
        });

        // Assert
        expect(upsertResult.successCount).toBe(1);
        expect(upsertResult.failureCount).toBe(0);
        expect(fetched).toHaveLength(1);
        expect(fetched[0].placeGrade).toBe('GⅡ');
    });
});
