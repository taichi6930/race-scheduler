# アーキテクチャ分析・再編提案

まだ承認・実装されていない構造分析と再編提案を置く場所。実装が完了し提案がクローズしたら、
内容を該当パッケージの README へ反映したうえでこのディレクトリから削除する
（詳細は [`.claude/docs/documentation-conventions.md`](../../.claude/docs/documentation-conventions.md) §3/§5）。

現在のパッケージ構成・依存関係・レイヤーアーキテクチャなど「今どうなっているか」は
[`packages/README.md`](../../packages/README.md) を正とする。ここに置くのは、まだ実装に
反映されていない分析・提案のみ。

## 一覧

| ファイル | 内容 | 対応する BACKLOG 項目 |
| --- | --- | --- |
| [architecture-overview.md](./architecture-overview.md) | パッケージ構成・依存関係の調査結果（再編提案の土台） | STR-01〜04 |
| [dependency-analysis.md](./dependency-analysis.md) | パッケージ間 import の静的解析結果 | STR-01〜04 |
| [module-boundary-issues.md](./module-boundary-issues.md) | モジュール境界の問題点一覧（重要度付き） | STR-01〜04 |
| [reorganization-proposal.md](./reorganization-proposal.md) | 上記3ファイルを踏まえた再編提案（未承認） | STR-01〜04 |
| [reorganization-tasks.md](./reorganization-tasks.md) | 再編提案を PR 単位へ分解したタスクチェックリスト（未着手分） | STR-01〜04 |
| [reorganization-tasks-completed.md](./reorganization-tasks-completed.md) | 上記のうち完了済みタスクのアーカイブ（判断根拠の記録用） | — |

`core` を `@race-schedule/domain`/`@race-schedule/shared` へ物理分割する構想（BACKLOG §F
STR-01〜04）は、着手前にユーザー承認が必要（`needs-approval`）。
