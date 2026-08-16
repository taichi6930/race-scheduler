import { YoutubeUserIdMapForNar } from '../../../constants/youtubeUserIdMapForNar';
import type { RaceEntity } from '../../../entity/raceEntity';
import { createAnchorTag } from '../../../utilities/createAnchorTag';
import { createYoutubeLiveUrl } from '../../../utilities/createYoutubeLiveUrl';
import { getJstYear } from '../../../utilities/dateJst';
import {
    formatDayDigits,
    formatMonthDigits,
    toXDigits,
} from '../../../utilities/format';
import {
    createNetkeibaNarRaceVideoUrl,
    createNetkeibaNarShutubaUrl,
    createNetkeibaRedirectUrl,
} from '../../../utilities/url';
import { createPlaceCodeForNetkeiba } from '../../service/courseCode/netkeibaCourseCode';
import { buildDescription } from './formatters';
import type { RaceLink } from './raceLink';

/**
 * NAR用の外部リンク一覧（netkeiba出馬表・レース動画・YouTube）を生成
 * @param raceEntity
 */
export const buildNarRaceLinks = (raceEntity: RaceEntity): RaceLink[] => {
    const raceIdForNetkeiba = `${toXDigits(getJstYear(raceEntity.datetime), 4)}${createPlaceCodeForNetkeiba(raceEntity.raceType, raceEntity.raceCourse)}${formatMonthDigits(raceEntity.datetime, 2)}${formatDayDigits(raceEntity.datetime, 2)}${toXDigits(raceEntity.raceNumber, 2)}`;

    return [
        {
            label: 'レース情報（netkeiba）',
            url: createNetkeibaRedirectUrl(
                createNetkeibaNarShutubaUrl(raceIdForNetkeiba),
            ),
        },
        {
            label: 'レース動画（netkeiba）',
            url: createNetkeibaRedirectUrl(
                createNetkeibaNarRaceVideoUrl(raceIdForNetkeiba),
            ),
        },
        {
            label: 'レース映像（YouTube）',
            url: createYoutubeLiveUrl(
                YoutubeUserIdMapForNar[raceEntity.raceCourse],
            ),
        },
    ];
};

/**
 * NAR用アンカータグを生成
 * @param raceEntity
 */
const buildNarAnchorTags = (raceEntity: RaceEntity): string[] =>
    buildNarRaceLinks(raceEntity).map((link) =>
        createAnchorTag(link.label, link.url),
    );

/**
 * NAR用の馬場条件情報を生成
 * @param raceEntity
 */
const buildNarCondition = (raceEntity: RaceEntity): string | null => {
    if (!raceEntity.conditionData) {
        return null;
    }
    return `距離: ${raceEntity.conditionData.surfaceType}${raceEntity.conditionData.distance.toString()}m`;
};

/**
 * NAR用カレンダー説明文を生成
 * @param raceEntity
 * @param updateDate
 */
export const getNarDescription = (
    raceEntity: RaceEntity,
    updateDate: Date,
): string =>
    buildDescription(raceEntity, updateDate, buildNarAnchorTags, [
        buildNarCondition(raceEntity),
    ]);
