import type { RaceEntity } from '../../../entity/raceEntity';
import { getJstHours, getJstMinutes } from '../../../utilities/dateJst';
import { RaceType } from '../../model/valueObject/raceType';

/** `競技` フィールドの表示ラベル（front `DisciplineIcon.labelFor` と対応）。 */
const RACE_TYPE_LABEL_JA = {
    [RaceType.JRA]: 'JRA',
    [RaceType.NAR]: '地方競馬',
    [RaceType.OVERSEAS]: '海外競馬',
    [RaceType.KEIRIN]: '競輪',
    [RaceType.BOATRACE]: '競艇',
    [RaceType.AUTORACE]: 'オートレース',
} satisfies Record<RaceType, string>;

/**
 * 発走時刻を `HH:mm` 形式で組み立てる。海外競馬はJST表記であることを明示する
 * （front `_formatRaceTime` と同じ理由: 現地時刻と誤読されうるため）。
 * @param raceEntity - 対象レース
 * @returns 発走時刻の表示文字列
 */
const formatTimeField = (raceEntity: RaceEntity): string => {
    const hour = String(getJstHours(raceEntity.datetime)).padStart(2, '0');
    const minute = String(getJstMinutes(raceEntity.datetime)).padStart(2, '0');
    const formatted = `${hour}:${minute}`;
    return raceEntity.raceType === RaceType.OVERSEAS
        ? `${formatted}（JST）`
        : formatted;
};

/**
 * `ステージ`フィールドの表示文字列を組み立てる。
 * @param raceEntity - 対象レース
 * @returns raceStageの値。未設定・空文字ならnull
 */
const formatStageField = (raceEntity: RaceEntity): string | null => {
    const { raceStage } = raceEntity;
    if (raceStage === undefined) return null;
    if (raceStage.length === 0) return null;
    return raceStage;
};

/**
 * `条件`（馬場種別・距離）フィールドの表示文字列を組み立てる。
 * @param raceEntity - 対象レース
 * @returns 表示文字列。conditionDataが無ければnull
 */
const formatConditionField = (raceEntity: RaceEntity): string | null => {
    if (!raceEntity.conditionData) return null;
    const { surfaceType, distance } = raceEntity.conditionData;
    return `${surfaceType} ・ ${distance}m`;
};

/** `GET /ui/race-detail` の kv セクションで選択できるフィールドキー。 */
export const RACE_DETAIL_FIELD_KEYS = [
    'time',
    'raceType',
    'course',
    'number',
    'grade',
    'stage',
    'condition',
] as const;

/** {@link RACE_DETAIL_FIELD_KEYS} の要素型。 */
export type RaceDetailFieldKey = (typeof RACE_DETAIL_FIELD_KEYS)[number];

/** kv セクションの1フィールド定義（既定ラベル・レースからの値解決）。 */
interface RaceDetailFieldDefinition {
    /** 管理画面で表示・ラベル未指定時に使う既定ラベル */
    readonly defaultLabel: string;
    /**
     * レースから表示値を解決する。値が存在しない場合（グレード無し等）は
     * `null` を返し、呼び出し側で行ごと省略する。
     */
    readonly resolve: (raceEntity: RaceEntity) => string | null;
}

/**
 * kv セクションのフィールドカタログ。管理画面・構成JSONが参照できるのは
 * このキーのみであり、値を生成するロジック自体はここに閉じる
 * （race-detail-sdui-design.md §1.2: 編集対象は「フィールド参照」であって
 * 自由テキストではない）。
 */
export const RACE_DETAIL_FIELDS = {
    time: { defaultLabel: '発走', resolve: formatTimeField },
    raceType: {
        defaultLabel: '競技',
        resolve: (raceEntity) => RACE_TYPE_LABEL_JA[raceEntity.raceType],
    },
    course: {
        defaultLabel: '会場',
        resolve: (raceEntity) => raceEntity.raceCourse,
    },
    number: {
        defaultLabel: 'レース',
        resolve: (raceEntity) => `${raceEntity.raceNumber}R`,
    },
    grade: {
        defaultLabel: 'グレード',
        resolve: (raceEntity) =>
            raceEntity.raceGrade.length > 0 ? raceEntity.raceGrade : null,
    },
    stage: { defaultLabel: 'ステージ', resolve: formatStageField },
    condition: { defaultLabel: '条件', resolve: formatConditionField },
} satisfies Record<RaceDetailFieldKey, RaceDetailFieldDefinition>;
