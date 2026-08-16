import type { RaceStage } from '../../model/valueObject/raceStage';

/**
 * シリーズレース名に指定キーワードを含み、かつステージ名に指定キーワードを
 * 含む/含まないが期待どおりかを判定
 * （複合条件を名前付き関数に切り出し、C2組み合わせ爆発を回避。
 * extractKeirinRaceName の各特殊ケース判定で共通利用する）
 * @param seriesRaceName シリーズレース名
 * @param seriesKeyword シリーズレース名に含まれるべきキーワード
 * @param raceStage レースステージ
 * @param stageKeyword レースステージに含まれる/含まれないべきキーワード
 * @param shouldStageInclude raceStage が stageKeyword を含むべきなら true、含まないべきなら false
 */
const isSeriesAndStageMatch = (
    seriesRaceName: string,
    seriesKeyword: string,
    raceStage: RaceStage,
    stageKeyword: string,
    shouldStageInclude: boolean,
): boolean =>
    seriesRaceName.includes(seriesKeyword) &&
    raceStage.includes(stageKeyword) === shouldStageInclude;

/** KEIRIN特殊ケースの1件分の定義（processJraRaceName.tsのテーブル駆動構造に準拠）。 */
interface KeirinRaceNamePattern {
    seriesKeyword: string;
    stageKeyword: string;
    shouldStageInclude: boolean;
    result: string;
}

const KEIRIN_RACE_NAME_PATTERNS: KeirinRaceNamePattern[] = [
    {
        seriesKeyword: '競輪祭',
        stageKeyword: 'ガールズ',
        shouldStageInclude: true,
        result: '競輪祭女子王座戦',
    },
    {
        seriesKeyword: '高松宮記念杯',
        stageKeyword: 'ガールズ',
        shouldStageInclude: true,
        result: 'パールカップ',
    },
    {
        seriesKeyword: 'オールスター競輪',
        stageKeyword: 'ガールズ',
        shouldStageInclude: true,
        result: '女子オールスター競輪',
    },
    {
        seriesKeyword: 'サマーナイトフェスティバル',
        stageKeyword: 'ガールズ',
        shouldStageInclude: true,
        result: 'ガールズケイリンフェスティバル',
    },
    {
        seriesKeyword: 'KEIRINグランプリ',
        stageKeyword: 'グランプリ',
        shouldStageInclude: false,
        result: '寺内大吉記念杯競輪',
    },
];

/**
 * KEIRINのレース名を抽出
 *
 * spyOn 経由でテストできるよう export している
 * （呼び出し元の「レース名が空文字になった場合はスキップ」分岐は、
 * このフォールバックが常に非空文字を返すため通常到達しない防御的コード）。
 * @param seriesRaceName シリーズレース名
 * @param raceStage レースステージ
 * @returns 特殊ケースに一致する固定名、なければ seriesRaceName をそのまま返す
 */
export const extractKeirinRaceName = (
    seriesRaceName: string,
    raceStage: RaceStage,
): string => {
    const matchedPattern = KEIRIN_RACE_NAME_PATTERNS.find((pattern) =>
        isSeriesAndStageMatch(
            seriesRaceName,
            pattern.seriesKeyword,
            raceStage,
            pattern.stageKeyword,
            pattern.shouldStageInclude,
        ),
    );

    // マッチしなければそのままレース名として返す（例: "小田原FⅡ"）
    return matchedPattern?.result ?? seriesRaceName;
};
