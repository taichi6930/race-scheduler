/**
 * no-compound-condition ルールのテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 入力                                          | 種別    | 期待結果                          |
 * |------|-----------------------------------------------|---------|------------------------------------|
 * | V-01 | if (単純条件)                                  | valid   | エラーなし                         |
 * | V-02 | ガード節へ分解済みコード（述語関数 + if）      | valid   | エラーなし                         |
 * | V-03 | if (a ?? b)                                    | valid   | ?? は対象外                        |
 * | V-04 | *.test.ts 内の複合条件                         | valid   | テストファイルは対象外             |
 * | V-05 | isValid && doSomething(); （ExpressionStatement）| valid | ガード節単独使用は構造上対象外    |
 * | V-06 | while (a ?? b)                                 | valid   | ?? は対象外（while）               |
 * | I-01 | if (a && b)                                    | invalid | 1エラー                            |
 * | I-02 | if (a || b)                                    | invalid | 1エラー                            |
 * | I-03 | 三項演算子の条件部で a && b                    | invalid | 1エラー                            |
 * | I-04 | if ((a && b) || c) （ネスト複合条件）          | invalid | 1エラー（1ノードとして検出）        |
 * | I-05 | while (a && b)                                 | invalid | 1エラー                            |
 * | I-06 | do { } while (a && b)                          | invalid | 1エラー                            |
 * | I-07 | for (; a && b; )                               | invalid | 1エラー                            |
 * | I-08 | if 内 && と 三項演算子内 && の2箇所            | invalid | 2エラー                            |
 */

import { afterAll, describe, it } from 'bun:test';
import * as tsParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';

import noCompoundCondition from './no-compound-condition';

// bun:test を RuleTester のテストフレームワークとして使用する
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        parser: tsParser,
    },
});

ruleTester.run('no-compound-condition', noCompoundCondition, {
    valid: [
        // V-01: 単純条件
        {
            name: 'V-01: if (単純条件)',
            code: `
                if (isValid) {
                    doSomething();
                }
            `,
        },
        // V-02: ガード節へ分解済みコード（述語関数 + if は valid、
        //       述語関数の定義側の && は test 位置に無いため対象外）
        {
            name: 'V-02: ガード節へ分解済みコード',
            code: `
                const isEligible = () => hasPermission && isActive;
                if (isEligible()) {
                    doSomething();
                }
            `,
        },
        // V-03: Nullish coalescing は対象外
        {
            name: 'V-03: if (a ?? b)',
            code: `
                if (a ?? b) {
                    doSomething();
                }
            `,
        },
        // V-04: テストファイルは対象外
        {
            name: 'V-04: テストファイル内の複合条件',
            code: `
                if (a && b) {
                    doSomething();
                }
            `,
            filename: 'example.test.ts',
        },
        // V-05: ガード節としての && 単独使用（ExpressionStatement）
        {
            name: 'V-05: ガード節単独使用（ExpressionStatement）',
            code: `isValid && doSomething();`,
        },
        // V-06: while + ??
        {
            name: 'V-06: while (a ?? b)',
            code: `
                while (a ?? b) {
                    doSomething();
                }
            `,
        },
    ],
    invalid: [
        // I-01: if 内の &&
        {
            name: 'I-01: if (a && b)',
            code: `
                if (a && b) {
                    doSomething();
                }
            `,
            errors: [{ messageId: 'compoundCondition' }],
        },
        // I-02: if 内の ||
        {
            name: 'I-02: if (a || b)',
            code: `
                if (a || b) {
                    doSomething();
                }
            `,
            errors: [{ messageId: 'compoundCondition' }],
        },
        // I-03: 三項演算子の条件部
        {
            name: 'I-03: 三項演算子の条件部',
            code: `const x = a && b ? 1 : 2;`,
            errors: [{ messageId: 'compoundCondition' }],
        },
        // I-04: ネストした複合条件（1ノードとして検出）
        {
            name: 'I-04: if ((a && b) || c)',
            code: `
                if ((a && b) || c) {
                    doSomething();
                }
            `,
            errors: [{ messageId: 'compoundCondition' }],
        },
        // I-05: while 文
        {
            name: 'I-05: while (a && b)',
            code: `
                while (a && b) {
                    doSomething();
                }
            `,
            errors: [{ messageId: 'compoundCondition' }],
        },
        // I-06: do-while 文
        {
            name: 'I-06: do { } while (a && b)',
            code: `
                do {
                    doSomething();
                } while (a && b);
            `,
            errors: [{ messageId: 'compoundCondition' }],
        },
        // I-07: for 文
        {
            name: 'I-07: for (; a && b; )',
            code: `
                for (; a && b; ) {
                    doSomething();
                }
            `,
            errors: [{ messageId: 'compoundCondition' }],
        },
        // I-08: 複数箇所（if + 三項演算子）
        {
            name: 'I-08: if 内 && と 三項演算子内 && の2箇所',
            code: `
                if (a && b) {
                    const x = c && d ? 1 : 2;
                }
            `,
            errors: [
                { messageId: 'compoundCondition' },
                { messageId: 'compoundCondition' },
            ],
        },
    ],
});
