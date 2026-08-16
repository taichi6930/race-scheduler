# セキュリティ関連ドキュメント

## `audit-allowlist.json`（DEP-020）

`bun audit --audit-level moderate` が検出する脆弱性のうち、調査の結果「対応不要」と
判断したものを追跡するためのallowlist。`scripts/check-audit-allowlist.ts` が読み込み、
`bun audit` の `--ignore=<GHSA-ID>` フラグへ変換する。

**現状（2026-08-02時点）は空配列**。`scheduled-tests.yml` の `audit` ジョブは
`continue-on-error: true`（結果はSEC-024によりIssue化されるのみ）のため、
allowlistが空でも既存の挙動（検出結果をそのまま表示・Issue化）から変わらない。
本ファイルは「①`bun audit`をブロッキング化する場合」「②誤検知・対応不要と判断した
脆弱性を個別に追跡したい場合」の受け皿として先に用意したものであり、実際にエントリを
追加するかどうかは個別の脆弱性ごとにセキュリティ判断が必要（本ファイルの追加自体は
機構のみで判断を含まない）。

### エントリの追加方法

各エントリは以下のスキーマに従う（`scripts/check-audit-allowlist.ts` が機械検証する）:

```json
{
  "id": "GHSA-xxxx-xxxx-xxxx",
  "package": "脆弱性のあるパッケージ名",
  "reason": "対応不要と判断した理由（開発専用依存で本番到達しない、パッチ未提供で影響が限定的、等）",
  "addedAt": "YYYY-MM-DD",
  "reviewBy": "YYYY-MM-DD"
}
```

- `id`: GitHub Security Advisory ID（`bun audit --json` の各エントリの `url` に含まれる
  `github.com/advisories/<ID>` から取得する）。
- `reviewBy`: 恒久的な放置を防ぐため、必ず将来の再レビュー期限を設定する（目安: 3ヶ月後）。
  期限切れのエントリは `check-audit-allowlist.ts` が警告する（非ブロッキング）。

### 使い方

```sh
# allowlistの内容・期限切れ警告を人間向けに表示
bun scripts/check-audit-allowlist.ts

# CI用: `bun audit`に渡す--ignoreフラグ列のみを標準出力へ（他の出力なし）
bun scripts/check-audit-allowlist.ts --ignore-flags
```
