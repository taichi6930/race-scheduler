import { z } from 'zod';

import { PositionNumberSchema } from '../domain/model/valueObject/positionNumber';
import { RaceType } from '../domain/model/valueObject/raceType';
import { makeValidator } from '../utilities/makeValidator';

/**
 * 出走選手1名分の情報を表すエンティティのzod型定義
 *
 * RaceEntity.playerList の要素として、出走表に印字されていた時点のスナップショットを
 * 保持する（改姓等があっても、当時のレースには当時の名前が残る設計。
 * aidlc-docs/inception/application-design/keirin-player-data-design.md §2.2）。
 * raceId は親（RaceEntity）が持つため、このエンティティ自体は持たない。
 * KEIRIN・AUTORACEが対象（term はKEIRIN固有、branch はKEIRIN/AUTORACE共通の
 * 「所属」属性だが意味は競技により異なる。KEIRIN=府県、AUTORACE=拠点/LG）。
 */
export const RacePlayerEntitySchema = z.object({
    /** 車番（レース内で一意, 1〜9） */
    carNumber: z
        .number()
        .int('carNumber must be an integer')
        .min(1, 'carNumber must be between 1 and 9')
        .max(9, 'carNumber must be between 1 and 9'),
    /**
     * 枠番（複数車が同一枠を共有しうるため一意ではない）。
     * KEIRIN（最大9）を上限に採用する。KEIRIN(9)・AUTORACE(8)のいずれもこの範囲に収まる
     * （現状 playerList を持つのはこの2競技のみ）。AUTORACEには枠の概念が無く、
     * 車番をそのまま枠番として扱う。
     */
    frameNumber: PositionNumberSchema(RaceType.KEIRIN),
    /** 選手コード（先頭ゼロを保持するため文字列） */
    playerNo: z.string().min(1, 'playerNo must not be empty'),
    /** 出走表に印字されていた時点の選手名 */
    playerName: z.string().min(1, 'playerName must not be empty'),
    /** 期別（選手養成所の卒業期。KEIRINのみ、省略可） */
    term: z.number().int().positive('term must be positive').optional(),
    /** 所属（KEIRIN=府県、AUTORACE=拠点/LG。省略可） */
    branch: z.string().min(1, 'branch must not be empty').optional(),
});

/**
 * RacePlayerEntityの型定義
 */
export type RacePlayerEntity = z.infer<typeof RacePlayerEntitySchema>;

/**
 * RacePlayerEntityのバリデーション関数
 * @param value - バリデーション対象のRacePlayerEntityオブジェクト
 * @returns バリデーション済みのRacePlayerEntityオブジェクト
 * @throws バリデーションエラーが発生した場合はzodのエラーをスローします。
 */
export const validateRacePlayerEntity: (value: unknown) => RacePlayerEntity =
    makeValidator(RacePlayerEntitySchema);
