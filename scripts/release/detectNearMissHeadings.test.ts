// detectNearMissHeadings のデシジョンテーブル
//
// | ID   | 条件                                                    | 期待                        |
// | ---- | -------------------------------------------------------- | --------------------------- |
// | T-01 | 正しい `## ` 見出し（規約通り）のみ                       | 空配列（ニアミス無し）      |
// | T-02 | `### 見出しテキスト`（ハッシュ3つ、実際に本リポで発生）   | 該当行を検出                |
// | T-03 | `# 見出しテキスト`（ハッシュ1つ）                         | 該当行を検出                |
// | T-04 | 見出しテキストが既知カテゴリと一致しない行                | 検出しない（無関係な見出し） |
// | T-05 | 空文字列の本文                                            | 空配列                      |
// | T-06 | 複数のニアミスが混在する本文                              | 全件を検出                  |

import { describe, expect, it } from 'bun:test';
import { detectNearMissHeadings } from './detectNearMissHeadings';

describe('detectNearMissHeadings', () => {
    it('[T-01] 正しい見出しのみの本文_空配列を返す', () => {
        const body = '## 🔧 バックエンドのみ\n- 何かを直した';

        const result = detectNearMissHeadings(body);

        expect(result).toEqual([]);
    });

    it('[T-02] ハッシュ3つの見出し_該当行を検出する', () => {
        const body = '## 更新履歴\n\n### 🔧 バックエンドのみ\n- 何かを直した';

        const result = detectNearMissHeadings(body);

        expect(result).toEqual(['### 🔧 バックエンドのみ']);
    });

    it('[T-03] ハッシュ1つの見出し_該当行を検出する', () => {
        const body = '# 📱 フロントの変更\n- 何かを変えた';

        const result = detectNearMissHeadings(body);

        expect(result).toEqual(['# 📱 フロントの変更']);
    });

    it('[T-04] 既知カテゴリと一致しない見出し_検出しない', () => {
        const body = '### Test plan\n- 手動確認した';

        const result = detectNearMissHeadings(body);

        expect(result).toEqual([]);
    });

    it('[T-05] 空文字列の本文_空配列を返す', () => {
        const result = detectNearMissHeadings('');

        expect(result).toEqual([]);
    });

    it('[T-06] 複数のニアミスが混在する本文_全件を検出する', () => {
        const body =
            '### 🔧 バックエンドのみ\n- a\n\n#### 📱 フロントの変更\n- b\n\n## ✨ 新しく取れる情報\n- c';

        const result = detectNearMissHeadings(body);

        expect(result).toEqual([
            '### 🔧 バックエンドのみ',
            '#### 📱 フロントの変更',
        ]);
    });
});
