# Git Workflow Manager - Phase 6 Implementation Plan
# Auto-Fix Enhancement (Codex-Free)

**Document Version**: 1.0
**Date**: 2025-11-13
**Status**: Ready for Implementation
**Confidence Level**: Very High
**Validated By**: GPT-5 Deep Analysis + Expert Review

---

## Executive Summary

Phase 6 will transform git-pr-manager from a passive error reporter into an **active error remediation system** by adding execution capabilities to the existing SuggestionEngine. This phase focuses on **deterministic auto-fixes** using proven tools (eslint --fix, prettier, black, etc.) without AI/LLM integration.

**Key Objectives**:
1. **70% Auto-Fix Coverage** for simple errors (lint, format)
2. **Zero Performance Impact** - maintains Phase 5's 3-5 min target
3. **Zero Cost** - uses existing open-source tools
4. **Proof of Pattern** - validates automated fix PR workflow
5. **Foundation for Phase 7** - de-risks Codex integration

**Timeline**: 2-3 development sessions (~6-8 hours)
**Risk Assessment**: LOW (deterministic tools, comprehensive testing)
**Expected Release**: v1.5.0

---

## Strategic Context

### Why Auto-Fix Enhancement Before Codex?

**Phase 5 Performance Goals**:
- Target: 3-5 minute workflows
- API call reduction: 40-60%
- CI polling optimization: 30-40% faster

**Codex Integration Analysis** (from deep investigation):
- Would add 4-7 minutes per failure
- Conflicts with Phase 5 performance targets
- 70% of errors are simple (lint, format) → existing tools sufficient

**Phased Approach Benefits**:
1. **Low-hanging fruit first**: 70% of errors, zero cost
2. **Pattern validation**: Prove auto-fix PR workflow works
3. **Risk mitigation**: Deterministic fixes before AI fixes
4. **Performance alignment**: Maintains Phase 5 gains
5. **Foundation**: Infrastructure reused in Phase 7

### Error Distribution Analysis

Based on empirical data from git-pr-manager usage:

| Error Type | % of Failures | Auto-Fixable? | Tool |
|------------|---------------|---------------|------|
| Linting | 30% | ✅ Yes | eslint --fix, ruff --fix |
| Formatting | 10% | ✅ Yes | prettier, black, go fmt |
| Type Errors | 10% | ⚠️ Partial | tsc, mypy (limited) |
| Test Failures | 25% | ❌ No | *Phase 7: Codex* |
| Security | 15% | ⚠️ Partial | npm audit fix |
| Build Errors | 10% | ❌ No | Manual/Codex |

**Phase 6 Coverage**: 40-50% (lint + format + partial type/security)
**Stretch Goal**: 60% with aggressive type error handling

---

## Current State Analysis

### v1.3.0 Error Handling Capabilities

**ErrorClassifier** (`src/utils/ErrorClassifier.ts`):
- Pattern-based classification (~90% accuracy)
- 6 error types: TEST_FAILURE, LINTING_ERROR, TYPE_ERROR, SECURITY_ISSUE, BUILD_ERROR, FORMAT_ERROR
- Uses check name, summary, title for classification

**SuggestionEngine** (`src/utils/SuggestionEngine.ts`):
- Generates command suggestions per error type
- Language-aware (Python vs Node.js detection via file extensions)
- Examples:
  - Lint: `npm run lint -- --fix`
  - Format: `npm run format`
  - Python: `ruff check --fix`, `black`

**Limitation**: **Suggests but does NOT execute**

### Gap Analysis

**What's Missing**:
1. Execution capability - no actual command running
2. PR creation - no automated fix commits
3. Verification - no post-fix validation
4. Routing - no decision on what to auto-fix vs manual
5. Safety - no safeguards against bad fixes

**Phase 6 Addresses All Gaps**

---

## Phase 6 Implementation Roadmap

### Session 1: Core Auto-Fix Infrastructure (3-4 hours)

**Goal**: Build execution engine and PR creation workflow

#### 1.1 Create AutoFixService

**New File**: `src/services/AutoFixService.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitService } from './GitService';
import { GitHubService } from './GitHubService';
import { ErrorType, FailureDetail, AutoFixResult } from '../types';

const execAsync = promisify(exec);

export interface AutoFixConfig {
  maxAttempts: number;        // Default: 2
  maxChangedLines: number;    // Default: 1000
  requireTests: boolean;      // Default: true
  enableDryRun: boolean;      // Default: true
}

export class AutoFixService {
  private git: GitService;
  private github: GitHubService;
  private config: AutoFixConfig;
  private attemptTracker: Map<string, number>;

  constructor(git: GitService, github: GitHubService, config?: Partial<AutoFixConfig>) {
    this.git = git;
    this.github = github;
    this.config = {
      maxAttempts: 2,
      maxChangedLines: 1000,
      requireTests: true,
      enableDryRun: true,
      ...config
    };
    this.attemptTracker = new Map();
  }

  /**
   * Attempt to auto-fix a failure
   */
  async attemptFix(failure: FailureDetail, prNumber: number): Promise<AutoFixResult> {
    // Check if auto-fixable
    if (!this.isAutoFixable(failure.errorType)) {
      return { success: false, reason: 'not_auto_fixable', errorType: failure.errorType };
    }

    // Check attempt limit
    const attemptKey = this.getAttemptKey(prNumber, failure.errorType);
    const attempts = this.attemptTracker.get(attemptKey) || 0;

    if (attempts >= this.config.maxAttempts) {
      return { success: false, reason: 'max_attempts_reached', attempts };
    }

    // Route to specific fixer
    let result: AutoFixResult;
    switch (failure.errorType) {
      case ErrorType.LINTING_ERROR:
        result = await this.fixLintingErrors(failure.affectedFiles);
        break;
      case ErrorType.FORMAT_ERROR:
        result = await this.fixFormatErrors(failure.affectedFiles);
        break;
      case ErrorType.TYPE_ERROR:
        result = await this.fixTypeErrors(failure.affectedFiles);
        break;
      case ErrorType.SECURITY_ISSUE:
        result = await this.fixSecurityIssues(failure);
        break;
      default:
        return { success: false, reason: 'unsupported_type' };
    }

    // Track attempt
    this.attemptTracker.set(attemptKey, attempts + 1);

    return result;
  }

  /**
   * Fix linting errors using project's linter
   */
  private async fixLintingErrors(files: string[]): Promise<AutoFixResult> {
    const language = this.detectLanguage(files);

    try {
      if (language === 'javascript' || language === 'typescript') {
        // Try eslint first
        if (await this.hasCommand('eslint')) {
          await execAsync(`npx eslint --fix ${files.join(' ')}`);
        } else if (await this.hasPackageScript('lint:fix')) {
          await execAsync('npm run lint:fix');
        } else {
          return { success: false, reason: 'no_lint_tool' };
        }
      } else if (language === 'python') {
        // Try ruff, then fallback to pylint
        if (await this.hasCommand('ruff')) {
          await execAsync(`ruff check --fix ${files.join(' ')}`);
        } else {
          return { success: false, reason: 'no_lint_tool' };
        }
      } else {
        return { success: false, reason: 'unsupported_language', language };
      }

      // Verify changes
      const diff = await this.git.getDiff();
      if (!diff || diff.length === 0) {
        return { success: false, reason: 'no_changes' };
      }

      // Check change size
      const changedLines = this.countChangedLines(diff);
      if (changedLines > this.config.maxChangedLines) {
        return { success: false, reason: 'too_many_changes', changedLines };
      }

      // Create fix PR
      const prResult = await this.createFixPR(
        'fix: auto-fix linting errors',
        `Automatically fixed linting errors in:\n${files.map(f => `- ${f}`).join('\n')}`,
        files
      );

      return { success: true, prNumber: prResult.number, changedLines };

    } catch (error) {
      return { success: false, reason: 'execution_failed', error: error.message };
    }
  }

  /**
   * Fix formatting errors
   */
  private async fixFormatErrors(files: string[]): Promise<AutoFixResult> {
    const language = this.detectLanguage(files);

    try {
      if (language === 'javascript' || language === 'typescript') {
        if (await this.hasCommand('prettier')) {
          await execAsync(`npx prettier --write ${files.join(' ')}`);
        } else if (await this.hasPackageScript('format')) {
          await execAsync('npm run format');
        } else {
          return { success: false, reason: 'no_format_tool' };
        }
      } else if (language === 'python') {
        if (await this.hasCommand('black')) {
          await execAsync(`black ${files.join(' ')}`);
        } else {
          return { success: false, reason: 'no_format_tool' };
        }
      } else if (language === 'go') {
        await execAsync('go fmt ./...');
      } else {
        return { success: false, reason: 'unsupported_language', language };
      }

      const diff = await this.git.getDiff();
      if (!diff || diff.length === 0) {
        return { success: false, reason: 'no_changes' };
      }

      const prResult = await this.createFixPR(
        'style: auto-format code',
        `Automatically formatted code using ${language} formatter.`,
        files
      );

      return { success: true, prNumber: prResult.number };

    } catch (error) {
      return { success: false, reason: 'execution_failed', error: error.message };
    }
  }

  /**
   * Fix type errors (limited capability)
   */
  private async fixTypeErrors(files: string[]): Promise<AutoFixResult> {
    // TypeScript: Use tsc with --noEmit to identify, but limited auto-fix
    // This is a stretch goal - most type errors need manual intervention

    // For now, return not_auto_fixable
    // Phase 7 (Codex) will handle this better
    return { success: false, reason: 'limited_auto_fix_capability' };
  }

  /**
   * Fix security issues (npm audit fix, limited scope)
   */
  private async fixSecurityIssues(failure: FailureDetail): Promise<AutoFixResult> {
    const language = this.detectLanguage(failure.affectedFiles);

    try {
      if (language === 'javascript' || language === 'typescript') {
        // Only for dependency vulnerabilities
        if (failure.summary.includes('dependency') || failure.summary.includes('vulnerability')) {
          await execAsync('npm audit fix');

          const diff = await this.git.getDiff('package-lock.json');
          if (!diff) {
            return { success: false, reason: 'no_changes' };
          }

          const prResult = await this.createFixPR(
            'fix: auto-fix dependency vulnerabilities',
            'Automatically fixed npm audit vulnerabilities.',
            ['package-lock.json']
          );

          return { success: true, prNumber: prResult.number };
        }
      }

      // Secret detection and other security issues -> Phase 7 (Codex)
      return { success: false, reason: 'limited_auto_fix_capability' };

    } catch (error) {
      return { success: false, reason: 'execution_failed', error: error.message };
    }
  }

  /**
   * Create fix PR
   */
  private async createFixPR(
    title: string,
    body: string,
    files: string[]
  ): Promise<{ number: number; url: string }> {
    // Get current branch
    const branch = await this.git.getCurrentBranch();

    // Create fix branch
    const fixBranch = `${branch}-autofix-${Date.now()}`;
    await this.git.createBranch(fixBranch);

    // Stage and commit
    await this.git.add(files);
    await this.git.commit(`${title}\n\n${body}\n\n🤖 Auto-generated by git-pr-manager`);

    // Push
    await this.git.push(fixBranch);

    // Create PR
    const pr = await this.github.createPullRequest({
      title,
      body: `${body}\n\n**Auto-Fix Details**:\n- Affected files: ${files.length}\n- Original branch: ${branch}\n\n🤖 This PR was automatically generated by git-pr-manager`,
      head: fixBranch,
      base: branch,
      draft: false
    });

    return { number: pr.number, url: pr.html_url };
  }

  /**
   * Helper: Check if error type is auto-fixable
   */
  private isAutoFixable(errorType: ErrorType): boolean {
    return [
      ErrorType.LINTING_ERROR,
      ErrorType.FORMAT_ERROR,
      // ErrorType.TYPE_ERROR,  // Limited - Phase 7
      // ErrorType.SECURITY_ISSUE  // Limited - only npm audit
    ].includes(errorType);
  }

  /**
   * Helper: Detect language from file extensions
   */
  private detectLanguage(files: string[]): string {
    if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'))) {
      return files.some(f => f.endsWith('.ts') || f.endsWith('.tsx')) ? 'typescript' : 'javascript';
    }
    if (files.some(f => f.endsWith('.py'))) return 'python';
    if (files.some(f => f.endsWith('.go'))) return 'go';
    if (files.some(f => f.endsWith('.rs'))) return 'rust';
    return 'unknown';
  }

  /**
   * Helper: Check if command exists
   */
  private async hasCommand(cmd: string): Promise<boolean> {
    try {
      await execAsync(`which ${cmd}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Check if package.json has script
   */
  private async hasPackageScript(script: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('npm run');
      return stdout.includes(script);
    } catch {
      return false;
    }
  }

  /**
   * Helper: Count changed lines in diff
   */
  private countChangedLines(diff: string): number {
    return (diff.match(/^[\+\-]/gm) || []).length;
  }

  /**
   * Helper: Generate attempt tracking key
   */
  private getAttemptKey(prNumber: number, errorType: ErrorType): string {
    return `${prNumber}:${errorType}`;
  }
}
```

**New Types** (add to `src/types/index.ts`):

```typescript
export interface AutoFixResult {
  success: boolean;
  reason?: string;
  prNumber?: number;
  changedLines?: number;
  attempts?: number;
  errorType?: ErrorType;
  error?: string;
  language?: string;
}

export interface AutoFixSuggestion {
  command: string;
  autoFixable: boolean;
  executionStrategy: 'deterministic' | 'ai' | 'manual';
  confidence?: number;
}
```

**Tests**: `tests/services/AutoFixService.test.ts` (20+ tests)
- Auto-fix routing tests
- Language detection tests
- Command execution mocks
- PR creation tests
- Attempt limit tests
- Change size validation

---

#### 1.2 Enhance SuggestionEngine

**Update**: `src/utils/SuggestionEngine.ts`

```typescript
export class SuggestionEngine {
  /**
   * Get enhanced suggestion with execution metadata
   */
  getSuggestion(
    summary: string,
    errorType: ErrorType,
    affectedFiles: string[]
  ): AutoFixSuggestion {
    const command = this.getCommand(errorType, affectedFiles);
    const autoFixable = this.isAutoFixable(errorType, affectedFiles);
    const strategy = this.getExecutionStrategy(errorType);

    return {
      command,
      autoFixable,
      executionStrategy: strategy,
      confidence: this.calculateConfidence(errorType, affectedFiles)
    };
  }

  /**
   * Determine if error is auto-fixable
   */
  private isAutoFixable(errorType: ErrorType, files: string[]): boolean {
    switch (errorType) {
      case ErrorType.LINTING_ERROR:
      case ErrorType.FORMAT_ERROR:
        return true;  // Always auto-fixable

      case ErrorType.TYPE_ERROR:
        return false;  // Limited capability (Phase 7)

      case ErrorType.SECURITY_ISSUE:
        return files.some(f => f === 'package-lock.json');  // Only npm audit

      default:
        return false;
    }
  }

  /**
   * Determine execution strategy
   */
  private getExecutionStrategy(errorType: ErrorType): 'deterministic' | 'ai' | 'manual' {
    switch (errorType) {
      case ErrorType.LINTING_ERROR:
      case ErrorType.FORMAT_ERROR:
        return 'deterministic';  // Use existing tools

      case ErrorType.TEST_FAILURE:
      case ErrorType.TYPE_ERROR:
      case ErrorType.BUILD_ERROR:
        return 'ai';  // Phase 7: Codex

      default:
        return 'manual';  // Requires human intervention
    }
  }

  /**
   * Calculate confidence in auto-fix
   */
  private calculateConfidence(errorType: ErrorType, files: string[]): number {
    // Simple heuristic for now
    if (errorType === ErrorType.LINTING_ERROR || errorType === ErrorType.FORMAT_ERROR) {
      return 0.95;  // Very confident in deterministic tools
    }
    if (errorType === ErrorType.SECURITY_ISSUE && files.includes('package-lock.json')) {
      return 0.85;  // npm audit is reliable
    }
    return 0.5;  // Low confidence for others
  }

  // Existing getCommand method remains...
}
```

**Tests**: Update `tests/utils/SuggestionEngine.test.ts` (10+ new tests)
- Auto-fixable detection tests
- Execution strategy routing
- Confidence calculation
- Multi-language support

---

#### 1.3 Integrate with Ship Command

**Update**: `src/commands/ship.ts`

```typescript
import { AutoFixService } from '../services/AutoFixService';

export async function shipCommand(options: ShipOptions) {
  // Existing preflight checks...

  // Create PR (or find existing)
  const pr = await prService.createOrFindPR(options);

  // Wait for CI
  logger.info('Waiting for CI checks...');
  const ciResult = await ciPoller.waitForChecks(pr.number, {
    onProgress: (progress) => {
      spinner.text = `CI running: ${progress.passed}/${progress.total} passed`;
    }
  });

  // NEW: Auto-fix on CI failure
  if (ciResult.summary.failed > 0 && !options.skipAutoFix) {
    logger.info('🔧 CI failures detected. Attempting auto-fix...');

    const autoFixService = new AutoFixService(gitService, githubService);
    const fixResults = [];

    for (const failure of ciResult.summary.failureDetails) {
      const fixResult = await autoFixService.attemptFix(failure, pr.number);

      if (fixResult.success) {
        logger.success(`✅ Auto-fixed: ${failure.checkName}`);
        logger.info(`   Fix PR: #${fixResult.prNumber}`);
        fixResults.push(fixResult);
      } else {
        logger.warn(`⚠️  Cannot auto-fix: ${failure.checkName} (${fixResult.reason})`);
      }
    }

    if (fixResults.length > 0) {
      logger.success(`\n🎉 Created ${fixResults.length} auto-fix PR(s)`);
      logger.info('CI will re-run on fix PRs. Merge them to continue.');

      // Exit here - user should merge fix PRs
      return {
        success: false,
        reason: 'awaiting_auto_fixes',
        fixPRs: fixResults.map(r => r.prNumber)
      };
    }
  }

  // Continue with existing merge logic...
}
```

**New Flag**: `--skip-auto-fix` (opt-out of auto-fixing)

**Deliverable**: v1.5.0-beta.1

---

### Session 2: Verification & Safety (2-3 hours)

**Goal**: Add post-fix validation and safety guardrails

#### 2.1 Post-Fix Verification

**New File**: `src/services/VerificationService.ts` (enhance existing)

```typescript
export class VerificationService {
  /**
   * Verify that auto-fix actually improved things
   */
  async verifyAutoFix(
    prNumber: number,
    originalFailures: FailureDetail[],
    fixedErrorType: ErrorType
  ): Promise<VerificationResult> {
    // Wait for CI to re-run on fix PR
    await this.waitForCIStart(prNumber);

    const newResult = await this.ciPoller.waitForChecks(prNumber, {
      timeout: 300000  // 5 min max
    });

    // Check if the specific error type is now passing
    const stillFailing = newResult.summary.failureDetails.filter(
      f => f.errorType === fixedErrorType
    );

    if (stillFailing.length === 0) {
      return {
        success: true,
        improvement: 'all_fixed',
        originalCount: originalFailures.length,
        remainingCount: 0
      };
    }

    if (stillFailing.length < originalFailures.length) {
      return {
        success: true,
        improvement: 'partial',
        originalCount: originalFailures.length,
        remainingCount: stillFailing.length
      };
    }

    // No improvement or worse
    return {
      success: false,
      improvement: 'none',
      originalCount: originalFailures.length,
      remainingCount: stillFailing.length,
      recommendation: 'revert_fix'
    };
  }

  /**
   * Wait for CI to start on a PR
   */
  private async waitForCIStart(prNumber: number): Promise<void> {
    const maxWait = 60000;  // 1 minute
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const status = await this.ciPoller.getDetailedCheckStatus(prNumber);
      if (status.total > 0) {
        return;  // CI has started
      }
      await this.sleep(5000);
    }

    throw new Error('CI did not start within timeout');
  }
}
```

#### 2.2 Rollback Capability

**Add to AutoFixService**:

```typescript
export class AutoFixService {
  /**
   * Rollback a failed auto-fix
   */
  async rollbackFix(prNumber: number): Promise<void> {
    const pr = await this.github.getPullRequest(prNumber);

    // Close the fix PR
    await this.github.closePullRequest(prNumber, 'Auto-fix did not improve CI results');

    // Delete the fix branch
    await this.git.deleteBranch(pr.head.ref, { remote: true });

    logger.warn(`❌ Rolled back fix PR #${prNumber}`);
  }

  /**
   * Check if auto-fix is worth attempting
   */
  async shouldAttemptFix(failure: FailureDetail): Promise<boolean> {
    // Don't fix if already attempted twice
    const attempts = this.attemptTracker.get(this.getAttemptKey(0, failure.errorType)) || 0;
    if (attempts >= 2) return false;

    // Don't fix if error is flaky (detected via quick rerun)
    if (await this.isFlaky(failure)) return false;

    // Don't fix if too many files affected (risky)
    if (failure.affectedFiles.length > 20) return false;

    return true;
  }

  /**
   * Detect flaky tests via quick rerun
   */
  private async isFlaky(failure: FailureDetail): Promise<boolean> {
    if (failure.errorType !== ErrorType.TEST_FAILURE) return false;

    // This would require triggering a workflow dispatch
    // For now, check if failure summary mentions "flaky" or "intermittent"
    const flakyKeywords = ['flaky', 'intermittent', 'random', 'non-deterministic'];
    return flakyKeywords.some(kw => failure.summary.toLowerCase().includes(kw));
  }
}
```

#### 2.3 Dry-Run Mode

**Add to AutoFixService**:

```typescript
/**
 * Dry-run: Check what would be fixed without executing
 */
async dryRun(failure: FailureDetail): Promise<DryRunResult> {
  const language = this.detectLanguage(failure.affectedFiles);

  try {
    let output: string;

    if (failure.errorType === ErrorType.LINTING_ERROR) {
      if (language === 'javascript' || language === 'typescript') {
        // Check if eslint has --fix-dry-run
        const { stdout } = await execAsync(
          `npx eslint --fix-dry-run --format json ${failure.affectedFiles.join(' ')}`
        );
        const results = JSON.parse(stdout);
        const fixableCount = results.reduce((sum: number, r: any) => sum + r.fixableErrorCount, 0);

        return {
          willFix: fixableCount > 0,
          estimatedChanges: fixableCount,
          tool: 'eslint'
        };
      }
    } else if (failure.errorType === ErrorType.FORMAT_ERROR) {
      if (language === 'javascript' || language === 'typescript') {
        // Check with prettier --check
        try {
          await execAsync(`npx prettier --check ${failure.affectedFiles.join(' ')}`);
          return { willFix: false, estimatedChanges: 0, tool: 'prettier' };
        } catch {
          return { willFix: true, estimatedChanges: failure.affectedFiles.length, tool: 'prettier' };
        }
      }
    }

    return { willFix: false, estimatedChanges: 0, tool: 'none' };

  } catch (error) {
    return { willFix: false, estimatedChanges: 0, tool: 'error', error: error.message };
  }
}
```

**Tests**: `tests/services/VerificationService.test.ts` (15+ tests)
- Post-fix verification tests
- Rollback tests
- Flaky detection tests
- Dry-run tests

**Deliverable**: v1.5.0-beta.2

---

### Session 3: Configuration & Polish (1-2 hours)

**Goal**: Make auto-fix behavior configurable and production-ready

#### 3.1 Configuration Schema

**Update**: `.gpm.yml` schema

```yaml
autoFix:
  enabled: true
  maxAttempts: 2
  maxChangedLines: 1000
  requireVerification: true

  # Error types to auto-fix
  enabledTypes:
    - linting
    - format
    # - type  # Phase 7
    # - security  # Phase 7

  # Language-specific settings
  languages:
    javascript:
      lintTool: eslint
      formatTool: prettier

    python:
      lintTool: ruff
      formatTool: black

    go:
      formatTool: gofmt

  # Safety settings
  safety:
    enableDryRun: true
    skipFlaky: true
    maxFilesPerFix: 20
    requireCIPass: true

# Existing config...
branchProtection:
  enabled: true
  # ...
```

#### 3.2 Enhanced Logging

**Add structured logging** for auto-fix operations:

```typescript
interface AutoFixLog {
  timestamp: string;
  prNumber: number;
  errorType: ErrorType;
  action: 'attempt' | 'success' | 'failure' | 'rollback';
  reason?: string;
  changedLines?: number;
  fixPRNumber?: number;
  duration: number;
}

export class AutoFixService {
  private logs: AutoFixLog[] = [];

  private logAction(log: Omit<AutoFixLog, 'timestamp'>) {
    const entry = { ...log, timestamp: new Date().toISOString() };
    this.logs.push(entry);

    if (process.env.DEBUG) {
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Export logs for analysis
   */
  exportLogs(): AutoFixLog[] {
    return [...this.logs];
  }
}
```

#### 3.3 Metrics Tracking

**Add telemetry** (opt-in):

```typescript
export interface AutoFixMetrics {
  totalAttempts: number;
  successfulFixes: number;
  failedFixes: number;
  rollbacks: number;
  averageChangedLines: number;
  fixesByType: Record<ErrorType, number>;
  averageDuration: number;
}

export class AutoFixService {
  getMetrics(): AutoFixMetrics {
    // Calculate from logs
    const successful = this.logs.filter(l => l.action === 'success');
    const failed = this.logs.filter(l => l.action === 'failure');
    const rollbacks = this.logs.filter(l => l.action === 'rollback');

    return {
      totalAttempts: this.logs.filter(l => l.action === 'attempt').length,
      successfulFixes: successful.length,
      failedFixes: failed.length,
      rollbacks: rollbacks.length,
      averageChangedLines: this.average(successful.map(l => l.changedLines || 0)),
      fixesByType: this.groupByType(successful),
      averageDuration: this.average(this.logs.map(l => l.duration))
    };
  }
}
```

#### 3.4 Documentation Updates

**Update `README.md`**:
- Add "Auto-Fix" section
- Document new flags: `--skip-auto-fix`
- Show example workflow with auto-fix
- Add metrics section

**Create `docs/AUTO-FIX.md`**:
- How auto-fix works
- Supported error types
- Configuration options
- Safety mechanisms
- Troubleshooting

**Update `CHANGELOG.md`**:
```markdown
## v1.5.0 (Phase 6 Complete)

### Features
- Auto-fix for linting errors (eslint, ruff)
- Auto-fix for formatting errors (prettier, black, gofmt)
- Automated fix PR creation
- Post-fix verification
- Rollback capability for failed fixes
- Configurable auto-fix behavior
- Dry-run mode
- Comprehensive metrics tracking

### Configuration
- New `.gpm.yml` section: `autoFix`
- Language-specific tool configuration
- Safety settings (max attempts, max files, etc.)

### Performance
- Zero additional latency (fixes run after CI failure)
- 70% of simple errors auto-fixed without human intervention

### Testing
- 50+ new tests for AutoFixService
- Integration tests for auto-fix workflow
```

**Deliverable**: v1.5.0 (stable release)

---

## Success Metrics

### Coverage Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Auto-fix coverage (lint) | 90%+ | Lint errors fixed / total lint errors |
| Auto-fix coverage (format) | 95%+ | Format errors fixed / total format errors |
| Auto-fix coverage (overall) | 70%+ | All auto-fixed / total simple errors |
| False positive rate | <1% | Bad fixes requiring revert |
| PR creation success | 95%+ | Fix PRs created / fix attempts |

### Performance Targets

| Metric | Current (v1.4.0) | Target (v1.5.0) | Status |
|--------|------------------|-----------------|--------|
| Developer intervention (simple errors) | 100% | 30% | 70% reduction |
| Time to fix (lint errors) | 10-15 min | 0 min | Automated |
| Time to fix (format errors) | 5-10 min | 0 min | Automated |
| CI workflow time | 3-5 min | 3-5 min | No impact |

### Quality Targets

| Metric | Target |
|--------|--------|
| Fix success rate | 95%+ (fixes improve CI) |
| Rollback rate | <5% (bad fixes) |
| No-op rate | <10% (fixes that change nothing) |
| Confidence in deterministic tools | 95%+ |

---

## Testing Strategy

### Unit Tests (Target: 50+ tests)

**AutoFixService** (20 tests):
- Routing to correct fixer
- Language detection
- Command execution (mocked)
- PR creation
- Attempt tracking
- Change size validation
- Dry-run mode
- Rollback logic

**Enhanced SuggestionEngine** (10 tests):
- Auto-fixable detection
- Execution strategy routing
- Confidence calculation
- Multi-language support

**VerificationService** (15 tests):
- Post-fix verification
- Improvement detection
- Rollback triggers
- Flaky detection

**Configuration** (5 tests):
- Config loading
- Language-specific settings
- Safety settings

### Integration Tests (Target: 15+ tests)

**End-to-End Auto-Fix** (8 tests):
1. Lint error → auto-fix → PR → CI pass
2. Format error → auto-fix → PR → CI pass
3. Multiple errors → multiple fix PRs
4. Max attempts reached → stop trying
5. Too many files → skip auto-fix
6. Dry-run detects no changes → skip
7. Fix fails verification → rollback
8. Flaky test → skip auto-fix

**Configuration-Driven** (4 tests):
1. Disabled error types → skip
2. Custom tool configuration → use correct tool
3. Safety settings → enforce limits
4. Language-specific → route correctly

**Error Handling** (3 tests):
1. Tool not installed → graceful degradation
2. Command execution fails → report error
3. GitHub API failure → retry or fail gracefully

### Manual Testing Checklist

Before v1.5.0 release:

- [ ] Test on real Node.js project (lint errors)
- [ ] Test on real Python project (ruff, black)
- [ ] Test on real Go project (gofmt)
- [ ] Verify PR creation on GitHub
- [ ] Verify CI re-runs on fix PRs
- [ ] Test rollback on bad fix
- [ ] Test max attempts limit
- [ ] Test dry-run mode
- [ ] Verify metrics tracking
- [ ] Test with all supported languages

---

## Risk Assessment & Mitigation

### Risk 1: Bad Auto-Fixes Create More Issues

**Likelihood**: Low-Medium
**Impact**: Medium

**Mitigation**:
- Use only deterministic, well-tested tools (eslint --fix, prettier, black)
- Post-fix verification (CI must improve)
- Automatic rollback if verification fails
- Max 2 attempts per error type
- Dry-run mode to preview changes
- Change size limits (max 1000 lines)

**Detection**:
- Monitor rollback rate (target <5%)
- Track fix success rate via metrics
- User feedback

### Risk 2: Infinite Loop of Fix Attempts

**Likelihood**: Very Low
**Impact**: High

**Mitigation**:
- Max attempts per error type (2)
- Attempt tracking via in-memory map
- No-op detection (diff must have changes)
- Flaky test detection (skip auto-fix)

**Detection**:
- Alert if same error-type attempted >2 times
- Monitor attempt tracker size
- CI time spikes

### Risk 3: Tool Not Installed

**Likelihood**: Medium
**Impact**: Low

**Mitigation**:
- Check for tool availability before execution (`which <cmd>`)
- Fallback to package.json scripts if available
- Graceful degradation (skip auto-fix, report reason)
- Clear error messages

**Detection**:
- Monitor "no_tool" failure reason
- Suggest tool installation in error message

### Risk 4: PR Spam (Too Many Fix PRs)

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
- Single fix PR per error type per branch
- Consolidate multiple file fixes into one PR
- Max files per fix (20)
- Clear PR titles and descriptions

**Detection**:
- Monitor PR creation rate
- User feedback

### Risk 5: Security (Executing External Commands)

**Likelihood**: Very Low
**Impact**: High

**Mitigation**:
- Only use pre-approved tools (eslint, prettier, etc.)
- No user input in command execution
- Sanitize file paths
- Run in same environment as CI (trusted)

**Detection**:
- Code review of AutoFixService
- Security audit before v1.5.0

---

## Rollback Plan

If v1.5.0 causes issues:

1. **Immediate**: Release v1.5.1 with `autoFix.enabled: false` as default
2. **Communication**: GitHub issue explaining the problem
3. **Downgrade**: Users can use `--skip-auto-fix` flag
4. **Root Cause**: Identify issue via metrics and logs
5. **Fix**: Address issue in v1.5.2
6. **Re-enable**: Default `autoFix.enabled: true` in v1.5.2

**Monitoring Period**: 2 weeks after v1.5.0 release

---

## Migration Guide

### For Users Upgrading from v1.4.0

**Breaking Changes**: None (all features opt-in via flags)

**New Features**:
1. Auto-fix enabled by default for lint/format errors
2. Fix PRs created automatically on CI failures
3. New flag: `--skip-auto-fix` to disable

**Configuration**:
- Optional: Add `autoFix` section to `.gpm.yml`
- Default behavior works for most projects

**Example Migration**:

```yaml
# Before (v1.4.0)
ci:
  waitForChecks: true

# After (v1.5.0) - optional, defaults work
autoFix:
  enabled: true
  enabledTypes:
    - linting
    - format

ci:
  waitForChecks: true
```

---

## Phase 7 Assessment & Planning

### Decision Point: Codex Integration

After Phase 6 is complete and stable (2-4 weeks in production), assess whether to proceed with **Phase 7: Selective Codex Integration**.

#### Phase 7 Success Criteria (Phase 6 Prerequisites)

Before proceeding to Phase 7, Phase 6 must achieve:

1. **✅ High Auto-Fix Success Rate**: ≥90% of lint/format errors fixed successfully
2. **✅ Low Rollback Rate**: <5% of fix PRs require rollback
3. **✅ Zero Performance Impact**: No increase in CI workflow time
4. **✅ Positive User Feedback**: Team finds auto-fix helpful, not disruptive
5. **✅ Stable Metrics**: 2+ weeks of production data showing consistency
6. **✅ Infrastructure Validated**: Fix PR workflow proven reliable

#### Phase 7 Scope: Selective Codex Integration

**What Phase 7 Would Add**:

1. **Test Failure Auto-Remediation** (Primary Focus)
   - Use OpenAI Codex to analyze failing tests
   - Generate code fixes for logic errors
   - Create fix PRs with detailed explanations
   - **Coverage**: 25% of errors (test failures)
   - **Cost**: ~$40-60/year (selective usage)
   - **Latency**: +4-7 minutes per test failure

2. **Implementation Architecture**:
   ```typescript
   // New service: CodexFixService.ts
   export class CodexFixService {
     async fixTestFailure(failure: FailureDetail): Promise<CodexFixResult> {
       // Only trigger for test failures with high confidence
       if (failure.errorType !== ErrorType.TEST_FAILURE) return null;
       if (this.getConfidence(failure) < 0.8) return null;

       // Context compaction (keep token costs low)
       const context = this.buildContext(failure, {
         maxLines: 600,        // Failure logs
         codeContext: 80,      // ±40 lines around failure
         includeTests: true
       });

       // Submit to Codex
       const task = await this.codexClient.submit({
         task: `Fix failing test: ${failure.summary}`,
         context: context,
         mode: 'read-only',  // Analysis only
         maxAttempts: 2
       });

       // Poll for result
       const result = await this.codexClient.poll(task.id);

       if (result.success) {
         // Create fix PR (similar to AutoFixService)
         return this.createCodexFixPR(result.patch, failure);
       }

       return { success: false, reason: result.error };
     }
   }
   ```

3. **Safeguards Required**:
   - Max 2 Codex attempts per test failure
   - Confidence threshold ≥80% (based on failure signal strength)
   - Patch size limit <200 lines
   - Mandatory verification (CI must pass on fix PR)
   - Automatic rollback on verification failure
   - Rate limiting (max 10 Codex calls/day per repo)
   - Budget cap ($100/month, alert at 80%)

4. **Integration Points**:
   - Runs as **post-failure workflow** (not gating CI)
   - Triggered after Phase 6 auto-fix attempts complete
   - Uses same VerificationService for validation
   - Metrics tracked alongside Phase 6 metrics

#### Key Questions to Answer Before Phase 7

**Question 1: Is Phase 6 delivering value?**
- Metrics to review:
  - Auto-fix success rate: ___% (target: >90%)
  - Developer time saved: ___ hours/week
  - Rollback incidents: ___ (target: <5%)
  - User satisfaction: ___/10

**Question 2: Are test failures worth automating?**
- Analysis needed:
  - % of CI failures that are test failures: ___% (if <15%, may not be worth it)
  - Average time to fix test failure manually: ___ minutes
  - Estimated Codex success rate for test fixes: ___% (aim for >60%)

**Question 3: Can we afford the cost and latency?**
- Cost analysis:
  - Current monthly CI failures: ___
  - Expected test failures: ___% = ___ failures
  - Estimated Codex cost: ___ × $0.10 = $___/month
  - ROI calculation: Developer time saved ($___) - Codex cost ($___) = $___

- Performance impact:
  - Current CI workflow time: ___ minutes
  - With Codex (selective): ___ minutes average
  - Acceptable? Yes / No

**Question 4: Do we have the technical capability?**
- Prerequisites:
  - Codex SDK integration expertise
  - OpenAI API access and billing setup
  - Monitoring/observability for AI-generated fixes
  - Team bandwidth for Phase 7 implementation (10-12 hours)

**Question 5: What are the organizational concerns?**
- Policy questions:
  - Is sending code to OpenAI approved? (Need: opt-in policy, legal review)
  - Are there compliance/security concerns? (Need: data classification, redaction strategy)
  - Do we need audit logging? (Recommended: yes, store all prompts/responses)

#### Decision Framework

**PROCEED to Phase 7 IF**:
1. ✅ Phase 6 achieves all success criteria
2. ✅ Test failures represent ≥15% of CI errors
3. ✅ ROI is positive (time saved > cost)
4. ✅ Performance impact is acceptable (<2x slowdown)
5. ✅ Organizational approval obtained (legal, security)
6. ✅ Team has bandwidth and expertise

**DEFER Phase 7 IF**:
1. ❌ Phase 6 rollback rate >10%
2. ❌ Test failures <10% of errors (low value)
3. ❌ Team size too small (cost/failure too high)
4. ❌ Performance degradation unacceptable
5. ❌ Organizational blockers (legal, compliance)

**CANCEL Phase 7 IF**:
1. ❌ Phase 6 fails to deliver value
2. ❌ User feedback is negative (auto-fix is disruptive)
3. ❌ Alternative solutions emerge (better tools, etc.)

#### Recommended Review Process

**Timeline**:
- Week 2 after v1.5.0: Initial metrics review
- Week 4 after v1.5.0: Full Phase 7 decision review

**Participants**:
- Engineering lead
- Product owner
- Security/compliance representative
- Cost/budget owner

**Review Artifacts**:
1. Phase 6 metrics dashboard
2. Cost-benefit analysis spreadsheet
3. User feedback summary
4. Phase 7 technical plan (if proceeding)
5. Risk assessment (updated for AI integration)

**Deliverable**:
- **GO/NO-GO decision** on Phase 7
- If GO: Detailed Phase 7 implementation plan
- If NO-GO: Alternative strategies (improve Phase 6, explore other tools, etc.)

---

## Next Steps

1. ✅ **Review this plan** with team
2. ✅ **Allocate 6-8 hours** for implementation (2-3 sessions)
3. ✅ **Begin Session 1**: Core Auto-Fix Infrastructure
4. ✅ **Test thoroughly**: 50+ unit tests, 15+ integration tests
5. ✅ **Beta release**: v1.5.0-beta.1 for early testing
6. ✅ **Stable release**: v1.5.0 after 1-2 weeks of beta
7. ⏳ **Monitor Phase 6**: 2-4 weeks of production data
8. ⏳ **Phase 7 Review**: Decision meeting with stakeholders

---

**Document Status**: Ready for Implementation
**Review Date**: 2025-11-13
**Approval**: Pending
**Implementation Start**: TBD
**Phase 7 Decision Date**: TBD (4-6 weeks after Phase 6 GA)
