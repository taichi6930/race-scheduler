import { YoutubeUserIdMapForJra } from '../../../constants/youtubeUserIdMapForJra';
import type { RaceEntity } from '../../../entity/raceEntity';
import { createAnchorTag } from '../../../utilities/createAnchorTag';
import { createYoutubeLiveUrl } from '../../../utilities/createYoutubeLiveUrl';
import { getJstYear } from '../../../utilities/dateJst';
import { toXDigits } from '../../../utilities/format';
import {
    createNetkeibaJraRaceVideoUrl,
    createNetkeibaJraShutubaUrl,
    createNetkeibaRedirectUrl,
} from '../../../utilities/url';
import { createPlaceCodeForNetkeiba } from '../../service/courseCode/netkeibaCourseCode';
import { buildDescription } from './formatters';
import type { RaceLink } from './raceLink';

/**
 * JRA用の外部リンク一覧（netkeiba出馬表・レース動画・公式YouTube）を生成
 * @param raceEntity
 */
export const buildJraRaceLinks = (raceEntity: RaceEntity): RaceLink[] => {
    const raceIdForNetkeiba = `${toXDigits(getJstYear(raceEntity.datetime), 4)}${createPlaceCodeForNetkeiba(raceEntity.raceType, raceEntity.raceCourse)}${toXDigits(raceEntity.placeHeldDays?.heldTimes ?? 1, 2)}${toXDigits(raceEntity.placeHeldDays?.heldDayTimes ?? 1, 2)}${toXDigits(raceEntity.raceNumber, 2)}`;

    return [
        {
            label: 'レース情報(netkeiba)',
            url: createNetkeibaRedirectUrl(
                createNetkeibaJraShutubaUrl(raceIdForNetkeiba),
            ),
        },
        {
            label: 'レース動画(netkeiba)',
            url: createNetkeibaRedirectUrl(
                createNetkeibaJraRaceVideoUrl(raceIdForNetkeiba),
            ),
        },
        {
            label: 'レース映像（公式YouTube）',
            url: createYoutubeLiveUrl(
                YoutubeUserIdMapForJra[raceEntity.raceCourse],
            ),
        },
    ];
};

/**
 * JRA用アンカータグを生成
 * @param raceEntity
 */
const buildJraAnchorTags = (raceEntity: RaceEntity): string[] =>
    buildJraRaceLinks(raceEntity).map((link) =>
        createAnchorTag(link.label, link.url),
    );

/**
 * JRA用カレンダー説明文を生成
 * @param raceEntity
 * @param updateDate
 */
export const getJraDescription = (
    raceEntity: RaceEntity,
    updateDate: Date,
): string => buildDescription(raceEntity, updateDate, buildJraAnchorTags);
