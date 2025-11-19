# GitHub Actions Integration Guide

**Version**: 1.7.0
**Last Updated**: 2025-11-18

---

## Overview

This guide shows how to integrate `git-pr-manager` (`gpm`) into your GitHub Actions workflows for automated PR validation, CI/CD orchestration, and workflow automation.

## Why Use gpm in GitHub Actions?

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
          node-version: "20"

      - name: Install git-pr-manager
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Run security scan
        run: gpm security
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Installation in CI

### Global Installation (Recommended)

```yaml
- name: Install gpm
  run: npm install -g @littlebearapps/git-pr-manager
```

**Pros**:

- Binary available system-wide as `gpm`
- No path configuration needed
- Works like standard CLI tools

### Local Installation (Alternative)

```yaml
- name: Install gpm locally
  run: npm install @littlebearapps/git-pr-manager

- name: Run gpm
  run: npx gpm status
```

**Pros**:

- Version pinned in package.json
- No global namespace pollution

---

## Environment Configuration

### Required Environment Variables

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # Required for GitHub API
```

**Note**: GitHub automatically provides `GITHUB_TOKEN` with permissions for the current repository. No manual secret creation needed for basic operations.

### Optional Environment Variables

```yaml
env:
  DEBUG: 1 # Enable debug logging
  GH_TOKEN: ${{ secrets.CUSTOM_TOKEN }} # Alternative to GITHUB_TOKEN
```

### Using Custom GitHub Tokens

For operations requiring additional permissions (e.g., cross-repo access, package registry):

1. **Create Personal Access Token**:
   - Go to https://github.com/settings/tokens
   - Generate token with required scopes (repo, workflow, etc.)

2. **Add as Repository Secret**:
   - Go to repository → Settings → Secrets and variables → Actions
   - Add secret named `GPM_TOKEN`

3. **Use in workflow**:
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.GPM_TOKEN }}
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
          node-version: "20"

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Run security scan
        run: gpm security --json > security-report.json
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

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Verify all checks passed
        run: gpm checks ${{ github.event.pull_request.number }} --json
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
        description: "Feature branch name"
        required: true

jobs:
  create-branch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Create feature branch
        run: gpm feature ${{ github.event.inputs.feature_name }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Pattern 4: Branch Protection Validation

```yaml
name: Validate Branch Protection
on:
  schedule:
    - cron: "0 0 * * 1" # Weekly on Monday
  workflow_dispatch:

jobs:
  validate-protection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Initialize gpm config
        run: gpm init --template strict

      - name: Check protection settings
        run: gpm protect --show --json > protection-report.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: protection-report
          path: protection-report.json
```

### Pattern 5: Dependency Update Checks

```yaml
name: Check Tool Updates
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday at 9am
  workflow_dispatch:

jobs:
  check-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Check for gpm updates
        id: update-check
        run: |
          gpm check-update --json > update-check.json
          cat update-check.json
        continue-on-error: true

      - name: Create issue if update available
        if: steps.update-check.outputs.exit-code == '1'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const updateData = JSON.parse(fs.readFileSync('update-check.json', 'utf8'));

            if (updateData.updateAvailable) {
              github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: `gpm update available: ${updateData.latestVersion}`,
                body: `A new version of git-pr-manager is available.

Current version: ${updateData.currentVersion}
Latest version: ${updateData.latestVersion}
Channel: ${updateData.channel}

To update:
\`\`\`bash
npm install -g @littlebearapps/git-pr-manager
\`\`\`

See the [changelog](https://github.com/littlebearapps/git-pr-manager/releases) for details.`,
                labels: ['dependencies', 'enhancement']
              });
            }
```

**Note**: Update check respects CI environment automatically - notifications are suppressed in GitHub Actions. Use `--json` mode for programmatic access.

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
          node-version: "20"

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Security scan
        run: gpm security
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
          node-version: "20"

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Check PR status
        run: |
          gpm checks ${{ github.event.pull_request.number }} --json | \
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
          node-version: "20"

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Get final status
        id: status
        run: |
          STATUS=$(gpm checks ${{ github.event.pull_request.number }} --json)
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

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Wait for CI checks
        run: |
          gpm checks ${{ github.event.pull_request.number }} --json | \
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

All `gpm` commands support `--json` flag for machine-readable output:

```yaml
- name: Get CI status as JSON
  run: gpm checks ${{ github.event.pull_request.number }} --json > status.json
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Parse JSON with jq
  run: |
    PASSED=$(jq '.passed' status.json)
    FAILED=$(jq '.failed' status.json)
    echo "Passed: $PASSED, Failed: $FAILED"
```

### Example JSON Output

**gpm checks --json**:

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

**gpm security --json**:

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
- run: gpm checks 123 --quiet

# Silent mode (no output, exit codes only)
- run: gpm checks 123 --silent

# Verbose mode (detailed output)
- run: gpm checks 123 --verbose

# JSON mode (machine-readable)
- run: gpm checks 123 --json
```

### Auto-Detection

gpm automatically detects CI environments and adjusts output:

```yaml
# CI environment detected automatically
- run: gpm checks 123
  # Output: Structured, concise format optimized for CI logs
```

---

## Configuration in CI

### Using .gpm.yml in Repository

1. **Commit .gpm.yml to repository**:

   ```yaml
   # .gpm.yml
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

2. **gpm reads config automatically**:
   ```yaml
   - name: Run gpm (uses .gpm.yml)
     run: gpm auto
   ```

### Initialize Config in CI

```yaml
- name: Initialize gpm config
  run: gpm init --template strict --no-interactive
```

---

## Troubleshooting

### Verify Setup with gpm doctor

Use `gpm doctor` to verify your CI environment has all required and optional tools:

```yaml
- name: Verify gpm setup
  run: gpm doctor
```

**Example output in CI**:

```
▸ System Health Check
✅ GitHub token: GITHUB_TOKEN
✅ git                  git version 2.51.0
✅ node                 v20.10.0
✅ gh                   gh version 2.78.0
⚠️  detect-secrets       NOT FOUND (optional)
⚠️  pip-audit            NOT FOUND (optional)
```

**When to use**:

- Debugging "tool not found" errors
- Verifying optional dependencies are installed
- Confirming environment setup before running workflows
- Troubleshooting security scan issues

**Note**: `gpm doctor` works without GITHUB_TOKEN, making it safe to run in any CI environment.

### Pre-Release Validation

Use `gpm doctor --pre-release` to validate your repository is ready for publishing:

```yaml
- name: Pre-release validation
  run: |
    npm install -g .
    gpm doctor --pre-release
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Automated Checks** (7 validations):

- ✅ Required workflow files exist (ci.yml, publish.yml)
- ✅ README badge URLs match actual workflow names
- ⚠️ package.json version is `0.0.0-development` (warning only)
- ⚠️ @semantic-release/git plugin NOT present (warning only)
- ✅ Working directory is clean (no uncommitted changes)
- ✅ On main branch (releases must be from main)
- ⚠️ All CI checks passed for HEAD commit (warning if gh CLI unavailable)

**When to use**:

- Before npm publish in release workflows
- Part of Alternative D release validation strategy
- Catches configuration issues before semantic-release runs
- Prevents publishing with uncommitted changes or wrong branch

**Exit codes**:

- `0` - All checks passed (or only warnings)
- `1` - One or more critical checks failed

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
- run: gpm checks 123
  timeout-minutes: 10
```

### Issue: "git command not found"

**Solution**: Ensure checkout action runs first:

```yaml
- uses: actions/checkout@v4 # Must run before gpm commands
- run: gpm status
```

### Issue: "Permission denied"

**Solution**: Ensure GITHUB_TOKEN has required permissions:

```yaml
permissions:
  contents: read # Read repository content
  pull-requests: write # Create/update PRs
  checks: read # Read CI check status
  statuses: read # Read commit statuses
```

### Issue: "Command not found: gpm"

**Solution 1**: Install globally:

```yaml
- run: npm install -g @littlebearapps/git-pr-manager
- run: gpm --version
```

**Solution 2**: Use npx:

```yaml
- run: npm install @littlebearapps/git-pr-manager
- run: npx gpm --version
```

---

## Best Practices

### 1. Cache npm installations

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: "npm"

- name: Install gpm
  run: npm install -g @littlebearapps/git-pr-manager
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
  - run: npm install -g @littlebearapps/git-pr-manager
  - run: gpm --version
```

### 3. Set appropriate timeouts

```yaml
- name: Wait for CI
  run: gpm checks ${{ github.event.pull_request.number }}
  timeout-minutes: 30 # Prevent hanging jobs
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Upload artifacts for debugging

```yaml
- name: Run security scan
  run: gpm security --json > security.json
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
      - run: gpm security

  validate:
    needs: security # Wait for security to complete
    runs-on: ubuntu-latest
    steps:
      - run: gpm checks $PR_NUMBER

  deploy:
    needs: [security, validate] # Wait for both
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
          node-version: "20"
          cache: "npm"

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Run security scan
        run: gpm security --json
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
          node-version: "20"
          cache: "npm"

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
          node-version: "20"

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Check CI status
        run: gpm checks ${{ github.event.pull_request.number }} --json
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

## Anti-Patterns & Best Practices

### ❌ Anti-Pattern: Workflow to Check Workflows

**Don't create workflows that only check the status of other workflows**:

```yaml
# ❌ BAD: Redundant workflow
name: Check PR Status
on: pull_request

jobs:
  check-status:
    runs-on: ubuntu-latest
    steps:
      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Check other workflows
        run: gpm checks ${{ github.event.pull_request.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Why this is bad**:

- Creates circular dependency (workflow checking workflows)
- Duplicates GitHub's built-in PR status checks
- Adds maintenance overhead without value
- Delays PR feedback (waits for other workflows first)

**✅ Better alternatives**:

1. **Use gpm locally** for PR monitoring:

   ```bash
   # Developer workflow
   gpm status              # Check current branch status
   gpm checks 47          # Monitor PR #47 checks locally
   gpm ship               # Full automated workflow
   ```

2. **Add gpm to existing workflows** as validation steps:

   ```yaml
   # ✅ GOOD: Part of existing workflow
   jobs:
     security:
       runs-on: ubuntu-latest
       steps:
         - name: Run security scan
           run: gpm security # Adds value, doesn't duplicate
   ```

3. **Use GitHub's built-in features**:
   - Branch protection rules for required checks
   - PR status checks UI for monitoring
   - Required reviewers for approvals

---

### ✅ Best Practice: gpm as Validation, Not Orchestration

**gpm is designed for**:

- ✅ Security scanning (`gpm security`)
- ✅ Local PR workflows (`gpm ship`, `gpm auto`)
- ✅ CLI automation for developers
- ✅ Validation steps in existing workflows

**gpm is NOT designed for**:

- ❌ Orchestrating other GitHub Actions workflows
- ❌ Replacing GitHub's workflow engine
- ❌ Creating meta-workflows that monitor workflows

**Key principle**: Let GitHub Actions handle workflow execution. Use gpm for:

- **Security**: Scanning secrets and vulnerabilities
- **Developer UX**: Local CLI automation
- **Validation**: Checking requirements in CI steps

---

### ✅ Best Practice: Keep Workflows Simple

**Good workflow structure**:

```yaml
jobs:
  # 1. Run your tests/builds
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run tests
        run: npm test

  # 2. Add gpm as additional validation
  security:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: Security scan
        run: gpm security # Complements existing checks
```

**Avoid**:

- Multiple layers of workflow dependencies
- Workflows that only call other tools without adding value
- Duplicating checks that GitHub already provides

---

### ✅ Best Practice: Use gpm Where It Adds Value

**Add gpm when**:

- ✅ You need security scanning beyond existing tools
- ✅ You want standardized git workflows for developers
- ✅ You need structured JSON output for reporting
- ✅ You want automated PR workflows locally

**Skip gpm when**:

- ❌ GitHub's built-in features already cover the need
- ❌ It would duplicate existing CI checks
- ❌ It adds complexity without clear benefit

---

## Resources

- **CLI Reference**: Run `gpm --help` for all commands
- **Configuration Guide**: See `.gpm.yml` documentation in README
- **Exit Codes**: 0 = success, 1 = failure, 2 = validation error
- **GitHub Actions Docs**: https://docs.github.com/en/actions

---

## Next Steps

1. **Start simple**: Add security scanning to your PR workflow
2. **Add validation**: Use `gpm checks` to wait for CI
3. **Automate**: Use `gpm auto` for full workflow automation
4. **Monitor**: Review JSON output for metrics and reporting

For AI agent integration, see [AI-AGENT-INTEGRATION.md](AI-AGENT-INTEGRATION.md).
