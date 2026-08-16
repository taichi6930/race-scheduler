/**
 * generateReleaseSummary.ts の自己テスト（純粋関数のみ。fetch依存の関数はスコープ外）
 *
 * ## デシジョンテーブル
 *
 * ### parseCategorizedSections
 * | # | body | 期待 |
 * |---|------|------|
 * | T-01 | frontendカテゴリ1件・箇条書き2件 | [{category:'frontend', items:[2件]}] |
 * | T-02 | 2カテゴリが順に並ぶ | 2件のセクションをそれぞれ正しく抽出 |
 * | T-03 | カテゴリ見出しが無いPRテンプレート本文（## Summary等） | 空配列 |
 * | T-04 | カテゴリ見出しの後に別の見出し（## Test plan）が来る | 別見出し以降の箇条書きは拾わない |
 * | T-05 | 空文字列 | 空配列 |
 *
 * ### aggregateReleaseNotesFromPrs
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-06 | カテゴリ記載ありのPR1件 | 該当カテゴリにitemsが入る |
 * | T-07 | カテゴリ記載なしのPR1件（dependabot想定） | 'other'カテゴリにPRタイトルが入る |
 * | T-08 | 複数PRの同カテゴリ | itemsが結合される |
 * | T-14 | layerLabels: ['api']付きのPR | 箇条書き先頭に'[api] 'が付く |
 * | T-15 | layerLabels未指定のPR（fetchPullRequestSummarySourceを介さない後方互換呼び出し） | プレフィックス無しでitemsが入る |
 * | T-16 | layerLabels: ['api', 'front']（複数レイヤー）かつカテゴリ記載なしのPR | 'other'のフォールバック項目にも'[api/front] 'が付く |
 *
 * ### buildMarkdownFromSummary
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-09 | backend 1件・frontend 0件 | backend見出し＋箇条書きのみ（frontendは出力されない） |
 * | T-10 | 全カテゴリ0件 | 空文字列 |
 *
 * ### buildWhatsChangedMarkdown
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-11 | PR2件・lastTagあり | What's Changed見出し＋2行＋Full Changelogリンク（nextVersion比較） |
 * | T-12 | PR0件 | 空文字列（lastTagの有無に関わらず） |
 * | T-13 | PR1件・lastTagがnull（初回リリース） | What's Changed見出し＋1行のみ（Full Changelog行なし） |
 */
import { describe, expect, it } from 'bun:test';

import {
    aggregateReleaseNotesFromPrs,
    buildMarkdownFromSummary,
    buildWhatsChangedMarkdown,
    parseCategorizedSections,
} from './generateReleaseSummary';

describe('parseCategorizedSections', () => {
    it('T-01_1カテゴリの場合_見出しと箇条書きを抽出する', () => {
        const result = parseCategorizedSections(
            '## 📱 フロントの変更\n- 変更点A\n- 変更点B',
        );

        expect(result).toEqual([
            { category: 'frontend', items: ['変更点A', '変更点B'] },
        ]);
    });

    it('T-02_複数カテゴリの場合_それぞれ抽出する', () => {
        const result = parseCategorizedSections(
            '## 🔧 バックエンドのみ\n- 内部修正\n\n## 🎉 改善\n- 速度改善',
        );

        expect(result).toEqual([
            { category: 'backend', items: ['内部修正'] },
            { category: 'improvement', items: ['速度改善'] },
        ]);
    });

    it('T-03_カテゴリ見出しが無いPRテンプレート本文の場合_空配列を返す', () => {
        const result = parseCategorizedSections(
            '## Summary\n- 変更概要\n\n## Test plan\n- テスト内容',
        );

        expect(result).toEqual([]);
    });

    it('T-04_カテゴリ見出しの後に別の見出しが来る場合_それ以降の箇条書きを拾わない', () => {
        const result = parseCategorizedSections(
            '## 📱 フロントの変更\n- 変更点A\n\n## Test plan\n- テスト項目',
        );

        expect(result).toEqual([{ category: 'frontend', items: ['変更点A'] }]);
    });

    it('T-05_空文字列の場合_空配列を返す', () => {
        const result = parseCategorizedSections('');

        expect(result).toEqual([]);
    });
});

describe('aggregateReleaseNotesFromPrs', () => {
    it('T-06_カテゴリ記載ありのPRの場合_該当カテゴリへitemsが入る', () => {
        const result = aggregateReleaseNotesFromPrs([
            { title: 'PR A', body: '## 📱 フロントの変更\n- 変更点A' },
        ]);

        const frontend = result.categories.find(
            (c) => c.category === 'frontend',
        );
        expect(frontend?.items).toEqual(['変更点A']);
    });

    it('T-07_カテゴリ記載なしのPRの場合_otherにPRタイトルが入る', () => {
        const result = aggregateReleaseNotesFromPrs([
            { title: 'chore(deps): bump foo from 1.0.0 to 1.0.1', body: '' },
        ]);

        const other = result.categories.find((c) => c.category === 'other');
        expect(other?.items).toEqual([
            'chore(deps): bump foo from 1.0.0 to 1.0.1',
        ]);
    });

    it('T-08_複数PRの同カテゴリの場合_itemsが結合される', () => {
        const result = aggregateReleaseNotesFromPrs([
            { title: 'PR A', body: '## 🎉 改善\n- 改善A' },
            { title: 'PR B', body: '## 🎉 改善\n- 改善B' },
        ]);

        const improvement = result.categories.find(
            (c) => c.category === 'improvement',
        );
        expect(improvement?.items).toEqual(['改善A', '改善B']);
    });

    it('T-14_layerLabelsがある場合_箇条書き先頭にレイヤープレフィックスを付ける', () => {
        const result = aggregateReleaseNotesFromPrs([
            {
                title: 'PR A',
                body: '## 🎉 改善\n- 検索速度を改善',
                layerLabels: ['api'],
            },
        ]);

        const improvement = result.categories.find(
            (c) => c.category === 'improvement',
        );
        expect(improvement?.items).toEqual(['[api] 検索速度を改善']);
    });

    it('T-15_layerLabels未指定の場合_プレフィックス無しでitemsが入る', () => {
        const result = aggregateReleaseNotesFromPrs([
            { title: 'PR A', body: '## 🎉 改善\n- 検索速度を改善' },
        ]);

        const improvement = result.categories.find(
            (c) => c.category === 'improvement',
        );
        expect(improvement?.items).toEqual(['検索速度を改善']);
    });

    it('T-16_複数レイヤーかつカテゴリ記載なしの場合_otherフォールバックにもプレフィックスを付ける', () => {
        const result = aggregateReleaseNotesFromPrs([
            {
                title: 'chore(deps): bump foo',
                body: '',
                layerLabels: ['api', 'front'],
            },
        ]);

        const other = result.categories.find((c) => c.category === 'other');
        expect(other?.items).toEqual(['[api/front] chore(deps): bump foo']);
    });
});

describe('buildMarkdownFromSummary', () => {
    it('T-09_itemsが0件のカテゴリは出力しない', () => {
        const result = buildMarkdownFromSummary({
            categories: [
                { category: 'backend', items: ['バグを修正しました'] },
                { category: 'frontend', items: [] },
            ],
        });

        expect(result).toBe('## 🔧 バックエンドのみ\n- バグを修正しました');
    });

    it('T-10_全カテゴリ0件の場合_空文字列を返す', () => {
        const result = buildMarkdownFromSummary({
            categories: [{ category: 'backend', items: [] }],
        });

        expect(result).toBe('');
    });
});

describe('buildWhatsChangedMarkdown', () => {
    it('T-11_PR2件かつlastTagありの場合_見出し2行とFull Changelogリンクを返す', () => {
        const result = buildWhatsChangedMarkdown({
            owner: 'taichi6930',
            repo: 'race-schedule',
            lastTag: 'v1.33.0',
            nextVersion: 'v1.33.1',
            prs: [
                {
                    title: 'PR A',
                    authorLogin: 'alice',
                    htmlUrl:
                        'https://github.com/taichi6930/race-schedule/pull/100',
                },
                {
                    title: 'PR B',
                    authorLogin: 'bob',
                    htmlUrl:
                        'https://github.com/taichi6930/race-schedule/pull/101',
                },
            ],
        });

        expect(result).toBe(
            "## What's Changed\n" +
                '* PR A by @alice in https://github.com/taichi6930/race-schedule/pull/100\n' +
                '* PR B by @bob in https://github.com/taichi6930/race-schedule/pull/101\n\n' +
                '**Full Changelog**: https://github.com/taichi6930/race-schedule/compare/v1.33.0...v1.33.1',
        );
    });

    it('T-12_PR0件の場合_空文字列を返す', () => {
        const result = buildWhatsChangedMarkdown({
            owner: 'taichi6930',
            repo: 'race-schedule',
            lastTag: 'v1.33.0',
            nextVersion: 'v1.33.1',
            prs: [],
        });

        expect(result).toBe('');
    });

    it('T-13_lastTagがnullの場合_Full Changelog行を含めない', () => {
        const result = buildWhatsChangedMarkdown({
            owner: 'taichi6930',
            repo: 'race-schedule',
            lastTag: null,
            nextVersion: 'v1.0.0',
            prs: [
                {
                    title: 'Initial PR',
                    authorLogin: 'alice',
                    htmlUrl:
                        'https://github.com/taichi6930/race-schedule/pull/1',
                },
            ],
        });

        expect(result).toBe(
            "## What's Changed\n" +
                '* Initial PR by @alice in https://github.com/taichi6930/race-schedule/pull/1',
        );
    });
});
