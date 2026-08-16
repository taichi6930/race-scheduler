import type { RaceEntity } from '../../../entity/raceEntity';
import { RaceType } from '../../model/valueObject/raceType';
import { buildJraRaceLinks } from './jra.builder';
import { buildKeirinRaceLinks } from './keirin.builder';
import { buildNarRaceLinks } from './nar.builder';
import type { RaceLink } from './raceLink';

/**
 * raceType → 外部リンク生成関数の対応表。
 * JRA/NAR/KEIRIN は専用ロジック、AUTORACE/BOATRACE/OVERSEAS は
 * 対応データが無いため空配列を返す。
 */
const RACE_LINKS_BUILDER_BY_RACE_TYPE: Record<
    RaceType,
    (raceEntity: RaceEntity) => RaceLink[]
> = {
    [RaceType.JRA]: buildJraRaceLinks,
    [RaceType.NAR]: buildNarRaceLinks,
    [RaceType.KEIRIN]: buildKeirinRaceLinks,
    [RaceType.AUTORACE]: () => [],
    [RaceType.BOATRACE]: () => [],
    [RaceType.OVERSEAS]: () => [],
};

/**
 * レースに関連する外部リンク（netkeiba出馬表・レース動画・YouTube公式配信等）を取得する。
 * カレンダー説明文（[buildCalendarDescription]）に埋め込むのと同一のリンクを、
 * アプリのレース詳細でボタン表示する用途にも使えるよう構造化データで返す。
 * @param raceEntity
 */
export const buildRaceLinks = (raceEntity: RaceEntity): RaceLink[] =>
    RACE_LINKS_BUILDER_BY_RACE_TYPE[raceEntity.raceType](raceEntity);
