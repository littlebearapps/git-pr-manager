# GitHub Actions Integration Guide

**Version**: 1.4.0-beta.1
**Last Updated**: 2025-11-13

---

## Overview

This guide shows how to integrate `git-workflow-manager` (`gwm`) into your GitHub Actions workflows for automated PR validation, CI/CD orchestration, and workflow automation.

## Why Use gwm in GitHub Actions?

- **Automated PR Validation**: Verify PRs meet protection requirements before merge
- **CI Status Monitoring**: Poll and wait for all checks to pass
- **Security Scanning**: Run secret detection and vulnerability scans in CI
- **Workflow Automation**: Standardize git workflows across teams
- **Rich Error Reporting**: Get structured error output with fix suggestions
- **Machine-Readable Output**: JSON mode for parsing in automation scripts

---

## Quick Start

### Basic PR Validation Workflow

```yaml
name: PR Checks
on: pull_request

jobs:
  validate-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install git-workflow-manager
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Run security scan
        run: gwm security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Installation in CI

### Global Installation (Recommended)

```yaml
- name: Install gwm
  run: npm install -g @littlebearapps/git-workflow-manager
```

**Pros**:
- Binary available system-wide as `gwm`
- No path configuration needed
- Works like standard CLI tools

### Local Installation (Alternative)

```yaml
- name: Install gwm locally
  run: npm install @littlebearapps/git-workflow-manager

- name: Run gwm
  run: npx gwm status
```

**Pros**:
- Version pinned in package.json
- No global namespace pollution

---

## Environment Configuration

### Required Environment Variables

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Required for GitHub API
```

**Note**: GitHub automatically provides `GITHUB_TOKEN` with permissions for the current repository. No manual secret creation needed for basic operations.

### Optional Environment Variables

```yaml
env:
  DEBUG: 1                    # Enable debug logging
  GH_TOKEN: ${{ secrets.CUSTOM_TOKEN }}  # Alternative to GITHUB_TOKEN
```

### Using Custom GitHub Tokens

For operations requiring additional permissions (e.g., cross-repo access, package registry):

1. **Create Personal Access Token**:
   - Go to https://github.com/settings/tokens
   - Generate token with required scopes (repo, workflow, etc.)

2. **Add as Repository Secret**:
   - Go to repository → Settings → Secrets and variables → Actions
   - Add secret named `GWM_TOKEN`

3. **Use in workflow**:
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.GWM_TOKEN }}
   ```

---

## Common Workflow Patterns

### Pattern 1: Security Scanning on PR

```yaml
name: Security Scan
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Run security scan
        run: gwm security --json > security-report.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload security report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: security-report.json
```

### Pattern 2: Wait for All Checks Before Deploy

```yaml
name: Deploy on PR Merge
on:
  pull_request:
    types: [closed]

jobs:
  deploy:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Verify all checks passed
        run: gwm checks ${{ github.event.pull_request.number }} --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy to production
        if: success()
        run: ./deploy.sh
```

### Pattern 3: Automated Feature Branch Creation

```yaml
name: Create Feature Branch
on:
  workflow_dispatch:
    inputs:
      feature_name:
        description: 'Feature branch name'
        required: true

jobs:
  create-branch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Create feature branch
        run: gwm feature ${{ github.event.inputs.feature_name }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Pattern 4: Branch Protection Validation

```yaml
name: Validate Branch Protection
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  workflow_dispatch:

jobs:
  validate-protection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Initialize gwm config
        run: gwm init --template strict

      - name: Check protection settings
        run: gwm protect --show --json > protection-report.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: protection-report
          path: protection-report.json
```

---

## Advanced Workflows

### Multi-Stage PR Workflow

```yaml
name: Complete PR Workflow
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Security scan
        run: gwm security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  validate:
    name: Validate PR
    runs-on: ubuntu-latest
    needs: security
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Check PR status
        run: |
          gwm checks ${{ github.event.pull_request.number }} --json | \
          jq -e '.overallStatus == "success" or .overallStatus == "pending"'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  status:
    name: Report Status
    runs-on: ubuntu-latest
    needs: [security, validate]
    if: always()
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Get final status
        id: status
        run: |
          STATUS=$(gwm checks ${{ github.event.pull_request.number }} --json)
          echo "status=$STATUS" >> $GITHUB_OUTPUT
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const status = ${{ steps.status.outputs.status }};
            const body = status.overallStatus === 'success'
              ? '✅ All checks passed!'
              : '⏳ Checks in progress...';

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

### Auto-Merge Workflow

```yaml
name: Auto-Merge PR
on:
  pull_request:
    types: [labeled]

jobs:
  auto-merge:
    if: contains(github.event.pull_request.labels.*.name, 'auto-merge')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Wait for CI checks
        run: |
          gwm checks ${{ github.event.pull_request.number }} --json | \
          jq -e '.overallStatus == "success"'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        timeout-minutes: 30

      - name: Merge PR
        if: success()
        run: gh pr merge ${{ github.event.pull_request.number }} --auto --squash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Machine-Readable Output

### Using JSON Mode

All `gwm` commands support `--json` flag for machine-readable output:

```yaml
- name: Get CI status as JSON
  run: gwm checks ${{ github.event.pull_request.number }} --json > status.json
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Parse JSON with jq
  run: |
    PASSED=$(jq '.passed' status.json)
    FAILED=$(jq '.failed' status.json)
    echo "Passed: $PASSED, Failed: $FAILED"
```

### Example JSON Output

**gwm checks --json**:
```json
{
  "total": 5,
  "passed": 5,
  "failed": 0,
  "pending": 0,
  "skipped": 0,
  "overallStatus": "success",
  "failureDetails": [],
  "startedAt": "2025-11-13T10:30:00Z"
}
```

**gwm security --json**:
```json
{
  "passed": true,
  "secretsFound": 0,
  "vulnerabilities": {
    "critical": 0,
    "high": 0,
    "moderate": 0,
    "low": 0
  },
  "scannedFiles": 42
}
```

---

## Verbosity Control

### Output Levels

```yaml
# Quiet mode (errors only)
- run: gwm checks 123 --quiet

# Silent mode (no output, exit codes only)
- run: gwm checks 123 --silent

# Verbose mode (detailed output)
- run: gwm checks 123 --verbose

# JSON mode (machine-readable)
- run: gwm checks 123 --json
```

### Auto-Detection

gwm automatically detects CI environments and adjusts output:

```yaml
# CI environment detected automatically
- run: gwm checks 123
  # Output: Structured, concise format optimized for CI logs
```

---

## Configuration in CI

### Using .gwm.yml in Repository

1. **Commit .gwm.yml to repository**:
   ```yaml
   # .gwm.yml
   branchProtection:
     enabled: true
     requireReviews: 1
     requireStatusChecks:
       - test
       - lint

   ci:
     waitForChecks: true
     timeout: 30

   security:
     scanSecrets: true
     scanDependencies: true
   ```

2. **gwm reads config automatically**:
   ```yaml
   - name: Run gwm (uses .gwm.yml)
     run: gwm auto
   ```

### Initialize Config in CI

```yaml
- name: Initialize gwm config
  run: gwm init --template strict --no-interactive
```

---

## Troubleshooting

### Issue: "No GitHub token found"

**Solution**: Ensure GITHUB_TOKEN is set:
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Issue: "Rate limit exceeded"

**Solution 1**: Use authenticated requests (GITHUB_TOKEN):
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Solution 2**: Increase timeout for rate limit recovery:
```yaml
- run: gwm checks 123
  timeout-minutes: 10
```

### Issue: "git command not found"

**Solution**: Ensure checkout action runs first:
```yaml
- uses: actions/checkout@v4  # Must run before gwm commands
- run: gwm status
```

### Issue: "Permission denied"

**Solution**: Ensure GITHUB_TOKEN has required permissions:

```yaml
permissions:
  contents: read      # Read repository content
  pull-requests: write  # Create/update PRs
  checks: read        # Read CI check status
  statuses: read      # Read commit statuses
```

### Issue: "Command not found: gwm"

**Solution 1**: Install globally:
```yaml
- run: npm install -g @littlebearapps/git-workflow-manager
- run: gwm --version
```

**Solution 2**: Use npx:
```yaml
- run: npm install @littlebearapps/git-workflow-manager
- run: npx gwm --version
```

---

## Best Practices

### 1. Cache npm installations

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'

- name: Install gwm
  run: npm install -g @littlebearapps/git-workflow-manager
```

### 2. Use matrix strategy for multi-environment testing

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [18, 20, 22]

runs-on: ${{ matrix.os }}
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node }}
  - run: npm install -g @littlebearapps/git-workflow-manager
  - run: gwm --version
```

### 3. Set appropriate timeouts

```yaml
- name: Wait for CI
  run: gwm checks ${{ github.event.pull_request.number }}
  timeout-minutes: 30  # Prevent hanging jobs
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Upload artifacts for debugging

```yaml
- name: Run security scan
  run: gwm security --json > security.json
  continue-on-error: true

- name: Upload results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: security-scan
    path: security.json
```

### 5. Use job dependencies for workflow orchestration

```yaml
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - run: gwm security

  validate:
    needs: security  # Wait for security to complete
    runs-on: ubuntu-latest
    steps:
      - run: gwm checks $PR_NUMBER

  deploy:
    needs: [security, validate]  # Wait for both
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
```

---

## Example: Complete CI/CD Pipeline

```yaml
name: Complete CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Stage 1: Security
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Run security scan
        run: gwm security --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # Stage 2: Tests
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    needs: security
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

  # Stage 3: Validate PR (only for PRs)
  validate-pr:
    name: Validate PR
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    needs: [security, test]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Check CI status
        run: gwm checks ${{ github.event.pull_request.number }} --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # Stage 4: Deploy (only on main)
  deploy:
    name: Deploy to Production
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    needs: [security, test]
    environment:
      name: production
      url: https://app.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Deploy
        run: ./scripts/deploy.sh
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

---

## Resources

- **CLI Reference**: Run `gwm --help` for all commands
- **Configuration Guide**: See `.gwm.yml` documentation in README
- **Exit Codes**: 0 = success, 1 = failure, 2 = validation error
- **GitHub Actions Docs**: https://docs.github.com/en/actions

---

## Next Steps

1. **Start simple**: Add security scanning to your PR workflow
2. **Add validation**: Use `gwm checks` to wait for CI
3. **Automate**: Use `gwm auto` for full workflow automation
4. **Monitor**: Review JSON output for metrics and reporting

For AI agent integration, see [AI-AGENT-INTEGRATION.md](AI-AGENT-INTEGRATION.md).
