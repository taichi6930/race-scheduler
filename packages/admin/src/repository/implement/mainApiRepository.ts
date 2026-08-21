import {
    DI_TOKENS,
    type RaceDetailUi,
    type RaceDetailUiConfig,
    type RaceType,
    type ReleaseNote,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type {
    BackfillFilter,
    BackfillPlaceResult,
    BackfillRaceResult,
} from '../../dto/backfillResult';
import type { FeatureFlagStatus } from '../../dto/featureFlagStatus';
import type { InviteIssueResult } from '../../dto/invite';
import type { JoinRequestSummary } from '../../dto/joinRequest';
import type { ParticipantSummary } from '../../dto/participant';
import type { RaceSummary } from '../../dto/raceSummary';
import type { IMainApiGateway } from '../../gateway/interface/IMainApiGateway';
import type { IMainApiRepository } from '../interface/IMainApiRepository';

/**
 * メインAPI（@race-schedule/api）の機能フラグをやり取りするリポジトリのHTTP実装
 * @remarks
 * MainApiGateway（HTTP通信の詳細）へ委譲する薄いアダプタ。
 * PERF-138: 変換・分岐を一切持たない委譲のみのクラスのため、@LogAllMethods による
 * ログ出力はログ対象から除外している（calendar/mainApiRepository.tsと同じ方針）。
 */
@injectable()
export class MainApiRepository implements IMainApiRepository {
    public constructor(
        @inject(DI_TOKENS.MainApiGateway)
        private readonly mainApiGateway: IMainApiGateway,
    ) {}

    public async fetchFeatureFlagList(): Promise<FeatureFlagStatus[]> {
        return this.mainApiGateway.fetchFeatureFlagList();
    }

    public async updateFeatureFlag(
        key: string,
        enabled: boolean,
    ): Promise<FeatureFlagStatus[]> {
        return this.mainApiGateway.updateFeatureFlag(key, enabled);
    }

    public async backfillPlace(
        filter: BackfillFilter,
    ): Promise<BackfillPlaceResult> {
        return this.mainApiGateway.backfillPlace(filter);
    }

    public async backfillRace(
        filter: BackfillFilter,
    ): Promise<BackfillRaceResult> {
        return this.mainApiGateway.backfillRace(filter);
    }

    public async fetchUiLayout(
        raceType: RaceType,
    ): Promise<RaceDetailUiConfig> {
        return this.mainApiGateway.fetchUiLayout(raceType);
    }

    public async saveUiLayout(
        raceType: RaceType,
        config: RaceDetailUiConfig,
    ): Promise<RaceDetailUiConfig> {
        return this.mainApiGateway.saveUiLayout(raceType, config);
    }

    public async previewUiLayout(
        config: RaceDetailUiConfig,
        raceId: string,
    ): Promise<RaceDetailUi | undefined> {
        return this.mainApiGateway.previewUiLayout(config, raceId);
    }

    public async fetchUpcomingKeirinRaces(
        days: number,
    ): Promise<RaceSummary[]> {
        return this.mainApiGateway.fetchUpcomingKeirinRaces(days);
    }

    public async fetchReleaseNotes(): Promise<ReleaseNote[]> {
        return this.mainApiGateway.fetchReleaseNotes();
    }

    public async issueInvite(memo: string | null): Promise<InviteIssueResult> {
        return this.mainApiGateway.issueInvite(memo);
    }

    public async fetchParticipants(): Promise<ParticipantSummary[]> {
        return this.mainApiGateway.fetchParticipants();
    }

    public async fetchJoinRequests(): Promise<JoinRequestSummary[]> {
        return this.mainApiGateway.fetchJoinRequests();
    }

    public async approveJoinRequest(id: string): Promise<void> {
        return this.mainApiGateway.approveJoinRequest(id);
    }

    public async rejectJoinRequest(id: string): Promise<void> {
        return this.mainApiGateway.rejectJoinRequest(id);
    }
}
