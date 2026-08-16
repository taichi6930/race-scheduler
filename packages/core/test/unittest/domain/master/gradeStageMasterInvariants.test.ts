/**
 * domain/master のグレード・ステージマスタ（GradeMaster/StageAliasList/StagePriorityList）
 * 3分割構造の不変条件テスト。
 *
 * 正規化前は `RaceGradeAndStageList`（grade行ごとにstageByWebSite/descriptionを複製）
 * という1リストに、性質の異なる複数の軸（グレードの格・ステージの表記/優先度）が
 * 混在しており、grade行ごとの表記ゆれ列挙漏れ・説明文の意図しない不一致が起きても
 * 機械的に検知できなかった。3分割後もこれらの不変条件が崩れていないことを固定する。
 *
 * ## デシジョンテーブル
 *
 * | # | 検証内容 | 期待 |
 * |---|---------|------|
 * | T-01 | StagePriorityList の各行の grade が GradeMaster[raceType] に存在する | 全行で存在する |
 * | T-02 | StagePriorityList の各行の stage が StageAliasList[raceType] に存在する | 全行で存在する |
 * | T-03 | StageAliasList 内で (raceType, stage) が重複しない | 重複0件 |
 * | T-04 | StagePriorityList 内で (raceType, grade, stage) の組み合わせが重複しない | 重複0件 |
 * | T-05 | StageAliasList 内で (raceType, stageByWebSite) が複数の stage に解決されない | 重複解決0件 |
 * | T-06 | GradeMaster の全RaceTypeが1つ以上のグレードを持つ | 全RaceTypeで1件以上 |
 * | T-07 | StagePriorityList の specifiedOverride=true な行の grade は GradeMaster上 isSpecified=false である | 全行でfalse（trueなら通常のisSpecifiedで表現できるはずでspecifiedOverrideは不要） |
 *
 * ## Coverage Target: 100% Line & Branch Coverage
 */

import { describe, expect, it } from 'bun:test';
import { GradeMaster } from '../../../../src/domain/master/gradeMaster';
import {
    StageAliasList,
    StagePriorityList,
} from '../../../../src/domain/master/gradeStageMaster';
import { RaceType } from '../../../../src/domain/model/valueObject/raceType';

describe('gradeStageMaster 不変条件', () => {
    it('T-01_StagePriorityListの各行のgradeがGradeMaster[raceType]に存在する', () => {
        const missing = StagePriorityList.flatMap((entry) =>
            entry.grade
                .filter((grade) => !(grade in GradeMaster[entry.raceType]))
                .map((grade) => `${entry.raceType}::${grade}::${entry.stage}`),
        );

        expect(missing).toEqual([]);
    });

    it('T-02_StagePriorityListの各行のstageがStageAliasList[raceType]に存在する', () => {
        const aliasStagesByRaceType = new Map<RaceType, Set<string>>();
        for (const alias of StageAliasList) {
            const set = aliasStagesByRaceType.get(alias.raceType) ?? new Set();
            set.add(alias.stage);
            aliasStagesByRaceType.set(alias.raceType, set);
        }

        const missing = StagePriorityList.filter(
            (entry) =>
                !(aliasStagesByRaceType.get(entry.raceType) ?? new Set()).has(
                    entry.stage,
                ),
        ).map(
            (entry) =>
                `${entry.raceType}::${entry.grade.join('/')}::${entry.stage}`,
        );

        expect(missing).toEqual([]);
    });

    it('T-03_StageAliasList内で(raceType,stage)が重複しない', () => {
        const seen = new Set<string>();
        const duplicates: string[] = [];
        for (const alias of StageAliasList) {
            const key = `${alias.raceType}::${alias.stage}`;
            if (seen.has(key)) {
                duplicates.push(key);
            }
            seen.add(key);
        }

        expect(duplicates).toEqual([]);
    });

    it('T-04_StagePriorityList内で(raceType,grade,stage)の組み合わせが重複しない', () => {
        const seen = new Set<string>();
        const duplicates: string[] = [];
        for (const entry of StagePriorityList) {
            for (const grade of entry.grade) {
                const key = `${entry.raceType}::${grade}::${entry.stage}`;
                if (seen.has(key)) {
                    duplicates.push(key);
                }
                seen.add(key);
            }
        }

        expect(duplicates).toEqual([]);
    });

    it('T-05_StageAliasList内で(raceType,stageByWebSite)が複数のstageに解決されない', () => {
        const resolutions = new Map<string, Set<string>>();
        for (const alias of StageAliasList) {
            for (const web of alias.stageByWebSite) {
                const key = `${alias.raceType}::${web}`;
                const set = resolutions.get(key) ?? new Set();
                set.add(alias.stage);
                resolutions.set(key, set);
            }
        }

        const ambiguous = [...resolutions].filter(
            ([, stages]) => stages.size > 1,
        );

        expect(ambiguous).toEqual([]);
    });

    it('T-06_GradeMasterの全RaceTypeが1つ以上のグレードを持つ', () => {
        const emptyRaceTypes = Object.values(RaceType).filter(
            (raceType) => Object.keys(GradeMaster[raceType]).length === 0,
        );

        expect(emptyRaceTypes).toEqual([]);
    });

    it('T-07_specifiedOverride=trueな行のgradeはGradeMaster上isSpecified=falseである', () => {
        const invalid = StagePriorityList.filter(
            (entry) => entry.specifiedOverride === true,
        ).flatMap((entry) =>
            entry.grade
                .filter(
                    (grade) =>
                        GradeMaster[entry.raceType][grade]?.isSpecified ===
                        true,
                )
                .map((grade) => `${entry.raceType}::${grade}::${entry.stage}`),
        );

        expect(invalid).toEqual([]);
    });
});
