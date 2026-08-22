/**
 * domain/policy/calendarEventContent テスト
 *
 * 単体テスト（calendarDescription配下）
 * - formatters.test.ts: formatRaceTime, formatUpdateTime, formatDescriptionTemplate
 * - keirin.builder.test.ts: getKeirinDescription
 * - jra.builder.test.ts: getJraDescription
 * - nar.builder.test.ts: getNarDescription
 * - overseas.builder.test.ts: getOverseasDescription
 * - autorace.builder.test.ts: getAutoRaceDescription
 * - boatrace.builder.test.ts: getBoatRaceDescription
 * - factory.test.ts: buildCalendarDescription dispatcher
 * - index.test.ts: public API exports
 *
 * このファイルのテスト対象:
 * - formatStageForCalendar: カレンダーイベント作成前のステージ処理
 * - formatSummaryForCalendar: カレンダーサマリー作成
 * - getGoogleCalendarColor: カレンダー色定義（colorId・eventLabelId）取得
 * - formatLocationForCalendar: 開催地フォーマット
 * - convertRaceEntityToCalendarEvent: 統合テスト（RaceEntity → Google Calendar Event変換）
 */

/**
 * ## デシジョンテーブル
 *
 * ### formatStageForCalendar
 * | ケース | レース種別 | 期待値 |
 * |--------|-----------|--------|
 * | S1 | JRA | null |
 * | S2 | NAR | null |
 * | S3 | OVERSEAS | null |
 * | S4 | raceStage ありの KEIRIN | raceStage の値 |
 * | S5 | raceStage ありの AUTORACE | raceStage の値 |
 * | S6 | raceStage ありの BOATRACE | raceStage の値 |
 * | S7 | raceStage なしの KEIRIN | null |
 *
 * ### formatSummaryForCalendar
 * | ケース | レース種別 | レースステージ | 期待値 |
 * |--------|-----------|------------|--------|
 * | T1 | JRA（ステージなし）| - | raceName のみ |
 * | T2 | ステージありの KEIRIN | S級決勝 | "S級決勝 レース名" |
 * | T3 | JRA（ステージなし・isConfirmed: false）| - | raceName のみ（未確定でもタイトルに接頭辞を付けない） |
 *
 * ### getGoogleCalendarColor
 * | ケース | レース種別 | グレード | 期待値 |
 * |--------|-----------|--------|--------|
 * | C1 | JRA | GⅠ | BLUEBERRY |
 * | C2 | JRA | 不明 | GRAPHITE（フォールバック） |
 * | C3 | KEIRIN | GP | BLUEBERRY |
 * | C4 | BOATRACE | SG | BLUEBERRY |
 * | C5 | AUTORACE | SG | BLUEBERRY |
 * | C6 | NAR | GⅠ | BLUEBERRY |
 *
 * ### formatLocationForCalendar
 * | ケース | レース種別 | 期待値 |
 * |--------|-----------|--------|
 * | L1 | JRA | "○○競馬場" |
 * | L2 | NAR | "○○競馬場" |
 * | L3 | OVERSEAS | "○○競馬場" |
 * | L4 | KEIRIN | "○○競輪場" |
 * | L5 | AUTORACE | "○○オートレース場" |
 * | L6 | BOATRACE | "○○ボートレース場" |
 *
 * ### buildCalendarEventId
 * | ケース | 入力 | 期待値 |
 * |--------|------|--------|
 * | I1 | 通常のraceId（英小文字+数字） | そのまま返す |
 * | I2 | サニタイズ対象文字（英大文字等）を含むraceId | 該当文字が "-" に置換される |
 * | I3 | GCAL_EVENT_ID_MAX_LENGTH（1024文字）を超えるraceId | 1024文字に切り詰められる |
 *
 * ### convertRaceEntityToCalendarEvent
 * | ケース | レース種別 | 期待値 |
 * |--------|-----------|--------|
 * | E1 | JRA | 全フィールドを持つ有効なイベント |
 * | E2 | conditionData ありの NAR | 説明に距離・路面情報を含む |
 * | E3 | KEIRIN | サマリーにステージを含むイベント |
 * | E4 | AUTORACE | 有効なイベント |
 * | E5 | BOATRACE | 有効なイベント |
 * | E6 | OVERSEAS | 有効なイベント |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import {
    buildCalendarEventId,
    convertRaceEntityToCalendarEvent,
    formatLocationForCalendar,
    formatStageForCalendar,
    formatSummaryForCalendar,
    GoogleCalendarColor,
    getGoogleCalendarColor,
} from '../../../../src/domain/policy/calendarEventContent';

/**
 * domain/policy/calendarEventContent テスト
 *
 * 単体テスト（calendarDescription配下）
 * - formatters.test.ts: formatRaceTime, formatUpdateTime, formatDescriptionTemplate
 * - keirin.builder.test.ts: getKeirinDescription
 * - jra.builder.test.ts: getJraDescription
 * - nar.builder.test.ts: getNarDescription
 * - overseas.builder.test.ts: getOverseasDescription
 * - autorace.builder.test.ts: getAutoRaceDescription
 * - boatrace.builder.test.ts: getBoatRaceDescription
 * - factory.test.ts: buildCalendarDescription dispatcher
 * - index.test.ts: public API exports
 *
 * このファイルのテスト対象:
 * - formatStageForCalendar: カレンダーイベント作成前のステージ処理
 * - formatSummaryForCalendar: カレンダーサマリー作成
 * - getGoogleCalendarColor: カレンダー色定義（colorId・eventLabelId）取得
 * - formatLocationForCalendar: 開催地フォーマット
 * - convertRaceEntityToCalendarEvent: 統合テスト（RaceEntity → Google Calendar Event変換）
 */

const JRA_ENTITY: RaceEntity = {
    raceId: validateRaceId('jra202501010501'),
    placeId: validatePlaceId('jra2025010105'),
    raceType: RaceType.JRA,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: '有馬記念',
    raceNumber: 1,
    raceCourse: '東京',
    locationCode: validateLocationCode('05'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2000 },
    placeHeldDays: { heldTimes: 3, heldDayTimes: 1 },
};

const NAR_ENTITY: RaceEntity = {
    raceId: validateRaceId('nar202501012001'),
    placeId: validatePlaceId('nar2025010120'),
    raceType: RaceType.NAR,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'NARレース',
    raceNumber: 1,
    raceCourse: '大井',
    locationCode: validateLocationCode('20'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: 'ダート', distance: 1600 },
};

const KEIRIN_ENTITY: RaceEntity = {
    raceId: validateRaceId('keirin202501011101'),
    placeId: validatePlaceId('keirin2025010111'),
    raceType: RaceType.KEIRIN,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'ケイリンレース',
    raceNumber: 1,
    raceCourse: '函館',
    locationCode: validateLocationCode('11'),
    raceGrade: 'GⅠ',
    raceStage: 'S級決勝',
};

const AUTORACE_ENTITY: RaceEntity = {
    raceId: validateRaceId('autorace202501010101'),
    placeId: validatePlaceId('autorace2025010101'),
    raceType: RaceType.AUTORACE,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'オートレース',
    raceNumber: 1,
    raceCourse: '飯塚',
    locationCode: validateLocationCode('01'),
    raceGrade: 'SG',
    raceStage: '優勝戦',
};

const BOATRACE_ENTITY: RaceEntity = {
    raceId: validateRaceId('boatrace202501010101'),
    placeId: validatePlaceId('boatrace2025010101'),
    raceType: RaceType.BOATRACE,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'ボートレース',
    raceNumber: 1,
    raceCourse: '桐生',
    locationCode: validateLocationCode('01'),
    raceGrade: 'SG',
    raceStage: '優勝戦',
};

const OVERSEAS_ENTITY: RaceEntity = {
    raceId: validateRaceId('overseas202501010101'),
    placeId: validatePlaceId('overseas2025010101'),
    raceType: RaceType.OVERSEAS,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: '海外レース',
    raceNumber: 1,
    raceCourse: 'ロンシャン',
    locationCode: validateLocationCode('01'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2400 },
};

describe('formatStageForCalendar', () => {
    // S1: JRA → null を返す
    it('S1: JRAでnullを返す', () => {
        expect(formatStageForCalendar(JRA_ENTITY)).toBeNull();
    });

    // S2: NAR → null を返す
    it('S2: NARでnullを返す', () => {
        expect(formatStageForCalendar(NAR_ENTITY)).toBeNull();
    });

    // S3: OVERSEAS → null を返す
    it('S3: OVERSEASでnullを返す', () => {
        expect(formatStageForCalendar(OVERSEAS_ENTITY)).toBeNull();
    });

    // S4: raceStage を持つ KEIRIN → raceStage の値を返す
    it('S4: KEIRINでraceStageを返す', () => {
        expect(formatStageForCalendar(KEIRIN_ENTITY)).toBe('S級決勝');
    });

    // S5: raceStage を持つ AUTORACE → raceStage の値を返す
    it('S5: AUTORACEでraceStageを返す', () => {
        expect(formatStageForCalendar(AUTORACE_ENTITY)).toBe('優勝戦');
    });

    // S6: raceStage を持つ BOATRACE → raceStage の値を返す
    it('S6: BOATRACEでraceStageを返す', () => {
        expect(formatStageForCalendar(BOATRACE_ENTITY)).toBe('優勝戦');
    });

    // S7: raceStage なしの KEIRIN → null を返す
    it('S7: raceStageなしKEIRINでnullを返す', () => {
        const entity = { ...KEIRIN_ENTITY, raceStage: undefined };
        expect(formatStageForCalendar(entity)).toBeNull();
    });

    // S8: JRA/NAR/OVERSEAS は raceStage が(型上不正に)設定されていても無視してnullを返す
    // switch文で JRA/NAR/OVERSEAS が同一ブロックにフォールスルーする実装のため、
    // raceStage が undefined の場合だけでなく、値が入っていても無視される（決してその
    // 値を返さない）ことを明示的に検証する。
    it('S8: JRAでraceStageが設定されていても無視してnullを返す', () => {
        const entity = { ...JRA_ENTITY, raceStage: '誤って設定されたstage' };
        expect(formatStageForCalendar(entity)).toBeNull();
    });
});

describe('formatSummaryForCalendar', () => {
    // T1: JRA（ステージなし）→ raceName のみ返す
    it('T1: JRA（stageなし）でraceNameのみ返す', () => {
        expect(formatSummaryForCalendar(JRA_ENTITY)).toBe('有馬記念');
    });

    // T2: ステージありの KEIRIN → "ステージ レース名" を返す
    it('T2: stage付きKEIRINで「stage raceName」を返す', () => {
        expect(formatSummaryForCalendar(KEIRIN_ENTITY)).toBe(
            'S級決勝 ケイリンレース',
        );
    });

    // T3: isConfirmed: false でも接頭辞を付与しない
    it('T3: isConfirmedがfalseでも接頭辞を付与しない', () => {
        const entity = { ...JRA_ENTITY, isConfirmed: false };
        expect(formatSummaryForCalendar(entity)).toBe('有馬記念');
    });
});

describe('getGoogleCalendarColor', () => {
    // C1: JRA GⅠ → BLUEBERRY を返す
    it('C1: JRA GⅠでBLUEBERRYを返す', () => {
        expect(getGoogleCalendarColor(RaceType.JRA, 'GⅠ')).toEqual(
            GoogleCalendarColor.BLUEBERRY,
        );
    });

    // C2: JRA 不明グレード → GRAPHITE を返す（フォールバック）
    it('C2: 不明なgradeでGRAPHITEを返す', () => {
        expect(getGoogleCalendarColor(RaceType.JRA, 'UnknownGrade')).toEqual(
            GoogleCalendarColor.GRAPHITE,
        );
    });

    // C3: KEIRIN GP → BLUEBERRY を返す
    it('C3: KEIRIN GPでBLUEBERRYを返す', () => {
        expect(getGoogleCalendarColor(RaceType.KEIRIN, 'GP')).toEqual(
            GoogleCalendarColor.BLUEBERRY,
        );
    });

    // C4: BOATRACE SG → BLUEBERRY を返す
    it('C4: BOATRACE SGでBLUEBERRYを返す', () => {
        expect(getGoogleCalendarColor(RaceType.BOATRACE, 'SG')).toEqual(
            GoogleCalendarColor.BLUEBERRY,
        );
    });

    // C5: AUTORACE SG → BLUEBERRY を返す
    it('C5: AUTORACE SGでBLUEBERRYを返す', () => {
        expect(getGoogleCalendarColor(RaceType.AUTORACE, 'SG')).toEqual(
            GoogleCalendarColor.BLUEBERRY,
        );
    });

    // C6: NAR GⅠ → BLUEBERRY を返す
    it('C6: NAR GⅠでBLUEBERRYを返す', () => {
        expect(getGoogleCalendarColor(RaceType.NAR, 'GⅠ')).toEqual(
            GoogleCalendarColor.BLUEBERRY,
        );
    });

    // C7: GoogleCalendarColorKeyMap の全エントリを網羅
    // grade→色の対応表は raceType ごとに多数のグレードを持つが、C1〜C6 では代表的な
    // 数グレードしか検証していなかったため、表引きの値がそれぞれ独立して正しいことを
    // 全件で固定する（1件でも値を誤って書き換えるとテストが落ちるようにする）。
    it.each<[RaceType, string, keyof typeof GoogleCalendarColor]>([
        [RaceType.JRA, 'GⅠ', 'BLUEBERRY'],
        [RaceType.JRA, 'GⅡ', 'TOMATO'],
        [RaceType.JRA, 'GⅢ', 'BASIL'],
        [RaceType.JRA, 'J.GⅠ', 'BLUEBERRY'],
        [RaceType.JRA, 'J.GⅡ', 'TOMATO'],
        [RaceType.JRA, 'J.GⅢ', 'BASIL'],
        [RaceType.JRA, 'JpnⅠ', 'LAVENDER'],
        [RaceType.JRA, 'JpnⅡ', 'FLAMINGO'],
        [RaceType.JRA, 'JpnⅢ', 'SAGE'],
        [RaceType.JRA, '重賞', 'BANANA'],
        [RaceType.JRA, 'Listed', 'BANANA'],
        [RaceType.JRA, 'オープン', 'TANGERINE'],
        [RaceType.JRA, 'オープン特別', 'TANGERINE'],
        [RaceType.NAR, 'GⅠ', 'BLUEBERRY'],
        [RaceType.NAR, 'GⅡ', 'TOMATO'],
        [RaceType.NAR, 'GⅢ', 'BASIL'],
        [RaceType.NAR, 'JpnⅠ', 'LAVENDER'],
        [RaceType.NAR, 'JpnⅡ', 'FLAMINGO'],
        [RaceType.NAR, 'JpnⅢ', 'SAGE'],
        [RaceType.NAR, '重賞', 'BANANA'],
        [RaceType.NAR, 'Listed', 'BANANA'],
        [RaceType.NAR, 'オープン', 'TANGERINE'],
        [RaceType.NAR, 'オープン特別', 'TANGERINE'],
        [RaceType.NAR, '地方重賞', 'GRAPE'],
        [RaceType.OVERSEAS, 'GⅠ', 'BLUEBERRY'],
        [RaceType.OVERSEAS, 'GⅡ', 'TOMATO'],
        [RaceType.OVERSEAS, 'GⅢ', 'BASIL'],
        [RaceType.OVERSEAS, 'Listed', 'BANANA'],
        [RaceType.OVERSEAS, '格付けなし', 'GRAPHITE'],
        [RaceType.KEIRIN, 'GP', 'BLUEBERRY'],
        [RaceType.KEIRIN, 'GⅠ', 'BLUEBERRY'],
        [RaceType.KEIRIN, 'GⅡ', 'TOMATO'],
        [RaceType.KEIRIN, 'GⅢ', 'BASIL'],
        [RaceType.KEIRIN, 'FⅠ', 'GRAPHITE'],
        [RaceType.KEIRIN, 'FⅡ', 'GRAPHITE'],
        [RaceType.BOATRACE, 'SG', 'BLUEBERRY'],
        [RaceType.BOATRACE, 'GⅠ', 'BLUEBERRY'],
        [RaceType.BOATRACE, 'GⅡ', 'TOMATO'],
        [RaceType.BOATRACE, 'GⅢ', 'BASIL'],
        [RaceType.BOATRACE, '一般', 'GRAPHITE'],
        [RaceType.AUTORACE, 'SG', 'BLUEBERRY'],
        [RaceType.AUTORACE, '特GⅠ', 'BLUEBERRY'],
        [RaceType.AUTORACE, 'GⅠ', 'BLUEBERRY'],
        [RaceType.AUTORACE, 'GⅡ', 'TOMATO'],
        [RaceType.AUTORACE, '開催', 'GRAPHITE'],
    ])('C7: %s %s は %s を返す', (raceType, grade, expectedColorKey) => {
        expect(getGoogleCalendarColor(raceType, grade)).toEqual(
            GoogleCalendarColor[expectedColorKey],
        );
    });
});

describe('formatLocationForCalendar', () => {
    // L1: JRA → "東京競馬場" を返す
    it('L1: JRAで「○○競馬場」を返す', () => {
        expect(formatLocationForCalendar(JRA_ENTITY)).toBe('東京競馬場');
    });

    // L2: NAR → "大井競馬場" を返す
    it('L2: NARで「○○競馬場」を返す', () => {
        expect(formatLocationForCalendar(NAR_ENTITY)).toBe('大井競馬場');
    });

    // L3: OVERSEAS → "ロンシャン競馬場" を返す
    it('L3: OVERSEASで「○○競馬場」を返す', () => {
        expect(formatLocationForCalendar(OVERSEAS_ENTITY)).toBe(
            'ロンシャン競馬場',
        );
    });

    // L4: KEIRIN → "函館競輪場" を返す
    it('L4: KEIRINで「○○競輪場」を返す', () => {
        expect(formatLocationForCalendar(KEIRIN_ENTITY)).toBe('函館競輪場');
    });

    // L5: AUTORACE → "飯塚オートレース場" を返す
    it('L5: AUTORACEで「○○オートレース場」を返す', () => {
        expect(formatLocationForCalendar(AUTORACE_ENTITY)).toBe(
            '飯塚オートレース場',
        );
    });

    // L6: BOATRACE → "桐生ボートレース場" を返す
    it('L6: BOATRACEで「○○ボートレース場」を返す', () => {
        expect(formatLocationForCalendar(BOATRACE_ENTITY)).toBe(
            '桐生ボートレース場',
        );
    });
});

describe('convertRaceEntityToCalendarEvent', () => {
    // E1: JRA エンティティ → 全フィールドを持つ有効なイベント
    it('E1: JRAエンティティを完全なcalendar eventに変換する', () => {
        const event = convertRaceEntityToCalendarEvent(JRA_ENTITY);

        expect(event.id).toBeTruthy();
        expect(event.summary).toBe('有馬記念');
        expect(event.location).toBe('東京競馬場');
        expect(event.start.timeZone).toBe('Asia/Tokyo');
        expect(event.end.timeZone).toBe('Asia/Tokyo');
        expect(event.colorId).toBe(GoogleCalendarColor.BLUEBERRY.colorId);
        expect(event.eventLabelId).toBe(GoogleCalendarColor.BLUEBERRY.labelId);
        expect(event.description).toContain('発走:');
        // JRA_ENTITY.datetime = 2025-01-01T09:00:00+09:00（toJstISOStringでJST変換した実値を検証）
        expect(event.start.dateTime).toBe('2025-01-01T09:00:00+09:00');
        expect(event.end.dateTime).toBe('2025-01-01T09:10:00+09:00');
    });

    // E2: conditionData ありの NAR → 説明に距離情報を含む
    it('E2: NAR descriptionにconditionDataを含む', () => {
        const event = convertRaceEntityToCalendarEvent(NAR_ENTITY);

        expect(event.description).toContain('ダート');
        expect(event.description).toContain('1600');
    });

    // E3: KEIRIN → サマリーにステージを含む
    it('E3: KEIRIN summaryにstageを含む', () => {
        const event = convertRaceEntityToCalendarEvent(KEIRIN_ENTITY);

        expect(event.summary).toBe('S級決勝 ケイリンレース');
        expect(event.location).toBe('函館競輪場');
    });

    // E4: AUTORACE → 有効なイベントを返す
    it('E4: AUTORACEエンティティを有効なcalendar eventに変換する', () => {
        const event = convertRaceEntityToCalendarEvent(AUTORACE_ENTITY);

        expect(event.summary).toBe('優勝戦 オートレース');
        expect(event.location).toBe('飯塚オートレース場');
    });

    // E5: BOATRACE → 有効なイベントを返す
    it('E5: BOATRACEエンティティを有効なcalendar eventに変換する', () => {
        const event = convertRaceEntityToCalendarEvent(BOATRACE_ENTITY);

        expect(event.summary).toBe('優勝戦 ボートレース');
        expect(event.location).toBe('桐生ボートレース場');
    });

    // E6: OVERSEAS → 有効なイベントを返す
    it('E6: OVERSEASエンティティを有効なcalendar eventに変換する', () => {
        const event = convertRaceEntityToCalendarEvent(OVERSEAS_ENTITY);

        expect(event.summary).toBe('海外レース');
        expect(event.location).toBe('ロンシャン競馬場');
    });

    // E7: 終了時刻は開始時刻の10分後
    it('E7: 終了時刻を開始の10分後に設定する', () => {
        const event = convertRaceEntityToCalendarEvent(JRA_ENTITY);

        const start = new Date(event.start.dateTime);
        const end = new Date(event.end.dateTime);
        const diffMinutes = (end.getTime() - start.getTime()) / (60 * 1000);
        expect(diffMinutes).toBe(10);
    });
});

describe('buildCalendarEventId', () => {
    // I1: 通常のraceId → そのまま返す
    it('I1: 英小文字と数字のみのraceIdはそのまま返す', () => {
        expect(buildCalendarEventId('jra202501010501')).toBe('jra202501010501');
    });

    // I2: サニタイズ対象文字を含むraceId → "-" に置換される
    it('I2: 許可されない文字（大文字・記号）は"-"に置換される', () => {
        expect(buildCalendarEventId('JRA_2025#01')).toBe('---_2025-01');
    });

    // I3: GCAL_EVENT_ID_MAX_LENGTH（1024文字）を超えるraceId → 1024文字に切り詰められる
    it('I3: 1024文字を超えるraceIdは1024文字に切り詰められる', () => {
        const longRaceId = 'a'.repeat(2000);

        const result = buildCalendarEventId(longRaceId);

        expect(result).toHaveLength(1024);
        expect(result).toBe('a'.repeat(1024));
    });
});
