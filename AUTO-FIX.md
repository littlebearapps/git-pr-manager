# Auto-Fix Feature Documentation

## Overview

The Auto-Fix feature automatically attempts to resolve common CI failures by detecting error types, applying appropriate fixes, and validating the results. When enabled, it can significantly reduce the time spent on fixing trivial issues like linting errors, formatting problems, and security vulnerabilities.

## ✨ Key Features

### 🔧 Intelligent Error Detection
- **Pattern-Based Classification**: Automatically identifies error types (linting, formatting, security, type errors, build errors)
- **Language Detection**: Supports JavaScript, TypeScript, Python with language-specific fix strategies
- **Fixability Assessment**: Determines which errors can be auto-fixed vs. requiring manual intervention

### 🛡️ Safe Execution
- **Post-Fix Verification**: Runs tests after applying fixes to ensure nothing broke
- **Automatic Rollback**: Reverts changes if verification fails or too many lines changed
- **Change Size Limits**: Configurable maximum changed lines (default: 1000 lines)
- **Attempt Tracking**: Prevents infinite loops with configurable max attempts per error type

### 🎯 Dry-Run Mode
- **Risk-Free Testing**: Simulate fixes without making actual changes
- **Preview Commands**: See exactly what would be executed
- **No Attempt Counting**: Dry-run attempts don't count toward max attempts

### 📊 Comprehensive Metrics
- **Success/Failure Tracking**: Monitor auto-fix effectiveness over time
- **Error Type Breakdown**: See which error types are most common
- **Performance Metrics**: Track average fix duration and total time saved
- **Rollback Statistics**: Identify patterns in failed fixes

### 📝 Enhanced Logging
- **Structured Logs**: Timestamp, log level, and context for every operation
- **Detailed Context**: Track PR numbers, attempt counts, durations
- **Exportable Metrics**: JSON export for analysis and reporting

## 🚀 Quick Start

### Enable Auto-Fix

```yaml
# .gwm.yml
autoFix:
  enabled: true              # Enable auto-fix globally
  maxAttempts: 2             # Max fix attempts per error type
  maxChangedLines: 1000      # Max lines that can be changed
  requireTests: true         # Run tests after fixes
  enableDryRun: false        # Dry-run mode (preview only)
  autoMerge: false           # Auto-merge fix PRs if checks pass
  createPR: true             # Create PR for fixes (vs direct commit)
```

### Basic Usage

Auto-fix is automatically invoked when CI checks fail:

```bash
# Standard workflow - auto-fix activates on CI failures
gwm ship

# Auto-fix will attempt to:
# 1. Detect error types from CI check failures
# 2. Apply appropriate fixes for auto-fixable errors
# 3. Run verification tests
# 4. Create a fix PR if successful
# 5. Rollback if verification fails
```

### Dry-Run Mode

Test fixes without making changes:

```yaml
# .gwm.yml
autoFix:
  enabled: true
  enableDryRun: true         # Enable dry-run mode
```

When dry-run is enabled, you'll see output like:

```
🔧 Auto-fix (DRY RUN) for linting_error
   Would run: npx eslint --fix src/services/AutoFixService.ts
   Estimated changes: ~150 lines
```

## 📖 Supported Error Types

### ✅ Auto-Fixable Errors

#### 1. Linting Errors (`linting_error`)

**JavaScript/TypeScript:**
- ESLint errors with auto-fix capability
- Uses: `npx eslint --fix <files>`
- Fallback: `npx biome check --write <files>`

**Python:**
- Ruff linting errors
- Uses: `ruff check --fix <files>`
- Fallback: `flake8 <files>` (detection only)

**Confidence:** High (95%+ success rate)

#### 2. Format Errors (`format_error`)

**JavaScript/TypeScript:**
- Prettier formatting issues
- Uses: `npx prettier --write <files>`
- Fallback: `npx biome format --write <files>`

**Python:**
- Black formatting issues
- Uses: `black <files>`
- Fallback: `ruff format <files>`

**Confidence:** Very High (99%+ success rate)

#### 3. Security Issues (`security_issue`)

**Dependency Vulnerabilities:**
- npm audit issues
- Uses: `npm audit fix`
- Automatic mode: Applies fixes automatically
- Fallback: `npm audit fix --force` for breaking changes

**Python:**
- pip-audit issues
- Uses: `pip-audit --fix`

**Secret Detection:**
- Limited auto-fix capability
- Manual intervention required for most cases
- Returns `limited_auto_fix_capability` status

**Confidence:** Medium (60-70% success rate for dependencies)

### ⚠️ Limited Auto-Fix

These errors require manual intervention but auto-fix can provide helpful diagnostics:

#### Type Errors (`type_error`)
- TypeScript compilation errors
- Requires code logic changes
- Auto-fix provides: File locations, error context

#### Build Errors (`build_error`)
- Compilation/build failures
- Often requires dependency or config changes
- Auto-fix provides: Error classification, suggested investigation areas

#### Test Failures (`test_failure`)
- Unit/integration test failures
- Requires code fixes or test updates
- Auto-fix provides: Failed test names, error messages

## ⚙️ Configuration Reference

### Complete Configuration Options

```yaml
autoFix:
  # Global enable/disable
  enabled: true              # Default: true

  # Attempt limits
  maxAttempts: 2             # Default: 2, Range: 1-5
                             # Max fix attempts per error type per session

  # Change size limits
  maxChangedLines: 1000      # Default: 1000, Range: 1-10000
                             # Max lines changed before triggering rollback

  # Verification settings
  requireTests: true         # Default: true
                             # Run tests after applying fixes

  # Dry-run mode
  enableDryRun: false        # Default: false
                             # Simulate fixes without executing

  # PR automation
  createPR: true             # Default: true
                             # Create PR for fixes vs direct commit

  autoMerge: false           # Default: false
                             # Auto-merge fix PRs if checks pass
```

### Configuration Presets

**Basic** - Minimal auto-fix:
```yaml
autoFix:
  enabled: true
  maxAttempts: 1
  maxChangedLines: 500
  requireTests: true
  enableDryRun: false
  createPR: true
  autoMerge: false
```

**Standard** - Balanced (recommended):
```yaml
autoFix:
  enabled: true
  maxAttempts: 2
  maxChangedLines: 1000
  requireTests: true
  enableDryRun: false
  createPR: true
  autoMerge: false
```

**Aggressive** - Maximum automation:
```yaml
autoFix:
  enabled: true
  maxAttempts: 3
  maxChangedLines: 2000
  requireTests: true
  enableDryRun: false
  createPR: true
  autoMerge: true            # ⚠️ Auto-merge enabled
```

## 🔄 Auto-Fix Workflow

### Step-by-Step Process

```
┌─────────────────────────────────────┐
│  1. CI Check Fails                  │
│     - Linting errors detected       │
│     - 15 files affected             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Error Classification            │
│     - Type: linting_error           │
│     - Auto-fixable: Yes             │
│     - Confidence: High              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Save State (git stash)          │
│     - Stash uncommitted changes     │
│     - Create backup reference       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Apply Fix                       │
│     - Run: npx eslint --fix         │
│     - 150 lines changed             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. Verify Change Size              │
│     - Changed: 150 lines            │
│     - Limit: 1000 lines             │
│     - Status: ✅ Within limit       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. Run Verification Tests          │
│     - npm test                      │
│     - All tests pass ✅             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  7. Create Fix PR                   │
│     - Branch: fix/linting-123       │
│     - Title: "fix: Auto-fix..."     │
│     - PR #456 created               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8. Track Metrics                   │
│     - Success recorded              │
│     - Duration: 45s                 │
│     - Update statistics             │
└─────────────────────────────────────┘
```

### Rollback Scenarios

Auto-fix automatically rolls back changes in these cases:

1. **Verification Failure**
   ```
   ❌ Verification failed: 3 tests failing
   🔄 Rolling back changes...
   ✅ State restored (git stash pop)
   ```

2. **Too Many Changes**
   ```
   ❌ Too many changes: 1,500 lines (limit: 1,000)
   🔄 Rolling back changes...
   ✅ State restored
   ```

3. **Execution Error**
   ```
   ❌ Fix execution failed: ESLint not found
   🔄 Rolling back changes...
   ✅ State restored
   ```

## 📊 Metrics & Monitoring

### Accessing Metrics

The AutoFixService tracks comprehensive metrics that can be accessed programmatically:

```typescript
import { AutoFixService } from './services/AutoFixService';

const autoFix = new AutoFixService(git, github, config);

// Get current metrics
const metrics = autoFix.getMetrics();

console.log(metrics);
// {
//   totalAttempts: 45,
//   successfulFixes: 38,
//   failedFixes: 7,
//   rollbackCount: 5,
//   verificationFailures: 3,
//   dryRunAttempts: 12,
//   byErrorType: {
//     linting_error: {
//       attempts: 25,
//       successes: 24,
//       failures: 1
//     },
//     format_error: {
//       attempts: 15,
//       successes: 14,
//       failures: 1
//     },
//     security_issue: {
//       attempts: 5,
//       successes: 0,
//       failures: 5
//     }
//   },
//   byReason: {
//     verification_failed: 3,
//     too_many_changes: 2,
//     not_auto_fixable: 2
//   },
//   averageFixDuration: 32000,  // 32 seconds
//   totalFixDuration: 1440000,  // 24 minutes
//   startTime: "2025-01-13T10:00:00.000Z",
//   lastUpdated: "2025-01-13T14:30:00.000Z"
// }

// Export metrics to JSON file
const json = autoFix.exportMetrics();
await fs.writeFile('metrics.json', json);

// Reset metrics (start fresh)
autoFix.resetMetrics();
```

### Metric Types

#### Success Metrics
- `totalAttempts`: Total fix attempts (excluding dry-run)
- `successfulFixes`: Fixes that passed verification and created PRs
- `failedFixes`: Fixes that failed for any reason

#### Rollback Metrics
- `rollbackCount`: Number of times changes were rolled back
- `verificationFailures`: Rollbacks due to test failures

#### Error Type Breakdown
- `byErrorType`: Success/failure rates per error type
- Useful for identifying which error types are most fixable

#### Reason Analysis
- `byReason`: Failure reasons (e.g., verification_failed, too_many_changes)
- Helps identify common failure patterns

#### Performance Metrics
- `averageFixDuration`: Average time per fix attempt
- `totalFixDuration`: Total time spent on auto-fix operations

## 🔍 Troubleshooting

### Auto-Fix Not Running

**Check configuration:**
```bash
# Verify .gwm.yml exists and has autoFix section
cat .gwm.yml | grep -A 7 "autoFix:"
```

**Expected output:**
```yaml
autoFix:
  enabled: true
  maxAttempts: 2
  maxChangedLines: 1000
  requireTests: true
  enableDryRun: false
  autoMerge: false
  createPR: true
```

### High Rollback Rate

**Common causes:**

1. **Tests failing after fixes**
   - Check if tests are flaky
   - Verify fix tools are compatible with test suite
   - Consider disabling `requireTests` temporarily

2. **Too many lines changed**
   - Increase `maxChangedLines` limit
   - Break fixes into smaller chunks
   - Review formatter configurations

### Tools Not Found

**Install missing tools:**

```bash
# JavaScript/TypeScript
npm install --save-dev eslint prettier @biomejs/biome

# Python
pip install ruff black flake8 pip-audit
```

### Verification Always Failing

**Disable verification temporarily:**
```yaml
autoFix:
  enabled: true
  requireTests: false        # Skip post-fix verification
```

**Then investigate:**
- Review test suite for brittleness
- Check for timing-dependent tests
- Ensure tests don't depend on specific formatting

## 🎓 Best Practices

### 1. Start with Dry-Run
```yaml
# Test auto-fix without risk
autoFix:
  enabled: true
  enableDryRun: true
```

### 2. Monitor Metrics
```typescript
// Review metrics weekly
const metrics = autoFix.getMetrics();
console.log(`Success rate: ${
  (metrics.successfulFixes / metrics.totalAttempts * 100).toFixed(1)
}%`);
```

### 3. Gradual Rollout
```yaml
# Week 1: Dry-run only
enableDryRun: true

# Week 2: Enable for formatting only
enabled: true
enableDryRun: false
# (modify code to only fix format_error)

# Week 3: Enable all fixable types
# (full auto-fix enabled)
```

### 4. Conservative Limits
```yaml
# Start conservative
maxAttempts: 1             # Only 1 attempt per error
maxChangedLines: 500       # Strict change limit
requireTests: true         # Always verify
```

### 5. Team Coordination
- Communicate when enabling auto-fix
- Share metrics with team
- Review rollback patterns
- Adjust configuration based on feedback

## 🔐 Security Considerations

### Dependency Fixes

Auto-fix uses `npm audit fix` which:
- ✅ Only installs compatible versions
- ✅ Respects semver ranges
- ⚠️ May update sub-dependencies
- ⚠️ Can introduce breaking changes with `--force`

**Recommendation:** Enable verification tests to catch breaking changes.

### Secret Detection

Auto-fix has **limited capability** for secret detection:
- ❌ Cannot automatically remove secrets
- ✅ Can detect and report secret locations
- ✅ Blocks PR merge if secrets found

**Manual action required** to properly remove secrets and rotate credentials.

### Change Review

Even with auto-fix enabled:
- Review fix PRs before merging
- Check diff for unexpected changes
- Verify tests actually pass in CI
- Don't rely solely on auto-merge

## 📚 API Reference

### AutoFixService

```typescript
class AutoFixService {
  constructor(
    git: GitService,
    github: GitHubService,
    config?: Partial<AutoFixConfig>,
    verify?: VerifyService,
    enableLogging?: boolean
  );

  // Attempt to fix a specific failure
  async attemptFix(
    failure: FailureDetail,
    prNumber: number,
    dryRun?: boolean
  ): Promise<AutoFixResult>;

  // Check if error type is auto-fixable
  isAutoFixable(errorType: ErrorType): boolean;

  // Get current metrics
  getMetrics(): AutoFixMetrics;

  // Reset metrics
  resetMetrics(): void;

  // Export metrics as JSON string
  exportMetrics(): string;
}
```

### Types

```typescript
interface AutoFixConfig {
  maxAttempts: number;
  maxChangedLines: number;
  requireTests: boolean;
  enableDryRun: boolean;
}

interface AutoFixResult {
  success: boolean;
  reason?: string;
  prNumber?: number;
  changedLines?: number;
  attempts?: number;
  errorType?: ErrorType;
  error?: string;
  language?: string;
  verificationFailed?: boolean;
  verificationErrors?: string[];
  rolledBack?: boolean;
}

interface AutoFixMetrics {
  totalAttempts: number;
  successfulFixes: number;
  failedFixes: number;
  rollbackCount: number;
  verificationFailures: number;
  dryRunAttempts: number;
  byErrorType: {
    [key in ErrorType]?: {
      attempts: number;
      successes: number;
      failures: number;
    };
  };
  byReason: {
    [reason: string]: number;
  };
  averageFixDuration?: number;
  totalFixDuration: number;
  startTime: Date;
  lastUpdated: Date;
}
```

## 🗺️ Roadmap

Future enhancements planned:

- [ ] AI-powered fix suggestions using GPT-4
- [ ] Custom fix scripts per error type
- [ ] Multi-repository fix coordination
- [ ] Fix history and learning from past successes
- [ ] Integration with code review tools
- [ ] Slack/Discord notifications for auto-fixes
- [ ] Visual fix diff preview
- [ ] Batch fix mode for multiple errors

## 📞 Support

For issues or questions about auto-fix:

1. Check [GitHub Issues](https://github.com/littlebearapps/git-workflow-manager/issues)
2. Review logs with `--verbose` flag
3. Export metrics and share with support
4. Contact: nathan@littlebearapps.com

---

**Made with ❤️ by [Little Bear Apps](https://littlebearapps.com)**
