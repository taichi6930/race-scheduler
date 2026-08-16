import type {
    RaceEntity,
    SearchRaceFilterParamsInput,
} from '@race-schedule/core';
import {
    badRequest,
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseRaceEntityUpsert,
    resolveRaceIdOrBadRequest,
    searchRaceFilterParamsSchema,
    shouldIncludeInCalendar,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IRaceUsecase } from '../usecase/interface/IRaceUsecase';
import { CrudController } from './crudController';

/**
 * クエリパラメータから raceId を取得・検証する。
 * calendarEvent/players で重複していた
 * 「raceId取得→必須チェック→resolveRaceIdOrBadRequest」を集約する。
 * @param searchParams - URLSearchParams（raceId）
 * @returns 検証結果（成功時は RaceId、失敗時は 400 レスポンス）
 */
const resolveRaceIdParamOrBadRequest = (
    searchParams: URLSearchParams,
): ReturnType<typeof resolveRaceIdOrBadRequest> => {
    const rawRaceId = searchParams.get('raceId');
    if (rawRaceId === null) {
        return { ok: false, response: badRequest('raceIdは必須です', 400) };
    }
    return resolveRaceIdOrBadRequest(rawRaceId);
};

@LogAllMethods
@injectable()
export class RaceController extends CrudController<
    RaceEntity,
    SearchRaceFilterParamsInput
> {
    public constructor(
        @inject(DI_TOKENS.RaceUsecase)
        private readonly raceUsecase: IRaceUsecase,
    ) {
        super(raceUsecase, {
            controllerName: 'RaceController',
            listKey: 'races',
            filterSchema: searchRaceFilterParamsSchema,
            parseUpsert: parseRaceEntityUpsert,
            // 「グレード・ステージによりカレンダー登録対象となるか」はグレード
            // マスタ（＋KEIRIN/AUTORACE/BOATRACEのみステージ優先度）に依存する
            // 判定のため、クライアント側で再実装させず計算済みフィールドとして
            // 返す。カレンダー登録可否の判定（shouldIncludeInCalendar）と
            // 同一基準にすることで、JRA等はグレードのみ、KEIRIN/AUTORACE/
            // BOATRACEはグレード×ステージ優先度（負け戦を除外）で「重賞のみ」
            // 表示・自動通知の対象を揃える。
            // フィールド名はisSpecifiedGradeだったが、「グレード単体で重賞相当か」
            // ではなく「カレンダー登録対象か」を返す値のため、意味が伝わる名前へ
            // 変更した（正規化に伴う整理）。
            // flaggedRaceIds は個別登録の上書きでありグレード判定とは無関係
            // のため渡さない（既定の空集合のまま）。
            augment: (raceEntity: RaceEntity) => ({
                isCalendarSpecified: shouldIncludeInCalendar(raceEntity),
            }),
            // isWatched（注目選手が出走するレースか）はraceIdのIN句で一括判定する
            // 必要があるため、1件ずつのaugmentではなくaugmentBatchで合成する
            // （KPLAYER-07）。favorites/timeline側の「⭐お気に入り」表示・通知の
            // isWatchedマージ判定に使う。
            augmentBatch: async (raceEntityList: RaceEntity[]) => {
                const raceIds = raceEntityList.map(
                    (raceEntity) => raceEntity.raceId,
                );
                const watchedRaceIds =
                    await raceUsecase.fetchWatchedRaceIds(raceIds);
                return raceEntityList.map((raceEntity) => ({
                    isWatched: watchedRaceIds.has(raceEntity.raceId),
                }));
            },
        });
    }

    /**
     * レース一覧を取得するAPI
     * GET /race?startDate=2026-01-01&finishDate=2026-01-02&raceTypeList=JRA
     * @param searchParams URLSearchParams（startDate, finishDate, raceTypeList）
     * @returns レース一覧を含むレスポンス
     */
    public get(searchParams: URLSearchParams): Promise<Response> {
        return this.doGet(searchParams);
    }

    /**
     * レース情報のupsert API
     * POST /race
     * @param request HTTPリクエスト（body: レースエンティティ）
     * @returns upsert結果を含むレスポンス
     */
    public upsert(request: Request): Promise<Response> {
        return this.doUpsert(request);
    }

    /**
     * 指定レースをカレンダーに登録する際のイベント内容を取得するAPI
     * GET /race/calendar-event?raceId=jra202601010101
     * @param searchParams URLSearchParams（raceId）
     * @returns レースのカレンダーイベント内容
     * @remarks
     * calendar Workerが実際にGoogle Calendarへ登録する内容（発走時刻・
     * netkeiba/YouTubeリンク等）と完全に同一の内容を返す。フロントの
     * 「カレンダーに追加」機能が、API経由の登録と同じ説明文を使えるようにする。
     */
    public async calendarEvent(
        searchParams: URLSearchParams,
    ): Promise<Response> {
        try {
            const parsedRaceId = resolveRaceIdParamOrBadRequest(searchParams);
            if (!parsedRaceId.ok) return parsedRaceId.response;

            const event = await this.raceUsecase.fetchCalendarEvent(
                parsedRaceId.value,
            );
            if (!event) {
                return badRequest('指定されたレースが見つかりません', 404);
            }
            return json(event);
        } catch (error) {
            return handleControllerError(error, 'RaceController.calendarEvent');
        }
    }

    /**
     * 指定レースの出走選手一覧（車番順）を取得するAPI
     * GET /race/players?raceId=keirin202608023601
     * @param searchParams URLSearchParams（raceId）
     * @returns 出走選手一覧を含むレスポンス
     * @remarks
     * 一覧取得（GET /race）には含めず、レース詳細を開いたときにオンデマンドで
     * 取得する専用エンドポイントとする（KPLAYER-07）。一覧の全レースに
     * 出走選手データを常に載せると、KEIRINが多い日にペイロードが膨らむため。
     * race_playerに行が無い場合（機械式以外・未取得）は空配列を返す
     * （calendarEventと異なり、レース自体の存在確認は行わない）。
     */
    public async players(searchParams: URLSearchParams): Promise<Response> {
        try {
            const parsedRaceId = resolveRaceIdParamOrBadRequest(searchParams);
            if (!parsedRaceId.ok) return parsedRaceId.response;

            const players = await this.raceUsecase.fetchRacePlayers(
                parsedRaceId.value,
            );
            return json({ raceId: parsedRaceId.value, players });
        } catch (error) {
            return handleControllerError(error, 'RaceController.players');
        }
    }

    /**
     * 指定レースのレース詳細画面（front）向けセクション型UIスキーマを取得するAPI
     * GET /ui/race-detail?raceId=keirin202608023601
     * @param searchParams URLSearchParams（raceId）
     * @returns UIスキーマ（`RaceDetailUi`）を含むレスポンス
     * @remarks
     * Server-Driven UI（race-detail-sdui-design.md）。front はこのレスポンスを
     * そのまま解釈してレース詳細のセクション群を描画する。
     */
    public async raceDetailUi(
        searchParams: URLSearchParams,
    ): Promise<Response> {
        try {
            const parsedRaceId = resolveRaceIdParamOrBadRequest(searchParams);
            if (!parsedRaceId.ok) return parsedRaceId.response;

            const detail = await this.raceUsecase.fetchRaceDetailUi(
                parsedRaceId.value,
            );
            if (!detail) {
                return badRequest('指定されたレースが見つかりません', 404);
            }
            return json(detail);
        } catch (error) {
            return handleControllerError(error, 'RaceController.raceDetailUi');
        }
    }
}
