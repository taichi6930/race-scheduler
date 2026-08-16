# GitHub Actions Composite Actions

This directory contains reusable composite actions that consolidate common workflow patterns across multiple GitHub Actions workflows.

## Available Composite Actions

### `create-github-app-token`

**Purpose**: Create a GitHub App token for authentication in workflows.

**Usage**:
```yaml
- uses: ./.github/actions/create-github-app-token
  id: app-token
  with:
    app-id: ${{ secrets.BOT_APP_ID }}
    private-key: ${{ secrets.BOT_PRIVATE_KEY }}
```

**Outputs**:
- `token`: The generated GitHub App token

**Used in**: 
- `auto-merge-main.yml`
- `backfill-release-notes.yml`
- `batch-all.yml`
- `create_pull_request.yml`
- `deploy.yml` (post-merge-verify, auto-release jobs)
- `error-monitor.yml`
- `health-check-data-freshness.yml`
- `scheduled-tests.yml`
- `test-report.yml`
- `uptime-check.yml`

### `deploy-prelude`

**Purpose**: Checkout the repository, set up the deploy environment, and validate Cloudflare secrets in one step (CICD-87). Wraps `setup-deploy-env` and `validate-cf-secrets`, which were previously called as 3 separate identical steps at the top of every `deploy-*-reusable.yml`.

**Usage**:
```yaml
- uses: ./.github/actions/deploy-prelude
  with:
    # 呼び出し元ごとに用途で絞ったトークンを渡す（Workers deployなら
    # CLOUDFLARE_WORKERS_API_TOKEN、D1操作ならCLOUDFLARE_D1_API_TOKEN等）
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_WORKERS_API_TOKEN }}
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Used in**:
- `deploy-admin-reusable.yml`
- `deploy-api-reusable.yml`
- `deploy-batch-reusable.yml`
- `deploy-calendar-reusable.yml`
- `deploy-db-reusable.yml`
- `deploy-front-reusable.yml`
- `deploy-scraping-reusable.yml`

### `setup-deploy-env`

**Purpose**: Set up environment variables for deployment workflows.

**Usage**:
```yaml
- uses: ./.github/actions/setup-deploy-env
```

**Environment Variables Set**:
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`: "true"

**Used in**:
- `deploy-admin-reusable.yml`
- `deploy-api-reusable.yml`
- `deploy-batch-reusable.yml`
- `deploy-calendar-reusable.yml`
- `deploy-db-reusable.yml`
- `deploy-front-reusable.yml`
- `deploy-scraping-reusable.yml`

### `setup-workspace`

**Purpose**: Set up the workspace with dependencies.

**Includes**:
- Repository checkout
- Bun installation and setup
- Dependency installation with caching

**Parameters**:
- `bun-install-filter`: (optional) Filter for bun install to specific packages
- `setup-node`: (optional) Whether to set up Node.js (default: 'true')

## Adding New Composite Actions

When adding new composite actions:

1. Create a directory under `.github/actions/<action-name>/`
2. Create an `action.yml` file defining the action
3. Update this README with documentation
4. Add the action to relevant workflow path filters (e.g., deploy.yml)
5. Update workflow files to use the new action

## Consolidation Goals

These composite actions aim to:
- Reduce code duplication across workflows
- Simplify workflow maintenance (single source of truth)
- Make version updates easier (update once, affects all)
- Improve consistency across CI/CD pipelines
