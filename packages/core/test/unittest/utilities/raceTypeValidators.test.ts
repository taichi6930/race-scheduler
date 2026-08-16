/**
 * RaceTypeValidators ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | RaceType | Condition | Expected | Coverage |
 * |----|----------|----------|-----------|----------|----------|
 * | 4  | raceStageRequiredSuperRefine | AUTORACE | valid stage | pass | Line |
 * | 5  | raceStageRequiredSuperRefine | BOATRACE | invalid stage | fail | Line |
 * | 6  | raceStageRequiredSuperRefine | JRA | any | pass | Line |
 *
 * NOTE: shouldHavePlaceGradeForMechanical / shouldHaveConditionDataForHorse /
 * PLACE_GRADE_REQUIRED_ERROR / CONDITION_DATA_REQUIRED_ERROR は
 * domain/rule/raceInvariants.ts へ移設済み。テストは
 * test/domain/rule/raceInvariants.test.ts を参照。
 */

import { describe, expect, it } from 'bun:test';
import {
    RaceCourseSchema,
    RaceType,
    raceStageRequiredSuperRefine,
} from '@race-schedule/core';

describe('RaceTypeValidators', () => {
    describe('raceStageRequiredSuperRefine', () => {
        it('JRA で raceStage がない場合でもエラーが出ない', () => {
            const ctx: any = {
                addIssue: (_issue: any) => {
                    throw new Error('Unexpected issue');
                },
            };

            // エラーが出ないことを確認
            expect(() => {
                raceStageRequiredSuperRefine(
                    {
                        raceType: RaceType.JRA,
                        raceStage: undefined,
                    },
                    ctx,
                );
            }).not.toThrow();
        });

        it('KEIRIN で raceStage がない場合エラーを追加', () => {
            let issueAdded = false;
            const ctx: any = {
                addIssue: (_issue: any) => {
                    issueAdded = true;
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.KEIRIN,
                    raceStage: undefined,
                },
                ctx,
            );

            expect(issueAdded).toBe(true);
        });

        it('AUTORACE で raceStage がない場合エラーを追加', () => {
            let issueAdded = false;
            const ctx: any = {
                addIssue: (_issue: any) => {
                    issueAdded = true;
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.AUTORACE,
                    raceStage: undefined,
                },
                ctx,
            );

            expect(issueAdded).toBe(true);
        });

        it('BOATRACE で raceStage がない場合エラーを追加', () => {
            let issueAdded = false;
            const ctx: any = {
                addIssue: (_issue: any) => {
                    issueAdded = true;
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.BOATRACE,
                    raceStage: undefined,
                },
                ctx,
            );

            expect(issueAdded).toBe(true);
        });
    });

    describe('RaceCourseSchema', () => {
        it('RaceCourseSchema - JRA で有効な開催場(中山) → パス', () => {
            const schema = RaceCourseSchema(RaceType.JRA);

            const result = schema.safeParse('中山');
            expect(result.success).toBe(true);
        });

        it('RaceCourseSchema - JRA で有効な開催場(東京) → パス', () => {
            const schema = RaceCourseSchema(RaceType.JRA);

            const result = schema.safeParse('東京');
            expect(result.success).toBe(true);
        });

        it.each(['中山', '東京', '阪神', '京都', '新潟'])(
            'RaceCourseSchema - JRA で有効な開催場 複数 → パス: %s',
            (course) => {
                const schema = RaceCourseSchema(RaceType.JRA);

                const result = schema.safeParse(course);
                expect(result.success).toBe(true);
            },
        );

        it('RaceCourseSchema - JRA で無効な開催場 → エラー', () => {
            const schema = RaceCourseSchema(RaceType.JRA);

            const result = schema.safeParse('InvalidPlace');
            expect(result.success).toBe(false);
        });

        it('RaceCourseSchema - NAR で有効な開催場(帯広ば) → パス', () => {
            const schema = RaceCourseSchema(RaceType.NAR);

            const result = schema.safeParse('帯広ば');
            expect(result.success).toBe(true);
        });

        it.each(['帯広ば', '浦和', '門別'])(
            'RaceCourseSchema - NAR で有効な開催場（複数） → パス: %s',
            (course) => {
                const schema = RaceCourseSchema(RaceType.NAR);

                const result = schema.safeParse(course);
                expect(result.success).toBe(true);
            },
        );

        it('RaceCourseSchema - NAR で JRA の開催場を使う → エラー', () => {
            const schema = RaceCourseSchema(RaceType.NAR);

            const result = schema.safeParse('中山');
            expect(result.success).toBe(false);
        });
    });

    describe('raceStageRequiredSuperRefine - レベル詳細', () => {
        it('KEIRIN で raceStage が undefined でも追加のエラー検証がない時がある', () => {
            // 注：raceStage が提供されない場合のテスト
            let issueAdded = false;
            const ctx: any = {
                addIssue: (_issue: any) => {
                    issueAdded = true;
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.KEIRIN,
                    // raceStage は undefined
                },
                ctx,
            );

            // 機械式なので raceStage が undefined の場合はエラーが追加される
            expect(issueAdded).toBe(true);
        });

        it('AUTORACE で raceStage undefined → エラー', () => {
            let issueAdded = false;
            const ctx: any = {
                addIssue: (_issue: any) => {
                    issueAdded = true;
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.AUTORACE,
                    // raceStage は undefined
                },
                ctx,
            );

            expect(issueAdded).toBe(true);
        });

        it('BOATRACE で raceStage undefined → エラー', () => {
            let issueAdded = false;
            const ctx: any = {
                addIssue: (_issue: any) => {
                    issueAdded = true;
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.BOATRACE,
                    // raceStage は undefined
                },
                ctx,
            );

            expect(issueAdded).toBe(true);
        });

        it('NAR で raceStage undefined → エラーなし', () => {
            let issueAdded = false;
            const ctx: any = {
                addIssue: (_issue: any) => {
                    issueAdded = true;
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.NAR,
                    // raceStage は undefined
                },
                ctx,
            );

            expect(issueAdded).toBe(false);
        });

        it('KEIRIN で無効な raceStage → エラーを追加', () => {
            const issues: any[] = [];
            const ctx: any = {
                addIssue: (issue: any) => {
                    issues.push(issue);
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.KEIRIN,
                    raceStage: 'InvalidStage',
                },
                ctx,
            );

            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0].path).toEqual(['raceStage']);
        });

        it('エラーメッセージが明確に', () => {
            const issues: any[] = [];
            const ctx: any = {
                addIssue: (issue: any) => {
                    issues.push(issue);
                },
            };

            raceStageRequiredSuperRefine(
                {
                    raceType: RaceType.AUTORACE,
                },
                ctx,
            );

            expect(issues.length).toBe(1);
            const issue = issues[0];
            expect(issue.message).toContain('raceStage');
        });
    });
});
