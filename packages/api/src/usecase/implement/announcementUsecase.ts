import type { Announcement } from '@race-schedule/core';
import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';
import type { IAnnouncementUsecase } from '../interface/IAnnouncementUsecase';
import type { IFeatureFlagUsecase } from '../interface/IFeatureFlagUsecase';

/** {@link FEATURE_FLAG_DEFINITIONS} 上のこのバナーのキー。 */
const ANNOUNCEMENT_BANNER_FLAG_KEY = 'announcement_banner';

/**
 * Server-Driven UI PoC: 起動時お知らせバナーの内容を組み立てるusecase。
 *
 * レースドメインのデータには依存しない（既存の `raceUsecase` 等とは無関係）ため
 * repositoryを持たない。文言自体は現時点では固定だが、将来D1等で管理したくなった場合は
 * repositoryを追加してここから呼び出す形にする（front・controller側の変更は不要）。
 *
 * `enabled` は `FeatureFlagUsecase`（feature-flag-design.md）が解決する。
 * 環境ごとの分岐（本番/非本番）や front からのデバッグモードヘッダーには依存しない
 * ——管理画面（`GET /admin/flags`）で環境ごとに個別に切り替える設計のため。
 */
@LogAllMethods
@injectable()
export class AnnouncementUsecase implements IAnnouncementUsecase {
    public constructor(
        @inject(DI_TOKENS.FeatureFlagUsecase)
        private readonly featureFlagUsecase: IFeatureFlagUsecase,
    ) {}

    public async getAnnouncement(): Promise<Announcement> {
        const enabled = await this.featureFlagUsecase.resolve(
            ANNOUNCEMENT_BANNER_FLAG_KEY,
        );
        return {
            schemaVersion: 1,
            enabled,
            message:
                'これはServer-Driven UI (SDUI) のPoCです。このバナーの文言はfrontを再デプロイせずAPI側だけで変更できます。',
        };
    }
}
