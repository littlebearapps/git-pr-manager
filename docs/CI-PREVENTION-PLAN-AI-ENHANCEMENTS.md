# CI Prevention Plan - AI Agent & CLI Enhancements

**Version**: 1.10.0 (Revised)
**Last Updated**: 2025-11-20
**Status**: Proposed Enhancement - Revised after thinkdeep analysis
**Analysis**: Validated with zen thinkdeep (gemini-3-pro-preview)

---

## ⚠️ IMPORTANT: Analysis Results

**Thinkdeep Analysis Findings** (2025-11-20):

- **Significant overlap discovered**: Many proposed features already exist in gpm v1.9.0
- **`gpm verify` already exists**: Implements most of proposed `gpm validate` functionality
- **Hook system already complete**: v1.4.0 has CI auto-skip and hook management
- **Real gaps identified**: Error format enhancements, hook status JSON, granular config
- **Revised effort**: 7-10 hours (vs. original 12-16 hours)

See "Revised Implementation Strategy" section below for updated recommendations.

---

## Overview

This document proposes enhancements to the CI Prevention Plan specifically for AI agents, automation tools, and CLI integration. The goal is to make validation checks programmatically accessible, scriptable, and AI-friendly.

**Key principle**: Enhance existing commands rather than duplicate functionality.

---

## Current State Analysis (v1.9.0)

### ✅ What Already Exists

**Commands:**

- **`gpm verify`**: Runs format, lint, typecheck, test, build with `--skip-*` flags and `--json` output
- **`gpm doctor`**: System health checks with `--pre-release` validation (7 checks)
- **`gpm install-hooks`/`gpm uninstall-hooks`**: Hook management commands
- **`gpm status`**: Shows current git/workflow status including hooks

**Features:**

- ✅ Multi-language support (Python, Node.js, Go, Rust) with auto-detection
- ✅ JSON output on most commands (`--json` flag)
- ✅ Non-interactive execution (verify/doctor are non-interactive)
- ✅ Hook CI auto-detection (v1.4.0) - automatically skips in GitHub Actions
- ✅ Hook configuration in `.gpm.yml` (basic: enabled state)
- ✅ Custom task ordering via `.gpm.yml` verification config

**Exit Codes:**

- ✅ Standard: 0 (success), 1 (failure), 2 (validation), 3 (auth), 4 (rate limit)

### ⚠️ Remaining Gaps for AI Agents

1. **Error format lacks fix suggestions**: Errors don't include `autoFixCommand` field
2. **Hook status not queryable**: No `gpm hooks status --json` command
3. **Limited hook configuration**: .gpm.yml hooks section is basic (just enabled/disabled)
4. **No command alias**: Users expect "validate" but only "verify" exists

---

## Core Problems for AI Agents (Revised)

### Real Gaps (Not Already Solved)

1. ~~**No programmatic validation endpoint**~~ → **SOLVED**: `gpm verify` already exists
2. ~~**Interactive hooks**~~ → **SOLVED**: Hooks auto-skip in CI (v1.4.0)
3. ~~**Limited JSON output**~~ → **MOSTLY SOLVED**: Most commands have `--json`, needs enhancement
4. **Error format lacks fix suggestions**: No `autoFixCommand` or `suggestions[]` in errors ✅ REAL GAP
5. ~~**Hook configuration**~~ → **PARTIALLY SOLVED**: .gpm.yml has hooks, needs granular config
6. ~~**No bypass mechanism**~~ → **SOLVED**: CI detection + `--no-verify` works

### What AI Agents Need (Updated)

- ✅ ~~Single command to validate everything~~ → **USE**: `gpm verify` (already exists)
- ✅ ~~JSON output for all validation steps~~ → **HAS**: Most commands support `--json`
- ⚠️ **Structured error messages with fix suggestions** → **NEED**: Add `autoFixCommand` field
- ❌ ~~Exit codes that indicate what failed (bitwise)~~ → **SKIP**: Use JSON parsing instead
- ✅ ~~Non-interactive mode~~ → **HAS**: verify/doctor are non-interactive
- ✅ ~~Hook auto-disable in CI~~ → **HAS**: v1.4.0 CI detection
- ⚠️ **Programmatic hook management** → **PARTIAL**: Add `gpm hooks status --json`

---

## Revised Implementation Strategy

Based on thinkdeep analysis, focus on **enhancing existing commands** rather than creating new ones:

### ✅ Phase A: Essential Enhancements (7-10 hours)

**1. Enhanced Error Format Across All Commands** (3-4 hours)

- **What**: Add `autoFixCommand`, `fixable`, `suggestions[]` to error objects
- **Where**: verify, security, doctor, checks commands
- **Why**: AI agents can automatically apply fixes
- **Backwards compatible**: New fields are additive

**2. Hook Status Command** (2-3 hours)

- **What**: Add `gpm hooks status` with `--json` output
- **Why**: AI agents can query hook configuration
- **Output**: Installed hooks, config, enabled state

**3. Granular Hook Configuration** (2-3 hours)

- **What**: Expand `.gpm.yml` hooks section
- **Add**: `preCommit.autoFix`, `prePush.runValidation`, `disableInCI`
- **Why**: Team-wide consistency, AI agents can read config

**4. Command Alias** (0 hours - documentation only)

- **What**: `gpm validate` → alias to `gpm verify`
- **Why**: Familiarity for users expecting "validate"
- **How**: Add `.alias('validate')` in commander config

### ❌ Phase B: SKIP These (Already Exist or YAGNI)

**5. ~~New `gpm validate` Command~~** → **USE** `gpm verify` instead

- Reason: Duplicate functionality, verify already does this

**6. ~~Hook Auto-Disable in Automation~~** → **ALREADY EXISTS** (v1.4.0)

- Reason: CI detection already works

**7. ~~Bitwise Exit Codes~~** → **SKIP** (use JSON parsing)

- Reason: Complex for humans, AI agents can parse JSON

**8. ~~Validation as a Service (HTTP API)~~** → **DEFER** (YAGNI)

- Reason: CLI + JSON sufficient for 95% of use cases

**9. ~~`gpm doctor --pre-commit`~~** → **USE** `gpm verify --skip-test --skip-build`

- Reason: Existing skip flags achieve same goal

### 📊 Effort Comparison

| Original Plan          | Revised Plan               | Savings            |
| ---------------------- | -------------------------- | ------------------ |
| Phase A: 6-8 hours     | Enhanced errors: 3-4 hours | ~50%               |
| Phase B: 6-8 hours     | Hook status: 2-3 hours     | ~60%               |
| Phase C: 12-16 hours   | Hook config: 2-3 hours     | ~80%               |
| **Total: 24-32 hours** | **Total: 7-10 hours**      | **~70% reduction** |

---

## Original Proposed Enhancements (For Reference)

**Note**: The sections below show the original proposals. See "Revised Implementation Strategy" above for updated recommendations that avoid duplication.

### 1. New Command: `gpm validate` ⭐ (HIGHEST PRIORITY)

**Purpose**: Single command that runs all pre-push validation checks with JSON output

**Usage**:

```bash
# Full validation (lint + build + test)
gpm validate

# JSON output for AI agents
gpm validate --json

# Validate specific steps
gpm validate --lint --build
gpm validate --test-only

# Skip specific steps
gpm validate --skip-test

# Non-interactive mode
gpm validate --non-interactive
```

**JSON Output Schema**:

```json
{
  "success": false,
  "checks": [
    {
      "name": "lint",
      "status": "failed",
      "exitCode": 1,
      "duration": 1234,
      "errors": [
        {
          "file": "src/commands/setup.ts",
          "line": 153,
          "column": 7,
          "rule": "prefer-const",
          "message": "'token' is never reassigned. Use 'const' instead",
          "severity": "error",
          "fixable": true,
          "suggestedFix": "Change 'let token' to 'const token'",
          "autoFixCommand": "npm run lint -- --fix src/commands/setup.ts"
        }
      ],
      "warnings": []
    },
    {
      "name": "build",
      "status": "skipped",
      "reason": "Lint failed (fail-fast mode)",
      "exitCode": null,
      "duration": 0
    },
    {
      "name": "test",
      "status": "skipped",
      "reason": "Build skipped",
      "exitCode": null,
      "duration": 0
    }
  ],
  "summary": {
    "total": 3,
    "passed": 0,
    "failed": 1,
    "skipped": 2,
    "duration": 1234
  },
  "metadata": {
    "timestamp": "2025-11-20T10:30:00.000Z",
    "gpm_version": "1.9.0",
    "mode": "non-interactive"
  }
}
```

**Exit Codes** (bitwise flags for AI agents):

- `0` - All checks passed
- `1` - Lint failed
- `2` - Build failed
- `4` - Test failed
- `8` - Other validation error

**Example**: If lint and test both fail, exit code = `1 | 4 = 5`

**Benefits for AI Agents**:

- ✅ Single command to check everything
- ✅ Machine-readable output
- ✅ Structured errors with fix suggestions
- ✅ No prompts or interaction required
- ✅ Bitwise exit codes tell exactly what failed

**Implementation Effort**: Medium (4-6 hours)

---

### 2. Hook Auto-Disable in Automation Contexts

**Purpose**: Automatically disable pre-commit hooks when running in CI, AI agents, or automation

**Implementation**:

Update `.git/hooks/pre-commit` to detect automation:

```bash
#!/bin/sh

# Auto-disable in automation contexts
if [ -n "$CI" ] || [ -n "$GPM_NO_HOOKS" ] || [ -n "$CLAUDE_CODE" ] || [ -n "$AIDER" ]; then
  echo "ℹ️  Pre-commit hooks disabled in automation context"
  exit 0
fi

# Run lint-staged
npx lint-staged
```

**Environment Variables**:

- `CI` - GitHub Actions, GitLab CI, etc.
- `GPM_NO_HOOKS=1` - Explicit bypass for any context
- `CLAUDE_CODE=1` - Claude Code detection
- `AIDER=1` - Aider detection

**Usage by AI Agents**:

```bash
# AI agent commits code (hooks auto-disabled)
export GPM_NO_HOOKS=1
git commit -m "feat: add feature"

# Or use git's built-in bypass
git commit --no-verify -m "feat: add feature"
```

**Benefits**:

- ✅ AI agents don't get blocked by interactive prompts
- ✅ Still enforced for human developers
- ✅ Respects standard `--no-verify` flag

**Implementation Effort**: Low (1 hour)

---

### 3. Hook Configuration via `.gpm.yml`

**Purpose**: Configure pre-commit/pre-push hooks declaratively for automation

**Configuration**:

```yaml
# .gpm.yml
hooks:
  # Enable/disable hooks
  enabled: true

  # Pre-commit hooks
  preCommit:
    enabled: true
    runLint: true
    runFormat: true
    autoFix: true
    failOnWarnings: false

  # Pre-push hooks
  prePush:
    enabled: true
    runValidation: true # Runs 'gpm validate'
    runTests: false
    timeout: 300000 # 5 minutes

  # Automation detection
  disableInCI: true
  disableForAI: true # Auto-disable for CLAUDE_CODE, AIDER, etc.

  # Custom commands
  customCommands:
    - "npm run security-scan"
```

**Benefits**:

- ✅ Version-controlled hook configuration
- ✅ Team-wide consistency
- ✅ AI agents can read config to understand requirements
- ✅ No manual hook installation needed

**Implementation Effort**: Medium (3-4 hours)

---

### 4. Enhanced Error Format with Fix Suggestions

**Purpose**: Structured error messages that AI agents can parse and act on

**Current** (human-friendly):

```
✖ ESLint error:
  src/commands/setup.ts:153:7
  'token' is never reassigned. Use 'const' instead
```

**Enhanced** (AI-friendly JSON):

```json
{
  "type": "eslint_error",
  "file": "src/commands/setup.ts",
  "location": {
    "line": 153,
    "column": 7,
    "endLine": 153,
    "endColumn": 12
  },
  "rule": {
    "id": "prefer-const",
    "severity": "error",
    "category": "best-practices",
    "docs": "https://eslint.org/docs/latest/rules/prefer-const"
  },
  "message": "'token' is never reassigned. Use 'const' instead",
  "code": "let token = options.token;",
  "fixable": true,
  "suggestions": [
    {
      "description": "Change 'let' to 'const'",
      "fix": "const token = options.token;",
      "command": "npm run lint -- --fix src/commands/setup.ts",
      "automated": true
    }
  ],
  "impact": "blocks_commit",
  "priority": "high"
}
```

**Benefits for AI Agents**:

- ✅ Exact file location for edits
- ✅ Automated fix commands
- ✅ Links to documentation
- ✅ Priority/impact assessment
- ✅ Can apply fixes programmatically

**Implementation Effort**: Medium (3-4 hours)

---

### 5. Programmatic Hook Management Commands

**Purpose**: Install/configure hooks via CLI commands (not manual scripts)

**New Commands**:

```bash
# Install hooks
gpm hooks install
gpm hooks install --pre-commit --pre-push

# Configure hooks
gpm hooks config --auto-fix --fail-on-warnings

# Check hook status
gpm hooks status --json

# Temporarily disable
gpm hooks disable --until="2025-11-21T00:00:00Z"

# Re-enable
gpm hooks enable

# Uninstall
gpm hooks uninstall
```

**JSON Output for `gpm hooks status --json`**:

```json
{
  "installed": true,
  "hooks": {
    "preCommit": {
      "enabled": true,
      "path": ".git/hooks/pre-commit",
      "lastRun": "2025-11-20T10:30:00.000Z",
      "config": {
        "runLint": true,
        "autoFix": true,
        "failOnWarnings": false
      }
    },
    "prePush": {
      "enabled": false,
      "path": ".git/hooks/pre-push",
      "lastRun": null
    }
  },
  "disabledUntil": null,
  "autoDisableContexts": ["CI", "CLAUDE_CODE", "AIDER"]
}
```

**Benefits**:

- ✅ No manual script running
- ✅ Consistent installation process
- ✅ AI agents can check hook status
- ✅ Temporary disable for special cases

**Implementation Effort**: Medium (4-5 hours)

---

### 6. Validation as a Service (API Mode)

**Purpose**: Expose validation checks as a programmatic API for advanced AI integration

**Usage**:

```bash
# Start validation server (for AI agents)
gpm validate serve --port 3000

# Query validation status
curl http://localhost:3000/validate
curl http://localhost:3000/validate/lint
curl http://localhost:3000/validate/build
curl http://localhost:3000/validate/test

# Auto-fix endpoints
curl -X POST http://localhost:3000/fix/lint
curl -X POST http://localhost:3000/fix/format
```

**Response Format**:

```json
{
  "endpoint": "/validate/lint",
  "status": "failed",
  "timestamp": "2025-11-20T10:30:00.000Z",
  "errors": [...],
  "fixable": 3,
  "autoFixAvailable": true,
  "autoFixCommand": "npm run lint -- --fix"
}
```

**Benefits**:

- ✅ Advanced AI agents can query validation status
- ✅ No need to shell out to CLI
- ✅ Real-time validation feedback
- ✅ Auto-fix as HTTP endpoint

**Implementation Effort**: High (8-10 hours)
**Priority**: LOW (nice-to-have, not essential)

---

### 7. Pre-commit Doctor Check

**Purpose**: Lightweight validation before commit (like `gpm doctor` but for code)

**Command**:

```bash
# Quick pre-commit validation
gpm doctor --pre-commit

# JSON output
gpm doctor --pre-commit --json
```

**Checks**:

- ✅ No ESLint errors in staged files
- ✅ No TypeScript compilation errors
- ✅ No `console.log` statements (optional)
- ✅ No hardcoded secrets (basic regex check)
- ✅ No large files staged (>1MB)
- ✅ Commit message follows conventional commits (optional)

**JSON Output**:

```json
{
  "status": "ready",
  "checks": [
    {
      "id": "lint.staged",
      "status": "ok",
      "details": "No ESLint errors in 3 staged files"
    },
    {
      "id": "typescript.compilation",
      "status": "ok",
      "details": "TypeScript compiles successfully"
    },
    {
      "id": "secrets.basic",
      "status": "ok",
      "details": "No potential secrets detected"
    },
    {
      "id": "file-size",
      "status": "warning",
      "details": "1 file >500KB staged (dist/bundle.js)",
      "recommendedAction": "Add dist/ to .gitignore"
    }
  ],
  "readyToCommit": true,
  "warnings": 1,
  "errors": 0
}
```

**Exit Codes**:

- `0` - Ready to commit
- `1` - Errors found (not ready)
- `2` - Warnings only (ready with caution)

**Benefits**:

- ✅ Fast pre-flight check (1-2 seconds)
- ✅ Catches common mistakes
- ✅ AI agents can validate before commit
- ✅ Complements full `gpm validate`

**Implementation Effort**: Medium (4-6 hours)

---

## ~~Recommended Implementation Priority~~ (SUPERSEDED - See "Revised Implementation Strategy")

**⚠️ This section shows the original plan. Use "Revised Implementation Strategy" above instead.**

### ~~Phase A - Essential for AI Agents (6-8 hours)~~

1. ~~**`gpm validate` command**~~ → **USE** `gpm verify` (already exists)
2. ~~**Hook auto-disable in automation**~~ → **ALREADY EXISTS** (v1.4.0)
3. **Enhanced error format** (3-4 hours) → **KEEP** ✅

### ~~Phase B - Quality of Life (6-8 hours)~~

4. **Hook configuration via .gpm.yml** (2-3 hours) → **KEEP** ✅
5. **Programmatic hook management** (2-3 hours) → **KEEP** (hooks status only) ✅

### ~~Phase C - Advanced Features (12-16 hours)~~

6. ~~**`gpm doctor --pre-commit`**~~ → **SKIP** (use `gpm verify --skip-*`)
7. ~~**Validation as a Service**~~ → **DEFER** (YAGNI)

---

## Integration Examples (Updated for Existing Commands)

**⚠️ Use `gpm verify` instead of `gpm validate` in all examples below.**

### Example 1: Claude Code Integration

```typescript
// Claude Code can validate before committing using existing gpm verify
async function beforeCommit() {
  // Run validation (use existing verify command)
  const result = await exec("gpm verify --json");
  const validation = JSON.parse(result.stdout);

  if (!validation.success) {
    // Show errors to user with fix suggestions
    for (const check of validation.checks) {
      if (check.status === "failed") {
        for (const error of check.errors) {
          logger.error(`${error.file}:${error.line} - ${error.message}`);
          if (error.autoFixCommand) {
            logger.info(`Fix: ${error.autoFixCommand}`);
          }
        }
      }
    }

    // Ask user if they want to auto-fix
    const shouldFix = await askUser("Apply automatic fixes?");
    if (shouldFix) {
      await exec("npm run lint -- --fix");
      // Re-validate
      return beforeCommit();
    }

    return false; // Don't commit
  }

  return true; // Safe to commit
}
```

### Example 2: Aider Integration

```python
# Aider can check validation status using existing gpm verify
import subprocess
import json

def validate_changes():
    result = subprocess.run(
        ["gpm", "verify", "--json"],  # Use existing verify command
        capture_output=True,
        text=True
    )

    validation = json.loads(result.stdout)

    if not validation["success"]:
        # Auto-fix if possible
        for check in validation["checks"]:
            if check["status"] == "failed":
                for error in check["errors"]:
                    if error.get("automated"):
                        # Apply fix
                        subprocess.run(error["autoFixCommand"], shell=True)

        # Re-validate after fixes
        return validate_changes()

    return True
```

### Example 3: GitHub Actions Integration

```yaml
# Use gpm verify in CI (existing command)
- name: Validate PR
  run: |
    gpm verify --json > validation.json  # Use existing verify command

- name: Comment PR with validation results
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const validation = JSON.parse(fs.readFileSync('validation.json', 'utf8'));

      const errors = validation.checks
        .filter(c => c.status === 'failed')
        .flatMap(c => c.errors)
        .map(e => `- ${e.file}:${e.line} - ${e.message}\n  Fix: \`${e.autoFixCommand}\``)
        .join('\n');

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## Validation Failed\n\n${errors}`
      });
```

---

## Success Metrics (Revised)

**Actual Implementation:**

- ✅ AI agents can run full validation → Use `gpm verify --json` (already works)
- ✅ 100% of validation checks have JSON output → Already ~90%, enhance with error format
- ✅ Zero interactive prompts in automation → Already true (verify/doctor non-interactive)
- ⚠️ Structured errors with fix suggestions → **NEED**: Add `autoFixCommand` field (Phase A)
- ❌ ~~Exit codes accurately reflect what failed (bitwise)~~ → **SKIP**: Use JSON parsing instead
- ✅ Hooks auto-disable in CI/AI contexts → Already works (v1.4.0 CI detection)

**Additional Metrics:**

- ✅ Hook status queryable via JSON → **NEED**: `gpm hooks status --json` (Phase A)
- ✅ Granular hook configuration → **NEED**: Expand `.gpm.yml` hooks section (Phase A)
- ✅ Command discoverability → **ADD**: `validate` alias to `verify` (0 hours)

---

## Backwards Compatibility

All enhancements maintain backwards compatibility:

- ✅ Existing commands unchanged
- ✅ Human-readable output still default
- ✅ `--json` flag opt-in, not required
- ✅ Manual hook installation still works
- ✅ No breaking changes to `.gpm.yml` schema

---

## Documentation Updates Required

1. **AI-AGENT-INTEGRATION.md**: Add `gpm validate` usage examples
2. **JSON-OUTPUT-SCHEMAS.md**: Add validation and hook status schemas
3. **README.md**: Add `gpm validate` and `gpm hooks` to API Reference
4. **CLAUDE.md**: Update with new commands and AI agent patterns

---

## ~~Questions for Discussion~~ (RESOLVED)

**Answers based on thinkdeep analysis:**

1. **~~Bitwise exit codes~~**: ❌ **SKIP** - Too complex for humans, AI agents can parse JSON instead
2. **~~Validation API~~**: ❌ **DEFER** - YAGNI, CLI + JSON sufficient for 95% of use cases
3. **~~Pre-commit doctor~~**: ❌ **SKIP** - Use `gpm verify --skip-test --skip-build` instead
4. **Hook config in .gpm.yml**: ✅ **KEEP** - No separate file needed, integrate with existing config
5. **Auto-fix safety**: ✅ **INFORMATIONAL** - `autoFixCommand` field informs, AI/user chooses whether to apply

**New Questions:**

6. **Command alias**: Should `gpm validate` alias to `gpm verify` for discoverability? → ✅ **YES** (0 hours)
7. **Hook status detail level**: Minimal, medium, or verbose? → ✅ **MEDIUM** (installed + config)
8. **Error format rollout**: All commands at once, or phase by phase? → ✅ **PHASED** (verify first, then others)

---

## Conclusion (Revised)

**Thinkdeep Analysis Results:**

After comprehensive analysis with zen thinkdeep (gemini-3-pro-preview), we discovered that **gpm v1.9.0 already has most proposed features**:

✅ **What Already Works:**

- `gpm verify` does everything proposed for `gpm validate`
- Hook system has CI auto-detection (v1.4.0)
- JSON output available on most commands
- Multi-language support with auto-detection
- Non-interactive execution for AI agents

⚠️ **Real Gaps to Address:**

1. Error format lacks `autoFixCommand` field (3-4 hours)
2. No `gpm hooks status --json` command (2-3 hours)
3. Limited hook configuration in `.gpm.yml` (2-3 hours)
4. Missing `validate` alias for discoverability (0 hours)

**Revised Strategy:**

Instead of creating new commands, **enhance existing ones**:

- Use `gpm verify` (don't create `gpm validate`)
- Add error format enhancements across commands
- Expand hook management with status command
- Document existing capabilities better

**Impact:**

- **Original plan**: 24-32 hours (7 new features)
- **Revised plan**: 7-10 hours (3 enhancements + 1 alias)
- **Savings**: ~70% effort reduction while meeting all AI agent needs

**Result**: gpm v1.9.0 **already is** a dual-use system serving both human developers and AI agents. Just needs error format polish and better documentation of existing features.
