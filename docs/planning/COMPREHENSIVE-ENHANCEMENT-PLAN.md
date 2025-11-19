# git-pr-manager: Comprehensive Enhancement Plan

## Full SDK Migration + CI/Security Improvements

**Version**: 2.0.0
**Date**: 2025-11-12
**Status**: 📋 Planning Phase - Ready for Implementation
**Scope**: Unified plan combining Option 2 SDK Migration + GitHub CI/Security Audit findings

---

## Executive Summary

This document outlines a complete transformation of git-pr-manager from bash + gh CLI to a sophisticated Node.js + Octokit SDK solution with **enhanced CI error reporting**, **intelligent polling**, **branch protection integration**, and **security features**.

### What's Changed from Option 2

This plan **supersedes** the original Option 2 migration plan by integrating findings from the comprehensive GitHub CI/Security Audit (2025-11-12). It adds:

1. **Enhanced Error Reporting** - Rich, actionable CI failure messages
2. **Intelligent CI Polling** - Async polling with progress, fail-fast, retries
3. **Branch Protection Integration** - Pre-flight validation and auto-configuration
4. **Security Integration** - Pre-commit scanning, vulnerability detection
5. **Workflow Templates** - Standardized CI patterns based on org best practices

### Key Benefits

| Aspect               | Current (Bash + gh CLI)    | After Enhancement                 | Improvement               |
| -------------------- | -------------------------- | --------------------------------- | ------------------------- |
| **Error Visibility** | ⚠️ Generic "CI failed"     | ✅ Detailed errors with file:line | 95% faster identification |
| **CI Polling**       | ⚠️ Blocking `gh pr checks` | ✅ Async with progress updates    | 50-75% faster feedback    |
| **Error Resolution** | ⚠️ 30-60 min debugging     | ✅ 5-10 min with suggested fixes  | 80-90% time savings       |
| **Type Safety**      | ❌ No types                | ✅ Full TypeScript                | Compile-time validation   |
| **Testing**          | ❌ Manual only             | ✅ Jest + Nock automated tests    | 100% coverage possible    |
| **Security**         | ⚠️ Post-push only          | ✅ Pre-commit + PR scanning       | Proactive protection      |
| **PR/Merge Time**    | ⚠️ 2-4 hours average       | ✅ 30-60 min average              | 50-75% faster             |

### Migration Effort

**Estimated Time**: 4-5 weeks (100-120 hours)

- **Week 1**: Core SDK infrastructure + Enhanced error reporting (25-30 hours)
- **Week 2**: PR automation + Intelligent CI polling (25-30 hours)
- **Week 3**: Branch protection + Security integration (25-30 hours)
- **Week 4**: Testing + Documentation + Workflow templates (20-25 hours)
- **Week 5**: Rollout + Bug fixes (5-10 hours)

---

## Table of Contents

1. [Audit Findings Overview](#audit-findings-overview)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Command Mapping](#command-mapping)
5. [Technical Design](#technical-design)
6. [Enhanced Features](#enhanced-features)
7. [Error Handling Strategy](#error-handling-strategy)
8. [Implementation Phases](#implementation-phases)
9. [Testing Strategy](#testing-strategy)
10. [Rollout Plan](#rollout-plan)
11. [Success Metrics](#success-metrics)

---

## Audit Findings Overview

### GitHub Organization Analysis (littlebearapps)

**Organization**: littlebearapps (Enterprise plan)

- **Total Repositories**: 28 (23 private, 5 public)
- **Audited**: 10 active repositories
- **Branch Protection**: 4/10 repos (40%)
- **CI/CD Workflows**: 6/10 repos (60%)

### Critical Issues Identified

#### 🔴 High Priority

1. **Inconsistent Branch Protection** - Only 40% of repos protected
2. **Failing Security Scans** - CodeQL, Dependency Review failing on multiple repos
3. **Poor Error Visibility** - CI failures show "undefined" summaries

#### 🟡 Medium Priority

1. **No Standardized CI Template** - Each repo uses different patterns
2. **Limited Test Reporting** - Only some repos use test-reporter with annotations
3. **Incomplete Check Enforcement** - Required checks not consistently enforced

#### 🟢 Best Practice Examples

**⭐ auditor-toolkit** - Excellent CI:

- Rich test reporting with annotations (max 50)
- GitHub Step Summary with test statistics
- Smart error handling with continue-on-error
- Test reporter integration

**⭐ wp-navigator-pro** - Good patterns:

- Parallel test jobs (smoke, full, CLI)
- TAP output for Codex compatibility
- Strict branch protection

### Key Takeaway for git-pr-manager

**Claude Code needs better error information**:

1. **Quick classification** - Test failure? Linting? Type error? Security issue?
2. **Actionable messages** - File:line, exact error, suggested fix
3. **Prioritization** - Critical vs warning vs info
4. **Progressive detail** - Summary → details → full logs

---

## Current State Analysis

### Current Tech Stack

```
git-pr-manager (v0.3.0)
├── Language: Bash
├── Git Operations: git CLI
├── GitHub Operations: gh CLI
├── PR Templates: ✅ Supported (v0.3.0)
├── CI Polling: ⚠️ Manual (`gh pr checks --watch`)
├── Error Reporting: ❌ Exit codes only
├── Security: ❌ No pre-commit checks
├── Testing: ❌ None (manual only)
└── Type Safety: ❌ None
```

### Current Workflow (Bash)

```bash
gpm ship
  ├── 1. Preflight Checks (bash)
  │   ├── Current branch validation
  │   ├── Uncommitted changes check
  │   └── GitHub auth (gh auth status)
  │
  ├── 2. Run verify.sh (bash)
  │   ├── Lint (npm run lint)
  │   ├── Typecheck (npm run typecheck)
  │   ├── Tests (npm test)
  │   └── Build (npm run build)
  │
  ├── 3. Push Branch (git CLI)
  │   └── git push origin feature/branch
  │
  ├── 4. Create PR (gh CLI)
  │   └── gh pr create --fill
  │
  ├── 5. Wait for CI (gh CLI - BLOCKING) ⚠️
  │   └── gh pr checks --watch
  │       ❌ No progress updates
  │       ❌ Minimal error details
  │       ❌ Blocks terminal
  │
  ├── 6. Merge PR (gh CLI)
  │   └── gh pr merge --squash
  │       ❌ No validation of merge requirements
  │
  └── 7. Delete Branch (git CLI)
      └── git push origin --delete feature/branch
```

### Pain Points (Validated by Audit)

1. **CI Error Visibility** ❌ CRITICAL
   - Example from audit: `❌ Security Scan Summary: failure → Summary: undefined`
   - No file:line references
   - No suggested fixes
   - Must navigate to GitHub Actions to debug

2. **CI Polling** ❌ CRITICAL
   - Blocking terminal
   - No progress indication
   - Can't tell which checks are running vs completed
   - Must wait for all checks (no fail-fast)

3. **Branch Protection** ⚠️ HIGH
   - No pre-flight validation
   - Discover merge blockers too late
   - No visibility into protection rules

4. **Security** ⚠️ HIGH
   - No pre-commit secret scanning
   - No dependency vulnerability checks
   - Security issues discovered after push

5. **Error Handling** ⚠️ MEDIUM
   - Exit codes are ambiguous
   - String parsing is fragile
   - No structured errors

6. **Testing** ⚠️ MEDIUM
   - No automated tests
   - Relies on manual verification
   - Hard to maintain confidence

---

## Target Architecture

### New Tech Stack

```
git-pr-manager (v1.0.0 - SDK-based + Enhanced)
├── Language: TypeScript (compiled to JavaScript)
├── Git Operations: simple-git (npm package)
├── GitHub Operations: Octokit SDK (@octokit/rest)
├── PR Templates: ✅ Enhanced (programmatic merging)
├── CI Polling: ✅ Async polling with progress ⭐ NEW
├── Error Reporting: ✅ Rich, actionable messages ⭐ NEW
├── Branch Protection: ✅ Pre-flight validation ⭐ NEW
├── Security: ✅ Pre-commit + PR scanning ⭐ NEW
├── Testing: ✅ Jest + Nock (unit + integration)
└── Type Safety: ✅ Full TypeScript
```

### Project Structure

```
git-pr-manager/
├── src/
│   ├── index.ts                          # CLI entry point
│   │
│   ├── commands/
│   │   ├── init.ts                       # gpm init
│   │   ├── feature-start.ts              # gpm feature start
│   │   ├── ship.ts                       # gpm ship ⭐
│   │   ├── status.ts                     # gpm status
│   │   ├── checks.ts                     # gpm checks ⭐ NEW
│   │   └── protect.ts                    # gpm protect ⭐ NEW
│   │
│   ├── services/
│   │   ├── GitHubService.ts              # Core Octokit wrapper
│   │   ├── GitService.ts                 # Git operations (simple-git)
│   │   ├── PRService.ts                  # PR creation/merge
│   │   ├── EnhancedCIPoller.ts           # ⭐ NEW - Rich CI polling
│   │   ├── BranchProtectionChecker.ts    # ⭐ NEW - Protection validation
│   │   ├── SecurityScanner.ts            # ⭐ NEW - Pre-commit security
│   │   ├── PRTemplateService.ts          # Template discovery + merging
│   │   ├── VerifyService.ts              # Run verify.sh with progress
│   │   └── ConfigService.ts              # .gpm.yml management
│   │
│   ├── types/
│   │   ├── config.ts                     # Config types
│   │   ├── pr.ts                         # PR types
│   │   ├── checks.ts                     # CI check types
│   │   ├── errors.ts                     # ⭐ NEW - Error classifications
│   │   ├── protection.ts                 # ⭐ NEW - Branch protection types
│   │   └── security.ts                   # ⭐ NEW - Security scan types
│   │
│   └── utils/
│       ├── logger.ts                     # Structured logging
│       ├── spinner.ts                    # CLI progress indicators
│       ├── errorClassifier.ts            # ⭐ NEW - Classify CI errors
│       ├── suggestionEngine.ts           # ⭐ NEW - Suggest fixes
│       └── errors.ts                     # Custom error classes
│
├── templates/                             # ⭐ NEW - Workflow templates
│   ├── ci-python.yml
│   ├── ci-nodejs.yml
│   ├── security.yml
│   └── README.md
│
├── tests/
│   ├── unit/
│   │   ├── github.test.ts
│   │   ├── enhanced-ci-poller.test.ts    # ⭐ NEW
│   │   ├── branch-protection.test.ts     # ⭐ NEW
│   │   ├── security-scanner.test.ts      # ⭐ NEW
│   │   └── error-classifier.test.ts      # ⭐ NEW
│   ├── integration/
│   │   ├── ship-workflow.test.ts
│   │   ├── pr-creation.test.ts
│   │   └── error-reporting.test.ts       # ⭐ NEW
│   └── fixtures/
│       ├── pr-templates/
│       ├── mock-responses/
│       └── check-runs/                   # ⭐ NEW - Mock CI responses
│
├── dist/                                  # Compiled JavaScript
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

### Enhanced Workflow (Node.js + SDK + Enhancements)

```typescript
gpm ship
  ├── 1. Preflight Checks (TypeScript)
  │   ├── GitService.getCurrentBranch()
  │   ├── GitService.hasUncommittedChanges()
  │   ├── SecurityScanner.checkForSecrets() ⭐ NEW
  │   ├── SecurityScanner.checkDependencies() ⭐ NEW
  │   ├── GitService.getRemoteUrl()
  │   └── GitHubService.verifyAuth()
  │
  ├── 2. Run verify.sh (Node.js child_process)
  │   └── VerifyService.runChecks() with progress
  │
  ├── 3. Push Branch (simple-git)
  │   └── git.push('origin', branchName)
  │
  ├── 4. Create PR (Octokit SDK)
  │   ├── BranchProtectionChecker.checkRequirements() ⭐ NEW
  │   └── PRService.createPR({ title, body, head, base })
  │
  ├── 5. Wait for CI (Octokit SDK - ASYNC + ENHANCED) ⭐ NEW
  │   └── EnhancedCIPoller.waitForChecks(prNumber)
  │       ├── Poll every 10s with progress updates
  │       ├── Show real-time check status
  │       ├── Parse errors with file:line references
  │       ├── Classify errors (test, lint, type, security)
  │       ├── Suggest fixes automatically
  │       ├── Fail fast on critical errors
  │       ├── Retry on flaky failures
  │       └── Return detailed CheckResult
  │
  ├── 6. Validate Merge Requirements ⭐ NEW
  │   └── BranchProtectionChecker.validatePRReadiness(prNumber)
  │       ├── Check required status checks
  │       ├── Check PR reviews
  │       ├── Check conversation resolution
  │       └── Return ValidationResult
  │
  ├── 7. Merge PR (Octokit SDK)
  │   └── PRService.mergePR(prNumber, 'squash')
  │
  └── 8. Delete Branch (Octokit SDK)
      └── BranchService.deleteBranch(branchName)
```

---

## Command Mapping

### Core Commands (Existing)

| Command                    | Current (Bash) | New (TypeScript)         | Notes               |
| -------------------------- | -------------- | ------------------------ | ------------------- |
| `gpm init`                 | ✅ Bash script | ✅ TypeScript            | Add template option |
| `gpm feature start <name>` | ✅ Bash script | ✅ TypeScript            | Same functionality  |
| `gpm ship`                 | ✅ Bash script | ✅ TypeScript + Enhanced | Major improvements  |
| `gpm status`               | ✅ Bash script | ✅ TypeScript            | Better formatting   |

### New Commands ⭐

| Command                      | Purpose                        | Example                              |
| ---------------------------- | ------------------------------ | ------------------------------------ |
| `gpm checks <pr-number>`     | Show detailed CI check status  | `gpm checks 123`                     |
| `gpm protect [branch]`       | Configure branch protection    | `gpm protect main --preset standard` |
| `gpm security`               | Run pre-commit security checks | `gpm security --secrets --deps`      |
| `gpm init --template <type>` | Initialize with CI template    | `gpm init --template python`         |

### Enhanced Flags

| Flag              | Command      | Purpose                                        |
| ----------------- | ------------ | ---------------------------------------------- |
| `--wait`          | `gpm ship`   | Wait for CI (default: true)                    |
| `--fail-fast`     | `gpm ship`   | Exit on first critical failure (default: true) |
| `--retry-flaky`   | `gpm ship`   | Retry flaky tests (default: false)             |
| `--skip-security` | `gpm ship`   | Skip pre-commit security checks                |
| `--details`       | `gpm checks` | Show full error details with annotations       |
| `--files`         | `gpm checks` | List affected files only                       |

---

## Technical Design

### 1. Enhanced CI Poller ⭐ CORE FEATURE

**Purpose**: Replace blocking `gh pr checks --watch` with intelligent, async polling that provides rich error information.

#### Interface

```typescript
interface CheckRunDetails {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required"
    | null;
  html_url: string;
  details_url: string;
  output: {
    title: string;
    summary: string;
    text: string;
    annotations_count: number;
  };
  started_at: string;
  completed_at: string;
  duration_ms?: number;
}

interface CheckSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;

  // Detailed failure information
  failureDetails: FailureDetail[];

  // Overall status
  overallStatus: "success" | "failure" | "pending";

  // Timing
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

interface FailureDetail {
  checkName: string;
  errorType: ErrorType;
  summary: string;
  affectedFiles: string[];
  annotations: Annotation[];
  suggestedFix: string | null;
  url: string;
}

enum ErrorType {
  TEST_FAILURE = "test_failure",
  LINTING_ERROR = "linting_error",
  TYPE_ERROR = "type_error",
  SECURITY_ISSUE = "security_issue",
  BUILD_ERROR = "build_error",
  FORMAT_ERROR = "format_error",
  UNKNOWN = "unknown",
}

interface Annotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "failure" | "warning" | "notice";
  message: string;
  title: string;
  raw_details?: string;
}
```

#### Implementation

```typescript
// src/services/EnhancedCIPoller.ts

export class EnhancedCIPoller {
  private github: Octokit;
  private owner: string;
  private repo: string;
  private errorClassifier: ErrorClassifier;
  private suggestionEngine: SuggestionEngine;

  constructor(options: PollerOptions) {
    this.github = new Octokit({ auth: options.token });
    this.owner = options.owner;
    this.repo = options.repo;
    this.errorClassifier = new ErrorClassifier();
    this.suggestionEngine = new SuggestionEngine();
  }

  /**
   * Get detailed check status for a PR
   */
  async getDetailedCheckStatus(prNumber: number): Promise<CheckSummary> {
    // Get PR details
    const { data: pr } = await this.github.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    const headSha = pr.head.sha;

    // Get check runs (GitHub Actions, GitHub Apps)
    const { data: checkRuns } = await this.github.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: headSha,
      per_page: 100,
    });

    // Get commit statuses (legacy, external services)
    const { data: commitStatus } =
      await this.github.repos.getCombinedStatusForRef({
        owner: this.owner,
        repo: this.repo,
        ref: headSha,
      });

    return this.parseCheckDetails(checkRuns, commitStatus);
  }

  /**
   * Parse check run details and extract actionable information
   */
  private parseCheckDetails(
    checkRuns: CheckRunsResponse,
    commitStatus: CombinedStatusResponse,
  ): CheckSummary {
    const allChecks = checkRuns.check_runs;
    const failures = allChecks.filter((c) => c.conclusion === "failure");
    const pending = allChecks.filter((c) => c.status !== "completed");

    const failureDetails: FailureDetail[] = failures.map((check) => {
      const errorType = this.errorClassifier.classify(check);
      const affectedFiles = this.extractFiles(check.output?.text || "");
      const suggestedFix = this.suggestionEngine.getSuggestion(
        check,
        errorType,
      );

      return {
        checkName: check.name,
        errorType,
        summary: check.output?.summary || "No summary available",
        affectedFiles,
        annotations: [], // Fetched separately if needed
        suggestedFix,
        url: check.html_url,
      };
    });

    return {
      total: allChecks.length + commitStatus.statuses.length,
      passed: allChecks.filter((c) => c.conclusion === "success").length,
      failed: failures.length,
      pending: pending.length,
      skipped: allChecks.filter((c) => c.conclusion === "skipped").length,
      failureDetails,
      overallStatus:
        failures.length > 0
          ? "failure"
          : pending.length > 0
            ? "pending"
            : "success",
      startedAt: new Date(allChecks[0]?.started_at || Date.now()),
      completedAt: pending.length === 0 ? new Date() : undefined,
      duration: this.calculateDuration(allChecks),
    };
  }

  /**
   * Extract file paths from check output
   */
  private extractFiles(checkOutput: string): string[] {
    const patterns = [
      // pytest: tests/test_auth.py::test_login FAILED
      /([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))::/g,

      // TypeScript: src/components/Button.tsx(45,12): error TS2322
      /([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))\(\d+,\d+\)/g,

      // Python traceback: File "app/models/user.py", line 123
      /File "([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))"/g,

      // ESLint: /path/to/file.js
      /\/([a-zA-Z0-9_\-\/]+\.(py|ts|tsx|js|jsx|go|rs))/g,
    ];

    const files = new Set<string>();
    for (const pattern of patterns) {
      const matches = checkOutput.matchAll(pattern);
      for (const match of matches) {
        files.add(match[1]);
      }
    }

    return Array.from(files);
  }

  /**
   * Fetch annotations for failed checks (detailed error info)
   */
  async getCheckAnnotations(
    checkRunId: number,
    limit = 50,
  ): Promise<Annotation[]> {
    const { data: annotations } = await this.github.checks.listAnnotations({
      owner: this.owner,
      repo: this.repo,
      check_run_id: checkRunId,
      per_page: limit,
    });

    return annotations.map((ann) => ({
      path: ann.path,
      start_line: ann.start_line,
      end_line: ann.end_line,
      annotation_level: ann.annotation_level,
      message: ann.message,
      title: ann.title,
      raw_details: ann.raw_details,
    }));
  }

  /**
   * Wait for CI checks with async polling and progress updates
   */
  async waitForChecks(
    prNumber: number,
    options: WaitOptions = {},
  ): Promise<CheckResult> {
    const {
      timeout = 600000, // 10 minutes
      pollInterval = 10000, // 10 seconds
      onProgress,
      failFast = true,
      retryFlaky = false,
      retryOptions = { maxRetries: 3, retryDelay: 5000 },
    } = options;

    const startTime = Date.now();
    let previousStatus: CheckSummary | null = null;
    let retryCount = 0;

    while (Date.now() - startTime < timeout) {
      const status = await this.getDetailedCheckStatus(prNumber);

      // Report progress if status changed
      if (this.hasStatusChanged(previousStatus, status)) {
        const progress: ProgressUpdate = {
          timestamp: new Date(),
          elapsed: Date.now() - startTime,
          total: status.total,
          passed: status.passed,
          failed: status.failed,
          pending: status.pending,
          newFailures: this.getNewFailures(previousStatus, status),
          newPasses: this.getNewPasses(previousStatus, status),
        };

        onProgress?.(progress);
      }

      // Check for completion
      if (status.pending === 0) {
        const success = status.failed === 0;

        // Handle flaky test retries
        if (!success && retryFlaky && retryCount < retryOptions.maxRetries) {
          const isRetryable = this.isRetryable(status, [
            "timeout",
            "network",
            "flaky",
          ]);

          if (isRetryable) {
            retryCount++;
            console.log(
              `⚠️  Retryable failure detected (attempt ${retryCount}/${retryOptions.maxRetries})`,
            );
            console.log(
              `   Waiting ${retryOptions.retryDelay}ms before retry...`,
            );
            await this.sleep(retryOptions.retryDelay);
            continue;
          }
        }

        return {
          success,
          summary: status,
          duration: Date.now() - startTime,
          retriesUsed: retryCount,
        };
      }

      // Fail fast on critical errors
      if (failFast && this.hasCriticalFailure(status)) {
        return {
          success: false,
          summary: status,
          duration: Date.now() - startTime,
          reason: "critical_failure",
          retriesUsed: retryCount,
        };
      }

      previousStatus = status;
      await this.sleep(pollInterval);
    }

    throw new TimeoutError(`CI checks did not complete within ${timeout}ms`);
  }

  /**
   * Check if failures are retryable (flaky tests, network issues)
   */
  private isRetryable(status: CheckSummary, patterns: string[]): boolean {
    return status.failureDetails.some((failure) =>
      patterns.some((pattern) =>
        failure.summary.toLowerCase().includes(pattern.toLowerCase()),
      ),
    );
  }

  /**
   * Check for critical failures that should trigger fail-fast
   */
  private hasCriticalFailure(status: CheckSummary): boolean {
    return status.failureDetails.some(
      (f) =>
        f.errorType === ErrorType.TEST_FAILURE ||
        f.errorType === ErrorType.BUILD_ERROR ||
        f.errorType === ErrorType.SECURITY_ISSUE,
    );
  }

  /**
   * Detect status changes for progress reporting
   */
  private hasStatusChanged(
    prev: CheckSummary | null,
    current: CheckSummary,
  ): boolean {
    if (!prev) return true;

    return (
      prev.passed !== current.passed ||
      prev.failed !== current.failed ||
      prev.pending !== current.pending
    );
  }

  private getNewFailures(
    prev: CheckSummary | null,
    current: CheckSummary,
  ): string[] {
    if (!prev) return [];

    const prevFailed = new Set(prev.failureDetails.map((f) => f.checkName));
    return current.failureDetails
      .filter((f) => !prevFailed.has(f.checkName))
      .map((f) => f.checkName);
  }

  private getNewPasses(
    prev: CheckSummary | null,
    current: CheckSummary,
  ): string[] {
    if (!prev) return [];

    const prevFailed = new Set(prev.failureDetails.map((f) => f.checkName));
    const currentFailed = new Set(
      current.failureDetails.map((f) => f.checkName),
    );

    return Array.from(prevFailed).filter((name) => !currentFailed.has(name));
  }

  private calculateDuration(checks: CheckRun[]): number | undefined {
    const completed = checks.filter((c) => c.completed_at);
    if (completed.length === 0) return undefined;

    const durations = completed.map(
      (c) =>
        new Date(c.completed_at!).getTime() - new Date(c.started_at).getTime(),
    );

    return Math.max(...durations);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

#### Error Classifier

```typescript
// src/utils/errorClassifier.ts

export class ErrorClassifier {
  /**
   * Classify error type based on check run details
   */
  classify(check: CheckRun): ErrorType {
    const name = check.name.toLowerCase();
    const summary = (check.output?.summary || "").toLowerCase();
    const title = (check.output?.title || "").toLowerCase();

    // Test failures
    if (this.isTestFailure(name, summary, title)) {
      return ErrorType.TEST_FAILURE;
    }

    // Linting errors
    if (this.isLintingError(name, summary, title)) {
      return ErrorType.LINTING_ERROR;
    }

    // Type errors
    if (this.isTypeError(name, summary, title)) {
      return ErrorType.TYPE_ERROR;
    }

    // Security issues
    if (this.isSecurityIssue(name, summary, title)) {
      return ErrorType.SECURITY_ISSUE;
    }

    // Build errors
    if (this.isBuildError(name, summary, title)) {
      return ErrorType.BUILD_ERROR;
    }

    // Format errors
    if (this.isFormatError(name, summary, title)) {
      return ErrorType.FORMAT_ERROR;
    }

    return ErrorType.UNKNOWN;
  }

  private isTestFailure(name: string, summary: string, title: string): boolean {
    const keywords = ["test", "spec", "pytest", "jest", "mocha", "unittest"];
    return keywords.some(
      (kw) => name.includes(kw) || summary.includes(kw) || title.includes(kw),
    );
  }

  private isLintingError(
    name: string,
    summary: string,
    title: string,
  ): boolean {
    const keywords = ["lint", "eslint", "pylint", "flake8", "ruff"];
    return keywords.some(
      (kw) => name.includes(kw) || summary.includes(kw) || title.includes(kw),
    );
  }

  private isTypeError(name: string, summary: string, title: string): boolean {
    const keywords = ["type", "typecheck", "mypy", "typescript", "tsc"];
    return keywords.some(
      (kw) => name.includes(kw) || summary.includes(kw) || title.includes(kw),
    );
  }

  private isSecurityIssue(
    name: string,
    summary: string,
    title: string,
  ): boolean {
    const keywords = ["security", "codeql", "secret", "vuln", "dependency"];
    return keywords.some(
      (kw) => name.includes(kw) || summary.includes(kw) || title.includes(kw),
    );
  }

  private isBuildError(name: string, summary: string, title: string): boolean {
    const keywords = ["build", "compile", "webpack", "tsc", "babel"];
    return keywords.some(
      (kw) => name.includes(kw) || summary.includes(kw) || title.includes(kw),
    );
  }

  private isFormatError(name: string, summary: string, title: string): boolean {
    const keywords = ["format", "prettier", "black", "autopep8"];
    return keywords.some(
      (kw) => name.includes(kw) || summary.includes(kw) || title.includes(kw),
    );
  }
}
```

#### Suggestion Engine

```typescript
// src/utils/suggestionEngine.ts

export class SuggestionEngine {
  /**
   * Get suggested fix for a failed check
   */
  getSuggestion(check: CheckRun, errorType: ErrorType): string | null {
    const summary = check.output?.summary || "";
    const files = this.extractFiles(summary);

    switch (errorType) {
      case ErrorType.TEST_FAILURE:
        if (files.length > 0) {
          return `pytest ${files.join(" ")} -v`;
        }
        return "npm test -- --verbose";

      case ErrorType.LINTING_ERROR:
        return "npm run lint -- --fix";

      case ErrorType.TYPE_ERROR:
        return "npm run typecheck";

      case ErrorType.FORMAT_ERROR:
        return "npm run format";

      case ErrorType.BUILD_ERROR:
        return "npm run build";

      case ErrorType.SECURITY_ISSUE:
        if (summary.includes("secret")) {
          return "Review and remove secrets from code";
        } else if (
          summary.includes("dependency") ||
          summary.includes("vulnerability")
        ) {
          return "npm audit fix";
        } else if (summary.includes("codeql")) {
          return "Review CodeQL findings at check details URL";
        }
        return "Review security scan findings";

      default:
        return null;
    }
  }

  private extractFiles(summary: string): string[] {
    // Similar to EnhancedCIPoller.extractFiles()
    const patterns = [
      /([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))::/g,
      /([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))\(\d+,\d+\)/g,
      /File "([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))"/g,
    ];

    const files = new Set<string>();
    for (const pattern of patterns) {
      const matches = summary.matchAll(pattern);
      for (const match of matches) {
        files.add(match[1]);
      }
    }

    return Array.from(files);
  }
}
```

#### Output Formatter

```typescript
// src/utils/outputFormatter.ts

export class OutputFormatter {
  /**
   * Format check summary for Claude Code CLI
   */
  formatCheckSummary(summary: CheckSummary): string {
    const lines: string[] = [];

    // Header
    if (summary.overallStatus === "success") {
      lines.push("✅ All CI Checks Passed!");
    } else if (summary.overallStatus === "pending") {
      lines.push("⏳ CI Checks In Progress...");
    } else {
      lines.push(`🔴 CI Checks Failed (${summary.failed}/${summary.total})`);
    }

    lines.push("");

    // Critical failures (if any)
    if (summary.failureDetails.length > 0) {
      lines.push("Critical Failures:");
      for (const failure of summary.failureDetails) {
        lines.push(
          `  ${this.getErrorIcon(failure.errorType)} ${failure.checkName} (${failure.errorType})`,
        );
        lines.push(`     Summary: ${failure.summary}`);

        if (failure.affectedFiles.length > 0) {
          lines.push(`     Files affected:`);
          for (const file of failure.affectedFiles.slice(0, 5)) {
            lines.push(`       - ${file}`);
          }
          if (failure.affectedFiles.length > 5) {
            lines.push(
              `       ... and ${failure.affectedFiles.length - 5} more`,
            );
          }
        }

        if (failure.suggestedFix) {
          lines.push(`     Suggested fix: ${failure.suggestedFix}`);
        }

        lines.push(`     Details: ${failure.url}`);
        lines.push("");
      }
    }

    // Passed checks
    const passedCount = summary.passed;
    if (passedCount > 0) {
      lines.push(`Passed (${passedCount}):`);
      lines.push(`  ✅ ${passedCount} check(s) passed`);
      lines.push("");
    }

    // Pending checks
    if (summary.pending > 0) {
      lines.push(`Pending (${summary.pending}):`);
      lines.push(`  ⏳ ${summary.pending} check(s) in progress`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Format progress update
   */
  formatProgress(progress: ProgressUpdate): string {
    const elapsed = Math.floor(progress.elapsed / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    const lines: string[] = [];
    lines.push(
      `[${timeStr}] ${progress.passed + progress.failed}/${progress.total} checks completed`,
    );

    if (progress.newPasses.length > 0) {
      for (const name of progress.newPasses) {
        lines.push(`  ✅ ${name}`);
      }
    }

    if (progress.newFailures.length > 0) {
      for (const name of progress.newFailures) {
        lines.push(`  ❌ ${name}`);
      }
    }

    if (progress.pending > 0) {
      lines.push(`  ⏳ ${progress.pending} in progress...`);
    }

    return lines.join("\n");
  }

  private getErrorIcon(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.TEST_FAILURE:
        return "🧪";
      case ErrorType.LINTING_ERROR:
        return "📝";
      case ErrorType.TYPE_ERROR:
        return "🔤";
      case ErrorType.SECURITY_ISSUE:
        return "🔒";
      case ErrorType.BUILD_ERROR:
        return "🔨";
      case ErrorType.FORMAT_ERROR:
        return "✨";
      default:
        return "❌";
    }
  }
}
```

### 2. Branch Protection Checker ⭐ NEW FEATURE

**Purpose**: Validate branch protection requirements before attempting PR merge.

```typescript
// src/services/BranchProtectionChecker.ts

export class BranchProtectionChecker {
  private github: Octokit;
  private owner: string;
  private repo: string;

  /**
   * Get branch protection configuration
   */
  async getProtection(branch: string = "main"): Promise<ProtectionStatus> {
    try {
      const { data: protection } = await this.github.repos.getBranchProtection({
        owner: this.owner,
        repo: this.repo,
        branch,
      });

      return {
        enabled: true,
        requiredStatusChecks: protection.required_status_checks?.contexts || [],
        strictChecks: protection.required_status_checks?.strict || false,
        requiredReviews:
          protection.required_pull_request_reviews
            ?.required_approving_review_count || 0,
        dismissStaleReviews:
          protection.required_pull_request_reviews?.dismiss_stale_reviews ||
          false,
        requireCodeOwnerReviews:
          protection.required_pull_request_reviews
            ?.require_code_owner_reviews || false,
        enforceAdmins: protection.enforce_admins?.enabled || false,
        requireConversationResolution:
          protection.required_conversation_resolution?.enabled || false,
        requireLinearHistory:
          protection.required_linear_history?.enabled || false,
        allowForcePushes: protection.allow_force_pushes?.enabled || false,
        allowDeletions: protection.allow_deletions?.enabled || false,
      };
    } catch (error) {
      if (error.status === 404) {
        return { enabled: false };
      }
      throw error;
    }
  }

  /**
   * Validate PR readiness for merge
   */
  async validatePRReadiness(prNumber: number): Promise<ValidationResult> {
    const { data: pr } = await this.github.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    const protection = await this.getProtection(pr.base.ref);

    if (!protection.enabled) {
      return {
        ready: true,
        warnings: ["No branch protection configured - consider enabling it"],
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check required status checks
    if (protection.requiredStatusChecks.length > 0) {
      const checkStatus = await this.getCheckStatus(pr.head.sha);

      const missingChecks = protection.requiredStatusChecks.filter(
        (required) =>
          !checkStatus.allChecks.some(
            (check) => check.name === required || check.context === required,
          ),
      );

      if (missingChecks.length > 0) {
        issues.push(`Missing required checks: ${missingChecks.join(", ")}`);
      }

      const failedRequiredChecks = protection.requiredStatusChecks.filter(
        (required) =>
          checkStatus.failedChecks.some(
            (f) => f.name === required || f.context === required,
          ),
      );

      if (failedRequiredChecks.length > 0) {
        issues.push(
          `Failed required checks: ${failedRequiredChecks.join(", ")}`,
        );
      }

      // Warn if strict checks enabled and branch is out of date
      if (protection.strictChecks) {
        const { data: comparison } = await this.github.repos.compareCommits({
          owner: this.owner,
          repo: this.repo,
          base: pr.base.sha,
          head: pr.head.sha,
        });

        if (comparison.behind_by > 0) {
          warnings.push(
            `Branch is ${comparison.behind_by} commit(s) behind base - strict checks require update`,
          );
        }
      }
    }

    // Check PR reviews
    if (protection.requiredReviews > 0) {
      const { data: reviews } = await this.github.pulls.listReviews({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      const latestReviews = this.getLatestReviews(reviews);
      const approvals = latestReviews.filter(
        (r) => r.state === "APPROVED",
      ).length;

      if (approvals < protection.requiredReviews) {
        issues.push(
          `Need ${protection.requiredReviews - approvals} more approval(s)`,
        );
      }

      // Check for requested changes
      const changesRequested = latestReviews.filter(
        (r) => r.state === "CHANGES_REQUESTED",
      ).length;
      if (changesRequested > 0) {
        issues.push(`${changesRequested} reviewer(s) requested changes`);
      }
    }

    // Check conversation resolution
    if (protection.requireConversationResolution) {
      const { data: comments } = await this.github.issues.listComments({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
      });

      const { data: reviewComments } =
        await this.github.pulls.listReviewComments({
          owner: this.owner,
          repo: this.repo,
          pull_number: prNumber,
        });

      // Count unresolved threads (heuristic: comments without "resolved" or checkmark)
      const unresolvedIssueComments = comments.filter(
        (c) =>
          !c.body?.includes("✓") && !c.body?.toLowerCase().includes("resolved"),
      );

      const unresolvedReviewComments = reviewComments.filter(
        (c) =>
          !c.body?.includes("✓") && !c.body?.toLowerCase().includes("resolved"),
      );

      const totalUnresolved =
        unresolvedIssueComments.length + unresolvedReviewComments.length;

      if (totalUnresolved > 0) {
        warnings.push(
          `Possibly ${totalUnresolved} unresolved conversation(s) - verify manually`,
        );
      }
    }

    return {
      ready: issues.length === 0,
      issues,
      warnings,
      protection,
    };
  }

  /**
   * Auto-configure branch protection
   */
  async setupProtection(
    branch: string = "main",
    preset: "basic" | "standard" | "strict" = "standard",
  ): Promise<void> {
    const configs = {
      basic: {
        required_status_checks: null,
        enforce_admins: false,
        required_pull_request_reviews: null,
        restrictions: null,
        required_conversation_resolution: false,
      },
      standard: {
        required_status_checks: {
          strict: true,
          contexts: ["ci", "security"],
        },
        enforce_admins: false,
        required_pull_request_reviews: {
          required_approving_review_count: 0,
          dismiss_stale_reviews: true,
          require_code_owner_reviews: false,
        },
        restrictions: null,
        required_conversation_resolution: true,
        required_linear_history: false,
        allow_force_pushes: false,
        allow_deletions: false,
      },
      strict: {
        required_status_checks: {
          strict: true,
          contexts: ["ci", "security", "tests", "lint"],
        },
        enforce_admins: true,
        required_pull_request_reviews: {
          required_approving_review_count: 1,
          dismiss_stale_reviews: true,
          require_code_owner_reviews: true,
        },
        restrictions: null,
        required_conversation_resolution: true,
        required_linear_history: true,
        allow_force_pushes: false,
        allow_deletions: false,
      },
    };

    await this.github.repos.updateBranchProtection({
      owner: this.owner,
      repo: this.repo,
      branch,
      ...configs[preset],
    });
  }

  private getLatestReviews(reviews: Review[]): Review[] {
    // Group by user, keep only latest review from each user
    const reviewsByUser = new Map<number, Review>();

    for (const review of reviews.sort(
      (a, b) =>
        new Date(b.submitted_at!).getTime() -
        new Date(a.submitted_at!).getTime(),
    )) {
      if (!reviewsByUser.has(review.user!.id)) {
        reviewsByUser.set(review.user!.id, review);
      }
    }

    return Array.from(reviewsByUser.values());
  }

  private async getCheckStatus(sha: string) {
    const { data: checkRuns } = await this.github.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: sha,
    });

    const { data: commitStatus } =
      await this.github.repos.getCombinedStatusForRef({
        owner: this.owner,
        repo: this.repo,
        ref: sha,
      });

    const allChecks = [
      ...checkRuns.check_runs.map((c) => ({
        name: c.name,
        status: c.conclusion,
      })),
      ...commitStatus.statuses.map((s) => ({
        context: s.context,
        status: s.state,
      })),
    ];

    const failedChecks = allChecks.filter(
      (c) => c.status === "failure" || c.status === "error",
    );

    return { allChecks, failedChecks };
  }
}
```

### 3. Security Scanner ⭐ NEW FEATURE

**Purpose**: Pre-commit security checks (secrets, vulnerabilities).

```typescript
// src/services/SecurityScanner.ts

export class SecurityScanner {
  /**
   * Scan for secrets in uncommitted changes
   */
  async scanForSecrets(): Promise<SecretScanResult> {
    try {
      // Use detect-secrets or TruffleHog
      const result = await execAsync(
        "detect-secrets scan --baseline .secrets.baseline",
      );

      if (result.exitCode !== 0) {
        const secrets = this.parseSecrets(result.stdout);
        return {
          found: true,
          secrets,
          blocked: true,
        };
      }

      return { found: false, secrets: [] };
    } catch (error) {
      console.warn("Secret scanning not available - install detect-secrets");
      return { found: false, secrets: [], skipped: true };
    }
  }

  /**
   * Check for dependency vulnerabilities
   */
  async checkDependencies(): Promise<VulnerabilityResult> {
    try {
      // Detect language and use appropriate tool
      const language = await this.detectLanguage();

      let result;
      if (language === "python") {
        result = await execAsync("pip-audit --format json");
      } else if (language === "node") {
        result = await execAsync("npm audit --json");
      } else {
        return { skipped: true, reason: "Unsupported language" };
      }

      const vulns = JSON.parse(result.stdout);
      const critical = this.filterCritical(vulns);

      return {
        total: vulns.length,
        critical: critical.length,
        high: this.filterHigh(vulns).length,
        medium: this.filterMedium(vulns).length,
        low: this.filterLow(vulns).length,
        shouldBlock: critical.length > 0,
        vulnerabilities: critical,
      };
    } catch (error) {
      console.warn("Dependency scanning not available");
      return { skipped: true, reason: "Tool not installed" };
    }
  }

  private async detectLanguage(): Promise<"python" | "node" | "unknown"> {
    if (
      (await fs.pathExists("requirements.txt")) ||
      (await fs.pathExists("setup.py"))
    ) {
      return "python";
    } else if (await fs.pathExists("package.json")) {
      return "node";
    }
    return "unknown";
  }

  private parseSecrets(output: string): SecretFinding[] {
    // Parse detect-secrets output
    // Format: filename:line: potential secret found
    const lines = output.split("\n");
    const secrets: SecretFinding[] = [];

    for (const line of lines) {
      const match = line.match(/^([^:]+):(\d+): (.+)$/);
      if (match) {
        secrets.push({
          file: match[1],
          line: parseInt(match[2]),
          type: match[3],
        });
      }
    }

    return secrets;
  }

  private filterCritical(vulns: any[]): Vulnerability[] {
    return vulns
      .filter((v) => v.severity === "critical" || v.severity === "CRITICAL")
      .map((v) => ({
        package: v.package || v.name,
        version: v.version,
        severity: "critical",
        cve: v.cve || v.id,
        description: v.description || v.title,
      }));
  }

  private filterHigh(vulns: any[]): Vulnerability[] {
    return vulns.filter((v) => v.severity === "high" || v.severity === "HIGH");
  }

  private filterMedium(vulns: any[]): Vulnerability[] {
    return vulns.filter(
      (v) => v.severity === "medium" || v.severity === "MEDIUM",
    );
  }

  private filterLow(vulns: any[]): Vulnerability[] {
    return vulns.filter((v) => v.severity === "low" || v.severity === "LOW");
  }
}
```

---

## Enhanced Features

### 1. Rich Error Output Example

**Before** (bash + gh CLI):

```
$ gpm ship
✓ Verified locally
✗ CI checks failed
Error: Some checks were not successful
```

**After** (Node.js + Octokit SDK):

```
$ gpm ship

🔄 Running pre-commit checks...
  ✅ No secrets detected
  ✅ No critical vulnerabilities
  ✅ Safe to push

✅ Verified locally (lint, typecheck, test, build)

🚀 Pushing branch feature/add-auth...
  ✅ Pushed to origin

📝 Creating pull request...
  ✅ PR #123 created: https://github.com/littlebearapps/repo/pull/123

🔄 Waiting for CI checks...

[00:15] ⏳ 8/10 checks completed
  ✅ Linting (2s)
  ✅ Type Check (5s)
  ✅ Format Check (1s)
  ✅ Secret Scanning (8s)
  ✅ Build (12s)
  ✅ Integration Tests (89s)
  ⏳ Unit Tests (in progress...)
  ⏳ Security Scan (in progress...)

[00:45] ❌ FAILURE DETECTED - Stopping early

🔴 CI Checks Failed (1/10)

Critical Failures:
  🧪 Unit Tests (test_failure)
     Summary: 3 tests failed in 2 files
     Files affected:
       - tests/test_auth.py
       - tests/test_api.py
     Suggested fix: pytest tests/test_auth.py tests/test_api.py -v
     Details: https://github.com/littlebearapps/repo/runs/123456

Detailed Errors:

tests/test_auth.py:45
  ❌ FAILURE: test_login_with_invalid_credentials
  Message: AssertionError: Expected 401, got 200

tests/test_auth.py:78
  ❌ FAILURE: test_token_expiration
  Message: Test timed out after 30 seconds

tests/test_api.py:123
  ❌ FAILURE: test_rate_limiting
  Message: AssertionError: Expected 429, got 200

Passed (7):
  ✅ Linting
  ✅ Type Check
  ✅ Format Check
  ✅ Secret Scanning
  ✅ Build
  ✅ Integration Tests
  ✅ Security Scan

❌ Ship failed - fix errors and try again

Quick Actions:
  → Run failing tests: pytest tests/test_auth.py tests/test_api.py -v
  → View full details: gpm checks 123 --details
  → Open in GitHub: open https://github.com/littlebearapps/repo/pull/123
```

### 2. Progress Updates During CI Wait

```
[00:00] ⏳ CI checks starting...
[00:05] ⏳ 2/10 checks completed
  ✅ Linting
  ✅ Format Check
[00:15] ⏳ 5/10 checks completed
  ✅ Type Check
  ✅ Secret Scanning
  ✅ Build
[00:45] ⏳ 8/10 checks completed
  ✅ Integration Tests
  ✅ Security Scan
  ⏳ Unit Tests (in progress...)
[01:05] ❌ 1 check failed
  ❌ Unit Tests
```

### 3. Branch Protection Validation

```
$ gpm ship

🔍 Checking PR readiness...

Branch Protection (main):
  ✅ Enabled
  ✅ Required checks: ci, security
  ✅ Strict status checks: Yes
  ⚠️  PR reviews required: 0 (consider adding)
  ✅ Conversation resolution required

PR Status:
  ✅ All required checks passed
  ✅ No unresolved conversations
  ✅ Ready to merge!

🎉 Merging PR #123...
  ✅ Merged successfully
  ✅ Branch deleted
```

### 4. Pre-Commit Security Checks

```
$ gpm ship

🔒 Running pre-commit security checks...

Secret Scanning:
  ✅ No secrets detected

Dependency Vulnerabilities:
  ✅ No critical vulnerabilities
  ⚠️  2 high severity issues found
      - requests 2.25.0 (CVE-2023-32681)
      - urllib3 1.26.0 (CVE-2023-43804)

  Suggested fix: pip install --upgrade requests urllib3

Continue anyway? [y/N]:
```

---

## Error Handling Strategy

### Custom Error Classes

```typescript
// src/utils/errors.ts

export class GitWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitWorkflowError";
  }
}

export class CIFailureError extends GitWorkflowError {
  constructor(
    public checkSummary: CheckSummary,
    message = "CI checks failed",
  ) {
    super(message);
    this.name = "CIFailureError";
  }
}

export class BranchProtectionError extends GitWorkflowError {
  constructor(
    public validation: ValidationResult,
    message = "Branch protection requirements not met",
  ) {
    super(message);
    this.name = "BranchProtectionError";
  }
}

export class SecurityScanError extends GitWorkflowError {
  constructor(
    public scanResult: SecretScanResult | VulnerabilityResult,
    message = "Security scan failed",
  ) {
    super(message);
    this.name = "SecurityScanError";
  }
}

export class TimeoutError extends GitWorkflowError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class PRExistsError extends GitWorkflowError {
  constructor(
    public existingPR: number,
    message = "Pull request already exists",
  ) {
    super(message);
    this.name = "PRExistsError";
  }
}

export class MergeConflictError extends GitWorkflowError {
  constructor(message = "Merge conflicts detected") {
    super(message);
    this.name = "MergeConflictError";
  }
}
```

### Error Recovery

```typescript
// In ship command

try {
  // ... workflow steps
  const result = await ciPoller.waitForChecks(prNumber, {
    failFast: true,
    retryFlaky: true,
  });

  if (!result.success) {
    throw new CIFailureError(result.summary);
  }
} catch (error) {
  if (error instanceof CIFailureError) {
    // Show rich error output
    console.error(formatter.formatCheckSummary(error.checkSummary));
    console.error("\n❌ Ship failed - fix errors and try again");
    console.error("\nQuick Actions:");

    for (const failure of error.checkSummary.failureDetails) {
      if (failure.suggestedFix) {
        console.error(`  → ${failure.suggestedFix}`);
      }
    }

    process.exit(1);
  } else if (error instanceof BranchProtectionError) {
    console.error("❌ Cannot merge - branch protection requirements not met");
    console.error("\nIssues:");
    for (const issue of error.validation.issues) {
      console.error(`  - ${issue}`);
    }
    process.exit(1);
  } else if (error instanceof SecurityScanError) {
    console.error("🔒 Security scan failed");
    // ... show details
    process.exit(1);
  } else if (error instanceof TimeoutError) {
    console.error("⏱️  CI checks timed out");
    console.error("Check status: gpm checks <pr-number>");
    process.exit(1);
  } else {
    // Unknown error
    throw error;
  }
}
```

---

## Implementation Phases

### Phase 1: Core SDK Infrastructure + Enhanced Error Reporting (Week 1)

**Goal**: Replace bash with Node.js/TypeScript, implement rich CI error reporting.

#### Tasks

1. **Project Setup** (4 hours)
   - [ ] Initialize TypeScript project with proper tsconfig.json
   - [ ] Install dependencies: @octokit/rest, simple-git, commander, chalk, ora
   - [ ] Set up Jest testing framework
   - [ ] Create project structure (src/, tests/, dist/)
   - [ ] Configure build pipeline (TypeScript → JavaScript)

2. **Core Services** (8 hours)
   - [ ] Implement GitHubService.ts (Octokit wrapper)
     - Authentication
     - Basic PR operations (get, create, merge)
     - Repository info
   - [ ] Implement GitService.ts (simple-git wrapper)
     - Current branch
     - Uncommitted changes check
     - Push/pull operations
   - [ ] Implement ConfigService.ts (.gpm.yml management)

3. **Enhanced CI Poller** (12 hours) ⭐ **PRIORITY**
   - [ ] Create EnhancedCIPoller.ts
     - getDetailedCheckStatus()
     - waitForChecks() with async polling
     - parseCheckDetails()
     - extractFiles()
     - getCheckAnnotations()
   - [ ] Create ErrorClassifier.ts
     - classify() method
     - Pattern matching for different error types
   - [ ] Create SuggestionEngine.ts
     - getSuggestion() method
     - Context-aware fix recommendations
   - [ ] Create OutputFormatter.ts
     - formatCheckSummary()
     - formatProgress()
     - formatAnnotations()

4. **CLI Framework** (4 hours)
   - [ ] Set up Commander.js for command routing
   - [ ] Create logger utility (structured logging)
   - [ ] Create spinner utility (progress indicators)
   - [ ] Add error handling middleware

**Deliverables**:

- ✅ Working TypeScript project
- ✅ Core services (GitHub, Git, Config)
- ✅ EnhancedCIPoller with rich error reporting
- ✅ Error classifier and suggestion engine
- ✅ CLI framework

**Testing**:

- Unit tests for EnhancedCIPoller (mock with Nock)
- Unit tests for ErrorClassifier
- Unit tests for SuggestionEngine
- Integration test: Fetch real check run from test PR

**Success Criteria**:

- Can fetch detailed check status from a PR
- Can classify error types correctly (90%+ accuracy)
- Can extract file paths from check outputs
- Can generate suggested fixes

---

### Phase 2: PR Automation + Intelligent CI Polling (Week 2)

**Goal**: Implement PR creation/merge with intelligent CI polling.

#### Tasks

1. **PR Service** (6 hours)
   - [ ] Create PRService.ts
     - createPR() with template support
     - mergePR() with validation
     - getPR() details
     - listPRs()
   - [ ] Create PRTemplateService.ts
     - discoverTemplate()
     - mergeTemplateWithData()
     - Support .github/PULL_REQUEST_TEMPLATE/

2. **CI Polling Enhancements** (10 hours) ⭐ **PRIORITY**
   - [ ] Add progress callback to waitForChecks()
   - [ ] Implement fail-fast logic for critical errors
   - [ ] Add retry logic for flaky tests
   - [ ] Implement timeout handling
   - [ ] Add status change detection (newFailures, newPasses)
   - [ ] Test with real PRs from auditor-toolkit, wp-navigator-pro

3. **Verify Service** (4 hours)
   - [ ] Create VerifyService.ts
     - runChecks() with progress
     - Run verify.sh or package.json scripts
     - Parse output for errors
     - Show real-time progress

4. **Ship Command** (8 hours)
   - [ ] Implement `gpm ship` command
     - Preflight checks
     - Run verify.sh
     - Push branch
     - Create PR
     - Wait for CI (with EnhancedCIPoller)
     - Merge PR
     - Delete branch
   - [ ] Add flags: --wait, --fail-fast, --retry-flaky
   - [ ] Add error recovery

**Deliverables**:

- ✅ Complete `gpm ship` command
- ✅ PR creation with templates
- ✅ Intelligent CI polling with progress
- ✅ Fail-fast and retry logic

**Testing**:

- Integration test: Full ship workflow (create PR → wait CI → merge)
- Test with auditor-toolkit repo (Python, pytest)
- Test with wp-navigator-pro repo (Node.js, Jest)
- Mock flaky tests to verify retry logic

**Success Criteria**:

- Can create PR from feature branch
- Can poll CI with real-time progress updates
- Can detect and classify CI failures
- Can suggest fixes automatically
- Can fail fast on critical errors
- Can retry flaky tests

---

### Phase 3: Branch Protection + Security Integration (Week 3)

**Goal**: Add branch protection validation and pre-commit security checks.

#### Tasks

1. **Branch Protection Checker** (8 hours) ⭐ **NEW FEATURE**
   - [ ] Create BranchProtectionChecker.ts
     - getProtection()
     - validatePRReadiness()
     - setupProtection() (auto-configure)
   - [ ] Integrate into `gpm ship` (pre-flight + pre-merge)
   - [ ] Add `gpm protect` command
     - Configure protection with presets (basic, standard, strict)
     - Based on org best practices from audit

2. **Security Scanner** (10 hours) ⭐ **NEW FEATURE**
   - [ ] Create SecurityScanner.ts
     - scanForSecrets() (detect-secrets or TruffleHog)
     - checkDependencies() (pip-audit, npm audit)
   - [ ] Integrate into `gpm ship` (pre-commit)
   - [ ] Add `gpm security` command
     - Run security checks manually
     - Show detailed results
   - [ ] Add configurable thresholds (.gpm.yml)

3. **Checks Command** (4 hours) ⭐ **NEW FEATURE**
   - [ ] Implement `gpm checks <pr-number>` command
     - Show detailed check status
     - Show annotations with --details flag
     - Show affected files with --files flag
   - [ ] Use EnhancedCIPoller for data
   - [ ] Use OutputFormatter for display

4. **Additional Commands** (6 hours)
   - [ ] Implement `gpm feature start <name>`
   - [ ] Implement `gpm status`
   - [ ] Implement `gpm init` (with --template flag)

**Deliverables**:

- ✅ Branch protection integration
- ✅ Pre-commit security scanning
- ✅ `gpm checks` command
- ✅ `gpm protect` command
- ✅ `gpm security` command
- ✅ All core commands implemented

**Testing**:

- Test branch protection validation with protected repos
- Test security scanner with known secrets (test files)
- Test dependency scanning with vulnerable packages
- Integration test: Full workflow with all features

**Success Criteria**:

- Can validate branch protection requirements
- Can detect secrets before commit
- Can check dependency vulnerabilities
- Can show rich check status
- Can auto-configure branch protection

---

### Phase 4: Testing + Documentation + Workflow Templates (Week 4)

**Goal**: Comprehensive testing, documentation, and workflow templates.

#### Tasks

1. **Unit Tests** (8 hours)
   - [ ] Test all services (GitHub, Git, Config, PR, Verify)
   - [ ] Test EnhancedCIPoller thoroughly
   - [ ] Test ErrorClassifier with various check outputs
   - [ ] Test SuggestionEngine
   - [ ] Test BranchProtectionChecker
   - [ ] Test SecurityScanner
   - [ ] Achieve 80%+ code coverage

2. **Integration Tests** (6 hours)
   - [ ] Test full `gpm ship` workflow
   - [ ] Test with auditor-toolkit (Python)
   - [ ] Test with wp-navigator-pro (Node.js/PHP)
   - [ ] Test error scenarios (CI failures, merge conflicts, etc.)
   - [ ] Test security scanning (secrets, vulnerabilities)

3. **Documentation** (4 hours)
   - [ ] Update README.md
     - Installation instructions
     - Quick start guide
     - Command reference
     - Configuration options
   - [ ] Create MIGRATION.md
     - How to migrate from v0.3.0 to v1.0.0
     - Breaking changes
     - New features
   - [ ] Update SUBAGENT_PROMPT.md
     - New commands and flags
     - Enhanced error reporting
     - Security features

4. **Workflow Templates** (6 hours) ⭐ **NEW FEATURE**
   - [ ] Create `templates/` directory
   - [ ] Create ci-python.yml (based on auditor-toolkit)
   - [ ] Create ci-nodejs.yml (based on wp-navigator-pro)
   - [ ] Create security.yml (based on org audit)
   - [ ] Add `gpm init --template <type>` support
   - [ ] Document templates in templates/README.md

5. **Polish** (4 hours)
   - [ ] Improve CLI output formatting
   - [ ] Add colors and emojis for better UX
   - [ ] Add help text for all commands
   - [ ] Add examples in --help output
   - [ ] Performance optimization

**Deliverables**:

- ✅ 80%+ test coverage
- ✅ Complete documentation
- ✅ Workflow templates
- ✅ Polished CLI experience

**Testing**:

- Run full test suite
- Test on multiple repos
- Test with different CI configurations
- Validate templates work as expected

**Success Criteria**:

- All tests pass
- Documentation is clear and complete
- Templates are production-ready
- CLI is polished and user-friendly

---

### Phase 5: Rollout + Bug Fixes (Week 5)

**Goal**: Deploy to production, gather feedback, fix issues.

#### Tasks

1. **Deploy to auditor-toolkit** (2 hours)
   - [ ] Install v1.0.0
   - [ ] Test full workflow
   - [ ] Monitor for issues
   - [ ] Gather feedback

2. **Deploy to wp-navigator-pro** (2 hours)
   - [ ] Install v1.0.0
   - [ ] Test full workflow
   - [ ] Compare with auditor-toolkit experience
   - [ ] Document any repo-specific issues

3. **Deploy to remaining repos** (3 hours)
   - [ ] Brand Copilot
   - [ ] Platform
   - [ ] Other active repos
   - [ ] Document patterns and issues

4. **Bug Fixes** (8 hours)
   - [ ] Address issues found during rollout
   - [ ] Fix edge cases
   - [ ] Improve error messages based on real usage
   - [ ] Performance tuning

**Deliverables**:

- ✅ Deployed to all repos
- ✅ Issues resolved
- ✅ v1.0.0 stable

**Success Criteria**:

- No critical bugs
- Positive feedback from usage
- 50-75% reduction in PR/merge time
- 80-90% reduction in debugging time

---

## Testing Strategy

### Unit Tests

**Coverage Goal**: 80%+

**Test Files**:

- `tests/unit/github.test.ts`
- `tests/unit/enhanced-ci-poller.test.ts` ⭐
- `tests/unit/error-classifier.test.ts` ⭐
- `tests/unit/suggestion-engine.test.ts` ⭐
- `tests/unit/branch-protection.test.ts` ⭐
- `tests/unit/security-scanner.test.ts` ⭐
- `tests/unit/pr-template.test.ts`

**Example Test** (EnhancedCIPoller):

```typescript
// tests/unit/enhanced-ci-poller.test.ts

import { EnhancedCIPoller } from "../../src/services/EnhancedCIPoller";
import { mockCheckRuns, mockCombinedStatus } from "../fixtures/check-runs";
import nock from "nock";

describe("EnhancedCIPoller", () => {
  let poller: EnhancedCIPoller;

  beforeEach(() => {
    poller = new EnhancedCIPoller({
      token: "test-token",
      owner: "littlebearapps",
      repo: "test-repo",
    });
  });

  describe("getDetailedCheckStatus", () => {
    it("should parse check runs and extract failure details", async () => {
      // Mock PR API
      nock("https://api.github.com")
        .get("/repos/littlebearapps/test-repo/pulls/123")
        .reply(200, { head: { sha: "abc123" } });

      // Mock check runs API
      nock("https://api.github.com")
        .get("/repos/littlebearapps/test-repo/commits/abc123/check-runs")
        .reply(200, mockCheckRuns);

      // Mock combined status API
      nock("https://api.github.com")
        .get("/repos/littlebearapps/test-repo/commits/abc123/status")
        .reply(200, mockCombinedStatus);

      const summary = await poller.getDetailedCheckStatus(123);

      expect(summary.total).toBe(10);
      expect(summary.passed).toBe(7);
      expect(summary.failed).toBe(1);
      expect(summary.pending).toBe(2);
      expect(summary.failureDetails).toHaveLength(1);
      expect(summary.failureDetails[0].errorType).toBe("test_failure");
      expect(summary.failureDetails[0].affectedFiles).toContain(
        "tests/test_auth.py",
      );
    });

    it("should classify error types correctly", async () => {
      // Test with different check run outputs
      // ... test each error type
    });

    it("should extract file paths from various formats", async () => {
      const testCases = [
        {
          input: "tests/test_auth.py::test_login FAILED",
          expected: ["tests/test_auth.py"],
        },
        {
          input: "src/Button.tsx(45,12): error TS2322",
          expected: ["src/Button.tsx"],
        },
        {
          input: 'File "app/models/user.py", line 123',
          expected: ["app/models/user.py"],
        },
      ];

      for (const { input, expected } of testCases) {
        const files = poller["extractFiles"](input);
        expect(files).toEqual(expected);
      }
    });
  });

  describe("waitForChecks", () => {
    it("should poll until checks complete", async () => {
      // Mock multiple polling rounds
      // ... test polling logic
    });

    it("should fail fast on critical errors", async () => {
      // ... test fail-fast logic
    });

    it("should retry flaky tests", async () => {
      // ... test retry logic
    });

    it("should timeout after specified duration", async () => {
      // ... test timeout
    });
  });
});
```

### Integration Tests

**Test Real Workflows**:

- `tests/integration/ship-workflow.test.ts`
- `tests/integration/error-reporting.test.ts` ⭐
- `tests/integration/branch-protection.test.ts` ⭐
- `tests/integration/security-scanning.test.ts` ⭐

**Example Integration Test**:

```typescript
// tests/integration/error-reporting.test.ts

describe("Error Reporting Integration", () => {
  it("should show rich error output for failed CI", async () => {
    // Create test PR with known failures
    const pr = await createTestPR({
      branch: "test-error-reporting",
      introduceErrors: {
        testFailure: ["tests/test_auth.py:45"],
        lintingError: ["src/Button.tsx:23"],
      },
    });

    // Run ship command
    const result = await runShipCommand({
      failFast: true,
    });

    // Verify error output
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("test_failure");
    expect(result.stdout).toContain("tests/test_auth.py:45");
    expect(result.stdout).toContain("Suggested fix: pytest");
    expect(result.stdout).toContain("linting_error");
    expect(result.stdout).toContain("src/Button.tsx:23");
  });
});
```

### Manual Testing Checklist

**Repos to Test**:

- [ ] auditor-toolkit (Python, pytest, comprehensive CI)
- [ ] wp-navigator-pro (Node.js, Jest, PHP)
- [ ] brand-copilot (Python, security scans)
- [ ] platform (TypeScript, failing security scans)

**Scenarios**:

- [ ] Create PR with passing CI
- [ ] Create PR with failing tests
- [ ] Create PR with failing security scans
- [ ] Create PR with missing required checks
- [ ] Test branch protection validation
- [ ] Test pre-commit security scanning
- [ ] Test retry logic for flaky tests
- [ ] Test timeout handling

---

## Rollout Plan

### Stage 1: Single Repo (Week 5, Days 1-2)

**Target**: auditor-toolkit (best CI setup, good test case)

**Steps**:

1. Install git-pr-manager v1.0.0
2. Test `gpm ship` with passing CI
3. Test `gpm ship` with failing tests (introduce test failure)
4. Test `gpm checks <pr-number>`
5. Verify error reporting is accurate
6. Document any issues

**Success Criteria**:

- No critical bugs
- Error reporting is helpful
- Developer feedback is positive

### Stage 2: Multiple Repos (Week 5, Days 3-4)

**Targets**: wp-navigator-pro, brand-copilot, platform

**Steps**:

1. Install v1.0.0 in each repo
2. Test full workflow in each
3. Compare experiences across repos
4. Document repo-specific issues

**Success Criteria**:

- Works across different tech stacks (Python, Node.js, PHP)
- Works with different CI configurations
- No major issues

### Stage 3: Full Rollout (Week 5, Day 5)

**Targets**: All remaining repos

**Steps**:

1. Install v1.0.0 globally
2. Update documentation
3. Announce to team
4. Monitor usage

**Success Criteria**:

- Deployed to all repos
- Documentation is clear
- Team can use effectively

---

## Success Metrics

### Quantitative Metrics

**Track for 2 weeks after full rollout**:

```typescript
interface PRMetrics {
  // Timing
  prCreateToMerge: number; // Total PR lifecycle time
  ciWaitTime: number; // Time waiting for CI
  debuggingTime: number; // Time spent understanding CI errors

  // Efficiency
  ciRunsPerPR: number; // Number of CI runs before merge
  iterationsPerPR: number; // Number of code pushes per PR

  // Error Handling
  errorReportingUsed: boolean; // Used enhanced error reporting?
  suggestedFixUsed: boolean; // Used suggested fix?
  failFastTriggered: boolean; // Failed fast on critical error?
  retryUsed: boolean; // Used retry for flaky tests?

  // Security
  secretsDetected: number; // Secrets blocked pre-commit
  vulnerabilitiesDetected: number; // Vulnerabilities found
}
```

**Target Improvements**:

- **PR/Merge Time**: 2-4 hours → 30-60 min (50-75% reduction)
- **CI Debugging**: 30-60 min → 5-10 min (80-90% reduction)
- **Error Identification**: 5-10 min → 10-30 sec (95% reduction)
- **PR Iterations**: 2-3 → 1-2 (33-50% reduction)

### Qualitative Metrics

**Developer Feedback**:

- [ ] Error messages are clear and actionable
- [ ] Suggested fixes are helpful
- [ ] Progress updates are informative
- [ ] Branch protection validation prevents issues
- [ ] Security scanning catches problems early
- [ ] Overall workflow is faster and less frustrating

**Example Survey Questions**:

1. How satisfied are you with the new error reporting? (1-5)
2. Do suggested fixes help you resolve issues faster? (Yes/No)
3. How often do you use `gpm checks` to debug CI? (Never/Sometimes/Often/Always)
4. Has the new workflow reduced your PR/merge time? (Yes/No)
5. Do you feel more confident shipping code with the security scanning? (Yes/No)

---

## Rollback Plan

### Scenario 1: Critical Bug Found

**If a critical bug is discovered during rollout**:

1. **Stop rollout** immediately
2. **Revert to v0.3.0** (bash version) in affected repos
3. **Document bug** with reproduction steps
4. **Fix bug** in separate branch
5. **Test fix** thoroughly
6. **Resume rollout** once stable

**Revert Command**:

```bash
npm uninstall -g git-pr-manager
npm install -g git-pr-manager@0.3.0
```

### Scenario 2: Performance Issues

**If new version is significantly slower**:

1. **Profile performance** to identify bottleneck
2. **Compare with v0.3.0** timing
3. **Optimize** identified bottlenecks
4. **If can't fix quickly**: revert to v0.3.0
5. **Re-deploy** once optimized

### Scenario 3: Feature Not Working as Expected

**If a feature doesn't work in production**:

1. **Disable feature** via config flag
2. **Continue using** other features
3. **Fix feature** in separate branch
4. **Re-enable** once stable

**Example** (disable security scanning):

```yaml
# .gpm.yml
security:
  enabled: false # Disable until fixed
```

---

## Conclusion

This comprehensive enhancement plan combines:

1. **Full SDK migration** (Option 2 from original plan)
2. **Enhanced error reporting** (from GitHub audit findings)
3. **Intelligent CI polling** (async, fail-fast, retry)
4. **Branch protection integration** (pre-flight validation)
5. **Security scanning** (pre-commit checks)
6. **Workflow templates** (based on org best practices)

**Total Effort**: 4-5 weeks (100-120 hours)

**Expected ROI**: 10-20 hours saved per week across team

**Next Step**: Review and approve this plan, then begin Phase 1 implementation.

---

**End of Comprehensive Enhancement Plan**
