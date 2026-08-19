import {
    fetchWithTimeout,
    getJstDate,
    getJstMonth,
    getJstYear,
    type RaceDetailUi,
    type RaceDetailUiConfig,
    RaceType,
    type ReleaseNote,
    withServiceAuthHeader,
} from '@race-schedule/core';
import { injectable } from 'tsyringe';

import type {
    BackfillFilter,
    BackfillPlaceResult,
    BackfillRaceResult,
} from '../../dto/backfillResult';
import type { FeatureFlagStatus } from '../../dto/featureFlagStatus';
import type { RaceSummary } from '../../dto/raceSummary';
import { getMainApiUrl } from '../../utility/mainApiConfig';
import type { IMainApiGateway } from '../interface/IMainApiGateway';

/** メインAPI `/internal/feature-flags` のレスポンス */
interface FeatureFlagListResponse {
    flags: FeatureFlagStatus[];
}

/** メインAPI `GET /race` のレスポンス（レース詳細レイアウト編集キットが使う項目のみ） */
interface RaceListResponse {
    races: RaceSummary[];
}

/**
 * `Date` を `GET /race` が受け付ける `YYYY-MM-DD` 形式へ変換する（JST基準、QJST-02）。
 * UTC基準（`toISOString().slice(0,10)`）だとJSTの00:00〜09:00の間は前日の日付になり、
 * レース詳細レイアウト編集キットのプレビュー候補一覧が当日分を落としていた。
 * @param date
 */
const toDateOnlyString = (date: Date): string =>
    `${getJstYear(date)}-${String(getJstMonth(date)).padStart(2, '0')}-${String(getJstDate(date)).padStart(2, '0')}`;

/** メインAPI `GET`/`POST /internal/ui-layout` のレスポンス */
interface UiLayoutResponse {
    raceType: string;
    config: RaceDetailUiConfig;
}

/** `fetchWithTimeout` が投げるエラーメッセージから404を判定する正規表現。 */
const NOT_FOUND_ERROR_PATTERN = / returned 404:/;

/**
 * `fetchWithTimeout` が投げたエラーが404レスポンス由来かを判定する。
 * @param error
 */
const isNotFoundError = (error: unknown): boolean =>
    error instanceof Error && NOT_FOUND_ERROR_PATTERN.test(error.message);

@injectable()
export class MainApiGateway implements IMainApiGateway {
    public async fetchFeatureFlagList(): Promise<FeatureFlagStatus[]> {
        const url = new URL('/internal/feature-flags', getMainApiUrl());
        const response = await fetchWithTimeout<FeatureFlagListResponse>(url, {
            headers: withServiceAuthHeader(),
        });
        return response.flags;
    }

    public async updateFeatureFlag(
        key: string,
        enabled: boolean,
    ): Promise<FeatureFlagStatus[]> {
        const url = new URL('/internal/feature-flags', getMainApiUrl());
        const response = await fetchWithTimeout<FeatureFlagListResponse>(url, {
            method: 'POST',
            headers: withServiceAuthHeader({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ key, enabled }),
        });
        return response.flags;
    }

    public async backfillPlace(
        filter: BackfillFilter,
    ): Promise<BackfillPlaceResult> {
        const url = new URL('/internal/backfill/place', getMainApiUrl());
        return fetchWithTimeout<BackfillPlaceResult>(url, {
            method: 'POST',
            headers: withServiceAuthHeader({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(filter),
        });
    }

    public async backfillRace(
        filter: BackfillFilter,
    ): Promise<BackfillRaceResult> {
        const url = new URL('/internal/backfill/race', getMainApiUrl());
        return fetchWithTimeout<BackfillRaceResult>(url, {
            method: 'POST',
            headers: withServiceAuthHeader({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(filter),
        });
    }

    public async fetchUiLayout(
        raceType: RaceType,
    ): Promise<RaceDetailUiConfig> {
        const url = new URL('/internal/ui-layout', getMainApiUrl());
        url.searchParams.set('raceType', raceType);
        const response = await fetchWithTimeout<UiLayoutResponse>(url, {
            headers: withServiceAuthHeader(),
        });
        return response.config;
    }

    public async saveUiLayout(
        raceType: RaceType,
        config: RaceDetailUiConfig,
    ): Promise<RaceDetailUiConfig> {
        const url = new URL('/internal/ui-layout', getMainApiUrl());
        const response = await fetchWithTimeout<UiLayoutResponse>(url, {
            method: 'POST',
            headers: withServiceAuthHeader({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ raceType, config }),
        });
        return response.config;
    }

    public async previewUiLayout(
        config: RaceDetailUiConfig,
        raceId: string,
    ): Promise<RaceDetailUi | undefined> {
        const url = new URL('/internal/ui-layout/preview', getMainApiUrl());
        try {
            return await fetchWithTimeout<RaceDetailUi>(url, {
                method: 'POST',
                headers: withServiceAuthHeader({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify({ config, raceId }),
            });
        } catch (error) {
            if (isNotFoundError(error)) return;
            throw error;
        }
    }

    public async fetchUpcomingKeirinRaces(
        days: number,
    ): Promise<RaceSummary[]> {
        const now = new Date();
        const url = new URL('/race', getMainApiUrl());
        url.searchParams.set('startDate', toDateOnlyString(now));
        url.searchParams.set(
            'finishDate',
            toDateOnlyString(new Date(now.getTime() + days * 86_400_000)),
        );
        url.searchParams.set('raceTypeList', RaceType.KEIRIN);
        const response = await fetchWithTimeout<RaceListResponse>(url, {
            headers: withServiceAuthHeader(),
        });
        return response.races;
    }

    public async fetchReleaseNotes(): Promise<ReleaseNote[]> {
        const url = new URL('/internal/release-notes', getMainApiUrl());
        return fetchWithTimeout<ReleaseNote[]>(url, {
            headers: withServiceAuthHeader(),
        });
    }
}
