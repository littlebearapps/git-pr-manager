# Multi-Language Support Implementation Plan

# Fixing auditor-toolkit Feedback Issues

**Date Created**: 2025-11-17
**Last Updated**: 2025-11-17 (Zen DeepThink Analysis - Plan Refinement v2)
**Analysis Method**: Zen DeepThink + Web Research (GitHub Linguist, Ruff docs) + Expert Validation
**Source Feedback**: `/tmp/gpm-errors-auditor-toolkit.md`
**Priority**: **CRITICAL** - Blocks all non-Node.js projects
**Estimated Total Effort**: 63-88 hours across 5 phases (Phase 1 split into 1a/1b, revised after expert analysis)

---

## Executive Summary

gpm currently assumes all projects are Node.js-based, causing verification failures on Python, Go, and Rust projects. The auditor-toolkit Python project experienced complete workflow failure due to hardcoded `npm` commands in verification logic.

**Impact**:

- ❌ Python projects cannot use gpm (100% failure rate)
- ❌ Go projects cannot use gpm (100% failure rate)
- ❌ Rust projects cannot use gpm (100% failure rate)
- ⚠️ Monorepos with mixed languages unsupported

**Solution**: Implement multi-language detection with tool command mapping, Makefile support, and auto-fix capabilities.

**Expected Outcome**:

- ✅ 67% time savings (15min → 5min manual workflow)
- ✅ 36% of errors auto-fixable (based on real data)
- ✅ Support for Python, Node.js, Go, Rust out of the box

---

## Table of Contents

1. [Plan Refinements (v2)](#plan-refinements-v2)
2. [Problem Analysis](#problem-analysis)
3. [Root Cause](#root-cause)
4. [Research Findings](#research-findings)
5. [Solution Architecture](#solution-architecture)
6. [Implementation Phases](#implementation-phases)
7. [Risk Analysis](#risk-analysis)
8. [Success Criteria](#success-criteria)
9. [Appendices](#appendices)

---

## Plan Refinements (v2)

**Date**: 2025-11-17
**Method**: Zen DeepThink Expert Analysis + GPT-5 Validation
**Confidence**: VERY HIGH

### Summary of Changes

After expert analysis using zen deepthink, the following refinements were made to the original plan:

| Area                 | Original              | Refined                            | Rationale                                   |
| -------------------- | --------------------- | ---------------------------------- | ------------------------------------------- |
| **Phase 1 Scope**    | Single phase (16-20h) | Split into 1a/1b (23-30h + 12-17h) | Better risk management, faster delivery     |
| **Test Coverage**    | 30+ tests (3-4h)      | 50-60 tests (5-6h)                 | Accurate accounting of integration tests    |
| **Auto-Fix UX**      | Basic flow (12-16h)   | Enhanced safety (14-19h)           | Critical: dry-run, rollback, diff display   |
| **Commit Parser**    | Custom build (4-6h)   | Use library (1-2h)                 | Proven library, -4h time savings            |
| **Package Managers** | Not included          | **CRITICAL addition** (2-3h)       | Python: poetry/pip, Node: yarn/npm/pnpm     |
| **Total Effort**     | 46-62 hours           | 63-88 hours                        | More realistic with all features (5 phases) |

### Critical Addition: Package Manager Detection

**Severity**: 🚨 **HIGH** - Without this, multi-package-manager projects will fail

**Problem**: Original plan detects _languages_ (Python, Node.js) but not _package managers_ within each ecosystem.

**Impact**:

- `npm run lint` fails in yarn/pnpm projects
- `pytest` fails in poetry/pipenv projects (dependencies not installed)
- Tool commands incorrect (e.g., `pip install` when project uses poetry)

**Solution**: Add package manager detection to Phase 1a (Task 1.1b, 2-3 hours)

**Detection Strategy**:

- Python: poetry.lock → poetry | Pipfile.lock → pipenv | uv.lock → uv | requirements.txt → pip
- Node.js: pnpm-lock.yaml → pnpm | yarn.lock → yarn | bun.lockb → bun | package-lock.json → npm
- Go/Rust: Single package manager (no detection needed)

### Enhanced Auto-Fix UX (Phase 2)

**Problem**: Original plan missing critical safety features for auto-fix

**Added Features** (Task 2.5, +2-3 hours):

1. `--dry-run` mode (preview changes before applying)
2. Git stash backup (auto-rollback if fix breaks code)
3. Diff summary after applying fixes
4. Clear decline workflow (skip/abort options)
5. Track new errors introduced by fixes

**Impact**: Increases user trust and adoption of auto-fix feature

### Use Existing Library for Commit Parsing (Phase 3)

**Decision**: Use `conventional-commits-parser` (npm) instead of custom build

**Rationale**:

- Battle-tested (1.1M weekly downloads, used by semantic-release)
- Handles all edge cases (emoji, multi-line, breaking changes)
- **Time savings**: -4 hours development + zero ongoing maintenance
- Lower risk than custom parser

**Updated Phase 3 Effort**: 4-8 hours (down from 8-12 hours)

### Phase 1 Split: 1a (Foundation) + 1b (Operational)

**Phase 1a - Foundation** (23-30 hours, shippable):

- Core language detection
- **Package manager detection** (NEW)
- CommandResolver service (NEW - unified command resolution)
- verify.ts refactor (remove hardcoded npm)
- Basic integration
- 40-50 tests
- Backward compatible

**Phase 1b - Operational** (12-17 hours):

- Install step support (opt-in)
- Makefile enhancements
- Basic Node workspaces
- Better error messages
- 20-25 tests

**Benefit**: Deliver core functionality faster, reduce risk, better testability

---

## Problem Analysis

### Issue Summary (from auditor-toolkit)

**What Happened**:

```bash
$ gpm ship
▸ Shipping Feature
✅ Current branch: feature/google-platforms-p0-p1-p2-foundation

Command failed: gpm verify --json
Exit code: 1

Linting errors:
  "error": "Command failed: npm run lint\nnpm error Missing script: \"lint\"\n..."

Test errors:
  "error": "Command failed: npm test\nnpm error Missing script: \"test\"\n..."

Build errors:
  "error": "Command failed: npm run build\nnpm error Missing script: \"build\"\n..."
```

**Why It Failed**:

- auditor-toolkit is a **Python 3.12 project**
- Has `pyproject.toml`, `setup.py`, `requirements.txt`, `Makefile`
- Uses `ruff check .` (not `npm run lint`)
- Uses `pytest tests/` (not `npm test`)
- No build step needed (Python is interpreted)

**Manual Workaround** (what the user had to do):

1. Run `make lint && make typecheck && make test` locally
2. Manually push with `git push origin <branch>`
3. Manually create PR with `gh pr create --fill`
4. Manually monitor CI with `gh pr checks --watch`
5. Fix 25 lint errors found by CI
6. Manually commit fixes and push
7. Manually merge with `gh pr merge --squash`
8. Total time: **15 minutes**

**Expected with Working gpm**:

1. Run `gpm ship`
2. Auto-detect Python project
3. Auto-run appropriate checks (`make lint`, `pytest`)
4. Auto-fix 9/25 lint errors (36% success rate)
5. Auto-create PR with smart defaults
6. Auto-merge after CI passes
7. Total time: **5 minutes** (67% time savings)

---

## Root Cause

### Architectural Flaws Identified

#### 1. Hardcoded Node.js Assumptions

**File**: `src/commands/verify.ts`

```typescript
// Line 50: Hardcoded ESLint
const lintResult = await runStep("Lint (ESLint)", "npm run lint", jsonMode);

// Lines 59-62: Hardcoded TypeScript
const typecheckResult = await runStep(
  "Type Check (TypeScript)",
  "npx tsc --noEmit",
  jsonMode,
);

// Line 72: Hardcoded npm test
const testResult = await runStep("Tests (Jest)", "npm test", jsonMode);

// Line 81: Hardcoded npm build
const buildResult = await runStep(
  "Build (TypeScript)",
  "npm run build",
  jsonMode,
);
```

**Problem**: No language detection, no alternative tools, no fallback logic.

#### 2. Architectural Split (Discovery vs Execution)

**File**: `src/services/VerifyService.ts`

The service has **partial** multi-language support:

- Lines 122-128: Checks for `tox.ini` (Python)
- Lines 131-141: Checks for `Makefile` targets

**BUT** this discovery logic is only used when `VerifyService.runChecks()` is called, NOT when `gpm verify` CLI command runs directly!

**Circular Dependency**:

```
gpm ship
  ↓
VerifyService.runChecks()
  ↓
Executes: "gpm verify --json"
  ↓
verify.ts command
  ↓
Hardcoded npm commands (ignores discovery!)
```

#### 3. No Language Detection Layer

There is no centralized service for:

- Detecting project language (Python, Node.js, Go, Rust)
- Mapping language → tool commands
- Checking tool availability
- Handling fallback chains (Makefile → native tools)

---

## Research Findings

### Language Detection (GitHub Linguist Approach)

**Primary Strategy**: Project marker files (99%+ accuracy)

| Language | Marker Files                                                                   | Priority |
| -------- | ------------------------------------------------------------------------------ | -------- |
| Python   | `pyproject.toml`, `setup.py`, `requirements.txt`, `Pipfile`, `.python-version` | High     |
| Node.js  | `package.json`, `package-lock.json`, `yarn.lock`                               | High     |
| Go       | `go.mod`, `go.sum`                                                             | High     |
| Rust     | `Cargo.toml`, `Cargo.lock`                                                     | High     |

**Secondary Strategy**: File extensions (less reliable, slower)
**Fallback**: Default to Node.js (backward compatibility)

### Auto-Fix Tools Research

**Python - Ruff** (Recommended):

- **Speed**: 10-100x faster than Pylint/Black
- **Coverage**: 800+ lint rules (Flake8, isort, pyupgrade compatible)
- **Auto-fix**: `ruff check --fix` (safe) | `--unsafe-fixes` (aggressive)
- **Formatter**: `ruff format .` (Black-compatible)
- **Docs**: https://docs.astral.sh/ruff/linter/

**JavaScript/TypeScript - ESLint**:

- **Auto-fix**: `eslint --fix .`
- **Coverage**: Lint + some formatting
- **Integration**: Works with Prettier

**Go - gofmt / goimports**:

- **Auto-fix**: `gofmt -w .` | `goimports -w .`
- **Coverage**: Formatting + import management
- **Advanced**: `golangci-lint run --fix` (comprehensive)

**Rust - rustfmt / clippy**:

- **Auto-fix**: `cargo fmt` | `cargo clippy --fix`
- **Coverage**: Formatting + lint fixes
- **Safe**: `cargo fix` (compiler suggestions)

### Real-World Data (auditor-toolkit)

- **Total lint errors**: 25 (from ruff)
- **Auto-fixable**: 9 (36% success rate)
- **Manual fixes needed**: 16 (64% requiring human review)
- **Time saved**: 10 minutes (auto-fix + guided fixes)

**Error Breakdown**:

- E402: Module imports not at top (9 errors) - Auto-fixable
- F401: Unused imports (7 errors) - Auto-fixable
- F811: Fixture redefinitions (5 errors) - Manual (pytest-specific)
- F841: Unused variables (3 errors) - Manual (logic review needed)
- F541: Empty f-strings (1 error) - Manual (likely typo)

---

## Solution Architecture

### New Service: LanguageDetectionService

**File**: `src/services/LanguageDetectionService.ts`

**Responsibilities**:

1. Detect project language via marker files
2. Parse Makefile for available targets
3. Map language → tool commands (with fallbacks)
4. Check tool availability (cache results)
5. Support multi-language projects (monorepos)

**API Design**:

```typescript
export interface DetectedLanguage {
  primary: Language; // Main language
  additional: Language[]; // For monorepos
  confidence: number; // 0-100%
  sources: string[]; // Files that led to detection
}

export interface ToolCommands {
  lint: string[]; // Fallback chain
  test: string[];
  typecheck?: string[]; // Optional
  format?: string[];
  build?: string[];
}

export class LanguageDetectionService {
  constructor(workingDir: string = process.cwd()) {}

  // Core detection
  async detectLanguage(): Promise<DetectedLanguage>;

  // Tool command mapping
  async getToolCommands(language: Language): Promise<ToolCommands>;

  // Makefile integration
  async getMakefileTargets(): Promise<string[]>;

  // Tool availability
  async checkToolAvailable(tool: string): Promise<boolean>;

  // Config override
  async getLanguageFromConfig(): Promise<Language | null>;
}
```

**Detection Algorithm**:

```typescript
async detectLanguage(): Promise<DetectedLanguage> {
  // 1. Check .gpm.yml for explicit override
  const configLanguage = await this.getLanguageFromConfig();
  if (configLanguage) {
    return {
      primary: configLanguage,
      additional: [],
      confidence: 100,
      sources: ['.gpm.yml']
    };
  }

  // 2. Check for project marker files
  const markers = await this.detectMarkerFiles();

  // Priority order: Python > Node.js > Go > Rust
  if (markers.python.length > 0) {
    return {
      primary: 'python',
      additional: markers.nodejs.length > 0 ? ['nodejs'] : [],
      confidence: 95,
      sources: markers.python
    };
  }

  if (markers.nodejs.length > 0) {
    return {
      primary: 'nodejs',
      additional: [],
      confidence: 95,
      sources: markers.nodejs
    };
  }

  if (markers.go.length > 0) {
    return {
      primary: 'go',
      additional: [],
      confidence: 95,
      sources: markers.go
    };
  }

  if (markers.rust.length > 0) {
    return {
      primary: 'rust',
      additional: [],
      confidence: 95,
      sources: markers.rust
    };
  }

  // 3. Fallback to Node.js (backward compatibility)
  return {
    primary: 'nodejs',
    additional: [],
    confidence: 50,
    sources: ['fallback']
  };
}
```

**Tool Command Mapping**:

```typescript
const TOOL_COMMANDS: Record<Language, ToolCommands> = {
  python: {
    lint: ["make lint", "ruff check .", "flake8 .", "pylint ."],
    test: ["make test", "pytest tests/", "python -m pytest", "tox"],
    typecheck: ["make typecheck", "mypy .", "pyright ."],
    format: ["ruff format .", "black .", "autopep8 ."],
    build: [], // Typically no build step
  },

  nodejs: {
    lint: ["npm run lint", "npx eslint ."],
    test: ["npm test", "npx jest", "npx vitest"],
    typecheck: ["npm run typecheck", "npx tsc --noEmit"],
    build: ["npm run build", "npx tsc"],
  },

  go: {
    lint: ["make lint", "golangci-lint run"],
    test: ["make test", "go test ./..."],
    format: ["gofmt -w .", "goimports -w ."],
    build: ["make build", "go build", "go build ./..."],
  },

  rust: {
    lint: ["make lint", "cargo clippy"],
    test: ["make test", "cargo test"],
    format: ["cargo fmt"],
    build: ["make build", "cargo build"],
  },
};
```

**Makefile Parsing**:

```typescript
async getMakefileTargets(): Promise<string[]> {
  const makefilePath = path.join(this.workingDir, 'Makefile');

  try {
    const content = await fs.readFile(makefilePath, 'utf-8');

    // Simple regex to extract targets
    // Matches: "target:" at start of line
    const targetRegex = /^([a-zA-Z0-9_-]+):/gm;
    const matches = [...content.matchAll(targetRegex)];

    return matches.map(m => m[1]);
  } catch {
    return [];
  }
}
```

---

### New Service: AutoFixService

**File**: `src/services/AutoFixService.ts`

**Responsibilities**:

1. Attempt auto-fix for lint/format errors
2. Distinguish safe vs unsafe fixes
3. Prompt user before unsafe fixes
4. Track metrics (fixed vs remaining)
5. Retry verification after fixes

**API Design**:

```typescript
export interface FixResult {
  success: boolean;
  fixed: number; // Errors fixed
  remaining: number; // Errors still present
  output: string;
  safe: boolean; // Whether only safe fixes were applied
}

export interface FixOptions {
  allowUnsafe: boolean; // Allow unsafe fixes
  prompt: boolean; // Prompt before fix
  dryRun: boolean; // Show what would be fixed
}

export class AutoFixService {
  constructor(workingDir: string, language: Language) {}

  // Attempt auto-fix
  async attemptFix(
    step: VerificationStep,
    error: string,
    options: FixOptions,
  ): Promise<FixResult>;

  // Check if error is fixable
  canAutoFix(error: string): boolean;

  // Get fix command for language/step
  getFixCommand(step: VerificationStep): FixCommand | null;
}
```

**Fix Command Mapping**:

```typescript
interface FixCommand {
  command: string;
  flags: string[];
  safe: boolean;
}

const FIX_COMMANDS: Record<
  Language,
  Partial<Record<VerificationStep, FixCommand>>
> = {
  python: {
    lint: {
      command: "ruff",
      flags: ["check", "--fix", "--unsafe-fixes"],
      safe: false, // --unsafe-fixes can change behavior
    },
    format: {
      command: "ruff",
      flags: ["format", "."],
      safe: true, // Formatting is always safe
    },
  },

  nodejs: {
    lint: {
      command: "eslint",
      flags: ["--fix", "."],
      safe: false,
    },
    format: {
      command: "prettier",
      flags: ["--write", "."],
      safe: true,
    },
  },

  go: {
    lint: {
      command: "golangci-lint",
      flags: ["run", "--fix"],
      safe: false,
    },
    format: {
      command: "gofmt",
      flags: ["-w", "."],
      safe: true,
    },
  },

  rust: {
    lint: {
      command: "cargo",
      flags: ["clippy", "--fix", "--allow-dirty"],
      safe: false,
    },
    format: {
      command: "cargo",
      flags: ["fmt"],
      safe: true,
    },
  },
};
```

**User Prompting Flow**:

```typescript
async attemptFix(
  step: VerificationStep,
  error: string,
  options: FixOptions
): Promise<FixResult> {
  const fixCommand = this.getFixCommand(step);

  if (!fixCommand) {
    return {
      success: false,
      fixed: 0,
      remaining: 0,
      output: 'No auto-fix available for this error',
      safe: true
    };
  }

  // Prompt if needed
  if (options.prompt && !fixCommand.safe) {
    const shouldFix = await this.promptUser(
      `Auto-fix available (unsafe). Attempt? [Y/n]:`
    );

    if (!shouldFix) {
      return {
        success: false,
        fixed: 0,
        remaining: 0,
        output: 'User declined auto-fix',
        safe: true
      };
    }
  }

  // Run fix command
  const result = await this.runFixCommand(fixCommand, options.dryRun);

  return {
    success: result.exitCode === 0,
    fixed: result.errorsFixed,
    remaining: result.errorsRemaining,
    output: result.output,
    safe: fixCommand.safe
  };
}
```

---

### Updated Configuration Schema

**File**: `src/types/config.ts` (extended)

```yaml
# .gpm.yml (Extended Schema)

# Language Configuration (NEW)
language:
  primary: python # Explicit override (auto-detected if omitted)
  additional: [] # For monorepos: [nodejs, python]
  autoDetect: true # Enable auto-detection (default: true)

# Verification Configuration (EXTENDED)
verification:
  # Custom commands (override defaults)
  commands:
    lint: make lint # Custom lint command
    test: pytest tests/ -v # Custom test command
    typecheck: make typecheck
    format: ruff format .
    build: skip # Or custom command

  # Auto-fix settings (NEW)
  autoFix:
    enabled: true # Enable auto-fix (default: true)
    promptBeforeFix: true # Ask before running (default: true)
    allowUnsafeFixes: false # Allow unsafe fixes (default: false)
    maxAttempts: 2 # Max retry attempts (default: 2)

    # Per-language overrides (optional)
    python:
      lintCommand: ruff check --fix --unsafe-fixes
      formatCommand: ruff format .

  # Tool preferences (NEW)
  toolPreferences:
    python:
      linter: ruff # or: pylint, flake8
      formatter: ruff # or: black, autopep8
      typeChecker: mypy # or: pyright, pyre

  # Makefile integration (NEW)
  preferMakefile: true # Prefer Makefile targets over native tools
  makefileTargets: # Target name mapping
    lint: lint
    test: test
    typecheck: typecheck
    format: format
    build: build

# PR Configuration (EXTENDED)
pr:
  autoGenerateTitle: true # NEW - from conventional commits
  autoGenerateBody: true # NEW - from commit messages
  parseConventionalCommits: true # NEW - detect commit types (feat, fix, etc.)
  mergeMethod: squash # EXISTING
  deleteBranchAfterMerge: true # EXISTING
  checkoutMainAfterMerge: true # NEW

# CI Configuration (EXISTING - no changes)
ci:
  waitForChecks: true
  timeout: 1800000 # 30 minutes
  retryFlaky: true
```

**TypeScript Interface**:

```typescript
export interface GpmConfig {
  language?: {
    primary?: Language;
    additional?: Language[];
    autoDetect?: boolean;
  };

  verification?: {
    commands?: {
      lint?: string;
      test?: string;
      typecheck?: string;
      format?: string;
      build?: string;
    };

    autoFix?: {
      enabled?: boolean;
      promptBeforeFix?: boolean;
      allowUnsafeFixes?: boolean;
      maxAttempts?: number;
      python?: {
        lintCommand?: string;
        formatCommand?: string;
      };
      nodejs?: {
        lintCommand?: string;
        formatCommand?: string;
      };
    };

    toolPreferences?: {
      python?: {
        linter?: "ruff" | "pylint" | "flake8";
        formatter?: "ruff" | "black" | "autopep8";
        typeChecker?: "mypy" | "pyright" | "pyre";
      };
    };

    preferMakefile?: boolean;
    makefileTargets?: {
      lint?: string;
      test?: string;
      typecheck?: string;
      format?: string;
      build?: string;
    };
  };

  pr?: {
    autoGenerateTitle?: boolean;
    autoGenerateBody?: boolean;
    parseConventionalCommits?: boolean;
    mergeMethod?: "merge" | "squash" | "rebase";
    deleteBranchAfterMerge?: boolean;
    checkoutMainAfterMerge?: boolean;
  };

  ci?: {
    waitForChecks?: boolean;
    timeout?: number;
    retryFlaky?: boolean;
  };
}
```

---

### Updated verify.ts Command

**File**: `src/commands/verify.ts` (refactored)

**Before** (Hardcoded):

```typescript
// Line 50: Hardcoded ESLint
const lintResult = await runStep("Lint (ESLint)", "npm run lint", jsonMode);

// Line 72: Hardcoded npm test
const testResult = await runStep("Tests (Jest)", "npm test", jsonMode);
```

**After** (Dynamic):

```typescript
import { LanguageDetectionService } from "../services/LanguageDetectionService";
import { AutoFixService } from "../services/AutoFixService";

export async function verifyCommand(
  options: VerifyOptions = {},
): Promise<void> {
  const startTime = Date.now();
  const results: VerifyStepResult[] = [];
  const failedSteps: string[] = [];

  // Detect language
  const detector = new LanguageDetectionService();
  const detected = await detector.detectLanguage();
  const toolCommands = await detector.getToolCommands(detected.primary);
  const makefileTargets = await detector.getMakefileTargets();

  if (!options.json) {
    logger.section("Running Verification Checks");
    logger.info(
      `Detected language: ${detected.primary} (${detected.confidence}% confidence)`,
    );

    if (makefileTargets.length > 0) {
      logger.info(`Found Makefile with targets: ${makefileTargets.join(", ")}`);
    }
  }

  // Initialize auto-fix service
  const autoFix = new AutoFixService(process.cwd(), detected.primary);
  const config = await loadConfig();

  // Step 1: Lint
  if (!options.skipLint) {
    const lintCommands = toolCommands.lint || [];
    const lintCommand = await selectCommand(
      lintCommands,
      makefileTargets,
      "lint",
    );

    if (lintCommand) {
      let lintResult = await runStep("Lint", lintCommand, options.json);
      results.push(lintResult);

      // Attempt auto-fix if enabled and step failed
      if (
        !lintResult.passed &&
        config.verification?.autoFix?.enabled !== false
      ) {
        if (!options.json) {
          logger.info("Attempting auto-fix...");
        }

        const fixResult = await autoFix.attemptFix(
          "lint",
          lintResult.error || "",
          {
            allowUnsafe:
              config.verification?.autoFix?.allowUnsafeFixes || false,
            prompt: config.verification?.autoFix?.promptBeforeFix !== false,
            dryRun: false,
          },
        );

        if (fixResult.success && fixResult.fixed > 0) {
          if (!options.json) {
            logger.success(`Auto-fixed ${fixResult.fixed} errors`);
            if (fixResult.remaining > 0) {
              logger.warn(
                `${fixResult.remaining} errors remaining (manual fix needed)`,
              );
            }
          }

          // Retry verification
          lintResult = await runStep("Lint (retry)", lintCommand, options.json);
          results.push(lintResult);
        }
      }

      if (!lintResult.passed) {
        failedSteps.push("lint");
      }
    } else {
      if (!options.json) {
        logger.warn("No lint command found, skipping");
      }
    }
  }

  // Step 2: Type check (similar pattern)
  // Step 3: Tests (similar pattern)
  // Step 4: Build (similar pattern)

  // ... rest of verification logic
}

// Helper: Select command from fallback chain
async function selectCommand(
  commands: string[],
  makefileTargets: string[],
  step: string,
): Promise<string | null> {
  // Prefer Makefile targets if available
  const config = await loadConfig();

  if (config.verification?.preferMakefile !== false) {
    const targetName = config.verification?.makefileTargets?.[step] || step;

    if (makefileTargets.includes(targetName)) {
      return `make ${targetName}`;
    }
  }

  // Fall back to native tools
  for (const cmd of commands) {
    // Check if command is available
    const [tool] = cmd.split(" ");

    try {
      execSync(`command -v ${tool}`, { stdio: "ignore" });
      return cmd;
    } catch {
      // Tool not available, try next
    }
  }

  return null;
}
```

---

## Implementation Phases

### Phase 1a: Foundation - Core Language Detection (v1.6.0-beta.1)

**Priority**: ⚠️ **CRITICAL** (Blocks all other improvements)
**Estimated Effort**: 23-30 hours
**Target Release**: v1.6.0-beta.1 (shippable, backward compatible)

#### Tasks

**1.1 Create LanguageDetectionService (6-8 hours)**

- [ ] Create `src/services/LanguageDetectionService.ts`
- [ ] Implement `detectLanguage()` method
  - Check .gpm.yml for override (highest priority)
  - Detect via marker files (pyproject.toml, package.json, go.mod, Cargo.toml)
  - Implement fallback to Node.js (backward compatibility)
  - Return DetectedLanguage with confidence score
- [ ] Implement `getToolCommands()` method
  - Map language + package manager → tool commands
  - Support fallback chains (Makefile → native tools)
  - Include install commands (for Phase 1b)
- [ ] Implement `getMakefileTargets()` method
  - Parse Makefile for available targets (simple regex)
  - No complex parsing (just target names)
- [ ] Implement `checkToolAvailable()` method
  - Run `command -v <tool>` to check availability
  - Cache results (in-memory, TTL: 1 hour)
- [ ] Write comprehensive tests (90%+ coverage)
  - Test detection for each language (Python, Node.js, Go, Rust)
  - Test Makefile parsing (simple, complex, missing)
  - Test tool availability checking
  - Test config override precedence

**1.1b Package Manager Detection (2-3 hours)** ← 🆕 **CRITICAL ADDITION**

- [ ] Add `detectPackageManager()` method to LanguageDetectionService
- [ ] Implement Python package manager detection
  - poetry.lock → poetry
  - Pipfile.lock → pipenv
  - uv.lock → uv
  - requirements.txt → pip (fallback)
- [ ] Implement Node.js package manager detection
  - pnpm-lock.yaml → pnpm
  - yarn.lock → yarn (check .yarnrc.yml for Yarn 2+)
  - bun.lockb → bun
  - package-lock.json → npm (fallback)
- [ ] Update tool command mapping to use detected package manager
  - Python: `poetry run pytest` vs `pytest` vs `pipenv run pytest`
  - Node.js: `pnpm run lint` vs `npm run lint` vs `yarn lint`
- [ ] Add install command support (for Phase 1b)
  - poetry install, pipenv install, uv sync, pip install
  - pnpm install --frozen-lockfile, yarn install --frozen-lockfile, npm ci
- [ ] Write tests for package manager detection (8 tests)

**1.2 Create CommandResolver Service (4-5 hours)** ← 🆕 **NEW SERVICE**

- [ ] Create `src/services/CommandResolver.ts`
- [ ] Implement unified command resolution logic
  - Input: task (lint/test/format/build), language, package manager, cwd, config
  - Priority: Makefile targets → package manager commands → native tools → error
- [ ] Implement `resolve()` method
  - Check Makefile targets first (if preferMakefile enabled)
  - Map to language-specific commands via package manager
  - Provide clear error if tool missing (suggest install command)
- [ ] Add `--dry-run` support
  - Show what commands would run without executing
  - Display detection summary (language, package manager, Makefile status)
- [ ] Write tests for command resolution (12 tests)

**1.3 Update Configuration Schema (4-5 hours)**

- [ ] Extend `src/types/config.ts` with new interfaces
  - verification.language (optional override)
  - verification.packageManager (optional override)
  - verification.makefile.prefer (default: true)
  - verification.detectionEnabled (default: true, feature flag)
- [ ] Update ConfigService to support new schema
  - Add validation for new fields
  - Maintain backward compatibility (all new fields optional)
- [ ] Add default values for new config options
- [ ] Update `.gpm.example.yml` with new options

**1.4 Refactor verify Command (4-5 hours)**

- [ ] Update `src/commands/verify.ts`
  - **Remove ALL hardcoded npm commands**
  - Import LanguageDetectionService and CommandResolver
  - Delegate command resolution to services
  - Add detection summary logging (language, package manager, Makefile)
- [ ] Update VerifyService to use new services
  - Ensure verify.ts routes through VerifyService only
  - No direct command construction in CLI layer
- [ ] Add `--dry-run` flag
  - Preview detection and commands without executing
  - Exit 0 after displaying plan
- [ ] Update error messages
  - Show detected language and package manager
  - Show command that failed
  - Suggest installing missing tools

**1.5 Testing & Validation (5-6 hours)**

- [ ] Unit tests for new services (40-50 tests total)
  - LanguageDetectionService: 14 tests
  - Package manager detection: 8 tests
  - CommandResolver: 12 tests
  - verify integration: 10 tests
  - ConfigService: 5 tests
- [ ] Integration tests
  - Test with auditor-toolkit (Python + poetry)
  - Test with gpm itself (Node.js + npm) - regression
  - Create sample Go project with Makefile
  - Create sample Rust project
- [ ] Test package manager variations
  - Python: poetry, pipenv, pip
  - Node.js: npm, yarn, pnpm
- [ ] Test Makefile integration
  - Projects with Makefile targets
  - Projects without Makefiles
  - Invalid Makefiles (graceful degradation)
- [ ] Test config overrides
  - Explicit language specification
  - Explicit package manager override
  - Custom command overrides
- [ ] Run full test suite
  - Ensure all 678+ existing tests still pass
  - Maintain 90%+ coverage
  - No regressions

**1.6 Documentation (2-3 hours)**

- [ ] Update README.md
  - Add "Multi-Language Support" section
  - Show examples for Python (poetry), Node.js (npm/yarn), Go, Rust
  - Document .gpm.yml language config
  - Document package manager detection
- [ ] Update CLAUDE.md
  - Update version to v1.6.0-beta.1
  - Add multi-language support notes
  - Add package manager detection notes
- [ ] Create migration guide
  - How to upgrade from v1.5.x
  - What changed in verify behavior
  - How to override language/package manager detection
  - No action required for Node.js projects (backward compatible)
- [ ] Update quickrefs/
  - Add language detection patterns
  - Add package manager detection rules
  - Add tool command mappings

#### Deliverables

- ✅ Multi-language support (Python, Node.js, Go, Rust)
- ✅ **Package manager detection** (poetry/pip, npm/yarn/pnpm/bun)
- ✅ **CommandResolver service** (unified command resolution)
- ✅ Makefile target detection and preference
- ✅ Fallback chain for tool commands
- ✅ Auto-detection with manual override via .gpm.yml
- ✅ **--dry-run mode** for verification preview
- ✅ Backward compatible (Node.js + npm fallback, no breaking changes)
- ✅ Comprehensive tests (40-50 new tests, 90%+ coverage maintained)
- ✅ Updated documentation

#### Success Criteria

- [ ] auditor-toolkit PR workflow succeeds end-to-end (Python + poetry)
- [ ] Existing Node.js projects show no regressions (gpm itself)
- [ ] Sample Go/Rust projects verify successfully
- [ ] Yarn/pnpm Node.js projects work correctly
- [ ] Poetry/pipenv Python projects work correctly
- [ ] All 678+ existing tests still pass
- [ ] New tests add 40-50 test cases (language, package manager, command resolution)
- [ ] `--dry-run` mode displays correct detection summary

---

### Phase 1b: Operational Completeness (v1.6.0)

**Priority**: ⚠️ **HIGH** (Completes Phase 1a, enables install workflows)
**Estimated Effort**: 12-17 hours
**Target Release**: v1.6.0 (stable)

#### Tasks

**1b.1 Install Step Support (3-4 hours)**

- [ ] Add `--allow-install` flag to verify command
- [ ] Add verification.allowInstall config option (default: false)
- [ ] Implement install step execution via CommandResolver
  - Use detected package manager's install command
  - Prompt before running install (unless --no-interactive)
  - Show install command before executing
- [ ] Handle missing lock files gracefully
  - Warn user if lock file missing (e.g., no poetry.lock)
  - Suggest creating lock file
- [ ] Write tests for install step (4-5 tests)

**1b.2 Makefile Enhancements (2-3 hours)**

- [ ] Improve Makefile target detection
  - Handle .PHONY targets
  - Handle targets with dependencies
  - Handle commented targets (skip)
- [ ] Add target name aliases in config
  - verification.makefile.aliases: { check: test, verify: lint }
- [ ] Better error messages when Makefile target missing
  - "Makefile found but no 'lint' target. Available targets: test, build, format"
- [ ] Write tests for Makefile enhancements (3-4 tests)

**1b.3 Basic Node Workspaces Support (3-4 hours)**

- [ ] Detect Node.js workspaces (package.json workspaces field)
- [ ] Detect Yarn workspaces (.yarnrc.yml)
- [ ] Detect pnpm workspaces (pnpm-workspace.yaml)
- [ ] Prefer root-level Makefile if present
- [ ] Run package manager commands at root level
  - pnpm run lint (runs across all workspaces)
  - yarn workspaces run lint
- [ ] Write tests for workspace detection (4-5 tests)

**1b.4 Better Error Messages (2-3 hours)**

- [ ] Show install command when tool missing
  - "ruff not found. Install with: pip install ruff"
  - "eslint not found. Install with: npm install -D eslint"
- [ ] Show package manager-specific suggestions
  - "Dependencies not installed. Run: poetry install"
  - "Dependencies not installed. Run: pnpm install"
- [ ] Show config override suggestions when detection is wrong
  - "Detected yarn but you're using npm? Override in .gpm.yml"
- [ ] Write tests for error message formatting (3-4 tests)

**1b.5 Testing & Documentation (2-3 hours)**

- [ ] Write integration tests (20-25 tests total)
  - Install step in different package managers
  - Workspace projects
  - Makefile enhancements
  - Error message formatting
- [ ] Update documentation
  - Add install step usage to README
  - Add workspace support notes
  - Add Makefile customization guide
- [ ] Update migration guide
  - How to enable install step
  - How to configure workspace support

#### Deliverables

- ✅ Install step support (opt-in via flag/config)
- ✅ Improved Makefile parsing and error handling
- ✅ Basic Node.js workspace support
- ✅ Better error messages with actionable suggestions
- ✅ Comprehensive tests (20-25 new tests)
- ✅ Updated documentation

#### Success Criteria

- [ ] Install step works correctly for poetry, pipenv, npm, yarn, pnpm
- [ ] Workspace projects (pnpm/yarn workspaces) verify successfully
- [ ] Error messages provide clear next steps
- [ ] All tests pass (700+ total with new tests)
- [ ] Documentation is complete and accurate

---

### Phase 2: Auto-Fix Capabilities (v1.7.0)

**Priority**: ⚠️ **HIGH** (60%+ time savings based on real data)
**Estimated Effort**: 14-19 hours (revised after Zen DeepThink analysis - added enhanced UX safety features)
**Target Release**: v1.7.0

#### Tasks

**2.1 Create AutoFixService (5-7 hours)**

- [ ] Create `src/services/AutoFixService.ts`
- [ ] Implement `attemptFix()` method
  - Execute fix command (safe or unsafe)
  - Parse fix output for metrics
  - Return FixResult with counts
- [ ] Implement `canAutoFix()` method
  - Check if error is fixable
  - Match error patterns
- [ ] Implement `getFixCommand()` method
  - Map language + step → fix command
  - Return safe/unsafe flag
- [ ] Implement user prompting
  - Use prompts library for interactive input
  - Show fix preview (what will be fixed)
  - Allow skip/accept/decline
- [ ] Write tests (90%+ coverage)
  - Test fix execution for each language
  - Test safe vs unsafe prompting
  - Test metrics tracking

**2.2 Integrate with verify Command (3-4 hours)**

- [ ] Update `src/commands/verify.ts`
  - Import AutoFixService
  - Add auto-fix step after verification failure
  - Implement retry logic (max 2 attempts)
  - Track and report metrics
- [ ] Add CLI flags
  - `--auto-fix`: Enable auto-fix (default: from config)
  - `--unsafe-fixes`: Allow unsafe fixes
  - `--no-fix`: Disable auto-fix
- [ ] Update output formatting
  - Show "Auto-fix available" message
  - Show metrics: N/M errors fixed
  - Show remaining errors with suggestions

**2.3 Configuration Support (2-3 hours)**

- [ ] Extend .gpm.yml schema (already designed in Phase 1)
- [ ] Update ConfigService validation
- [ ] Add per-language fix command overrides
- [ ] Document auto-fix configuration

**2.4 Testing (2-3 hours)**

- [ ] Test Python auto-fix
  - Ruff with safe fixes
  - Ruff with unsafe fixes
  - User prompting flow
- [ ] Test JavaScript auto-fix
  - ESLint with --fix
  - Prettier integration
- [ ] Test retry logic
  - Fix → retry → pass
  - Fix → retry → still fail
- [ ] Test metrics tracking
  - Accurate counts
  - Clear reporting

**2.5 Enhanced Auto-Fix UX (2-3 hours)** ← 🆕 **SAFETY FEATURES**

- [ ] Add `--dry-run` mode for preview
  - Show what commands would execute without running them
  - Display detection summary (language, errors found, fix commands available)
  - List specific fixes that would be applied
  - No actual file modifications
- [ ] Implement git stash backup before fixes
  - Create automatic stash before applying any fixes
  - Name: `gpm-autofix-backup-{timestamp}`
  - Only if working directory has uncommitted changes
  - Clear recovery instructions if fix fails
- [ ] Add diff summary after applying fixes
  - Show `git diff` output for modified files
  - Highlight which files were changed
  - Display number of lines added/removed
  - Allow review before proceeding
- [ ] Implement clear decline workflow
  - Skip option: "Skip this fix, continue with next"
  - Abort option: "Stop all fixes, restore from stash"
  - Always option: "Apply all remaining fixes without prompting"
  - Remember choice for current session
- [ ] Track new errors introduced by fixes
  - Re-run verification after auto-fix
  - Detect new errors that weren't present before
  - Display clearly: "⚠️ Auto-fix introduced N new errors"
  - Offer to restore from stash if errors increased
  - Log metrics: errors fixed, errors introduced, net improvement

**Enhanced attemptFix() Implementation**:

```typescript
async attemptFix(
  failure: FailureDetail,
  options: {
    dryRun?: boolean;
    interactive?: boolean;
    allowUnsafe?: boolean;
  }
): Promise<FixResult> {
  // 1. Dry-run mode
  if (options.dryRun) {
    const fixCommand = this.getFixCommand(failure);
    logger.info('Dry-run mode: Would execute:');
    logger.info(`  $ ${fixCommand}`);
    logger.info(`  Language: ${this.detectLanguage(failure)}`);
    logger.info(`  Safety: ${this.isSafeFix(failure) ? 'safe' : 'unsafe'}`);
    return { applied: false, dryRun: true };
  }

  // 2. Git stash backup (if uncommitted changes)
  let stashCreated = false;
  const isClean = await this.gitService.isClean();
  if (!isClean) {
    const stashName = `gpm-autofix-backup-${Date.now()}`;
    await this.gitService.stash(stashName);
    stashCreated = true;
    logger.info(`✅ Created backup: ${stashName}`);
  }

  // 3. Count errors BEFORE fix
  const errorsBefore = await this.countErrors(failure);

  try {
    // 4. Apply fix
    const fixCommand = this.getFixCommand(failure);
    await this.executeFixCommand(fixCommand);

    // 5. Show diff summary
    const diff = await this.gitService.getDiff();
    if (diff) {
      logger.info('\n📝 Changes applied:');
      logger.log(diff);
    }

    // 6. Re-run verification to detect new errors
    const errorsAfter = await this.countErrors(failure);
    const errorsIntroduced = errorsAfter - errorsBefore;

    if (errorsIntroduced > 0) {
      logger.warn(`⚠️  Auto-fix introduced ${errorsIntroduced} new errors`);

      // Offer to restore
      if (options.interactive) {
        const { restore } = await prompts({
          type: 'confirm',
          name: 'restore',
          message: 'Restore from backup stash?',
          initial: true
        });

        if (restore && stashCreated) {
          await this.gitService.stashPop();
          logger.info('✅ Restored from backup');
          return { applied: false, restored: true };
        }
      }
    }

    return {
      applied: true,
      errorsFixed: Math.max(0, errorsBefore - errorsAfter),
      errorsIntroduced,
      netImprovement: errorsBefore - errorsAfter,
      stashCreated
    };

  } catch (error) {
    // 7. Auto-restore on error
    if (stashCreated) {
      logger.error('Fix failed - restoring from backup...');
      await this.gitService.stashPop();
      logger.info('✅ Restored from backup');
    }
    throw error;
  }
}
```

#### Deliverables

- ✅ Auto-fix for lint errors (Python: ruff, JS: eslint, Go: golangci-lint, Rust: clippy)
- ✅ Safe/unsafe fix modes with user prompting
- ✅ Automatic retry after fixes (max 2 attempts)
- ✅ Metrics reporting (N/M errors auto-fixed, X remaining)
- ✅ Config-driven settings (enable/disable, safe-only mode)

#### Success Criteria

- [ ] 36%+ of errors auto-fixable (based on auditor-toolkit data)
- [ ] User prompted before unsafe fixes
- [ ] Retry logic works correctly
- [ ] Metrics accurately track fixed vs remaining
- [ ] All tests pass with new auto-fix tests added

---

### Phase 3: Smart PR Generation (v1.7.0 or v1.8.0)

**Priority**: 🟢 **MEDIUM** (Nice-to-have, not blocking)
**Estimated Effort**: 4-8 hours (revised after Zen DeepThink analysis - use proven library instead of custom parser)
**Target Release**: v1.7.0 or v1.8.0

#### Tasks

**3.1 Conventional Commit Parsing (1-2 hours)** ← **REVISED: Use Library**

- [ ] Install `conventional-commits-parser` npm package
  - Battle-tested library (1.1M weekly downloads)
  - Fully supports conventional commits spec
  - Handles edge cases and variations
  - Includes TypeScript types
- [ ] Create `src/utils/ConventionalCommitParser.ts` wrapper
  - Import `conventional-commits-parser`
  - Parse commit messages for type (feat, fix, docs, chore, refactor, test, perf, ci)
  - Extract scope, description, BREAKING CHANGE footer
  - Group commits by type
- [ ] Write tests for wrapper logic (5-7 tests)
  - Test parsing with library
  - Test grouping logic
  - Test edge cases (no type, multiple types)

**Why use library over custom implementation:**

- ✅ Time savings: 4-6 hours → 1-2 hours (saves 4 hours)
- ✅ Battle-tested: 1.1M weekly downloads, actively maintained
- ✅ Full spec compliance: Handles all conventional commit variations
- ✅ Edge case handling: Emoji commits, multi-line descriptions, trailers
- ✅ No maintenance burden: Bug fixes and updates from community
- ✅ TypeScript support: Built-in type definitions

**3.2 PR Title/Body Generation (2-3 hours)**

- [ ] Create `src/utils/PRGenerator.ts`
- [ ] Generate PR title
  - feat: Add X feature
  - fix: Fix Y bug
  - feat+fix: Add X and fix Y (multiple types)
- [ ] Generate PR body
  - Group commits by type
  - Create bulleted list
  - Add testing checklist template
- [ ] Support custom templates via .gpm.yml

**3.3 Integration (2-3 hours)**

- [ ] Update `src/commands/ship.ts`
  - Parse commits since base branch
  - Generate PR title/body
  - Use generated content when creating PR
- [ ] Add CLI flags
  - `--no-auto-generate`: Disable auto-generation
  - `--template <name>`: Use specific template
- [ ] Update config schema
  - `pr.autoGenerateTitle`
  - `pr.autoGenerateBody`
  - `pr.parseConventionalCommits`

#### Deliverables

- ✅ Parse conventional commits
- ✅ Auto-generate PR title from commit types
- ✅ Auto-generate PR body with commit list
- ✅ Configurable via .gpm.yml
- ✅ Manual override option

#### Success Criteria

- [ ] PR titles accurately reflect commit content
- [ ] PR bodies include all commits grouped by type
- [ ] Manual override works (`--no-auto-generate`)
- [ ] Config options respected

---

### Phase 4: CI Output Parsing (v1.8.0 or v1.9.0)

**Priority**: 🟢 **LOW** (Enhancement, not critical)
**Estimated Effort**: 10-14 hours
**Target Release**: v1.8.0 or v1.9.0

#### Tasks

**4.1 Create CIOutputParser (5-7 hours)**

- [ ] Create `src/services/CIOutputParser.ts`
- [ ] Parse ruff output (Python)
  - Extract file:line references
  - Extract error codes (E402, F401, etc.)
  - Extract error messages
- [ ] Parse eslint output (JavaScript)
  - Extract file:line:column
  - Extract rule names
  - Extract error messages
- [ ] Parse go test output
  - Extract test failures
  - Extract file:line
- [ ] Parse cargo test output
  - Extract test failures
  - Extract file:line
- [ ] Write tests for each parser

**4.2 Enhanced Error Reporting (3-4 hours)**

- [ ] Update error output formatting
  - Show file:line references
  - Show specific error codes
  - Provide fix suggestions (if available)
- [ ] Group errors by file
- [ ] Show top 10 most common errors
- [ ] Link to documentation for error codes

**4.3 Integration with CI Polling (2-3 hours)**

- [ ] Update EnhancedCIPoller
  - Parse CI logs in real-time
  - Extract actionable errors
  - Show in progress updates
- [ ] Update output formatter
  - Use parsed errors for display
  - Show clickable file paths (if terminal supports)

#### Deliverables

- ✅ Parse CI output for actionable errors
- ✅ Show specific file:line references
- ✅ Provide fix suggestions from CI output
- ✅ Group errors by file and type

#### Success Criteria

- [ ] Errors parsed correctly for each language
- [ ] File:line references accurate
- [ ] Fix suggestions helpful
- [ ] CI output readable and actionable

---

## Risk Analysis

### Technical Risks

#### 1. Breaking Existing Node.js Projects

**Likelihood**: Medium
**Impact**: High
**Mitigation**:

- Default to Node.js if no language markers found (backward compatibility)
- Comprehensive testing with existing gpm repositories
- Beta release (v1.6.0-beta.1) before stable
- Feature flag: `GPM_DISABLE_LANGUAGE_DETECTION=1` env variable
- Migration guide with examples

**Validation**:

- Run full test suite (678+ tests) before release
- Test with 5+ real Node.js projects
- Monitor GitHub issues after beta release

---

#### 2. Makefile Parsing Complexity

**Likelihood**: Low
**Impact**: Medium
**Mitigation**:

- Use simple regex for target detection (no complex parsing)
- Don't parse Makefile logic (variables, conditions, includes)
- Fallback to native tools if parsing fails
- Test with common Makefile patterns (GNU Make)

**Edge Cases**:

- Makefiles with complex variable expansion: Skip parsing
- Makefiles with `.PHONY` targets: Detect anyway
- Makefiles with conditional logic: Ignore conditions, detect all targets

---

#### 3. Tool Availability Checks Slow Down Startup

**Likelihood**: Medium
**Impact**: Low
**Mitigation**:

- Cache tool availability results (in-memory, TTL: 1 hour)
- Run checks in parallel (Promise.all)
- Lazy check (only when needed for verification, not on every CLI invocation)
- Skip availability check for Makefile targets (Makefile handles this)

**Performance Target**:

- Language detection: <100ms
- Tool availability checks: <500ms (cached: <1ms)
- Total overhead: <600ms

---

#### 4. Auto-Fix Breaks User Code

**Likelihood**: Low (with safe-only default)
**Impact**: High
**Mitigation**:

- **Default to safe fixes only** (no behavioral changes)
- **Prompt before running unsafe fixes** (user consent required)
- **Show diff before applying** (future enhancement - v1.9.0)
- **Allow rollback with git stash** (future enhancement)
- **Clear documentation** on safe vs unsafe fixes

**Safe Fixes** (applied automatically):

- Formatting changes (ruff format, prettier, gofmt)
- Import sorting (isort behavior in ruff)
- Unused import removal (if not used anywhere)

**Unsafe Fixes** (require prompt):

- Code refactoring (ruff --unsafe-fixes)
- Logic changes (e.g., converting deprecated APIs)
- Removing seemingly unused code (might have side effects)

---

#### 5. Config Schema Migration Breaks Existing Configs

**Likelihood**: Low
**Impact**: Medium
**Mitigation**:

- Maintain full backward compatibility (all old configs still work)
- Warn about deprecated config options (log to stderr)
- Provide migration tool: `gpm migrate-config` (future)
- Support both old and new schema simultaneously
- Clear upgrade documentation

**Migration Strategy**:

```yaml
# Old .gpm.yml (v1.5.x and earlier)
ci:
  waitForChecks: true
  timeout: 30

# Still works in v1.6.0+ (no changes needed)

# New .gpm.yml (v1.6.0+)
language:
  primary: python  # NEW - optional

ci:
  waitForChecks: true
  timeout: 30  # EXISTING - unchanged
```

---

### Operational Risks

#### 6. User Adoption - Resistance to Multi-Language Support

**Likelihood**: Low
**Impact**: Low
**Mitigation**:

- Clear communication: "Backward compatible, no action needed"
- Show value: "Python/Go/Rust now supported!"
- Provide examples in README
- Beta testing with early adopters (e.g., auditor-toolkit)

---

#### 7. Support Burden - Troubleshooting New Features

**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:

- Comprehensive documentation (README, CLAUDE.md, guides)
- Clear error messages ("Python project detected, using ruff")
- `gpm doctor` enhancement: Show detected language, available tools
- Debug mode: `GPM_DEBUG=1 gpm verify` (show detection logic)

---

## Success Criteria

### Functional Requirements

- ✅ **Multi-language support**: Python, Node.js, Go, Rust out of the box
- ✅ **Language auto-detection**: 95%+ accuracy for marker file detection
- ✅ **Makefile integration**: Prefer Makefile targets when available
- ✅ **Auto-fix capabilities**: 30%+ of errors auto-fixable on average
- ✅ **Backward compatibility**: All existing Node.js projects work unchanged
- ✅ **Config-driven**: Users can override all defaults via .gpm.yml

### Performance Requirements

- ✅ **Language detection**: <100ms overhead
- ✅ **Tool availability checks**: <500ms first run, <1ms cached
- ✅ **Verification time**: No regression vs v1.5.x for Node.js projects
- ✅ **Auto-fix speed**: <5 seconds for typical lint fixes

### Quality Requirements

- ✅ **Test coverage**: 90%+ maintained (current: 89.67%)
- ✅ **New tests added**: 50+ test cases for new features
- ✅ **No regressions**: All 678+ existing tests pass
- ✅ **Documentation**: All new features documented with examples

### User Experience Requirements

- ✅ **Real-world validation**: auditor-toolkit PR workflow succeeds
- ✅ **Time savings**: 67% faster than manual workflow (15min → 5min)
- ✅ **Error messages**: Clear, actionable, suggest fixes
- ✅ **User feedback**: Beta testers report positive experience

---

## Appendices

### Appendix A: auditor-toolkit Feedback Summary

**Source**: `/tmp/gpm-errors-auditor-toolkit.md`

**Key Metrics**:

- Manual workflow time: 15 minutes
- Expected gpm workflow time: 5 minutes
- Time savings: 67%
- Total lint errors: 25
- Auto-fixable errors: 9 (36%)
- Manual fixes needed: 16 (64%)

**Lessons Learned**:

1. Language detection is critical
2. Makefile targets are common in Python projects
3. CI is already robust - don't duplicate all checks locally
4. Auto-fix is valuable for quick iterations
5. Error parsing helps prioritize fixes
6. Smart defaults matter (conventional commits → PR descriptions)
7. Cleanup is important (checkout main, pull updates)

---

### Appendix B: Research Sources

**Language Detection**:

- GitHub Linguist: https://github.com/github-linguist/linguist
- Project marker files: PEP 518 (pyproject.toml), npm (package.json), Go modules (go.mod), Cargo (Cargo.toml)

**Auto-Fix Tools**:

- Ruff (Python): https://docs.astral.sh/ruff/linter/
- ESLint (JavaScript): https://eslint.org/docs/latest/use/command-line-interface#--fix
- gofmt (Go): https://pkg.go.dev/cmd/gofmt
- cargo fmt (Rust): https://doc.rust-lang.org/cargo/commands/cargo-fmt.html

**Makefile Parsing**:

- GNU Make manual: https://www.gnu.org/software/make/manual/make.html
- Simple target regex: `/^([a-zA-Z0-9_-]+):/gm`

---

### Appendix C: Comparison Matrix

| Feature              | Before (v1.5.x)              | After (v1.6.0+)                    |
| -------------------- | ---------------------------- | ---------------------------------- |
| **Language Support** | Node.js only                 | Python, Node.js, Go, Rust          |
| **Detection**        | None (assumes Node.js)       | Auto-detect via marker files       |
| **Makefile Support** | Partial (VerifyService only) | Full (preferred over native tools) |
| **Auto-Fix**         | None                         | Safe/unsafe with prompting         |
| **Tool Commands**    | Hardcoded npm                | Dynamic with fallback chains       |
| **Config Override**  | Limited                      | Full (.gpm.yml language section)   |
| **Python Projects**  | ❌ Fail                      | ✅ Work                            |
| **Go Projects**      | ❌ Fail                      | ✅ Work                            |
| **Rust Projects**    | ❌ Fail                      | ✅ Work                            |
| **Time Savings**     | Manual: 15min                | Automated: 5min (67% savings)      |

---

### Appendix D: Example Workflows

#### Python Project (auditor-toolkit)

**Before (v1.5.x)**:

```bash
$ gpm ship
❌ Verification failed (npm run lint not found)

# Manual workaround:
$ make lint && make typecheck && make test  # 2 min
$ git push origin feature/branch            # 1 min
$ gh pr create --fill                       # 1 min
$ gh pr checks --watch                      # 5 min (CI)
$ # Fix 25 lint errors                      # 3 min
$ git commit -m "fix: lint" && git push     # 1 min
$ gh pr checks --watch                      # 2 min (CI retry)
$ gh pr merge --squash --delete-branch      # 1 min
$ git checkout main && git pull             # 1 min
# Total: 15 minutes
```

**After (v1.6.0+)**:

```bash
$ gpm ship
🔍 Detected language: Python (95% confidence)
✅ Found Makefile with targets: lint, test, typecheck

▸ Pre-flight Verification
✓ Running: make lint
❌ Lint failed (25 ruff errors)

🔧 Auto-fix available (9/25 fixable)
❓ Attempt auto-fix? [Y/n]: y

✓ Auto-fixed 9 errors
⚠️  16 errors remaining (manual fix needed)

📝 Top errors:
   - E402: Move imports to top (6 files)
   - F811: pytest fixture redefinition (use # noqa) (3 files)

❓ Continue with PR creation? [Y/n]: n

# User fixes 16 remaining errors (3 min)
$ gpm ship  # Retry

✓ All checks passed!
✓ PR #111 created
✓ CI passed
✓ PR merged and branch deleted
✓ Checked out main and pulled latest

# Total: 5 minutes (67% faster)
```

---

#### Node.js Project (gpm itself)

**Before (v1.5.x)**:

```bash
$ gpm ship
✅ Detected language: Node.js (implicit)
✓ Running: npm run lint
✓ Running: npm test
✓ Running: npm run build
✓ All checks passed
✓ PR created and merged
```

**After (v1.6.0+)**:

```bash
$ gpm ship
🔍 Detected language: Node.js (95% confidence from package.json)
✓ Running: npm run lint      # Same as before
✓ Running: npm test          # Same as before
✓ Running: npm run build     # Same as before
✓ All checks passed
✓ PR created and merged

# Behavior unchanged - backward compatible!
```

---

### Appendix E: File Structure Changes

**New Files** (Phase 1):

```
src/
├── services/
│   ├── LanguageDetectionService.ts   # NEW
│   └── AutoFixService.ts              # NEW (Phase 2)
└── utils/
    ├── ConventionalCommitParser.ts    # NEW (Phase 3)
    ├── PRGenerator.ts                 # NEW (Phase 3)
    └── CIOutputParser.ts              # NEW (Phase 4)

tests/
├── services/
│   ├── LanguageDetectionService.test.ts   # NEW
│   └── AutoFixService.test.ts             # NEW (Phase 2)
└── utils/
    ├── ConventionalCommitParser.test.ts   # NEW (Phase 3)
    ├── PRGenerator.test.ts                # NEW (Phase 3)
    └── CIOutputParser.test.ts             # NEW (Phase 4)
```

**Modified Files**:

```
src/
├── commands/
│   ├── verify.ts          # MAJOR REFACTOR (Phase 1)
│   └── ship.ts            # MINOR CHANGES (Phase 3)
├── services/
│   └── VerifyService.ts   # MINOR CHANGES (Phase 1)
├── types/
│   └── config.ts          # EXTENDED (Phase 1)
└── config/
    └── ConfigService.ts   # EXTENDED (Phase 1)

docs/
├── README.md              # UPDATED (all phases)
├── CLAUDE.md              # UPDATED (all phases)
└── guides/
    └── MULTI-LANGUAGE-SUPPORT.md   # NEW (Phase 1)
```

---

### Appendix F: Test Plan

#### Unit Tests (Phase 1)

**LanguageDetectionService**:

- [ ] `detectLanguage()` - Python project (pyproject.toml)
- [ ] `detectLanguage()` - Node.js project (package.json)
- [ ] `detectLanguage()` - Go project (go.mod)
- [ ] `detectLanguage()` - Rust project (Cargo.toml)
- [ ] `detectLanguage()` - Monorepo (Python + Node.js)
- [ ] `detectLanguage()` - No markers (fallback to Node.js)
- [ ] `detectLanguage()` - Config override (.gpm.yml)
- [ ] `getToolCommands()` - Python tools
- [ ] `getToolCommands()` - Node.js tools
- [ ] `getToolCommands()` - Go tools
- [ ] `getToolCommands()` - Rust tools
- [ ] `getMakefileTargets()` - Parse simple Makefile
- [ ] `getMakefileTargets()` - Parse complex Makefile
- [ ] `getMakefileTargets()` - No Makefile (empty array)
- [ ] `checkToolAvailable()` - Tool exists
- [ ] `checkToolAvailable()` - Tool missing
- [ ] `checkToolAvailable()` - Cache hit

**verify command**:

- [ ] Verify Python project with Makefile
- [ ] Verify Python project without Makefile
- [ ] Verify Node.js project (regression test)
- [ ] Verify with missing tools (skip gracefully)
- [ ] Verify with config override
- [ ] Verify with `--skip-lint` flag
- [ ] Verify with `--json` output

**ConfigService**:

- [ ] Load config with new language section
- [ ] Validate language config
- [ ] Validate autoFix config
- [ ] Backward compatibility (old config format)

#### Integration Tests (Phase 1)

- [ ] End-to-end: Python project verification
- [ ] End-to-end: Node.js project verification (no regression)
- [ ] End-to-end: Go project verification
- [ ] End-to-end: Rust project verification
- [ ] End-to-end: Makefile preference
- [ ] End-to-end: Config override

#### Real-World Validation

- [ ] auditor-toolkit PR workflow (Python)
- [ ] gpm itself (Node.js regression test)
- [ ] Sample Go project
- [ ] Sample Rust project

---

### Appendix G: Migration Guide

#### Upgrading from v1.5.x to v1.6.0

**No Changes Required** for Node.js projects - gpm will detect Node.js automatically and use the same commands as before.

**Optional Enhancements** for Node.js projects:

1. **Add language config** to `.gpm.yml` (optional):

```yaml
language:
  primary: nodejs
```

2. **Use Makefile targets** (optional):

```yaml
verification:
  preferMakefile: true
```

**Recommended for Python projects**:

1. **Create `.gpm.yml`**:

```yaml
language:
  primary: python

verification:
  preferMakefile: true # If you have a Makefile

  # Or specify custom commands:
  commands:
    lint: ruff check .
    test: pytest tests/
    typecheck: mypy .
    format: ruff format .
```

2. **Verify your setup**:

```bash
gpm doctor        # Check tool availability
gpm verify        # Test verification
```

3. **Use gpm workflow**:

```bash
gpm ship          # Full workflow
```

**Recommended for Go/Rust projects**:

See examples in README.md and docs/guides/MULTI-LANGUAGE-SUPPORT.md.

---

### Appendix H: Future Enhancements (v1.9.0+)

**Not in Scope** for current roadmap but worth considering:

1. **Visual Diff Before Auto-Fix**
   - Show code diff before applying fixes
   - Interactive approval (y/n for each file)
   - Estimated effort: 6-8 hours

2. **Multi-Language Monorepo Support**
   - Detect multiple languages in same repo
   - Run appropriate tools per directory
   - Support Nx/Turborepo/Lerna patterns
   - Estimated effort: 12-16 hours

3. **Plugin System**
   - Allow users to add custom language support
   - Plugin API for tool detection and commands
   - Community-contributed plugins
   - Estimated effort: 20-30 hours

4. **IDE Integration**
   - VSCode extension for gpm
   - Show verification status in editor
   - One-click auto-fix from IDE
   - Estimated effort: 30-40 hours

5. **CI Workflow Generation**
   - Generate GitHub Actions workflow from .gpm.yml
   - Support GitLab CI, CircleCI, etc.
   - Keep workflows in sync with config
   - Estimated effort: 15-20 hours

---

## Conclusion

This implementation plan addresses all issues identified in the auditor-toolkit feedback and provides a clear path to multi-language support in gpm.

**Key Takeaways**:

- **Phase 1 is critical** - Language detection is the foundation
- **Incremental delivery** - v1.6.0 → v1.7.0 → v1.8.0+
- **Backward compatible** - No breaking changes for existing users
- **Real-world validated** - Based on actual user feedback and data
- **Well-researched** - Using proven patterns from GitHub Linguist, Ruff, etc.
- **Risk-mitigated** - Clear strategies for handling edge cases

**Estimated Timeline** (revised after Zen DeepThink analysis):

- Phase 1a - Foundation (v1.6.0-beta.1): 4-5 weeks (23-30 hours)
- Phase 1b - Operational (v1.6.0): 2-3 weeks (12-17 hours)
- Phase 2 - Auto-Fix (v1.7.0): 2-3 weeks (14-19 hours)
- Phase 3 - PR Generation (v1.7.0/v1.8.0): 1-2 weeks (4-8 hours)
- Phase 4 - CI Parsing (v1.8.0/v1.9.0): 2-3 weeks (10-14 hours)
- **Total**: 11-16 weeks (63-88 hours)

**Next Steps**:

1. Review and approve this plan
2. Create GitHub milestone for v1.6.0
3. Create issues for Phase 1 tasks
4. Begin implementation of LanguageDetectionService
5. Beta test with auditor-toolkit
6. Release v1.6.0-beta.1 for community feedback

---

**Document Version**: 2.0 (Zen DeepThink Analysis Complete)
**Last Updated**: 2025-11-17
**Status**: Ready for Implementation
**Confidence Level**: VERY HIGH (Expert Validated)
