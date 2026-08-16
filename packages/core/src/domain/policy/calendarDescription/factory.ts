import type { RaceEntity } from '../../../entity/raceEntity';
import { RaceType } from '../../model/valueObject/raceType';
import { getSimpleDescription } from './formatters';
import { getJraDescription } from './jra.builder';
import { getKeirinDescription } from './keirin.builder';
import { getNarDescription } from './nar.builder';

/**
 * raceType → カレンダー説明文ビルダーの対応表。
 * JRA/NAR/KEIRIN は専用ロジック、AUTORACE/BOATRACE/OVERSEAS は
 * 発走時刻と更新時刻のみのシンプルな共通実装（getSimpleDescription）を用いる。
 */
const DESCRIPTION_BUILDER_BY_RACE_TYPE: Record<
    RaceType,
    (raceEntity: RaceEntity, updateDate: Date) => string
> = {
    [RaceType.JRA]: getJraDescription,
    [RaceType.NAR]: getNarDescription,
    [RaceType.KEIRIN]: getKeirinDescription,
    [RaceType.AUTORACE]: getSimpleDescription,
    [RaceType.BOATRACE]: getSimpleDescription,
    [RaceType.OVERSEAS]: getSimpleDescription,
};

/**
 * RaceTypeに応じてカレンダー説明文を生成
 * 各競技のロジックを統一的に処理する
 * @param raceEntity
 * @param updateDate
 */
export const buildCalendarDescription = (
    raceEntity: RaceEntity,
    updateDate: Date = new Date(),
): string =>
    DESCRIPTION_BUILDER_BY_RACE_TYPE[raceEntity.raceType](
        raceEntity,
        updateDate,
    );
