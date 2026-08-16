/**
 * domain/policy/calendarInclusion テスト
 *
 * @spec SPEC-CAL-001
 * @spec SPEC-PLAYER-001
 *
 * ## Decision Table
 *
 * ### Function: shouldIncludeInCalendar(raceEntity)
 *
 * | Case | RaceType | RaceGrade | RaceStage | Priority | Expected | Description |
 * |------|----------|-----------|-----------|----------|----------|-------------|
 * | U1 | JRA | Specified | - | - | true | JRA: isSpecified=true のグレード → 含める |
 * | U2 | JRA | NotSpecified | - | - | false | JRA: isSpecified=false のグレード → 除外 |
 * | U3 | NAR | Specified | - | - | true | NAR: isSpecified=true のグレード → 含める |
 * | U4 | NAR | NotSpecified | - | - | false | NAR: isSpecified=false のグレード → 除外 |
 * | U5 | OVERSEAS | Specified | - | - | true | OVERSEAS: isSpecified=true のグレード → 含める |
 * | U6 | OVERSEAS | NotSpecified | - | - | false | OVERSEAS: isSpecified=false のグレード → 除外 |
 * | U7 | KEIRIN | Specified(GⅠ) | S級決勝(priority9) | >=6 | true | KEIRIN: isSpecified=true かつ priority>=6 → 含める |
 * | U8 | KEIRIN | Specified(GⅠ) | S級一次予選(priority2) | <6 | false | KEIRIN: priority<6 → 除外 |
 * | U9 | KEIRIN | NotSpecified | ValidStage | >=6 | false | KEIRIN: isSpecified=false → 除外 |
 * | U10 | AUTORACE | Specified(GⅠ) | 優勝戦(priority7) | >=6 | true | AUTORACE: isSpecified=true かつ priority>=6 → 含める |
 * | U11 | AUTORACE | Specified(GⅠ) | 一般戦(priority0) | <6 | false | AUTORACE: priority<6 → 除外 |
 * | U12 | BOATRACE | Specified(SG) | 優勝戦(priority9) | >=6 | true | BOATRACE: isSpecified=true かつ priority>=6 → 含める |
 * | U13 | BOATRACE | Specified(SG) | 準優勝戦(priority0) | <6 | false | BOATRACE: priority<6 → 除外 |
 * | U14 | JRA | AnyGrade | - | - | - | grade/stage が string でない場合は priority=0で評価 |
 * | U16 | KEIRIN | FⅡ(NotSpecified) | null(非string) | - | false | FⅡはisSpecified=false・stageも非stringで全プロ例外にも該当せず isSpecifiedRace=false（&&短絡でgetPriority未到達） |
 * | U21 | KEIRIN | Specified(GⅢ) | S級準決勝(priority6ちょうど) | ==6 | true | MECHANICAL_PRIORITY_THRESHOLD 境界: priority=6ちょうどはtrue（ユーザー依頼で5→6へ引き上げ） |
 * | U22 | KEIRIN | FⅠ(NotSpecified) | L級ガールズフレッシュクイーン(priority3ちょうど) | ==3 | false | isSpecifiedRace=false（FⅠは平場）かつpriority<6 → false |
 * | U23 | KEIRIN | Specified(GP) | S級グランプリ(priority10) | >=6 | true | 最高優先度グレード(GP)でも同様にtrueとなることを確認 |
 * | U24 | KEIRIN | FⅠ(NotSpecified) | S級決勝(priority4) | >=6 | false | FⅠ決勝はpriorityが閾値以上でも平場のため対象外（F1は重賞ではない） |
 * | U25 | KEIRIN | FⅡ | S級スーパープロピストレーサー賞(priority7) | >=6 | true | 全プロ競輪の例外ステージ(SPR)はFⅡでも重賞相当として含める |
 * | U26 | KEIRIN | FⅡ | S級特選(priority0) | <6 | false | 全プロ競輪の例外ステージでもpriority<6のステージは除外 |
 * | U27 | KEIRIN | FⅡ | S級決勝(全プロ対象外ステージ) | - | false | grade=FⅡでも全プロ例外ステージ名に一致しなければ通常通り平場扱い |
 * | U28 | KEIRIN | Specified(GⅠ) | S級二次予選(priority4) | <6 | false | 旧閾値(4)では含まれていたが、新閾値(6)引き上げ後は除外されることを固定する回帰テスト |
 * | U29 | KEIRIN | FⅡ | S級優秀(全プロ例外・priority4) | <6 | false | 全プロ例外ステージでも新閾値未満(4<6)は除外（旧閾値では含まれていた） |
 *
 * ### Function: isSpecifiedRace(raceEntity)
 * | Case | RaceType | RaceGrade | RaceStage | Expected | Description |
 * |------|----------|-----------|-----------|----------|-------------|
 * | S1 | KEIRIN | GⅠ | - | true | 通常のisSpecifiedグレード |
 * | S2 | KEIRIN | FⅡ | S級ダイナミックステージ | true | 全プロ競輪の例外ステージ |
 * | S3 | KEIRIN | FⅡ | S級決勝 | false | 全プロ例外ステージ名に一致しない |
 * | S4 | KEIRIN | FⅠ | S級スーパープロピストレーサー賞 | false | 全プロ例外はgrade=FⅡ限定（FⅠは対象外） |
 * | S5 | JRA | FⅡ | S級スーパープロピストレーサー賞 | false | 全プロ例外はKEIRIN限定（raceType不一致） |
 *
 * ### Function: shouldIncludeInCalendar(raceEntity, flaggedRaceIds) - 指定レースフラグ
 * | Case | RaceGrade | flaggedRaceIds に raceId を含む | Expected | Description |
 * |------|-----------|----------------------------------|----------|-------------|
 * | U17 | NotSpecified | true | true | グレード対象外でもフラグがあれば含める |
 * | U18 | NotSpecified | false | false | グレード対象外かつフラグ無しは除外（従来通り） |
 * | U19 | Specified | true | true | グレード対象かつフラグありも当然含める |
 * | U20 | NotSpecified | (第2引数省略) | false | flaggedRaceIds省略時は空集合扱い（後方互換） |
 *
 * ### Function: shouldIncludeInCalendar(raceEntity, flaggedRaceIds, watchedRaceIds) - 注目選手（SPEC-PLAYER-001）
 * | Case | RaceGrade | watchedRaceIds に raceId を含む | Expected | Description |
 * |------|-----------|-----------------------------------|----------|-------------|
 * | W1 | NotSpecified | true | true | グレード対象外でも注目選手が出走していれば含める |
 * | W2 | NotSpecified | false | false | グレード対象外かつ注目選手も無しは除外（従来通り） |
 * | W3 | Specified | true | true | グレード対象かつ注目選手ありも当然含める |
 * | W4 | NotSpecified | (第3引数省略) | false | watchedRaceIds省略時は空集合扱い（後方互換） |
 * | W5 | NotSpecified(flag無し) | watchedRaceIdsのみtrue | true | flaggedRaceIdsが空でもwatchedRaceIdsだけで含める |
 *
 * ### Function: getPriority(raceEntity)
 *
 * mechanicalGradeRule の `getSpecifiedGrades(...).has(raceEntity.raceGrade)`
 * ガードにより、raceGrade が非 string の呼び出しは shouldIncludeInCalendar
 * 経由では実質到達しない（Set<string> は文字列以外を含まないため）。
 * 防御的な型ガードの分岐を直接検証するため getPriority を直接呼び出す。
 *
 * | Case | raceGrade（非string） | raceStage | 期待結果 |
 * |------|------------------------|-----------|----------|
 * | P1   | undefined              | 'A'       | 0        |
 * | P2   | number(123)            | 'A'       | 0        |
 * | P3   | 'GⅠ'（string）        | null      | 0        |
 *
 * ### getPriority のメモ化 (PERF-094)
 * | Case | 呼び出し                              | 期待                          |
 * |------|----------------------------------------|-------------------------------|
 * | P4   | 同一(raceType,raceGrade,raceStage)を2回 | 2回目もキャッシュ経由で同じ値 |
 *
 * ## Coverage Target: 100% Line & Branch Coverage
 */

import { describe, expect, it } from 'bun:test';
import { validateLocationCode } from '../../../../src/domain/model/valueObject/locationCode';
import { validatePlaceId } from '../../../../src/domain/model/valueObject/placeId';
import { validateRaceId } from '../../../../src/domain/model/valueObject/raceId';
import { RaceType } from '../../../../src/domain/model/valueObject/raceType';
import {
    getPriority,
    isSpecifiedRace,
    shouldIncludeInCalendar,
} from '../../../../src/domain/policy/calendarInclusion';
import type { RaceEntity } from '../../../../src/entity/raceEntity';

describe('calendarInclusion', () => {
    describe('shouldIncludeInCalendar', () => {
        // JRA テスト
        it('U1: JRA - Specified グレードの場合は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('jra202501010101'),
                placeId: validatePlaceId('jra2025010105'),
                raceType: RaceType.JRA,
                raceName: 'テストレース',
                raceGrade: 'GⅠ',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('05'),
                raceCourse: '三崎',
                conditionData: {
                    surfaceType: '芝',
                    distance: 2000,
                },
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(true);
        });

        it('U2: JRA - NotSpecified グレードの場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('jra202501010101'),
                placeId: validatePlaceId('jra2025010105'),
                raceType: RaceType.JRA,
                raceName: 'テストレース',
                raceGrade: '1000万下',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('05'),
                raceCourse: '三崎',
                conditionData: {
                    surfaceType: '芝',
                    distance: 2000,
                },
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // NAR テスト
        it('U3: NAR - Specified グレードの場合は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('nar202501010101'),
                placeId: validatePlaceId('nar2025010105'),
                raceType: RaceType.NAR,
                raceName: 'ナーテストレース',
                raceGrade: 'GⅡ',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('30'),
                raceCourse: '大澤',
                conditionData: {
                    surfaceType: '芝',
                    distance: 2000,
                },
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(true);
        });

        it('U4: NAR - NotSpecified グレードの場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('nar202501010101'),
                placeId: validatePlaceId('nar2025010105'),
                raceType: RaceType.NAR,
                raceName: 'ナーテストレース',
                raceGrade: '500万下',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('30'),
                raceCourse: '大澤',
                conditionData: {
                    surfaceType: '芝',
                    distance: 2000,
                },
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // OVERSEAS テスト
        it('U5: OVERSEAS - Specified グレードの場合は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('overseas202501010101'),
                placeId: validatePlaceId('overseas2025010105'),
                raceType: RaceType.OVERSEAS,
                raceName: 'オーバーシーズテスト',
                raceGrade: 'GⅠ',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('01'),
                raceCourse: 'USA',
            };

            const result = shouldIncludeInCalendar(race);
            // OVERSEAS の specified status に基づく結果
            expect(result).toBe(true);
        });

        it('U6: OVERSEAS - NotSpecified グレードの場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('overseas202501010101'),
                placeId: validatePlaceId('overseas2025010105'),
                raceType: RaceType.OVERSEAS,
                raceName: 'オーバーシーズテスト',
                raceGrade: 'Class2',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('01'),
                raceCourse: 'USA',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // KEIRIN テスト
        it('U7: KEIRIN - Specified かつ priority>=4 の場合は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テスト競輪',
                raceGrade: 'GⅠ',
                raceStage: 'S級決勝', // マスタ実在ステージ・priority=9(>=4)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(true);
        });

        it('U8: KEIRIN - priority<4 の場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テスト競輪',
                raceGrade: 'GⅠ',
                raceStage: 'S級一次予選', // マスタ実在ステージ・priority=2(<4)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            // priority < 4 のため false になるはず
            expect(result).toBe(false);
        });

        it('U9: KEIRIN - NotSpecified グレードの場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テスト競輪',
                raceGrade: 'F',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // AUTORACE テスト
        it('U10: AUTORACE - Specified かつ priority>=4 の場合は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('autorace202501010101'),
                placeId: validatePlaceId('autorace2025010184'),
                raceType: RaceType.AUTORACE,
                raceName: 'テートオートレース',
                raceGrade: 'GⅠ',
                raceStage: '優勝戦', // マスタ実在ステージ・priority=7(>=4)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('84'),
                raceCourse: '島田',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(true);
        });

        it('U11: AUTORACE - priority<4 の場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('autorace202501010101'),
                placeId: validatePlaceId('autorace2025010184'),
                raceType: RaceType.AUTORACE,
                raceName: 'テートオートレース',
                raceGrade: 'GⅠ',
                raceStage: '一般戦', // マスタ実在ステージ・priority=0(<4)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('84'),
                raceCourse: '島田',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // BOATRACE テスト
        it('U12: BOATRACE - Specified かつ priority>=4 の場合は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('boatrace202501010101'),
                placeId: validatePlaceId('boatrace2025010102'),
                raceType: RaceType.BOATRACE,
                raceName: 'テストボートレース',
                // BOATRACE で isSpecified=true なのは SG のみ（GⅠ/GⅡ/GⅢ は isSpecified=false）
                raceGrade: 'SG',
                raceStage: '優勝戦', // マスタ実在ステージ・priority=9(>=4)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('02'),
                raceCourse: '赤龍',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(true);
        });

        it('U13: BOATRACE - priority<4 の場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('boatrace202501010101'),
                placeId: validatePlaceId('boatrace2025010102'),
                raceType: RaceType.BOATRACE,
                raceName: 'テストボートレース',
                raceGrade: 'SG',
                raceStage: '準優勝戦', // マスタ実在ステージ・priority=0(<4)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('02'),
                raceCourse: '赤龍',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // MECHANICAL_PRIORITY_THRESHOLD(=6) の境界ペア
        it('U21: KEIRIN - priority が 6 ちょうど(閾値と同値)の場合は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テスト競輪',
                raceGrade: 'GⅢ',
                raceStage: 'S級準決勝', // マスタ実在ステージ・priority=6ちょうど
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(true);
        });

        it('U28: KEIRIN - priority が 4(旧閾値では含まれたが新閾値未満)の場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テスト競輪',
                raceGrade: 'GⅠ',
                raceStage: 'S級二次予選', // マスタ実在ステージ・priority=4ちょうど(<6)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        it('U22: KEIRIN - priority が 3 ちょうど(閾値未満)の場合は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テスト競輪',
                raceGrade: 'FⅠ',
                raceStage: 'L級ガールズフレッシュクイーン', // マスタ実在ステージ・priority=3ちょうど
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // Edge case: grade/stage が string でない場合
        it('U14: grade が null の場合は priority=0 として評価されること', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                raceType: RaceType.KEIRIN,
                raceName: '競輪レース',
                raceGrade: null as unknown as string, // grade が null
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: 'KE01',
            } as unknown as RaceEntity;

            const result = shouldIncludeInCalendar(race);
            // grade が null のため priority=0, isSpecified check は通るが priority >= 4 は false
            expect(result).toBe(false);
        });

        it('U15: stage が null の場合は priority=0 として評価されること', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                raceType: RaceType.KEIRIN,
                raceName: '競輪レース',
                raceGrade: 'Grade1',
                raceStage: null as unknown as string, // stage が null
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: 'KE01',
            } as unknown as RaceEntity;

            const result = shouldIncludeInCalendar(race);
            // stage が null のため priority=0, priority >= 4 は false
            expect(result).toBe(false);
        });

        // KEIRIN での複数のパターン（より詳細）
        it('U23: KEIRIN - GP(最高優先度グレード)かつ priority>=4 の場合は true を返すこと', () => {
            const raceWithHighPriority: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                raceType: RaceType.KEIRIN,
                raceName: 'S級グランプリ',
                raceGrade: 'GP',
                raceStage: 'S級グランプリ', // マスタ実在ステージ・priority=10(>=4)
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: 'KE01',
            } as unknown as RaceEntity;

            const result = shouldIncludeInCalendar(raceWithHighPriority);
            expect(result).toBe(true);
        });

        it('U16: KEIRIN - FⅡ(NotSpecified)かつ stage が非string の場合 false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202605238410'),
                placeId: validatePlaceId('keirin2026052384'),
                raceType: RaceType.KEIRIN,
                raceName: '全プロ記念競輪in武雄',
                raceGrade: 'FⅡ', // isSpecified=false・stageも非stringで全プロ例外にも該当しない
                raceStage: null as unknown as string,
                raceNumber: 10,
                datetime: new Date('2026-05-23T06:13:00Z'),
                locationCode: validateLocationCode('84'),
                raceCourse: '武雄',
            } as unknown as RaceEntity;

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        it('U29: KEIRIN - FⅡ + S級優秀（全プロ例外・priority4<新閾値6）はカレンダーに含めないこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202605238410'),
                placeId: validatePlaceId('keirin2026052384'),
                raceType: RaceType.KEIRIN,
                raceName: '全プロ記念競輪in武雄',
                raceGrade: 'FⅡ',
                raceStage: 'S級優秀',
                raceNumber: 10,
                datetime: new Date('2026-05-23T06:13:00Z'),
                locationCode: validateLocationCode('84'),
                raceCourse: '武雄',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        it('U24: KEIRIN - FⅠ(NotSpecified)の決勝(priority4)は平場のため false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テストFⅠ競輪',
                raceGrade: 'FⅠ',
                raceStage: 'S級決勝', // priority=4(>=4)だがFⅠは平場のため対象外
                raceNumber: 12,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        it('U25: KEIRIN - FⅡ + S級スーパープロピストレーサー賞(全プロ例外)は true を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: '全プロ競輪',
                raceGrade: 'FⅡ',
                raceStage: 'S級スーパープロピストレーサー賞', // priority=7
                raceNumber: 12,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(true);
        });

        it('U26: KEIRIN - FⅡ + S級特選(全プロ例外だがpriority<4)は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: '全プロ競輪',
                raceGrade: 'FⅡ',
                raceStage: 'S級特選', // priority=0(<4)
                raceNumber: 12,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        it('U27: KEIRIN - FⅡ + S級決勝(全プロ例外ステージ名に非該当)は false を返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テストFⅡ競輪',
                raceGrade: 'FⅡ',
                raceStage: 'S級決勝', // 全プロ例外ステージ名の集合に含まれない
                raceNumber: 12,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // 指定レースフラグ（flaggedRaceIds）のテスト
        it('U17: グレード対象外でもflaggedRaceIdsに含まれていればtrueを返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('nar202601010202'),
                placeId: validatePlaceId('nar2026010102'),
                raceType: RaceType.NAR,
                raceName: '佐賀2R',
                raceGrade: '一般',
                raceNumber: 2,
                datetime: new Date('2026-01-01T10:00:00Z'),
                locationCode: validateLocationCode('02'),
                raceCourse: '佐賀',
                conditionData: {
                    surfaceType: 'ダート',
                    distance: 1400,
                },
            };

            const result = shouldIncludeInCalendar(
                race,
                new Set(['nar202601010202']),
            );
            expect(result).toBe(true);
        });

        it('U18: グレード対象外かつflaggedRaceIdsに含まれない場合はfalseを返すこと（従来通り）', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('nar202601010202'),
                placeId: validatePlaceId('nar2026010102'),
                raceType: RaceType.NAR,
                raceName: '佐賀2R',
                raceGrade: '一般',
                raceNumber: 2,
                datetime: new Date('2026-01-01T10:00:00Z'),
                locationCode: validateLocationCode('02'),
                raceCourse: '佐賀',
                conditionData: {
                    surfaceType: 'ダート',
                    distance: 1400,
                },
            };

            const result = shouldIncludeInCalendar(
                race,
                new Set(['nar202601010199']), // 別のraceId
            );
            expect(result).toBe(false);
        });

        it('U19: グレード対象かつflaggedRaceIdsにも含まれる場合はtrueを返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('jra202501010101'),
                placeId: validatePlaceId('jra2025010105'),
                raceType: RaceType.JRA,
                raceName: 'テストレース',
                raceGrade: 'GⅠ',
                raceStage: 'A',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('05'),
                raceCourse: '三崎',
                conditionData: {
                    surfaceType: '芝',
                    distance: 2000,
                },
            };

            const result = shouldIncludeInCalendar(
                race,
                new Set(['jra2025010101']),
            );
            expect(result).toBe(true);
        });

        it('U20: flaggedRaceIdsを省略した場合は空集合として扱われfalseを返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('nar202601010202'),
                placeId: validatePlaceId('nar2026010102'),
                raceType: RaceType.NAR,
                raceName: '佐賀2R',
                raceGrade: '一般',
                raceNumber: 2,
                datetime: new Date('2026-01-01T10:00:00Z'),
                locationCode: validateLocationCode('02'),
                raceCourse: '佐賀',
                conditionData: {
                    surfaceType: 'ダート',
                    distance: 1400,
                },
            };

            const result = shouldIncludeInCalendar(race);
            expect(result).toBe(false);
        });

        // 注目選手（watchedRaceIds）のテスト（SPEC-PLAYER-001）
        it('W1: グレード対象外でもwatchedRaceIdsに含まれていればtrueを返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202608023601'),
                placeId: validatePlaceId('keirin2026080236'),
                raceType: RaceType.KEIRIN,
                raceName: '小田原1R',
                raceGrade: 'FⅡ',
                raceStage: 'Ｓ級一次予選',
                raceNumber: 1,
                datetime: new Date('2026-08-02T01:58:00Z'),
                locationCode: validateLocationCode('36'),
                raceCourse: '小田原',
            };

            const result = shouldIncludeInCalendar(
                race,
                new Set(),
                new Set(['keirin202608023601']),
            );
            expect(result).toBe(true);
        });

        it('W2: グレード対象外かつwatchedRaceIdsに含まれない場合はfalseを返すこと（従来通り）', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202608023601'),
                placeId: validatePlaceId('keirin2026080236'),
                raceType: RaceType.KEIRIN,
                raceName: '小田原1R',
                raceGrade: 'FⅡ',
                raceStage: 'Ｓ級一次予選',
                raceNumber: 1,
                datetime: new Date('2026-08-02T01:58:00Z'),
                locationCode: validateLocationCode('36'),
                raceCourse: '小田原',
            };

            const result = shouldIncludeInCalendar(
                race,
                new Set(),
                new Set(['keirin202608023699']), // 別のraceId
            );
            expect(result).toBe(false);
        });

        it('W3: グレード対象かつwatchedRaceIdsにも含まれる場合はtrueを返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202501010101'),
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                raceName: 'テスト競輪',
                raceGrade: 'GⅠ',
                raceStage: 'S級決勝',
                raceNumber: 1,
                datetime: new Date('2025-01-01T10:00:00Z'),
                locationCode: validateLocationCode('43'),
                raceCourse: '競輪門',
            };

            const result = shouldIncludeInCalendar(
                race,
                new Set(),
                new Set(['keirin202501010101']),
            );
            expect(result).toBe(true);
        });

        it('W4: watchedRaceIdsを省略した場合は空集合として扱われfalseを返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202608023601'),
                placeId: validatePlaceId('keirin2026080236'),
                raceType: RaceType.KEIRIN,
                raceName: '小田原1R',
                raceGrade: 'FⅡ',
                raceStage: 'Ｓ級一次予選',
                raceNumber: 1,
                datetime: new Date('2026-08-02T01:58:00Z'),
                locationCode: validateLocationCode('36'),
                raceCourse: '小田原',
            };

            const result = shouldIncludeInCalendar(race, new Set());
            expect(result).toBe(false);
        });

        it('W5: flaggedRaceIdsが空でもwatchedRaceIdsだけでtrueを返すこと', () => {
            const race: RaceEntity = {
                raceId: validateRaceId('keirin202608023601'),
                placeId: validatePlaceId('keirin2026080236'),
                raceType: RaceType.KEIRIN,
                raceName: '小田原1R',
                raceGrade: 'FⅡ',
                raceStage: 'Ｓ級一次予選',
                raceNumber: 1,
                datetime: new Date('2026-08-02T01:58:00Z'),
                locationCode: validateLocationCode('36'),
                raceCourse: '小田原',
            };

            const result = shouldIncludeInCalendar(
                race,
                new Set(), // flaggedRaceIdsは空
                new Set(['keirin202608023601']),
            );
            expect(result).toBe(true);
        });
    });

    describe('isSpecifiedRace', () => {
        it('S1: KEIRIN - GⅠ(Specifiedグレード)は true を返すこと', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: 'GⅠ',
                raceStage: 'S級決勝',
            } as unknown as RaceEntity;

            const result = isSpecifiedRace(race);
            expect(result).toBe(true);
        });

        it('S2: KEIRIN - FⅡ + S級ダイナミックステージ(全プロ例外)は true を返すこと', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: 'FⅡ',
                raceStage: 'S級ダイナミックステージ',
            } as unknown as RaceEntity;

            const result = isSpecifiedRace(race);
            expect(result).toBe(true);
        });

        it('S3: KEIRIN - FⅡ + S級決勝(全プロ例外ステージ名に非該当)は false を返すこと', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: 'FⅡ',
                raceStage: 'S級決勝',
            } as unknown as RaceEntity;

            const result = isSpecifiedRace(race);
            expect(result).toBe(false);
        });

        it('S4: KEIRIN - FⅠ + 全プロ例外ステージ名でも false を返すこと（例外はFⅡ限定）', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: 'FⅠ',
                raceStage: 'S級スーパープロピストレーサー賞',
            } as unknown as RaceEntity;

            const result = isSpecifiedRace(race);
            expect(result).toBe(false);
        });

        it('S5: JRA - FⅡ + 全プロ例外ステージ名でも false を返すこと（例外はKEIRIN限定）', () => {
            const race = {
                raceType: RaceType.JRA,
                raceGrade: 'FⅡ',
                raceStage: 'S級スーパープロピストレーサー賞',
            } as unknown as RaceEntity;

            const result = isSpecifiedRace(race);
            expect(result).toBe(false);
        });
    });

    describe('getPriority', () => {
        it('P1: raceGrade が undefined の場合は 0 を返すこと', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: undefined,
                raceStage: 'A',
            } as unknown as RaceEntity;

            const result = getPriority(race);
            expect(result).toBe(0);
        });

        it('P2: raceGrade が number の場合は 0 を返すこと', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: 123,
                raceStage: 'A',
            } as unknown as RaceEntity;

            const result = getPriority(race);
            expect(result).toBe(0);
        });

        it('P3: raceGrade が string でも raceStage が非string の場合は 0 を返すこと', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: 'GⅠ',
                raceStage: null,
            } as unknown as RaceEntity;

            const result = getPriority(race);
            expect(result).toBe(0);
        });

        it('P4: 同一の(raceType,raceGrade,raceStage)で2回呼び出すと2回目もキャッシュ経由で同じpriorityを返すこと', () => {
            const race = {
                raceType: RaceType.KEIRIN,
                raceGrade: 'GⅠ',
                raceStage: 'S級決勝',
            } as unknown as RaceEntity;

            const first = getPriority(race);
            const second = getPriority(race);

            expect(second).toBe(first);
            expect(second).toBeGreaterThan(0);
        });
    });
});
