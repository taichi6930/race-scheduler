import { YoutubeUserIdMapForKeirin } from '../../../constants/youtubeUserIdMapForKeirin';
import type { RaceEntity } from '../../../entity/raceEntity';
import { createAnchorTag } from '../../../utilities/createAnchorTag';
import { createYoutubeLiveUrl } from '../../../utilities/createYoutubeLiveUrl';
import { getJstYear } from '../../../utilities/dateJst';
import {
    formatDayDigits,
    formatMonthDigits,
    toXDigits,
} from '../../../utilities/format';
import { createNetkeirinRaceShutubaUrl } from '../../../utilities/url';
import { RaceType } from '../../model/valueObject/raceType';
import { createPlaceCodeForOfficial } from '../../service/courseCode/officialCourseCode';
import { buildDescription } from './formatters';
import type { RaceLink } from './raceLink';

/**
 * Keirin用の外部リンク一覧（netkeirin出馬表・公式YouTube・（該当時）ぺーちゃんねる）を生成
 * @param raceEntity
 */
export const buildKeirinRaceLinks = (raceEntity: RaceEntity): RaceLink[] => {
    const raceIdForNetkeirin = `${toXDigits(getJstYear(raceEntity.datetime), 4)}${formatMonthDigits(raceEntity.datetime, 2)}${formatDayDigits(raceEntity.datetime, 2)}${createPlaceCodeForOfficial(RaceType.KEIRIN, raceEntity.raceCourse)}${toXDigits(raceEntity.raceNumber, 2)}`;

    const isShowPeChannel = ['GP', 'GⅠ', 'GⅡ', 'GⅢ'].includes(
        raceEntity.raceGrade,
    );

    const links: RaceLink[] = [
        {
            label: 'レース情報（netkeirin）',
            url: createNetkeirinRaceShutubaUrl(raceIdForNetkeirin),
        },
        {
            label: 'レース映像（公式YouTube）',
            url: createYoutubeLiveUrl(
                YoutubeUserIdMapForKeirin[raceEntity.raceCourse],
            ),
        },
    ];

    if (isShowPeChannel) {
        links.push({
            label: 'レース映像（ぺーちゃんねる）',
            url: createYoutubeLiveUrl('加藤慎平のぺーちゃんねる'),
        });
    }

    return links;
};

/**
 * Keirin用アンカータグを生成
 * @param raceEntity
 */
const buildKeirinAnchorTags = (raceEntity: RaceEntity): string[] =>
    buildKeirinRaceLinks(raceEntity).map((link) =>
        createAnchorTag(link.label, link.url),
    );

/**
 * Keirin用カレンダー説明文を生成
 * @param raceEntity
 * @param updateDate
 */
export const getKeirinDescription = (
    raceEntity: RaceEntity,
    updateDate: Date,
): string => buildDescription(raceEntity, updateDate, buildKeirinAnchorTags);
