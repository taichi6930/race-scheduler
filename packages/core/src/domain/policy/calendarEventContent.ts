import type { RaceEntity } from '../../entity/raceEntity';
import { toJstISOString } from '../../utilities/dateJst';
import type { GradeType } from '../model/valueObject/gradeType';
import { RaceType } from '../model/valueObject/raceType';
import { buildCalendarDescription } from './calendarDescription';

/** レースイベントの表示長（発走から 10 分） */
const RACE_EVENT_DURATION_MS = 10 * 60 * 1000;
/** Google Calendar のイベント ID 長上限 */
const GCAL_EVENT_ID_MAX_LENGTH = 1024;

/**
 * raceId から Google Calendar のイベント ID を構築する。
 * @remarks
 * convertRaceEntityToCalendarEvent と、raceEntity を持たない
 * 単発削除（フラグ解除時の即時イベント削除）の両方から使う共通ロジック。
 * @param raceId - レースID
 * @returns Google Calendar のイベント ID
 */
export const buildCalendarEventId = (raceId: string): string =>
    raceId.replaceAll(/[^\d_a-z-]/g, '-').slice(0, GCAL_EVENT_ID_MAX_LENGTH);

/**
 * Googleカレンダーで使用する色の定義
 *
 * Google Calendar は Event Labels 機能により、カレンダーごとに任意のHEX色を
 * ラベル（id/name/backgroundColor）として登録し、イベントから eventLabelId で
 * 参照できるようになった（2026年6月ロールアウト）。
 * colorId（従来の固定11色）は eventLabelVersion=0 環境向けの後方互換フィールドとして残す。
 * @see https://developers.google.com/workspace/calendar/api/guides/labels
 */
export interface GoogleCalendarColorDefinition {
    /** 従来の Event colorId（1〜11）。eventLabelVersion=0 の場合のフォールバックとして送信 */
    colorId: string;
    /** Event Label の固定ID（UUID形式）。カレンダーへの事前登録（calendars.patch）が必要 */
    labelId: string;
    /** ラベルの表示名 */
    labelName: string;
    /** 背景色（HEX） */
    backgroundColor: string;
}

/**
 * 各色はカレンダーイベントの視認性と重要度を表現するために選択
 * labelId は一度払い出したら変更しない（変更するとカレンダー上のラベルが再登録される）
 */
export const GoogleCalendarColor = {
    LAVENDER: {
        colorId: '1',
        labelId: '89509e98-4f9a-46aa-9941-cc8e303a1310',
        labelName: 'Lavender',
        backgroundColor: '#7986CB',
    },
    SAGE: {
        colorId: '2',
        labelId: '15575a1a-e0e5-44e4-b1eb-9043ecbe4df2',
        labelName: 'Sage',
        backgroundColor: '#33B679',
    },
    GRAPE: {
        colorId: '3',
        labelId: 'bd9cc87e-7b8f-4f4e-8b56-712164cb6fff',
        labelName: 'Grape',
        backgroundColor: '#8E24AA',
    },
    FLAMINGO: {
        colorId: '4',
        labelId: '1ea821f1-4edc-4e85-9f2d-17ffb880f02e',
        labelName: 'Flamingo',
        backgroundColor: '#E67C73',
    },
    BANANA: {
        colorId: '5',
        labelId: '5ee43363-e654-4484-8c7f-2073d9067918',
        labelName: 'Banana',
        backgroundColor: '#F6BF26',
    },
    TANGERINE: {
        colorId: '6',
        labelId: '11a441d0-4495-45c5-839d-9bc4275775e3',
        labelName: 'Tangerine',
        backgroundColor: '#F4511E',
    },
    PEACOCK: {
        colorId: '7',
        labelId: 'b3fee38c-a5a0-49d8-b1d8-dc6394ffa097',
        labelName: 'Peacock',
        backgroundColor: '#039BE5',
    },
    GRAPHITE: {
        colorId: '8',
        labelId: '849d5039-c3d8-4014-a070-12b67bdf252b',
        labelName: 'Graphite',
        backgroundColor: '#616161',
    },
    BLUEBERRY: {
        colorId: '9',
        labelId: '7c0bbdd9-0b70-4b3e-b540-90efdb0e364a',
        labelName: 'Blueberry',
        backgroundColor: '#3F51B5',
    },
    BASIL: {
        colorId: '10',
        labelId: 'c362add2-38bd-4cc2-8d2a-93722a337257',
        labelName: 'Basil',
        backgroundColor: '#0B8043',
    },
    TOMATO: {
        colorId: '11',
        labelId: '9d246b13-a463-48fe-95bc-4416ea02020e',
        labelName: 'Tomato',
        backgroundColor: '#D50000',
    },
} as const satisfies Record<string, GoogleCalendarColorDefinition>;

/**
 * GoogleCalendarColor のキー（色名）の型
 */
export type GoogleCalendarColorKey = keyof typeof GoogleCalendarColor;

/**
 * カレンダーに事前登録すべき Event Label の一覧
 * ensureEventLabels（Gateway層）から参照される
 */
export const GOOGLE_CALENDAR_ALL_COLORS: readonly GoogleCalendarColorDefinition[] =
    Object.values(GoogleCalendarColor);

/**
 * 各競技ごとのグレード→色キーマップをRaceTypeでまとめる
 */
export // SAFETY: 各競技（jra/nar/keirin/boatrace/autorace）キーは RaceType の実際の値と一致し、
// 各グレード名も GradeType の値・色キーも GoogleCalendarColorKey の値のみで構成された
// リテラルオブジェクトのため、より広い Record 型として扱っても値の実体は変わらない。
const GoogleCalendarColorKeyMap = {
    jra: {
        GⅠ: 'BLUEBERRY',
        GⅡ: 'TOMATO',
        GⅢ: 'BASIL',
        'J.GⅠ': 'BLUEBERRY',
        'J.GⅡ': 'TOMATO',
        'J.GⅢ': 'BASIL',
        JpnⅠ: 'LAVENDER',
        JpnⅡ: 'FLAMINGO',
        JpnⅢ: 'SAGE',
        重賞: 'BANANA',
        Listed: 'BANANA',
        オープン: 'TANGERINE',
        オープン特別: 'TANGERINE',
    },
    nar: {
        GⅠ: 'BLUEBERRY',
        GⅡ: 'TOMATO',
        GⅢ: 'BASIL',
        JpnⅠ: 'LAVENDER',
        JpnⅡ: 'FLAMINGO',
        JpnⅢ: 'SAGE',
        重賞: 'BANANA',
        Listed: 'BANANA',
        オープン: 'TANGERINE',
        オープン特別: 'TANGERINE',
        地方重賞: 'GRAPE',
    },
    overseas: {
        GⅠ: 'BLUEBERRY',
        GⅡ: 'TOMATO',
        GⅢ: 'BASIL',
        Listed: 'BANANA',
        格付けなし: 'GRAPHITE',
    },
    keirin: {
        GP: 'BLUEBERRY',
        GⅠ: 'BLUEBERRY',
        GⅡ: 'TOMATO',
        GⅢ: 'BASIL',
        FⅠ: 'GRAPHITE',
        FⅡ: 'GRAPHITE',
    },
    boatrace: {
        SG: 'BLUEBERRY',
        GⅠ: 'BLUEBERRY',
        GⅡ: 'TOMATO',
        GⅢ: 'BASIL',
        一般: 'GRAPHITE',
    },
    autorace: {
        SG: 'BLUEBERRY',
        特GⅠ: 'BLUEBERRY',
        GⅠ: 'BLUEBERRY',
        GⅡ: 'TOMATO',
        開催: 'GRAPHITE',
    },
} as Record<RaceType, Record<GradeType, GoogleCalendarColorKey>>;

/**
 * Stageが指定されたグレードのセットをRaceTypeごとに定義
 * 各RaceTypeで、どのグレード・ステージのレースをカレンダーに登録すべきかを管理
 * @param raceType - レース種別
 * @param raceEntity
 * @returns 指定されたグレードのセット
 */
export const formatStageForCalendar = (
    raceEntity: RaceEntity,
): string | null => {
    switch (raceEntity.raceType) {
        case RaceType.JRA:
        case RaceType.NAR:
        case RaceType.OVERSEAS: {
            return null;
        }
        case RaceType.KEIRIN:
        case RaceType.AUTORACE:
        case RaceType.BOATRACE: {
            return raceEntity.raceStage ?? null;
        }
    }
};

/**
 * Calendarのタイトルに使用する文字列を生成
 * @param raceEntity - レースエンティティ
 * @returns カレンダーイベントのタイトルに使用する文字列
 */
export const formatSummaryForCalendar = (raceEntity: RaceEntity): string => {
    const stage = formatStageForCalendar(raceEntity);
    return stage === null
        ? raceEntity.raceName
        : `${stage} ${raceEntity.raceName}`;
};

/**
 * レース種別とグレードに基づいてGoogleカレンダーの色定義を取得するユーティリティ関数
 * 各レース種別とグレードの組み合わせに対して、Googleカレンダーで使用する色を定義
 * 定義されていない組み合わせの場合は、デフォルトの色（GRAPHITE）を返す
 * @param raceType - レース種別
 * @param gradeType - グレード
 * @returns Googleカレンダーの色定義（colorId・labelId・背景色を含む）
 */
export const getGoogleCalendarColor = (
    raceType: RaceType,
    gradeType: GradeType,
): GoogleCalendarColorDefinition =>
    GoogleCalendarColor[
        GoogleCalendarColorKeyMap[raceType][gradeType] ?? 'GRAPHITE'
    ];

/**
 * raceType ごとの開催地サフィックス（「◯◯競馬場」等）。
 * 開催地文字列は「raceCourse + サフィックス」だけなので switch を表引きに置き換える。
 */
const LOCATION_SUFFIX_BY_RACE_TYPE: Record<RaceType, string> = {
    [RaceType.JRA]: '競馬場',
    [RaceType.NAR]: '競馬場',
    [RaceType.OVERSEAS]: '競馬場',
    [RaceType.KEIRIN]: '競輪場',
    [RaceType.AUTORACE]: 'オートレース場',
    [RaceType.BOATRACE]: 'ボートレース場',
};

/**
 * カレンダーイベントの開催地を構築
 * @param raceEntity - レース情報
 * @returns 開催地の文字列
 */
export const formatLocationForCalendar = (raceEntity: RaceEntity): string =>
    `${raceEntity.raceCourse}${LOCATION_SUFFIX_BY_RACE_TYPE[raceEntity.raceType]}`;

/**
 * Date を Google Calendar API 用のJST ISO文字列に変換
 * @param date
 */
const formatDateTimeForCalendar = (date: Date): string => {
    return toJstISOString(date);
};

/** convertRaceEntityToCalendarEvent が返す Google Calendar Event 形式のペイロード。 */
interface CalendarEventPayload {
    id: string;
    summary: string;
    description: string;
    location: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    colorId: string;
    /**
     * Event Labels機能で参照する色ラベルID（eventLabelVersion=1と併用）
     * @see https://developers.google.com/workspace/calendar/api/guides/labels
     */
    eventLabelId: string;
    extendedProperties?: { private?: { status?: string } };
}

/**
 * RaceEntity を Google Calendar Event 形式に変換
 * @param raceEntity
 */
export const convertRaceEntityToCalendarEvent = (
    raceEntity: RaceEntity,
): CalendarEventPayload => {
    const startTime = new Date(raceEntity.datetime);
    const endTime = new Date(startTime.getTime() + RACE_EVENT_DURATION_MS);
    const color = getGoogleCalendarColor(
        raceEntity.raceType,
        raceEntity.raceGrade,
    );

    return {
        id: buildCalendarEventId(raceEntity.raceId),
        summary: formatSummaryForCalendar(raceEntity),
        description: buildCalendarDescription(raceEntity),
        location: formatLocationForCalendar(raceEntity),
        start: {
            dateTime: formatDateTimeForCalendar(startTime),
            timeZone: 'Asia/Tokyo',
        },
        end: {
            dateTime: formatDateTimeForCalendar(endTime),
            timeZone: 'Asia/Tokyo',
        },
        colorId: color.colorId,
        eventLabelId: color.labelId,
    };
};
