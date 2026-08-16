/**
 * playerMapper.test.ts - PlayerMapper ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: PlayerMapper.toEntity()
 * | ケース | 入力 | 期待値 | 備考 |
 * |--------|------|--------|------|
 * | P1 | 有効な行 | PlayerEntity | 全フィールドマッピング |
 * | P2 | 必須フィールド欠如（raceType無し） | Error | playerRowSchema検証失敗（行検証） |
 * | P3 | 行検証は通るが無効な raceType | Error | validatePlayerEntity失敗（catch経由） |
 * | P4 | term/branchがある行 | PlayerEntity（term/branch付き） | player_keirinのLEFT JOIN結果 |
 * | P5 | term/branchがnullの行 | PlayerEntity（term/branchはundefined） | 未紐付け（LEFT JOIN不一致） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';

import { PlayerMapper } from '../../../../src/repository/implement/playerMapper';

describe('PlayerMapper.toEntity', () => {
    // P1: 有効な行 → PlayerEntity を返す
    it('P1: 有効な行をPlayerEntityにマッピングする', () => {
        const row = {
            raceType: 'keirin',
            playerNo: '123',
            playerName: '選手名前',
            priority: 5,
        };

        const entity = PlayerMapper.toEntity(row);

        expect(entity.raceType).toBe('keirin');
        expect(entity.playerNo).toBe('123');
        expect(entity.playerName).toBe('選手名前');
        expect(entity.priority).toBe(5);
    });

    // P2: raceType が欠如した行 → playerRowSchema 検証失敗で Error
    it('P2: raceTypeが欠如した行は行検証(playerRowSchema)でErrorをスローする', () => {
        const row = {
            playerNo: '123',
            playerName: '選手名前',
            priority: 5,
        };

        expect(() => PlayerMapper.toEntity(row)).toThrow(
            'Invalid player data from gateway',
        );
    });

    // P3: 行検証は通るが raceType が無効 → validatePlayerEntity が失敗し catch 経由で Error
    it('P3: 行検証は通るが無効なraceTypeのときErrorをスローする', () => {
        const row = {
            raceType: 'invalid_type',
            playerNo: '123',
            playerName: '選手名前',
            priority: 5,
        };

        expect(() => PlayerMapper.toEntity(row)).toThrow(
            'Failed to validate PlayerEntity',
        );
    });

    // P4: term/branchがある行 → PlayerEntityにterm/branchが付与される
    it('P4: term/branchがある行はPlayerEntityにterm/branchを含める', () => {
        const row = {
            raceType: 'keirin',
            playerNo: '123',
            playerName: '選手名前',
            priority: 5,
            term: 100,
            branch: '京都',
        };

        const entity = PlayerMapper.toEntity(row);

        expect(entity.term).toBe(100);
        expect(entity.branch).toBe('京都');
    });

    // P5: term/branchがnullの行（LEFT JOIN不一致）→ undefinedになる
    it('P5: term/branchがnullの行はPlayerEntityでundefinedになる', () => {
        const row = {
            raceType: 'keirin',
            playerNo: '123',
            playerName: '選手名前',
            priority: 5,
            term: null,
            branch: null,
        };

        const entity = PlayerMapper.toEntity(row);

        expect(entity.term).toBeUndefined();
        expect(entity.branch).toBeUndefined();
    });
});
