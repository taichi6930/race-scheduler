import type { GradeType } from '../../model/valueObject/gradeType';
import type { RaceCourse } from '../../model/valueObject/raceCourse';
import type { RaceDateTime } from '../../model/valueObject/raceDateTime';
import type { RaceDistance } from '../../model/valueObject/raceDistance';
import type { RaceName } from '../../model/valueObject/raceName';
import type { RaceSurfaceType } from '../../model/valueObject/surfaceType';

interface JraRaceDataForRaceName {
    name: RaceName;
    place: RaceCourse;
    grade: GradeType;
    date: RaceDateTime;
    surfaceType?: RaceSurfaceType;
    distance?: RaceDistance;
}

interface RacePattern {
    shortName: string;
    placeList?: RaceCourse[];
    gradeList?: GradeType[];
    monthList?: number[];
    keywordPatternList?: string[][];
    surfaceType?: RaceSurfaceType;
    distance?: RaceDistance;
}

/**
 * JRAクラス名称変更（賞金別名称→勝利数別名称）の施行日。
 * これより前に開催されたレースでは「1000万下」等の表記が当時の正式名称であり
 * 誤表記ではないため、{@link normalizeLegacyConditionClassName} の適用対象から除外する。
 */
const JRA_CLASS_RENAME_EFFECTIVE_DATE = new Date('2019-06-01T00:00:00+09:00');

/**
 * JRA旧クラス名（賞金別名称）→ 新クラス名（勝利数別名称）対応表。
 *
 * 2019年6月1日のJRAクラス名称変更（例: 500万円以下 → 1勝クラス）以降に開催される
 * レースについて、スクレイピング元（Yahoo!スポーツ）のレースタイトルに旧称
 * （「1000万円以下」「1000万下」等）がそのまま残っているケースがあるため、
 * レース名（非重賞のフォールバック時）を新称へ正規化する。
 * 500万/1000万/1600万のみが対象（900万下は正式なクラス名称変更の対象外のため含めない）。
 */
const LEGACY_CONDITION_CLASS_TABLE: readonly (readonly [RegExp, string])[] = [
    [/1600万円?(以下|下)/, '3勝クラス'],
    [/1000万円?(以下|下)/, '2勝クラス'],
    [/500万円?(以下|下)/, '1勝クラス'],
];

/**
 * レース名中の旧クラス名表記を新クラス名表記へ正規化する。
 * クラス名称変更の施行日（2019年6月1日）より前のレースは対象外とし、そのまま返す。
 * @param name - 正規化対象のレース名
 * @param date - レース開催日
 */
const normalizeLegacyConditionClassName = (
    name: string,
    date: Date,
): string => {
    if (date < JRA_CLASS_RENAME_EFFECTIVE_DATE) {
        return name;
    }

    return LEGACY_CONDITION_CLASS_TABLE.reduce(
        (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
        name,
    );
};

const RACE_PATTERNS: RacePattern[] = [
    {
        shortName: '阪神JF',
        placeList: ['阪神'],
        gradeList: ['GⅠ'],
        monthList: [10, 11],
        keywordPatternList: [['阪神'], ['ジュベナイル']],
    },
    {
        shortName: '朝日杯FS',
        placeList: ['中山', '阪神'],
        gradeList: ['GⅠ'],
        monthList: [11],
        keywordPatternList: [['朝日'], ['フュー']],
    },
    {
        shortName: 'マイルCS',
        placeList: ['阪神', '京都'],
        gradeList: ['GⅠ'],
        monthList: [10],
        keywordPatternList: [['マイル']],
        surfaceType: '芝',
    },
    {
        shortName: 'AJCC',
        placeList: ['中山', '東京'],
        gradeList: ['GⅡ'],
        monthList: [0, 1],
        keywordPatternList: [
            ['アメリカ'],
            ['J', 'ジョッキー'],
            ['C', 'クラブ'],
        ],
        surfaceType: '芝',
    },
    {
        shortName: '府中牝馬S',
        placeList: ['中山', '東京'],
        gradeList: ['GⅡ', 'GⅢ'],
        monthList: [5, 9],
        keywordPatternList: [['府中牝馬']],
        surfaceType: '芝',
    },
    {
        shortName: 'アイビスサマーD',
        placeList: ['新潟'],
        gradeList: ['GⅢ'],
        keywordPatternList: [['アイビス']],
        surfaceType: '芝',
        distance: 1000,
    },
    {
        shortName: '京成杯オータムH',
        placeList: ['中山'],
        gradeList: ['GⅢ'],
        monthList: [8],
        keywordPatternList: [['京成杯']],
        surfaceType: '芝',
        distance: 1600,
    },
    {
        shortName: 'サウジアラビアRC',
        placeList: ['東京'],
        gradeList: ['GⅢ'],
        monthList: [9],
        keywordPatternList: [['サウジ']],
        surfaceType: '芝',
        distance: 1600,
    },
    {
        shortName: 'ルミエールオータムD',
        placeList: ['新潟'],
        gradeList: ['Listed'],
        monthList: [9, 10],
        keywordPatternList: [['ルミエール']],
        surfaceType: '芝',
        distance: 1000,
    },
];

/**
 * リスト型のパターン条件（placeList/gradeList/monthList）について、
 * 条件が指定されているにもかかわらず実際の値がリストに含まれていない場合に true を返す。
 * `list && !list.includes(actual)` という複合条件を独立関数へ切り出し、
 * C2（条件網羅）の組み合わせ爆発を回避する。
 * @param list - パターン側のリスト条件（未指定の場合は undefined）
 * @param actual - 実際の値
 * @returns 条件が指定されておりかつ不一致であれば true
 */
const isListFieldMismatch = <T>(list: T[] | undefined, actual: T): boolean =>
    !!list && !list.includes(actual);

/**
 * スカラー型のパターン条件（surfaceType/distance）について、
 * 条件が指定されているにもかかわらず実際の値と一致しない場合に true を返す。
 * `value && actual !== value` という複合条件を独立関数へ切り出し、
 * C2（条件網羅）の組み合わせ爆発を回避する。
 * @param patternValue - パターン側の条件値（未指定の場合は undefined）
 * @param actual - 実際の値
 * @returns 条件が指定されておりかつ不一致であれば true
 */
const isScalarFieldMismatch = <T>(
    patternValue: T | undefined,
    actual: T | undefined,
): boolean => !!patternValue && actual !== patternValue;

/**
 * すべての条件がレース情報にマッチするかを判定する
 * @param raceInfo
 * @param pattern
 */
const isMatchingPattern = (
    raceInfo: JraRaceDataForRaceName,
    pattern: RacePattern,
): boolean => {
    if (isListFieldMismatch(pattern.placeList, raceInfo.place)) {
        return false;
    }

    if (isListFieldMismatch(pattern.gradeList, raceInfo.grade)) {
        return false;
    }

    if (isListFieldMismatch(pattern.monthList, raceInfo.date.getMonth())) {
        return false;
    }

    if (isScalarFieldMismatch(pattern.surfaceType, raceInfo.surfaceType)) {
        return false;
    }

    if (isScalarFieldMismatch(pattern.distance, raceInfo.distance)) {
        return false;
    }

    if (pattern.keywordPatternList) {
        for (const keywords of pattern.keywordPatternList) {
            if (keywords.every((keyword) => !raceInfo.name.includes(keyword))) {
                return false;
            }
        }
    }

    return true;
};

export const processJraRaceName = (
    raceInfo: JraRaceDataForRaceName,
): string => {
    const matchedPattern = RACE_PATTERNS.find((pattern) =>
        isMatchingPattern(raceInfo, pattern),
    );

    return matchedPattern
        ? matchedPattern.shortName
        : normalizeLegacyConditionClassName(raceInfo.name, raceInfo.date);
};
