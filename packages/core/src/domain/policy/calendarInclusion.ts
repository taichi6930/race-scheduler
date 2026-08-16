import type { RaceEntity } from '../../entity/raceEntity';
import { buildRaceTypeIndexedCache } from '../../utilities/raceTypeIndexedCache';
import { GradeMaster } from '../master/gradeMaster';
import { StagePriorityList } from '../master/gradeStageMaster';
import { RaceType } from '../model/valueObject/raceType';

/**
 * GradeMaster から isSpecified が true のグレードの集合を取得（raceType単位でメモ化）
 * @param raceType - 対象のレースタイプ
 * @returns isSpecified が true のグレードのセット
 */
const getSpecifiedGrades = buildRaceTypeIndexedCache(
    (raceType: RaceType): Set<string> =>
        new Set(
            Object.entries(GradeMaster[raceType])
                .filter(([, entry]) => entry.isSpecified)
                .map(([grade]) => grade),
        ),
);

/** (raceType, grade, stage) 単位で参照する優先度・重賞例外情報 */
interface StagePriorityInfo {
    priority: number;
    specifiedOverride: boolean;
}

const DEFAULT_STAGE_PRIORITY_INFO: StagePriorityInfo = {
    priority: 0,
    specifiedOverride: false,
};

/**
 * getPriority/isSpecifiedRace の (raceType, raceGrade, raceStage) 組み合わせ単位の
 * 結果キャッシュ。StagePriorityList は定数のため、同一組み合わせに対する結果は
 * 常に同じになる（PERF-094）。
 */
const stagePriorityInfoCache = new Map<string, StagePriorityInfo>();

/**
 * stagePriorityInfoCache のキーを組み立てる。
 * @param raceType - 対象レースタイプ
 * @param raceGrade - 対象レースのグレード
 * @param stage - 対象レースのステージ
 * @returns stagePriorityInfoCache 用の一意なキー文字列
 */
const buildStagePriorityCacheKey = (
    raceType: RaceType,
    raceGrade: string,
    stage: string,
): string => `${raceType}::${raceGrade}::${stage}`;

/**
 * StagePriorityList から対象レースの priority・重賞例外フラグを取得（メモ化）
 * @remarks
 * raceGrade/raceStage が非 string になる呼び出しは、唯一の呼び出し元である
 * isMechanicalGradeSpecified/isSpecifiedRace の型ガードにより実質到達しないが、
 * 防御的な型チェックとして意味があり、かつ単独でテスト容易なため直接ユニット
 * テストできるよう getPriority を export している。
 * @param raceType - 対象レースタイプ
 * @param raceGrade - 対象レースのグレード
 * @param stage - 対象レースのステージ
 * @returns priority・specifiedOverride。見つからない場合は既定値
 */
const getStagePriorityInfo = (
    raceType: RaceType,
    raceGrade: string,
    stage: string,
): StagePriorityInfo => {
    const cacheKey = buildStagePriorityCacheKey(raceType, raceGrade, stage);
    const cached = stagePriorityInfoCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    const match = StagePriorityList.find(
        (item) =>
            item.raceType === raceType &&
            item.grade.includes(raceGrade) &&
            item.stage === stage,
    );
    const info: StagePriorityInfo = match
        ? {
              priority: match.priority,
              specifiedOverride: match.specifiedOverride ?? false,
          }
        : DEFAULT_STAGE_PRIORITY_INFO;
    stagePriorityInfoCache.set(cacheKey, info);
    return info;
};

/**
 * StagePriorityList から対象レースの priority を取得（メモ化）
 * @param raceEntity - 対象レースエンティティ
 * @returns priority、見つからない場合は 0
 */
export const getPriority = (raceEntity: RaceEntity): number => {
    const { raceGrade, raceStage: stage, raceType } = raceEntity;

    // raceGrade / stage のいずれかが文字列でなければ対象外（ガード節に分解し、複合条件を回避）
    if (typeof raceGrade !== 'string') {
        return 0;
    }
    if (typeof stage !== 'string') {
        return 0;
    }

    return getStagePriorityInfo(raceType, raceGrade, stage).priority;
};

/**
 * KEIRIN/AUTORACE/BOATRACE をカレンダー登録対象とする priority の下限値。
 * 以前は `4` だったが、二次予選・準決勝クラスをカレンダーから間引くため `6` へ引き上げた
 * （ユーザー依頼、2026-08-06）。
 */
const MECHANICAL_PRIORITY_THRESHOLD = 6;

/**
 * grade単独ではisSpecified=falseのステージが、StagePriorityList上の
 * specifiedOverrideにより重賞相当として扱われるかを判定する。
 * 例: KEIRIN「全プロ競輪」（FⅡ格式だが実質重賞相当のステージ）。
 * @param raceEntity - 判定対象のレースエンティティ
 * @returns specifiedOverrideに該当すれば true
 */
const isSpecifiedOverrideStage = (raceEntity: RaceEntity): boolean => {
    const { raceGrade, raceStage: stage, raceType } = raceEntity;

    if (typeof raceGrade !== 'string') {
        return false;
    }
    if (typeof stage !== 'string') {
        return false;
    }

    return getStagePriorityInfo(raceType, raceGrade, stage).specifiedOverride;
};

/**
 * レースが重賞相当（isSpecified）かどうかを判定する。
 * 基本は GradeMaster の isSpecified グレードだが、StagePriorityList上で
 * specifiedOverride が付与されたステージ（KEIRIN全プロ競輪等）は
 * grade単独でisSpecified=falseでも例外的に重賞相当として扱う。
 * @param raceEntity - 判定対象のレースエンティティ
 * @returns 重賞相当であれば true
 */
export const isSpecifiedRace = (raceEntity: RaceEntity): boolean =>
    getSpecifiedGrades(raceEntity.raceType).has(raceEntity.raceGrade) ||
    isSpecifiedOverrideStage(raceEntity);

/**
 * JRA/NAR/OVERSEAS 用のルール: isSpecifiedRace = true のレースのみ対象。
 * @param raceEntity - 判定対象のレースエンティティ
 * @returns 対象であれば true
 */
const isHorseGradeSpecified = (raceEntity: RaceEntity): boolean =>
    isSpecifiedRace(raceEntity);

/**
 * KEIRIN/AUTORACE/BOATRACE 用のルール:
 * isSpecifiedRace = true かつ priority >= MECHANICAL_PRIORITY_THRESHOLD。
 * @param raceEntity - 判定対象のレースエンティティ
 * @returns 対象であれば true
 */
const isMechanicalGradeSpecified = (raceEntity: RaceEntity): boolean =>
    isSpecifiedRace(raceEntity) &&
    getPriority(raceEntity) >= MECHANICAL_PRIORITY_THRESHOLD;

/**
 * RaceType ごとのカレンダー対象条件を定義
 * 各RaceTypeが、どのグレード・ステージのレースをカレンダーに登録すべきかを管理
 */
const calendarRaceFilterRules: Record<
    RaceType,
    (raceEntity: RaceEntity) => boolean
> = {
    [RaceType.JRA]: isHorseGradeSpecified,
    [RaceType.NAR]: isHorseGradeSpecified,
    [RaceType.OVERSEAS]: isHorseGradeSpecified,
    [RaceType.KEIRIN]: isMechanicalGradeSpecified,
    [RaceType.AUTORACE]: isMechanicalGradeSpecified,
    [RaceType.BOATRACE]: isMechanicalGradeSpecified,
};

/**
 * レースがカレンダーに含まれるべきかを判定
 * グレードによる判定（重賞など）に加え、ユーザーが個別に指定した
 * レース（flaggedRaceIds）・注目選手が出走するレース（watchedRaceIds、
 * SPEC-PLAYER-001）は、グレードに関係なく常に含める。
 * @param raceEntity - 判定対象のレースエンティティ
 * @param flaggedRaceIds - ユーザーが指定したレースの raceId 集合（未指定時は空集合扱い）
 * @param watchedRaceIds - 注目選手（player_watch）が出走するレースの raceId 集合
 * （未指定時は空集合扱い）
 * @returns カレンダーに含めるべき場合は true
 */
export const shouldIncludeInCalendar = (
    raceEntity: RaceEntity,
    flaggedRaceIds: ReadonlySet<string> = new Set(),
    watchedRaceIds: ReadonlySet<string> = new Set(),
): boolean => {
    const rule = calendarRaceFilterRules[raceEntity.raceType];
    return (
        rule(raceEntity) ||
        flaggedRaceIds.has(raceEntity.raceId) ||
        watchedRaceIds.has(raceEntity.raceId)
    );
};
