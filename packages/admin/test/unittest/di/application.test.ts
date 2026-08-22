/**
 * DI Application層テスト
 *
 * `packages/admin/src/di/application.ts` の `registerApplication` が
 * Usecase 7種すべてを正しく登録すること（具象クラスとして解決できること）を
 * 検証する。
 *
 * ## デシジョンテーブル
 *
 * | # | Usecase | トークン | 期待 |
 * |---|---------|---------|------|
 * | T-01 | FeatureFlagsUsecase | DI_TOKENS.FeatureFlagUsecase | 具象インスタンスとして解決される |
 * | T-02 | BackfillUsecase | DI_TOKENS.BackfillUsecase | 具象インスタンスとして解決される |
 * | T-03 | RaceDetailLayoutUsecase | DI_TOKENS.UiLayoutUsecase | 具象インスタンスとして解決される |
 * | T-04 | ReleaseNotesUsecase | DI_TOKENS.ReleaseNoteUsecase | 具象インスタンスとして解決される |
 * | T-05 | InviteUsecase | ADMIN_DI_TOKENS.InviteUsecase | 具象インスタンスとして解決される |
 * | T-06 | ParticipantsUsecase | ADMIN_DI_TOKENS.ParticipantsUsecase | 具象インスタンスとして解決される |
 * | T-07 | JoinRequestsUsecase | ADMIN_DI_TOKENS.JoinRequestsUsecase | 具象インスタンスとして解決される |
 * | T-08 | 複数回呼び出し | - | 安全に上書き登録される |
 */
import 'reflect-metadata';

import { beforeEach, describe, expect, it } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import { ADMIN_DI_TOKENS } from '../../../src/di/tokens';
import { BackfillUsecase } from '../../../src/usecase/implement/backfillUsecase';
import { FeatureFlagsUsecase } from '../../../src/usecase/implement/featureFlagsUsecase';
import { InviteUsecase } from '../../../src/usecase/implement/inviteUsecase';
import { JoinRequestsUsecase } from '../../../src/usecase/implement/joinRequestsUsecase';
import { ParticipantsUsecase } from '../../../src/usecase/implement/participantsUsecase';
import { RaceDetailLayoutUsecase } from '../../../src/usecase/implement/raceDetailLayoutUsecase';
import { ReleaseNotesUsecase } from '../../../src/usecase/implement/releaseNotesUsecase';
import type { IBackfillUsecase } from '../../../src/usecase/interface/IBackfillUsecase';
import type { IFeatureFlagsUsecase } from '../../../src/usecase/interface/IFeatureFlagsUsecase';
import type { IInviteUsecase } from '../../../src/usecase/interface/IInviteUsecase';
import type { IJoinRequestsUsecase } from '../../../src/usecase/interface/IJoinRequestsUsecase';
import type { IParticipantsUsecase } from '../../../src/usecase/interface/IParticipantsUsecase';
import type { IRaceDetailLayoutUsecase } from '../../../src/usecase/interface/IRaceDetailLayoutUsecase';
import type { IReleaseNotesUsecase } from '../../../src/usecase/interface/IReleaseNotesUsecase';

describe('DI Application層', () => {
    beforeEach(() => {
        container.clearInstances();
        registerApplication();
    });

    it('T-01: FeatureFlagsUsecaseが具象クラスとして登録されること', () => {
        const usecase = container.resolve<IFeatureFlagsUsecase>(
            DI_TOKENS.FeatureFlagUsecase,
        );
        expect(usecase).toBeInstanceOf(FeatureFlagsUsecase);
    });

    it('T-02: BackfillUsecaseが具象クラスとして登録されること', () => {
        const usecase = container.resolve<IBackfillUsecase>(
            DI_TOKENS.BackfillUsecase,
        );
        expect(usecase).toBeInstanceOf(BackfillUsecase);
    });

    it('T-03: RaceDetailLayoutUsecaseが具象クラスとして登録されること', () => {
        const usecase = container.resolve<IRaceDetailLayoutUsecase>(
            DI_TOKENS.UiLayoutUsecase,
        );
        expect(usecase).toBeInstanceOf(RaceDetailLayoutUsecase);
    });

    it('T-04: ReleaseNotesUsecaseが具象クラスとして登録されること', () => {
        const usecase = container.resolve<IReleaseNotesUsecase>(
            DI_TOKENS.ReleaseNoteUsecase,
        );
        expect(usecase).toBeInstanceOf(ReleaseNotesUsecase);
    });

    it('T-05: InviteUsecaseが具象クラスとして登録されること', () => {
        const usecase = container.resolve<IInviteUsecase>(
            ADMIN_DI_TOKENS.InviteUsecase,
        );
        expect(usecase).toBeInstanceOf(InviteUsecase);
    });

    it('T-06: ParticipantsUsecaseが具象クラスとして登録されること', () => {
        const usecase = container.resolve<IParticipantsUsecase>(
            ADMIN_DI_TOKENS.ParticipantsUsecase,
        );
        expect(usecase).toBeInstanceOf(ParticipantsUsecase);
    });

    it('T-07: JoinRequestsUsecaseが具象クラスとして登録されること', () => {
        const usecase = container.resolve<IJoinRequestsUsecase>(
            ADMIN_DI_TOKENS.JoinRequestsUsecase,
        );
        expect(usecase).toBeInstanceOf(JoinRequestsUsecase);
    });

    it('T-08: 複数回呼び出しても安全であること', () => {
        registerApplication();
        registerApplication();

        const usecase = container.resolve<IReleaseNotesUsecase>(
            DI_TOKENS.ReleaseNoteUsecase,
        );
        expect(usecase).toBeInstanceOf(ReleaseNotesUsecase);
    });
});
