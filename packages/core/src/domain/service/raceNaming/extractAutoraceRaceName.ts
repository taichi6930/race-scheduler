interface AutoraceRaceCondition {
    keyword: string;
    grade: string;
    name: string;
}

const AUTORACE_RACE_CONDITIONS: AutoraceRaceCondition[] = [
    {
        keyword: '日本選手権',
        grade: 'SG',
        name: '日本選手権オートレース',
    },
    {
        keyword: 'スーパースター',
        grade: 'SG',
        name: 'スーパースター王座決定戦',
    },
    {
        keyword: '全日本選抜',
        grade: 'SG',
        name: '全日本選抜オートレース',
    },
    {
        keyword: 'オートレースグランプリ',
        grade: 'SG',
        name: 'オートレースグランプリ',
    },
    {
        keyword: 'オールスター',
        grade: 'SG',
        name: 'オールスター・オートレース',
    },
    {
        keyword: '共同通信',
        grade: 'GⅠ',
        name: '共同通信社杯プレミアムカップ',
    },
];

/**
 * レース名抽出元テキストが指定条件のキーワードを含み、かつグレードが一致するかを判定
 * （複合条件を名前付き関数に切り出し、C2組み合わせ爆発を回避）
 * @param raceSummaryInfoChild レース名抽出元テキスト
 * @param grade 抽出済みグレード
 * @param condition キーワード・グレード・レース名の対応情報
 * @param condition.keyword
 * @param condition.grade
 * @param condition.name
 */
const isAutoraceRaceConditionMatch = (
    raceSummaryInfoChild: string,
    grade: string,
    condition: AutoraceRaceCondition,
): boolean =>
    raceSummaryInfoChild.includes(condition.keyword) &&
    grade === condition.grade;

/**
 * AUTORACEのレース名を抽出
 * @param raceSummaryInfoChild - レース名抽出元テキスト
 * @param locationName - 開催場名
 * @param grade - 抽出済みグレード
 * @returns 特殊ケースに一致する固定名、なければ `${locationName}${grade}`
 */
export const extractAutoraceRaceName = (
    raceSummaryInfoChild: string,
    locationName: string,
    grade: string,
): string => {
    for (const condition of AUTORACE_RACE_CONDITIONS) {
        if (
            isAutoraceRaceConditionMatch(raceSummaryInfoChild, grade, condition)
        ) {
            return condition.name;
        }
    }

    return `${locationName}${grade}`;
};
