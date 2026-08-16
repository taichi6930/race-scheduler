/**
 * releaseNoteCategories.ts
 *
 * autoRelease.ts（実リリース本文の生成）とfront（更新履歴ページのパース）の両方が
 * 前提とする、リリースノートのカテゴリ見出し規約。front（Dart）側は同じ見出し文字列を
 * 独自に定義してパースするため、この規約を変更する場合は front 側の実装も合わせて
 * 更新すること（whats-new-page-requirements.md FR-02参照）。
 */

export const RELEASE_NOTE_CATEGORIES = [
    { key: 'backend', heading: '## 🔧 バックエンドのみ' },
    { key: 'frontend', heading: '## 📱 フロントの変更' },
    { key: 'new_info', heading: '## ✨ 新しく取れる情報' },
    { key: 'improvement', heading: '## 🎉 改善' },
    { key: 'other', heading: '## 📝 その他' },
] as const;

export const RELEASE_NOTE_CATEGORY_KEYS = RELEASE_NOTE_CATEGORIES.map(
    (c) => c.key,
);

/** カテゴリキーから見出し文字列を引く。未知のキーは `other` の見出しにフォールバックする。 */
export const headingForCategory = (key: string): string => {
    const found = RELEASE_NOTE_CATEGORIES.find((c) => c.key === key);
    return found ? found.heading : RELEASE_NOTE_CATEGORIES[4].heading;
};
