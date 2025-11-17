# CI/CD and Security Implementation Plan

**Version**: 1.0
**Created**: 2025-11-17
**Status**: Planning Phase
**Target**: git-pr-manager v1.6.0

---

## Executive Summary

This document outlines a comprehensive CI/CD and security setup for git-pr-manager, a public npm package that automates git workflows. The plan emphasizes **dogfooding** (using gpm in its own CI) to demonstrate credibility, multi-layer security for a tool that handles GitHub tokens, and cross-platform testing for production reliability.

**Key Principle**: *git-pr-manager SHOULD have MORE rigorous CI than typical packages because it IS a CI/security tool.*

---

## Current State vs. Target

### Current State
- ✅ Automated publishing (semantic-release + OIDC)
- ✅ Single workflow: `publish.yml` (tests, builds, publishes)
- ✅ 622 tests, 89.67% coverage
- ✅ GitHub Actions trusted publisher (npm)
- ⚠️ Tests run only on ubuntu-latest, Node LTS
- ⚠️ No security scanning (CodeQL, Dependabot)
- ⚠️ No cross-platform validation
- ⚠️ No dogfooding (gpm not used in its own CI)

### Target State
- ✅ Three workflows: `ci.yml`, `codeql.yml`, `publish.yml`
- ✅ Test matrix: 3 OS × 2 Node versions (6 jobs)
- ✅ Security: CodeQL + Dependabot + gpm security scan
- ✅ Dogfooding: gpm validates itself
- ✅ Branch protection with required status checks
- ✅ SECURITY.md policy for responsible disclosure

---

## Implementation Priorities

### Phase 1: HIGH Priority (Week 1) 🔴
**Goal**: Establish credibility through rigorous CI and dogfooding

1. **CI Workflow** (`ci.yml`)
   - Test matrix (6 jobs): ubuntu/macos/windows × Node 20/22
   - Lint, typecheck, build jobs
   - Security scan job using `gpm security` (**dogfooding!**)
   - Aggregate checks job for branch protection

2. **Branch Protection**
   - Require all CI jobs to pass
   - Enable "Require branches to be up to date"
   - Enforce on main branch

**Deliverables**:
- `.github/workflows/ci.yml` (8 jobs total)
- Branch protection rules configured
- Documentation: CI setup guide

**Success Metrics**:
- All PRs tested on 6 OS/Node combinations
- gpm security runs in CI (dogfooding validated)
- No merge to main without passing checks

---

### Phase 2: MEDIUM Priority (Week 2) 🟡
**Goal**: Enhance security posture and automation

1. **CodeQL Analysis** (`codeql.yml`)
   - Weekly scheduled scans + on PR/push
   - `security-extended` queries
   - Detect: command injection, path traversal, etc.

2. **Dependabot Configuration** (`dependabot.yml`)
   - npm dependencies: weekly Monday 9am
   - GitHub Actions: weekly Monday 9am
   - Auto-merge strategy: patch/minor only

3. **Security Policy** (`SECURITY.md`)
   - Supported versions
   - Responsible disclosure process
   - Security contact (GitHub Security Advisories)

**Deliverables**:
- `.github/workflows/codeql.yml`
- `.github/dependabot.yml`
- `SECURITY.md` in repository root

**Success Metrics**:
- CodeQL scans complete without critical findings
- Dependabot creates weekly update PRs
- Clear security policy visible on GitHub

---

### Phase 3: LOW Priority (Week 3) 🟢
**Goal**: Quality-of-life improvements

1. **Coverage Upload** (Codecov)
   - Upload coverage reports from CI
   - PR diff coverage comments
   - Public coverage badge

2. **Dependabot Auto-Merge**
   - Automated merge for patch/minor updates (with CI passing)
   - Manual review for major updates

3. **Issue Templates**
   - Bug report template
   - Feature request template
   - Security issue template (private)

**Deliverables**:
- Codecov integration in `ci.yml`
- Auto-merge workflow for Dependabot
- `.github/ISSUE_TEMPLATE/` files

**Success Metrics**:
- Coverage trends visible in Codecov dashboard
- Dependabot PRs auto-merge within 24 hours
- Community can report issues with templates

---

## Detailed Implementation

### 1. CI Workflow (`ci.yml`)

**File**: `.github/workflows/ci.yml`
**Triggers**: `pull_request`, `push` (main), `workflow_dispatch`
**Permissions**: `contents: read` (top-level)

#### Jobs Overview

```yaml
jobs:
  # Job 1: Security Scan (runs FIRST - catch secrets early)
  security-scan:
    name: Security Scan (gpm dogfooding)
    runs-on: ubuntu-latest
    steps:
      - Install gpm globally: npm install -g @littlebearapps/git-pr-manager
      - Run: gpm security
      - Mode: continue-on-error: true (until stable)
      - Skip for: forks, when GITHUB_TOKEN unavailable

  # Job 2: Lint
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - npm run lint

  # Job 3: Type Check
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - npx tsc --noEmit

  # Job 4: Build
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - npm run build
      - Verify artifacts exist (dist/index.js)
      - Upload build artifacts (for reuse)

  # Job 5: Test Matrix (6 jobs total)
  test:
    name: Test (Node ${{ matrix.node }} on ${{ matrix.os }})
    strategy:
      matrix:
        node: ['20.x', '22.x']
        os: [ubuntu-latest, macos-latest, windows-latest]
      fail-fast: false
    steps:
      - npm test

  # Job 6: Coverage
  coverage:
    name: Coverage
    runs-on: ubuntu-latest
    steps:
      - npm test -- --coverage
      - Check thresholds (80%+)
      - Upload to Codecov (Phase 3)

  # Job 7: Audit
  audit:
    name: Audit Dependencies
    runs-on: ubuntu-latest
    steps:
      - npm audit signatures

  # Job 8: Aggregate Check (REQUIRED for branch protection)
  checks:
    name: All Checks Passed
    if: always()
    needs: [security-scan, lint, typecheck, build, test, coverage, audit]
    runs-on: ubuntu-latest
    steps:
      - Verify all jobs succeeded
      - Exit 1 if any failed
```

#### Key Features

**Concurrency**:
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```
- Cancels superseded runs on same ref
- Saves GitHub Actions minutes

**Paths Ignore**:
```yaml
on:
  pull_request:
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.github/ISSUE_TEMPLATE/**'
```
- Skip CI for docs-only changes
- Faster feedback for code changes

**Caching**:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node }}
    cache: 'npm'
```
- Native npm caching via setup-node
- Reduces install time by ~50%

---

### 2. Dogfooding Strategy

**Goal**: Use gpm in its own CI to prove it works and build credibility

#### Mode A: Safe/Default (Phase 1)
**When**: PR and push to main
**How**: Install released gpm (not PR code)
**Permissions**: `pull-requests: write` (minimal)

```yaml
security-scan:
  name: Security Scan (gpm dogfooding)
  runs-on: ubuntu-latest
  # Only for non-fork PRs (safety)
  if: github.event.pull_request.head.repo.fork == false
  permissions:
    pull-requests: write
  steps:
    - uses: actions/checkout@v4

    # Install RELEASED gpm (not PR code)
    - name: Install gpm
      run: npm install -g @littlebearapps/git-pr-manager

    # Run gpm security scan
    - name: Run gpm security
      run: gpm security
      continue-on-error: true  # Until stable
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Safety**:
- Uses released version (trusted code)
- Skips forks (untrusted PRs)
- Minimal permissions (read + PR comments)
- `continue-on-error: true` until proven stable

#### Mode B: Deep Validation (Phase 3)
**When**: After Mode A proves stable
**How**: Test PR build in quarantined context
**Purpose**: Validate PR changes without privilege escalation

**Options**:
1. **Fixture Repository**: Test against private/test repo with read-only token
2. **Dry-Run Mode**: Verify output without making changes
3. **Self-Test Branch**: workflow_run on temp branch (no elevated perms)

**Not recommended**: `pull_request_target` (privilege escalation risk)

---

### 3. CodeQL Analysis (`codeql.yml`)

**File**: `.github/workflows/codeql.yml`
**Triggers**: `push` (main), `pull_request`, `schedule` (weekly Sundays 1am UTC)
**Permissions**: `security-events: write`, `contents: read`

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 1 * * 0'  # Weekly Sunday 1am UTC

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    timeout-minutes: 360

    permissions:
      security-events: write
      contents: read
      actions: read

    strategy:
      fail-fast: false
      matrix:
        language: ['javascript-typescript']

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: security-extended

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
          upload: true
```

**Why CodeQL for git-pr-manager**:
- Detects command injection (git command execution via `simple-git`)
- Detects path traversal (file operations)
- Detects authentication issues (GitHub API token handling)
- Critical for tool that executes system commands and handles secrets

**Query Suite**: `security-extended`
- More comprehensive than `security-only`
- Fewer false positives than `security-and-quality`
- Good balance for production tools

---

### 4. Dependabot Configuration (`dependabot.yml`)

**File**: `.github/dependabot.yml`

```yaml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "automated"
    commit-message:
      prefix: "chore"
      include: "scope"
    groups:
      # Group dev dependencies to reduce PR count
      dev-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    labels:
      - "dependencies"
      - "github-actions"
      - "automated"
    commit-message:
      prefix: "chore"
      include: "scope"
```

**Auto-Merge Strategy** (Phase 3):
```yaml
# Separate workflow: auto-merge-dependabot.yml
name: Auto-merge Dependabot

on: pull_request

jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Check if patch or minor
        id: check
        run: |
          # Parse PR title for semver type
          if [[ "${{ github.event.pull_request.title }}" =~ (patch|minor) ]]; then
            echo "auto_merge=true" >> $GITHUB_OUTPUT
          fi

      - name: Enable auto-merge
        if: steps.check.outputs.auto_merge == 'true'
        run: gh pr merge --auto --squash "$PR_NUMBER"
        env:
          PR_NUMBER: ${{ github.event.pull_request.number }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Rationale**:
- Patch/minor: Low risk, auto-merge after CI passes
- Major: Require manual review (breaking changes)
- Weekly schedule: Balance freshness vs PR spam

---

### 5. Security Policy (`SECURITY.md`)

**File**: `SECURITY.md` (repository root)

```markdown
# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via GitHub Security Advisories:
1. Go to https://github.com/littlebearapps/git-pr-manager/security/advisories
2. Click "Report a vulnerability"
3. Provide detailed information about the vulnerability

### What to Include
- Type of vulnerability (e.g., command injection, path traversal)
- Steps to reproduce
- Affected versions
- Impact assessment
- Suggested fix (if known)

### Response Timeline
- **Initial Response**: Within 48 hours
- **Fix Timeline**: Critical vulnerabilities within 7 days, others within 30 days
- **Disclosure**: After fix is released and users have been notified

## Security Considerations

### GitHub Token Handling
git-pr-manager requires a GitHub token (`GITHUB_TOKEN` or `GH_TOKEN`) to interact with the GitHub API. This token:
- Should have minimal required permissions (repo scope)
- Is never logged or transmitted to third parties
- Should be stored as an environment variable (not committed to code)

### Command Execution
git-pr-manager executes git commands locally via `simple-git`. Users should:
- Only use in trusted repositories
- Review command output in verbose mode
- Avoid running with elevated privileges

### Known Limitations
- Requires write access to repository (to create branches, PRs)
- Cannot enforce branch protection rules (GitHub API limitation)
- Designed for single-user workflows (not multi-tenant environments)

## Security Tools

We use the following tools to maintain security:
- **CodeQL**: Automated code scanning (weekly + on PR/push)
- **Dependabot**: Automated dependency updates (weekly)
- **npm audit**: Dependency vulnerability scanning (in CI)
- **gpm security**: Self-validation (dogfooding our own tool)

## Attribution

We follow responsible disclosure practices and will credit security researchers who report vulnerabilities (with their permission).
```

---

### 6. Publish Workflow Enhancements

**File**: `.github/workflows/publish.yml` (existing, enhance)

**Current**: Tests → Build → semantic-release → npm publish (OIDC)

**Enhancements**:

```yaml
# Add after "Build package" step:

- name: Integration Test (gpm dogfooding)
  run: |
    # Install from built package (validates npm package structure)
    npm install -g .

    # Run gpm commands (validates CLI works)
    gpm --version
    gpm status || true  # May fail if not in git repo context
    gpm security
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# Add after "Release" step:

- name: Generate SBOM (Supply Chain)
  if: success()
  run: |
    npm install -g @cyclonedx/cyclonedx-npm
    cyclonedx-npm --output-file sbom.json

- name: Upload SBOM to Release
  if: success()
  uses: actions/upload-artifact@v4
  with:
    name: sbom
    path: sbom.json
```

**Rationale**:
- Integration test validates package works when installed globally
- SBOM (Software Bill of Materials) provides supply chain transparency
- Both enhance credibility for security-focused tool

---

### 7. Branch Protection Rules

**Configure on GitHub**: Settings → Branches → Add rule (main)

Required Settings:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging:
  - `All Checks Passed` (aggregate from ci.yml)
  - `CodeQL` (from codeql.yml)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings
- ⚠️ Require signed commits (optional, for maintainers)

**Rationale**:
- Prevents accidental direct pushes to main
- Ensures all code is tested before merge
- Maintains high quality bar for production tool

---

## Risk Mitigation

### Risk: Dogfooding Creates Circular Dependency
**Impact**: If gpm bugs break CI, can't merge fixes
**Mitigation**:
- Keep core tests independent (use Jest/npm test directly)
- Use gpm only for enhanced validation (continue-on-error initially)
- Mode A uses released version (not PR code)

### Risk: Test Matrix Increases CI Time
**Impact**: 6× jobs = longer feedback loop
**Mitigation**:
- Run jobs in parallel (GitHub Actions default)
- Optimize each job (~3-5 min target)
- Use caching (npm, setup-node)
- Skip CI for docs-only changes (paths-ignore)

### Risk: CodeQL False Positives
**Impact**: Developers waste time triaging
**Mitigation**:
- Start with `security-extended` (balanced queries)
- Document suppressions with justifications
- Tune over time based on patterns

### Risk: Dependabot PR Spam
**Impact**: Too many PRs to review
**Mitigation**:
- Weekly schedule (not daily)
- Group dev dependencies
- Auto-merge patch/minor (Phase 3)
- Manual review for major updates only

### Risk: Privilege Escalation via Dogfooding
**Impact**: Malicious PR could exploit gpm in CI
**Mitigation**:
- Never use `pull_request_target` with untrusted code
- Install released gpm (not PR code) when write perms needed
- Skip forks entirely for dogfooding job
- Minimal permissions (pull-requests: write only)

---

## Success Metrics

### Phase 1 (Week 1)
- [ ] CI workflow with 8 jobs deployed
- [ ] Test matrix covers 6 OS/Node combinations
- [ ] gpm security runs in CI (dogfooding validated)
- [ ] Branch protection enables on main
- [ ] All PRs tested before merge

### Phase 2 (Week 2)
- [ ] CodeQL scans complete weekly + on PR/push
- [ ] Dependabot creates update PRs weekly
- [ ] SECURITY.md visible on GitHub repository
- [ ] Zero critical security findings from CodeQL

### Phase 3 (Week 3)
- [ ] Coverage reports uploaded to Codecov
- [ ] Dependabot PRs auto-merge (patch/minor)
- [ ] Issue templates available for community
- [ ] Public coverage badge on README

---

## Cost Analysis

### GitHub Actions (Free Tier)
- **Limit**: 2000 minutes/month (public repos)
- **Current usage**: ~53s per publish (negligible)
- **Projected usage**:
  - CI per PR: 3-5 min (6 parallel jobs)
  - CodeQL per week: 5-10 min
  - Estimate: 100 PRs/month × 5min = 500 min
  - **Total**: ~600 min/month (30% of free tier)
- **Conclusion**: Well within limits ✅

### Codecov (Free Tier)
- **Limit**: Unlimited public repos
- **Cost**: $0
- **Benefit**: PR diff coverage, trends, badge

### Dependabot
- **Cost**: Free (built-in GitHub feature)
- **Benefit**: Automated security updates

---

## Next Steps

### Immediate Actions (Before Phase 1)
1. Review this document with stakeholders
2. Get approval for implementation plan
3. Create GitHub milestone: "CI/Security Setup v1.6.0"
4. Create implementation tasks (one per deliverable)

### Implementation Order
1. **Week 1**: Implement ci.yml + branch protection
2. **Week 2**: Implement CodeQL + Dependabot + SECURITY.md
3. **Week 3**: Implement coverage upload + auto-merge + templates

### Rollout Strategy
1. Create feature branch: `feature/ci-security-setup`
2. Implement one workflow at a time
3. Test each workflow on feature branch
4. Merge to main (triggers dogfooding!)
5. Monitor for issues
6. Iterate based on feedback

---

## References

### Internal
- mcp-delegator workflows: `/lba/apps/mcp-servers/mcp-delegator/.github/workflows/`
- Current publish.yml: `.github/workflows/publish.yml`
- Test suite: `tests/` (622 tests, 89.67% coverage)

### External
- CodeQL: https://codeql.github.com/
- Dependabot: https://docs.github.com/en/code-security/dependabot
- GitHub Actions best practices: https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions
- npm provenance: https://docs.npmjs.com/generating-provenance-statements

---

## Appendix A: Workflow Comparison

| Feature | mcp-delegator | git-pr-manager (current) | git-pr-manager (target) |
|---------|---------------|--------------------------|-------------------------|
| Test OS | 3 (u/m/w) | 1 (ubuntu) | 3 (u/m/w) ✅ |
| Node versions | 2 (20, 22) | 1 (LTS) | 2 (20, 22) ✅ |
| CodeQL | ✅ | ❌ | ✅ |
| Dependabot | ✅ | ❌ | ✅ |
| Dogfooding | N/A | ❌ | ✅ (unique!) |
| Coverage upload | ❌ | ❌ | ✅ (Phase 3) |
| SECURITY.md | ❌ | ❌ | ✅ |
| Branch protection | ✅ | ⚠️ (manual) | ✅ |

---

## Appendix B: Estimated Timeline

```
Week 1 (Phase 1 - HIGH):
  Day 1-2: Implement ci.yml (8 jobs)
  Day 3:   Test ci.yml on feature branch
  Day 4:   Configure branch protection
  Day 5:   Documentation + merge to main

Week 2 (Phase 2 - MEDIUM):
  Day 1:   Implement codeql.yml
  Day 2:   Implement dependabot.yml
  Day 3:   Write SECURITY.md
  Day 4:   Test all workflows
  Day 5:   Merge to main + monitor

Week 3 (Phase 3 - LOW):
  Day 1-2: Codecov integration
  Day 3:   Dependabot auto-merge workflow
  Day 4:   Issue templates
  Day 5:   Final documentation + release v1.6.0
```

---

**Document Status**: ✅ Ready for Review
**Next Action**: Get stakeholder approval → Begin Week 1 implementation
**Owner**: git-pr-manager maintainers
**Last Updated**: 2025-11-17
