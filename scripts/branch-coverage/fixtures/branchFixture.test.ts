/**
 * @file branchInstrumentPlugin.test.ts が子プロセスとして実行するフィクスチャテスト。
 * if分岐のtrue側を1回・false側を2回通し、既知の実カウントを作る。
 */
import { expect, test } from 'bun:test';
import { classify } from './branchFixture';

test('both true', () => {
    expect(classify(true, true)).toBe('both');
});

test('a false', () => {
    expect(classify(false, true)).toBe('not-both');
});

test('b false', () => {
    expect(classify(true, false)).toBe('not-both');
});
