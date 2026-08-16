import type { Announcement } from '@race-schedule/core';

/**
 * Announcement UseCase Interface（Server-Driven UI PoC）
 */
export interface IAnnouncementUsecase {
    /** 起動時お知らせバナーのUIスキーマを返す（`enabled` は機能フラグで決まる）。 */
    getAnnouncement: () => Promise<Announcement>;
}
