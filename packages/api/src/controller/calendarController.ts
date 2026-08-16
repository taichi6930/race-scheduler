import type { CalendarFilterParams } from '@race-schedule/core';
import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
    parseCommonSearchParams,
    parseOrBadRequest,
    resolveRaceIdOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { ICalendarUsecase } from '../usecase/interface/ICalendarUsecase';
import {
    CalendarFlagAddRequestSchema,
    CalendarFlagRemoveRequestSchema,
} from './calendarController.schemas';

/** flag 追加・削除レスポンスの共通形状 */
const FLAG_MUTATION_RESULT = {
    successCount: 1,
    failureCount: 0,
    failures: [],
} as const;

/**
 * Controller層：外部入力（HTTPリクエスト）をdomain層の検証関数に通し、
 * domain検証済みの型をusecaseに送る。検証ロジック自体はdomain層（Zodスキーマ・RaceId等）が持つ。
 */
@LogAllMethods
@injectable()
export class CalendarController {
    public constructor(
        @inject(DI_TOKENS.CalendarUsecase)
        private readonly usecase: ICalendarUsecase,
    ) {}

    /**
     * カレンダー掲載対象のレース一覧を、カレンダー登録フラグ付きで取得する
     * query param: startDate, finishDate, raceTypeList (カンマ区切り)
     * @param searchParams URLSearchParams オブジェクト（query param: startDate, finishDate, raceTypeList）
     * @returns カレンダー掲載対象のレース一覧を含むレスポンス
     * @remarks
     * Google Calendarへは問い合わせず、D1（race / calendar_flag）から構築する。
     * クエリパラメータをdomainの検証関数（parseCommonSearchParams）で検証する
     */
    public async get(searchParams: URLSearchParams): Promise<Response> {
        try {
            // domainの検証関数で入力パラメータを検証
            // ValidationError は badRequest に変換し、それ以外は外側 try に委ねる
            const parsed = parseOrBadRequest<CalendarFilterParams>(() => {
                const common = parseCommonSearchParams(searchParams);
                return {
                    startDate: common.startDate,
                    finishDate: common.finishDate,
                    raceTypeList: common.raceTypeList,
                };
            });
            if (!parsed.ok) return parsed.response;
            const filter = parsed.value;

            // domain検証済みのfilterをusecaseに送る
            const data = await this.usecase.fetch(filter);
            return json({
                count: data.length,
                calendars: data,
            });
        } catch (error) {
            return handleControllerError(error, 'CalendarController.get');
        }
    }

    /**
     * 指定レース（カレンダー登録フラグ）の一覧を取得する
     * @returns カレンダー登録フラグ一覧を含むレスポンス
     */
    public async flagList(): Promise<Response> {
        try {
            const flags = await this.usecase.listFlags();
            return json({ count: flags.length, flags });
        } catch (error) {
            return handleControllerError(error, 'CalendarController.flagList');
        }
    }

    /**
     * レースに指定フラグを追加する
     * body: { raceId: string, label?: string }
     * @param request HTTPリクエスト（body: raceId, label?）
     * @returns フラグ追加結果を含むレスポンス
     * @remarks
     * D1への保存のみ行う。Google Calendarへの反映は次回のcalendar Worker
     * 同期サイクルで行われる（即時反映は行わない）。
     */
    public async flagAdd(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();

            const parsedBody = parseBodyOrBadRequest(
                CalendarFlagAddRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const parsedRaceId = resolveRaceIdOrBadRequest(
                parsedBody.value.raceId,
            );
            if (!parsedRaceId.ok) return parsedRaceId.response;

            await this.usecase.addFlag(
                parsedRaceId.value,
                parsedBody.value.label ?? '',
            );
            return json(FLAG_MUTATION_RESULT, 200);
        } catch (error) {
            return handleControllerError(error, 'CalendarController.flagAdd');
        }
    }

    /**
     * レースの指定フラグを削除する
     * body: { raceId: string }
     * @param request HTTPリクエスト（body: raceId）
     * @returns フラグ削除結果を含むレスポンス
     * @remarks
     * D1からの削除のみ行う。Google Calendarからの削除は次回のcalendar Worker
     * 同期サイクルで行われる（即時反映は行わない）。
     */
    public async flagRemove(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();

            const parsedBody = parseBodyOrBadRequest(
                CalendarFlagRemoveRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const parsedRaceId = resolveRaceIdOrBadRequest(
                parsedBody.value.raceId,
            );
            if (!parsedRaceId.ok) return parsedRaceId.response;

            await this.usecase.removeFlag(parsedRaceId.value);
            return json(FLAG_MUTATION_RESULT, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'CalendarController.flagRemove',
            );
        }
    }
}
