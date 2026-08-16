/**
 * check-node-version-sync.ts の自己テスト（QSYNC-09）
 *
 * ## デシジョンテーブル
 *
 * ### extractMajorVersion
 * | # | raw | 期待 |
 * |---|-----|------|
 * | T-01 | `'24'` | 24 |
 * | T-02 | `'>=24.0.0 <25.0.0'` | 24（最初に現れる数値） |
 * | T-03 | `'^24.13.3'` | 24 |
 * | T-04 | 数値を含まない文字列 | null |
 *
 * ### extractVersions
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-05 | 3箇所すべて値あり | 3箇所すべてのメジャーバージョンを返す |
 * | T-06 | package.jsonにengines/devDependenciesが無い | 該当箇所はnull |
 *
 * ### findVersionMismatches
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-07 | 3箇所とも一致 | 空配列 |
 * | T-08 | 1箇所だけ異なる | 3箇所分のメッセージを返す |
 * | T-09 | 1箇所がnull（抽出失敗） | 抽出失敗のメッセージを返す |
 */

import { describe, expect, it } from 'bun:test';

import {
    extractMajorVersion,
    extractVersions,
    findVersionMismatches,
} from './check-node-version-sync';

describe('check-node-version-sync/extractMajorVersion', () => {
    it('T-01: プレーンな数値文字列からメジャーバージョンを抽出すること', () => {
        expect(extractMajorVersion('24')).toBe(24);
    });

    it('T-02: engines.node形式の範囲指定から最初の数値を抽出すること', () => {
        expect(extractMajorVersion('>=24.0.0 <25.0.0')).toBe(24);
    });

    it('T-03: キャレット付きのバージョン指定から抽出すること', () => {
        expect(extractMajorVersion('^24.13.3')).toBe(24);
    });

    it('T-04: 数値を含まない場合はnullを返すこと', () => {
        expect(extractMajorVersion('unknown')).toBeNull();
    });
});

describe('check-node-version-sync/extractVersions', () => {
    it('T-05: 3箇所すべて値がある場合はメジャーバージョンを返すこと', () => {
        const versions = extractVersions('24\n', {
            engines: { node: '>=24.0.0 <25.0.0' },
            devDependencies: { '@types/node': '^24.13.3' },
        });

        expect(versions).toEqual({
            nvmrc: 24,
            enginesNode: 24,
            typesNode: 24,
        });
    });

    it('T-06: package.jsonにengines/devDependenciesが無い場合はnullを返すこと', () => {
        const versions = extractVersions('24\n', {});

        expect(versions).toEqual({
            nvmrc: 24,
            enginesNode: null,
            typesNode: null,
        });
    });
});

describe('check-node-version-sync/findVersionMismatches', () => {
    it('T-07: 3箇所とも一致する場合は空配列を返すこと', () => {
        const mismatches = findVersionMismatches({
            nvmrc: 24,
            enginesNode: 24,
            typesNode: 24,
        });

        expect(mismatches).toEqual([]);
    });

    it('T-08: 1箇所だけ異なる場合は3箇所分のメッセージを返すこと', () => {
        const mismatches = findVersionMismatches({
            nvmrc: 24,
            enginesNode: 24,
            typesNode: 25,
        });

        expect(mismatches).toEqual([
            '.nvmrc: 24',
            'package.json engines.node: 24',
            "package.json devDependencies['@types/node']: 25",
        ]);
    });

    it('T-09: 1箇所がnull（抽出失敗）の場合は抽出失敗のメッセージを返すこと', () => {
        const mismatches = findVersionMismatches({
            nvmrc: 24,
            enginesNode: 24,
            typesNode: null,
        });

        expect(mismatches).toEqual([
            "package.json devDependencies['@types/node']: メジャーバージョンを抽出できませんでした",
        ]);
    });
});
