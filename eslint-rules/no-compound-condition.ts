import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * 条件式（if/while/do-while/for/三項演算子のtest）で
 * 複合論理演算子（&&/||）を直接使うことを禁止するカスタムルール。
 *
 * ## 狙い
 * 複合条件（例: `if (a && b || c)`）は、厳密にテストしようとすると
 * サブ条件の組み合わせ数（C2: 条件網羅）が指数的に増え、テストが
 * 書きづらく・壊れやすくなる。複合条件を名前付き述語関数やガード節に
 * 分解すれば、各述語は単独でC0/C1がテストでき、呼び出し側は
 * 「関数呼び出し1つ」という単純な分岐になるためC2の組み合わせ爆発を
 * 回避できる。
 *
 * ## 検出対象
 * 以下5種類のノードの `test` プロパティに**直接**現れる
 * LogicalExpression（&&/||）を検出する。
 * - IfStatement
 * - WhileStatement
 * - DoWhileStatement
 * - ForStatement
 * - ConditionalExpression（三項演算子）
 *
 * `test` が LogicalExpression である場合、そのノード配下は
 * （ネストしていても）同一の1ノードとして扱われるため、
 * `if (a && b || c)` のような複合条件は1回だけ報告される。
 *
 * ## 検出対象外
 * - Nullish coalescing（`??`）: LogicalExpression だが演算子が `??` の
 *   場合は対象外（ロジック分岐ではなくデフォルト値解決のため）。
 * - ガード節としての `&&` 単独使用（例: `isValid && doSomething();`）:
 *   この形は式全体が ExpressionStatement として使われており、
 *   構造上 IfStatement 等の `test` には現れ得ないため、
 *   本ルールの対象セレクタに一致しない（自動的に対象外）。
 * - テストファイル（`*.test.ts` / `*.spec.ts`）: ファイル名で判定し
 *   ルール自体を無効化する。
 *
 * ## 既知の限界（意図的な範囲限定）
 * `test` に直接現れる LogicalExpression のみを検出するため、
 * 以下のように複合条件が関数呼び出しや否定でラップされている場合は
 * 検出されない。誤検知（false negative）が多いようなら、
 * `test` 配下を再帰的に走査する方式へ拡張を検討する。
 * - `if (!(a && b))`  … test が UnaryExpression のため未検出
 * - `if (someFn(a && b))`  … test が CallExpression のため未検出
 */

const createRule = ESLintUtils.RuleCreator(
    (name) =>
        `https://github.com/taichi6930/race-schedule/blob/main/eslint-rules/${name}.ts`,
);

const TEST_FILE_PATTERN = /\.(?:test|spec)\.tsx?$/;

const COMPOUND_CONDITION_SELECTOR = [
    'IfStatement > LogicalExpression.test',
    'WhileStatement > LogicalExpression.test',
    'DoWhileStatement > LogicalExpression.test',
    'ForStatement > LogicalExpression.test',
    'ConditionalExpression > LogicalExpression.test',
].join(', ');

type MessageIds = 'compoundCondition';

const noCompoundCondition = createRule<[], MessageIds>({
    name: 'no-compound-condition',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'if/while/do-while/for/三項演算子の条件式に複合論理演算子（&&/||）を直接書くことを禁止し、名前付き述語関数・ガード節への分解を強制する',
        },
        schema: [],
        messages: {
            compoundCondition:
                '複合条件（&&/||）は名前付き述語関数またはガード節に分解してください。\n' +
                '例: const isEligible = () => hasPermission && isActive;\n' +
                'if (isEligible()) { ... }',
        },
    },
    defaultOptions: [],
    create(context) {
        if (TEST_FILE_PATTERN.test(context.filename)) {
            return {};
        }

        return {
            [COMPOUND_CONDITION_SELECTOR](node: TSESTree.LogicalExpression) {
                // Nullish coalescing（??）はロジック分岐ではなくデフォルト値解決のため対象外
                if (node.operator === '??') {
                    return;
                }
                context.report({ node, messageId: 'compoundCondition' });
            },
        };
    },
});

export default noCompoundCondition;
