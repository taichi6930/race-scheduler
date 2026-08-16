/**
 * check-pubspec-lockfile-drift.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * パース・制約判定を誤ると誤検知/検知漏れに直結するため、純粋関数（fs非依存）のUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### parseYamlDirectDependencies
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `dependencies:` 配下の `foo: ^1.2.3` | `foo -> "^1.2.3"` を含む |
 * | T-02 | `flutter:` の下に `sdk: flutter`（値なし行） | `flutter` は含まれない |
 * | T-03 | `dev_dependencies:` も同様に抽出される | `dev_dep -> "^2.0.0"` を含む |
 * | T-04 | セクション外（0-indentの別キー配下）の行 | 抽出されない |
 *
 * ### parseLockPackages
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-05 | `dependency: direct main` + `version: "1.2.3"` | `{dependency:'direct main', version:'1.2.3'}` |
 * | T-06 | `dependency: transitive` | dependencyが'transitive'として記録される |
 *
 * ### satisfiesConstraint
 * | # | locked | constraint | 期待 |
 * |---|--------|-----------|------|
 * | T-07 | `1.5.0` | `^1.0.0` | true |
 * | T-08 | `2.0.0` | `^1.0.0` | false（メジャー超過） |
 * | T-09 | `0.3.0` | `^0.2.0` | false（0.x系はminor跨ぎでbreaking扱い） |
 * | T-10 | `1.2.3` | `1.2.3`（完全一致指定） | true |
 * | T-11 | `1.2.3` | `>=1.0.0 <2.0.0`（対応外構文） | null（判定スキップ） |
 *
 * ### checkDrift
 * | # | 状況 | 期待 |
 * |---|-----|------|
 * | T-12 | lockに存在しない直接依存 | kind='missing-in-lock' |
 * | T-13 | lockではtransitive扱い | kind='transitive-only' |
 * | T-14 | バージョンが制約を満たさない | kind='version-mismatch' |
 * | T-15 | 全て整合 | 空配列 |
 */
import { describe, expect, it } from 'bun:test';

import {
    checkDrift,
    parseLockPackages,
    parseYamlDirectDependencies,
    satisfiesConstraint,
} from './check-pubspec-lockfile-drift';

describe('parseYamlDirectDependencies', () => {
    it('[T-01] dependencies配下の単純な制約を抽出すること', () => {
        const yaml = 'dependencies:\n  foo: ^1.2.3\n';
        expect(parseYamlDirectDependencies(yaml).get('foo')).toBe('^1.2.3');
    });

    it('[T-02] 値の無いネスト依存（sdk指定等）は含めないこと', () => {
        const yaml = 'dependencies:\n  flutter:\n    sdk: flutter\n';
        expect(parseYamlDirectDependencies(yaml).has('flutter')).toBe(false);
    });

    it('[T-03] dev_dependenciesも同様に抽出すること', () => {
        const yaml = 'dev_dependencies:\n  dev_dep: ^2.0.0\n';
        expect(parseYamlDirectDependencies(yaml).get('dev_dep')).toBe('^2.0.0');
    });

    it('[T-04] セクション外の行は抽出しないこと', () => {
        const yaml =
            'dependencies:\n  foo: ^1.2.3\nflutter_intl:\n  enabled: true\n';
        const result = parseYamlDirectDependencies(yaml);
        expect(result.has('enabled')).toBe(false);
        expect(result.size).toBe(1);
    });
});

describe('parseLockPackages', () => {
    it('[T-05] dependency/versionを正しく抽出すること', () => {
        const lock =
            'packages:\n  foo:\n    dependency: direct main\n    version: "1.2.3"\n';
        expect(parseLockPackages(lock).get('foo')).toEqual({
            dependency: 'direct main',
            version: '1.2.3',
        });
    });

    it('[T-06] transitive扱いも記録すること', () => {
        const lock =
            'packages:\n  bar:\n    dependency: transitive\n    version: "0.1.0"\n';
        expect(parseLockPackages(lock).get('bar')?.dependency).toBe(
            'transitive',
        );
    });
});

describe('satisfiesConstraint', () => {
    it('[T-07] caret範囲内はtrueを返すこと', () => {
        expect(satisfiesConstraint('1.5.0', '^1.0.0')).toBe(true);
    });

    it('[T-08] メジャーバージョン超過はfalseを返すこと', () => {
        expect(satisfiesConstraint('2.0.0', '^1.0.0')).toBe(false);
    });

    it('[T-09] 0.x系はminorを跨ぐとfalseを返すこと', () => {
        expect(satisfiesConstraint('0.3.0', '^0.2.0')).toBe(false);
    });

    it('[T-10] 完全一致指定はバージョンが一致すればtrueを返すこと', () => {
        expect(satisfiesConstraint('1.2.3', '1.2.3')).toBe(true);
    });

    it('[T-11] 対応外の構文はnullを返すこと', () => {
        expect(satisfiesConstraint('1.2.3', '>=1.0.0 <2.0.0')).toBeNull();
    });
});

describe('checkDrift', () => {
    it('[T-12] lockに存在しない直接依存はmissing-in-lockになること', () => {
        const yamlDeps = new Map([['foo', '^1.0.0']]);
        const lockPackages = new Map();
        const issues = checkDrift(yamlDeps, lockPackages);
        expect(issues).toEqual([
            {
                name: 'foo',
                kind: 'missing-in-lock',
                detail: expect.stringContaining('^1.0.0') as unknown as string,
            },
        ]);
    });

    it('[T-13] lockでtransitive扱いの場合はtransitive-onlyになること', () => {
        const yamlDeps = new Map([['foo', '^1.0.0']]);
        const lockPackages = new Map([
            ['foo', { dependency: 'transitive', version: '1.0.0' }],
        ]);
        const issues = checkDrift(yamlDeps, lockPackages);
        expect(issues[0].kind).toBe('transitive-only');
    });

    it('[T-14] バージョンが制約を満たさない場合はversion-mismatchになること', () => {
        const yamlDeps = new Map([['foo', '^1.0.0']]);
        const lockPackages = new Map([
            ['foo', { dependency: 'direct main', version: '2.0.0' }],
        ]);
        const issues = checkDrift(yamlDeps, lockPackages);
        expect(issues[0].kind).toBe('version-mismatch');
    });

    it('[T-15] 全て整合していれば空配列を返すこと', () => {
        const yamlDeps = new Map([['foo', '^1.0.0']]);
        const lockPackages = new Map([
            ['foo', { dependency: 'direct main', version: '1.5.0' }],
        ]);
        expect(checkDrift(yamlDeps, lockPackages)).toEqual([]);
    });
});
