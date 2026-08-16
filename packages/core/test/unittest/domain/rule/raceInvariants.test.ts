/**
 * domain/rule/raceInvariants テスト
 *
 * ## デシジョンテーブル
 *
 * ### shouldHavePlaceGradeForMechanical
 * | #    | raceType | placeGrade | 期待結果 |
 * |------|----------|------------|----------|
 * | T-01 | KEIRIN   | あり       | true     |
 * | T-02 | KEIRIN   | なし       | false    |
 * | T-03 | AUTORACE | あり       | true     |
 * | T-04 | AUTORACE | なし       | false    |
 * | T-05 | BOATRACE | あり       | true     |
 * | T-06 | BOATRACE | なし       | false    |
 * | T-07 | JRA      | なし       | true     |
 * | T-08 | NAR      | なし       | true     |
 *
 * ### shouldHaveConditionDataForHorse
 * | #    | raceType | conditionData | 期待結果 |
 * |------|----------|----------------|----------|
 * | T-09 | JRA      | あり           | true     |
 * | T-10 | JRA      | なし           | false    |
 * | T-11 | NAR      | なし           | false    |
 * | T-12 | NAR      | あり           | true     |
 * | T-13 | OVERSEAS | なし           | false    |
 * | T-14 | KEIRIN   | なし           | true     |
 * | T-15 | AUTORACE | なし           | true     |
 * | T-16 | BOATRACE | なし           | true     |
 *
 * ### conditionDataRequiredSuperRefine
 * | #    | raceType | conditionData | 期待結果         |
 * |------|----------|----------------|------------------|
 * | T-17 | JRA      | あり           | addIssue されない |
 * | T-18 | JRA      | なし           | addIssue される   |
 * | T-19 | KEIRIN   | なし           | addIssue されない |
 *
 * ### shouldHavePlaceHeldDaysForJra
 * | #    | raceType | placeHeldDays | 期待結果 |
 * |------|----------|---------------|----------|
 * | T-20 | JRA      | あり          | true     |
 * | T-21 | JRA      | なし          | false    |
 * | T-22 | NAR      | なし          | true     |
 *
 * ### エラー定数
 * | #    | 定数                         | 期待内容                        |
 * |------|------------------------------|----------------------------------|
 * | T-23 | PLACE_GRADE_REQUIRED_ERROR   | message/path が想定通り          |
 * | T-24 | CONDITION_DATA_REQUIRED_ERROR| message/path が想定通り          |
 * | T-25 | PLACE_HELD_DAYS_REQUIRED_ERROR| message/path が想定通り         |
 *
 * ### isPlaceWithoutRaceList
 * | #    | raceType | isRaceListAvailable | 期待結果 |
 * |------|----------|---------------------|----------|
 * | T-26 | NAR      | false               | true     |
 * | T-27 | NAR      | true                | false    |
 * | T-28 | NAR      | undefined           | false    |
 * | T-29 | JRA      | false               | false    |
 * | T-30 | KEIRIN   | false               | true     |
 * | T-31 | AUTORACE | false               | true     |
 *
 * ### raceCourseSuperRefine
 * | #    | raceType | raceCourse | 期待結果                                     |
 * |------|----------|------------|-----------------------------------------------|
 * | T-32 | JRA      | 東京(有効) | addIssue されない                            |
 * | T-33 | JRA      | 不正値     | addIssueされる（path:['raceCourse']・実メッセージ） |
 *
 * ### gradeTypeSuperRefine
 * | #    | raceType | value     | path        | optional | 期待結果                              |
 * |------|----------|-----------|-------------|----------|----------------------------------------|
 * | T-34 | JRA      | GⅠ(有効)  | 'raceGrade' | -        | addIssue されない                      |
 * | T-35 | JRA      | 不正値    | 'raceGrade' | -        | addIssueされる（実メッセージ・path指定通り） |
 * | T-36 | JRA      | undefined | 'placeGrade'| true     | addIssue されない（スキップ分岐）      |
 * | T-37 | JRA      | undefined | 'placeGrade'| false/省略| addIssueされる（スキップしない）       |
 *
 * ### raceStageRequiredSuperRefine
 * | #    | raceType | raceStage    | 期待結果                                             |
 * |------|----------|--------------|--------------------------------------------------------|
 * | T-38 | KEIRIN   | undefined    | addIssueされる（機械式で必須・RACE_STAGE_REQUIRED_ERROR） |
 * | T-39 | JRA      | undefined    | addIssue されない（非機械式は不要）                    |
 * | T-40 | KEIRIN   | 不正値       | addIssueされる（path:['raceStage']・実メッセージ）      |
 * | T-41 | KEIRIN   | S級決勝(有効)| addIssue されない                                     |
 * | T-46 | KEIRIN   | 不正値・raceStageConfirmed:false | addIssue されない（仮登録は許可リスト照合をスキップ） |
 * | T-47 | KEIRIN   | 空文字・raceStageConfirmed:false | addIssueされる（仮登録でも非空文字列は必須）          |
 * | T-48 | KEIRIN   | 不正値・raceStageConfirmed:true  | addIssueされる（確定扱いなので従来どおり許可リスト照合） |
 *
 * ### zodErrorMessage
 * | #    | error                       | fallback  | 期待結果                          |
 * |------|------------------------------|-----------|-------------------------------------|
 * | T-42 | ZodError(issuesあり)         | 'fallback'| issues[0].message                  |
 * | T-43 | ZodError(issues空)           | 'fallback'| fallback（issues[0]が無い）        |
 * | T-44 | 非ZodError（Error）          | 'fallback'| fallback                            |
 * | T-45 | 非ZodError（文字列など）     | 'fallback'| fallback                            |
 */
import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { RaceType } from '../../../../src/domain/model/valueObject/raceType';
import {
    CONDITION_DATA_REQUIRED_ERROR,
    conditionDataRequiredSuperRefine,
    gradeTypeSuperRefine,
    isPlaceWithoutRaceList,
    PLACE_GRADE_REQUIRED_ERROR,
    PLACE_HELD_DAYS_REQUIRED_ERROR,
    RACE_STAGE_REQUIRED_ERROR,
    raceCourseSuperRefine,
    raceStageRequiredSuperRefine,
    shouldHaveConditionDataForHorse,
    shouldHavePlaceGradeForMechanical,
    shouldHavePlaceHeldDaysForJra,
    zodErrorMessage,
} from '../../../../src/domain/rule/raceInvariants';

interface MockRefinementCtx {
    addIssue: (issue: unknown) => void;
}

interface RecordedIssue {
    path?: (string | number)[];
    message?: string;
}

/**
 * addIssue の呼び出し回数・引数を記録するテスト用 RefinementCtx を作る。
 * @returns ctx（never にキャストして superRefine へ渡す）と、記録された issue 一覧
 */
const createRecordingCtx = (): {
    ctx: MockRefinementCtx;
    issues: RecordedIssue[];
} => {
    const issues: RecordedIssue[] = [];
    const ctx: MockRefinementCtx = {
        addIssue: (issue: unknown) => {
            issues.push(issue as RecordedIssue);
        },
    };
    return { ctx, issues };
};

describe('shouldHavePlaceGradeForMechanical', () => {
    it.each([
        ['[T-01] KEIRIN・placeGradeあり → true', RaceType.KEIRIN, '1', true],
        [
            '[T-02] KEIRIN・placeGradeなし → false',
            RaceType.KEIRIN,
            undefined,
            false,
        ],
        [
            '[T-03] AUTORACE・placeGradeあり → true',
            RaceType.AUTORACE,
            '1',
            true,
        ],
        [
            '[T-04] AUTORACE・placeGradeなし → false',
            RaceType.AUTORACE,
            undefined,
            false,
        ],
        [
            '[T-05] BOATRACE・placeGradeあり → true',
            RaceType.BOATRACE,
            '1',
            true,
        ],
        [
            '[T-06] BOATRACE・placeGradeなし → false',
            RaceType.BOATRACE,
            undefined,
            false,
        ],
        [
            '[T-07] JRA（競馬）・placeGradeなし → true（不要）',
            RaceType.JRA,
            undefined,
            true,
        ],
        [
            '[T-08] NAR（競馬）・placeGradeなし → true（不要）',
            RaceType.NAR,
            undefined,
            true,
        ],
    ])('%s', (_title, raceType, placeGrade, expected) => {
        const result = shouldHavePlaceGradeForMechanical({
            raceType,
            placeGrade,
        });
        expect(result).toBe(expected);
    });
});

describe('shouldHaveConditionDataForHorse', () => {
    it.each([
        [
            '[T-09] JRA・conditionDataあり → true',
            RaceType.JRA,
            { age: 3 },
            true,
        ],
        [
            '[T-10] JRA・conditionDataなし → false',
            RaceType.JRA,
            undefined,
            false,
        ],
        [
            '[T-11] NAR・conditionDataなし → false',
            RaceType.NAR,
            undefined,
            false,
        ],
        [
            '[T-12] NAR・conditionDataあり → true',
            RaceType.NAR,
            { grade: 2 },
            true,
        ],
        [
            '[T-13] OVERSEAS・conditionDataなし → false',
            RaceType.OVERSEAS,
            undefined,
            false,
        ],
        [
            '[T-14] KEIRIN（機械式）・conditionDataなし → true（不要）',
            RaceType.KEIRIN,
            undefined,
            true,
        ],
        [
            '[T-15] AUTORACE（機械式）・conditionDataなし → true（不要）',
            RaceType.AUTORACE,
            undefined,
            true,
        ],
        [
            '[T-16] BOATRACE（機械式）・conditionDataなし → true（不要）',
            RaceType.BOATRACE,
            undefined,
            true,
        ],
    ])('%s', (_title, raceType, conditionData, expected) => {
        const result = shouldHaveConditionDataForHorse({
            raceType,
            conditionData,
        });
        expect(result).toBe(expected);
    });
});

describe('conditionDataRequiredSuperRefine', () => {
    it('[T-17] JRAでconditionDataがある場合はaddIssueされない', () => {
        const ctx: MockRefinementCtx = {
            addIssue: () => {
                throw new Error('Unexpected issue');
            },
        };

        expect(() => {
            conditionDataRequiredSuperRefine(
                { raceType: RaceType.JRA, conditionData: { age: 3 } },
                ctx as never,
            );
        }).not.toThrow();
    });

    it('[T-18] JRAでconditionDataがない場合はaddIssueされる', () => {
        let issueAdded = false;
        const ctx: MockRefinementCtx = {
            addIssue: () => {
                issueAdded = true;
            },
        };

        conditionDataRequiredSuperRefine(
            { raceType: RaceType.JRA, conditionData: undefined },
            ctx as never,
        );

        expect(issueAdded).toBe(true);
    });

    it('[T-19] KEIRINでconditionDataがない場合はaddIssueされない', () => {
        let issueAdded = false;
        const ctx: MockRefinementCtx = {
            addIssue: () => {
                issueAdded = true;
            },
        };

        conditionDataRequiredSuperRefine(
            { raceType: RaceType.KEIRIN, conditionData: undefined },
            ctx as never,
        );

        expect(issueAdded).toBe(false);
    });
});

describe('shouldHavePlaceHeldDaysForJra', () => {
    it.each([
        [
            '[T-20] JRA・placeHeldDaysあり → true',
            RaceType.JRA,
            { heldTimes: 1, heldDayTimes: 1 },
            true,
        ],
        [
            '[T-21] JRA・placeHeldDaysなし → false',
            RaceType.JRA,
            undefined,
            false,
        ],
        [
            '[T-22] NAR・placeHeldDaysなし → true（JRA以外は不要）',
            RaceType.NAR,
            undefined,
            true,
        ],
    ])('%s', (_title, raceType, placeHeldDays, expected) => {
        const result = shouldHavePlaceHeldDaysForJra({
            raceType,
            placeHeldDays,
        });
        expect(result).toBe(expected);
    });
});

describe('エラー定数', () => {
    it('[T-23] PLACE_GRADE_REQUIRED_ERROR の構造が正しい', () => {
        expect(PLACE_GRADE_REQUIRED_ERROR.message).toBe(
            'placeGrade is required for KEIRIN/AUTORACE/BOATRACE',
        );
        expect(PLACE_GRADE_REQUIRED_ERROR.path).toEqual(['placeGrade']);
    });

    it('[T-24] CONDITION_DATA_REQUIRED_ERROR の構造が正しい', () => {
        expect(CONDITION_DATA_REQUIRED_ERROR.message).toBe(
            'conditionData is required for JRA/NAR/OVERSEAS',
        );
        expect(CONDITION_DATA_REQUIRED_ERROR.path).toEqual(['conditionData']);
    });

    it('[T-25] PLACE_HELD_DAYS_REQUIRED_ERROR の構造が正しい', () => {
        expect(PLACE_HELD_DAYS_REQUIRED_ERROR.message).toBe(
            'placeHeldDays is required for JRA',
        );
        expect(PLACE_HELD_DAYS_REQUIRED_ERROR.path).toEqual(['placeHeldDays']);
    });
});

describe('isPlaceWithoutRaceList', () => {
    it.each([
        [
            '[T-26] NAR・isRaceListAvailable=false → true',
            RaceType.NAR,
            false,
            true,
        ],
        [
            '[T-27] NAR・isRaceListAvailable=true → false',
            RaceType.NAR,
            true,
            false,
        ],
        [
            '[T-28] NAR・isRaceListAvailable=undefined → false',
            RaceType.NAR,
            undefined,
            false,
        ],
        [
            '[T-29] JRA・isRaceListAvailable=false → false（対象外）',
            RaceType.JRA,
            false,
            false,
        ],
        [
            '[T-30] KEIRIN・isRaceListAvailable=false → true',
            RaceType.KEIRIN,
            false,
            true,
        ],
        [
            '[T-31] AUTORACE・isRaceListAvailable=false → true',
            RaceType.AUTORACE,
            false,
            true,
        ],
    ])('%s', (_title, raceType, isRaceListAvailable, expected) => {
        const result = isPlaceWithoutRaceList({
            raceType,
            isRaceListAvailable,
        });
        expect(result).toBe(expected);
    });
});

describe('raceCourseSuperRefine', () => {
    it('[T-32] JRAで有効なraceCourse(東京)の場合はaddIssueされない', () => {
        const { ctx, issues } = createRecordingCtx();

        raceCourseSuperRefine(
            { raceType: RaceType.JRA, raceCourse: '東京' },
            ctx as never,
        );

        expect(issues).toHaveLength(0);
    });

    it('[T-33] JRAで不正なraceCourseの場合はpath:[raceCourse]でaddIssueされる', () => {
        const { ctx, issues } = createRecordingCtx();

        raceCourseSuperRefine(
            { raceType: RaceType.JRA, raceCourse: '存在しない競馬場' },
            ctx as never,
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toEqual(['raceCourse']);
        expect(issues[0]?.message).toBe(
            `${RaceType.JRA}の開催場ではありません`,
        );
    });
});

describe('gradeTypeSuperRefine', () => {
    it('[T-34] JRAで有効なgrade(GⅠ)の場合はaddIssueされない', () => {
        const { ctx, issues } = createRecordingCtx();

        gradeTypeSuperRefine(ctx as never, RaceType.JRA, 'GⅠ', 'raceGrade');

        expect(issues).toHaveLength(0);
    });

    it('[T-35] JRAで不正なgradeの場合はpath指定通りにaddIssueされる', () => {
        const { ctx, issues } = createRecordingCtx();

        gradeTypeSuperRefine(
            ctx as never,
            RaceType.JRA,
            '存在しないグレード',
            'raceGrade',
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toEqual(['raceGrade']);
        expect(issues[0]?.message).toBe(
            `${RaceType.JRA}のグレードではありません`,
        );
    });

    it('[T-36] valueがundefinedかつoptional:trueの場合はaddIssueされない（スキップ分岐）', () => {
        const { ctx, issues } = createRecordingCtx();

        gradeTypeSuperRefine(
            ctx as never,
            RaceType.JRA,
            undefined,
            'placeGrade',
            { optional: true },
        );

        expect(issues).toHaveLength(0);
    });

    it('[T-37] valueがundefinedかつoptional指定なしの場合はaddIssueされる（スキップしない）', () => {
        const { ctx, issues } = createRecordingCtx();

        gradeTypeSuperRefine(
            ctx as never,
            RaceType.JRA,
            undefined,
            'placeGrade',
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toEqual(['placeGrade']);
    });
});

describe('raceStageRequiredSuperRefine', () => {
    it('[T-38] KEIRIN(機械式)でraceStageが未設定の場合はRACE_STAGE_REQUIRED_ERRORでaddIssueされる', () => {
        const { ctx, issues } = createRecordingCtx();

        raceStageRequiredSuperRefine(
            { raceType: RaceType.KEIRIN, raceStage: undefined },
            ctx as never,
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toEqual(['raceStage']);
        expect(issues[0]?.message).toBe(RACE_STAGE_REQUIRED_ERROR.message);
    });

    it('[T-39] JRA(非機械式)でraceStageが未設定でもaddIssueされない', () => {
        const { ctx, issues } = createRecordingCtx();

        raceStageRequiredSuperRefine(
            { raceType: RaceType.JRA, raceStage: undefined },
            ctx as never,
        );

        expect(issues).toHaveLength(0);
    });

    it('[T-40] KEIRINで不正なraceStageの場合はpath:[raceStage]でaddIssueされる', () => {
        const { ctx, issues } = createRecordingCtx();

        raceStageRequiredSuperRefine(
            { raceType: RaceType.KEIRIN, raceStage: '存在しないステージ' },
            ctx as never,
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toEqual(['raceStage']);
        expect(issues[0]?.message).toBe(
            `${RaceType.KEIRIN}の開催ステージではありません`,
        );
    });

    it('[T-41] KEIRINで有効なraceStage(S級決勝)の場合はaddIssueされない', () => {
        const { ctx, issues } = createRecordingCtx();

        raceStageRequiredSuperRefine(
            { raceType: RaceType.KEIRIN, raceStage: 'S級決勝' },
            ctx as never,
        );

        expect(issues).toHaveLength(0);
    });

    it('[T-46] KEIRINで不正なraceStageでもraceStageConfirmed:falseの場合はaddIssueされない（仮登録）', () => {
        const { ctx, issues } = createRecordingCtx();

        raceStageRequiredSuperRefine(
            {
                raceType: RaceType.KEIRIN,
                raceStage: '存在しないステージ',
                raceStageConfirmed: false,
            },
            ctx as never,
        );

        expect(issues).toHaveLength(0);
    });

    it('[T-47] raceStageConfirmed:falseでもraceStageが空文字の場合はRACE_STAGE_REQUIRED_ERRORでaddIssueされる', () => {
        const { ctx, issues } = createRecordingCtx();

        raceStageRequiredSuperRefine(
            {
                raceType: RaceType.KEIRIN,
                raceStage: '   ',
                raceStageConfirmed: false,
            },
            ctx as never,
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toEqual(['raceStage']);
        expect(issues[0]?.message).toBe(RACE_STAGE_REQUIRED_ERROR.message);
    });

    it('[T-48] KEIRINで不正なraceStageかつraceStageConfirmed:trueの場合は従来どおりaddIssueされる', () => {
        const { ctx, issues } = createRecordingCtx();

        raceStageRequiredSuperRefine(
            {
                raceType: RaceType.KEIRIN,
                raceStage: '存在しないステージ',
                raceStageConfirmed: true,
            },
            ctx as never,
        );

        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toEqual(['raceStage']);
        expect(issues[0]?.message).toBe(
            `${RaceType.KEIRIN}の開催ステージではありません`,
        );
    });
});

describe('zodErrorMessage', () => {
    it('[T-42] ZodErrorかつissuesがある場合はissues[0].messageを返す', () => {
        const error = new z.ZodError([
            { code: 'custom', path: ['x'], message: '具体的なエラー内容' },
        ]);

        const result = zodErrorMessage(error, 'fallback');

        expect(result).toBe('具体的なエラー内容');
    });

    it('[T-43] ZodErrorだがissuesが空の場合はfallbackを返す', () => {
        const error = new z.ZodError([]);

        const result = zodErrorMessage(error, 'fallback');

        expect(result).toBe('fallback');
    });

    it('[T-44] 非ZodError(Error)の場合はfallbackを返す', () => {
        const error = new Error('普通のエラー');

        const result = zodErrorMessage(error, 'fallback');

        expect(result).toBe('fallback');
    });

    it('[T-45] 非ZodError(文字列など任意の値)の場合はfallbackを返す', () => {
        const result = zodErrorMessage('文字列エラー', 'fallback');

        expect(result).toBe('fallback');
    });
});
