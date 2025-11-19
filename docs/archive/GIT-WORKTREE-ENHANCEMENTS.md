# Git Worktree Enhancements - Implementation Plan

**Version**: 1.5.0
**Date**: 2025-11-15
**Status**: 📋 Planning Phase - Ready for Implementation
**Scope**: Targeted improvements for git worktree workflows

---

## Executive Summary

This plan outlines targeted enhancements to improve gpm's user experience for developers using git worktrees. While gpm's core workflows already function correctly in worktree environments, there are specific pain points that can be addressed with minimal complexity.

### Current State

**✅ What Works:**

- Core workflows (feature, ship, auto) function in worktree contexts via simple-git 3.21.0
- Git hooks properly installed to shared location (`.bare/hooks/`) using `git rev-parse --git-common-dir`
- All git operations (checkout, push, pull, merge, stash) work correctly in worktrees
- 15 tests covering worktree hook scenarios

**❌ What's Missing:**

- No detection of branch conflicts across worktrees
- No worktree management commands
- Generic error messages don't help worktree users
- No visibility into worktree structure from gpm

### The Problem

**Critical User Pain Point:**

```bash
# Developer in worktree1
$ gpm feature my-branch

# Branch already checked out in worktree2
fatal: 'my-branch' is already checked out at '/path/to/worktree2'
```

**Why This Happens:**

- `feature.ts:42-46` checks `branchExists()` which only queries local branches
- Doesn't detect if branch is active in another worktree
- Git's error message is cryptic without context

### Proposed Solution

Three-phase enhancement plan:

| Phase       | Focus                     | Effort   | Impact                             |
| ----------- | ------------------------- | -------- | ---------------------------------- |
| **Phase 1** | Branch Conflict Detection | 2-3 days | **HIGH** - Prevents cryptic errors |
| **Phase 2** | Enhanced Error Context    | 1 day    | **MEDIUM** - Better UX             |
| **Phase 3** | Basic Worktree Commands   | 2-3 days | **LOW** - Convenience feature      |

**Total Effort**: 5-7 days for all phases (3-4 days for essential phases 1-2)

### Key Benefits

| Aspect                 | Before                          | After                                  | Improvement     |
| ---------------------- | ------------------------------- | -------------------------------------- | --------------- |
| **Error Clarity**      | ⚠️ "fatal: already checked out" | ✅ "Branch active in: /path/worktree2" | 90% clearer     |
| **Resolution Time**    | ⚠️ 5-10 min investigation       | ✅ Immediate worktree path shown       | 80-90% faster   |
| **Worktree Discovery** | ⚠️ Manual `git worktree list`   | ✅ `gpm worktree list` (Phase 3)       | Integrated UX   |
| **Branch Safety**      | ❌ No pre-checkout validation   | ✅ Worktree conflict detection         | Prevents errors |

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Technical Investigation](#technical-investigation)
3. [Architecture Design](#architecture-design)
4. [Phase 1: Branch Conflict Detection](#phase-1-branch-conflict-detection)
5. [Phase 2: Enhanced Error Context](#phase-2-enhanced-error-context)
6. [Phase 3: Basic Worktree Commands](#phase-3-basic-worktree-commands)
7. [Testing Strategy](#testing-strategy)
8. [Rollout Plan](#rollout-plan)
9. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Code Locations

**feature.ts:42-46** - Branch existence check (LOCAL only):

```typescript
// Check if branch already exists
const exists = await gitService.branchExists(branchName);
if (exists) {
  logger.error(`Branch ${chalk.cyan(branchName)} already exists`);
  process.exit(1);
}
```

**GitService.ts:124-127** - branchExists implementation:

```typescript
async branchExists(branchName: string): Promise<boolean> {
  const branches = await this.git.branch();
  return branches.all.includes(branchName);
}
```

**Problem:** `branches.all` from simple-git includes local branches but doesn't indicate if they're checked out in another worktree.

### Worktree Detection Methods

Git provides `git worktree list` command:

```bash
$ git worktree list
/path/to/project/.bare/main    abcdef1 [main]
/path/to/project/feature-a     1234567 [feature/feature-a]
/path/to/project/feature-b     7890abc [feature/feature-b]
```

**Output format:**

```
<path>    <commit-hash>    [<branch>]
```

**Parsing requirements:**

- Split by whitespace
- Extract path (column 1)
- Extract branch from `[branch-name]` (column 3)

---

## Technical Investigation

### simple-git Worktree Support

**Research findings:**

- simple-git v3.21.0 does NOT have dedicated worktree methods
- All operations work in worktree context (uses current working directory)
- No `git.worktree.list()` or `git.worktree.add()` methods
- Must use `git.raw(['worktree', 'list'])` for worktree operations

### Edge Cases to Handle

1. **Branch checked out in multiple worktrees** - Should detect and report all locations
2. **Detached HEAD in worktree** - Worktree exists but no branch
3. **Bare repository structure** - `.bare/` vs `.git/` detection
4. **Relative vs absolute paths** - Normalize for comparison
5. **Branch name variations** - `feature/test` vs `feature-test`

### Performance Considerations

- `git worktree list` is fast (~10ms for 10 worktrees)
- Cache worktree list during command execution (single call per command)
- No performance impact on standard repos (worktree list returns single entry)

---

## Architecture Design

### New Types (src/types/index.ts)

```typescript
/**
 * Git worktree information
 */
export interface WorktreeInfo {
  path: string; // Absolute path to worktree
  commit: string; // Current commit hash
  branch: string | null; // Branch name (null if detached HEAD)
  isMain: boolean; // True if this is the main/bare worktree
}

/**
 * Worktree conflict error
 */
export interface WorktreeConflict {
  branchName: string;
  worktrees: string[]; // Paths where branch is checked out
}
```

### New Error Class (src/utils/errors.ts)

```typescript
/**
 * Worktree conflict error - branch already checked out elsewhere
 */
export class WorktreeConflictError extends WorkflowError {
  constructor(
    branchName: string,
    worktreePaths: string[],
    currentPath: string,
  ) {
    const message = `Branch '${branchName}' is already checked out in another worktree`;
    const details = {
      branch: branchName,
      currentWorktree: currentPath,
      conflictingWorktrees: worktreePaths,
    };
    const suggestions = [
      `Switch to existing worktree: cd ${worktreePaths[0]}`,
      `Or use a different branch name`,
      `Or remove the worktree: git worktree remove ${worktreePaths[0]}`,
    ];

    super("WORKTREE_CONFLICT", message, details, suggestions);
    this.name = "WorktreeConflictError";
  }
}
```

### New Methods (src/services/GitService.ts)

```typescript
/**
 * Get all worktrees in repository
 */
async getWorktrees(): Promise<WorktreeInfo[]> {
  try {
    const output = await this.git.raw(['worktree', 'list', '--porcelain']);
    return parseWorktreeList(output);
  } catch (error) {
    // Not a worktree repository, return current directory as single worktree
    return [{
      path: this.workingDir,
      commit: await this.getCurrentCommit(),
      branch: await this.getCurrentBranch(),
      isMain: true
    }];
  }
}

/**
 * Check if branch is checked out in any worktree
 * Returns array of worktree paths where branch is active
 */
async getBranchWorktrees(branchName: string): Promise<string[]> {
  const worktrees = await this.getWorktrees();
  return worktrees
    .filter(w => w.branch === branchName)
    .map(w => w.path);
}

/**
 * Check if current directory is in a worktree setup
 */
async isWorktreeRepository(): Promise<boolean> {
  try {
    await this.git.raw(['worktree', 'list']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current commit hash
 */
private async getCurrentCommit(): Promise<string> {
  const log = await this.git.log({ maxCount: 1 });
  return log.latest?.hash || '';
}
```

### Helper Function (src/utils/worktree-parser.ts)

```typescript
import { WorktreeInfo } from "../types";

/**
 * Parse `git worktree list --porcelain` output
 *
 * Format:
 * worktree /path/to/worktree
 * HEAD abc123def
 * branch refs/heads/feature-name
 *
 * worktree /path/to/another
 * HEAD def456abc
 * detached
 */
export function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const entries = output.trim().split("\n\n");

  for (const entry of entries) {
    const lines = entry.split("\n");
    const info: Partial<WorktreeInfo> = {
      branch: null,
      isMain: false,
    };

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        info.path = line.substring("worktree ".length);
      } else if (line.startsWith("HEAD ")) {
        info.commit = line.substring("HEAD ".length);
      } else if (line.startsWith("branch ")) {
        const branchRef = line.substring("branch ".length);
        // Extract branch name from refs/heads/branch-name
        info.branch = branchRef.replace("refs/heads/", "");
      } else if (line === "bare") {
        info.isMain = true;
      }
    }

    if (info.path && info.commit) {
      worktrees.push(info as WorktreeInfo);
    }
  }

  return worktrees;
}
```

---

## Phase 1: Branch Conflict Detection

**Goal**: Prevent cryptic errors when branch is already checked out in another worktree

**Effort**: 2-3 days
**Priority**: HIGH (Essential)

### Implementation Steps

#### Step 1.1: Add Worktree Methods to GitService (4 hours)

**File**: `src/services/GitService.ts`

Add three new methods:

1. `getWorktrees()` - List all worktrees
2. `getBranchWorktrees(branchName)` - Check where branch is active
3. `isWorktreeRepository()` - Detect worktree setup

**Location**: After `getDefaultBranch()` method (line 235)

#### Step 1.2: Create Worktree Parser Utility (2 hours)

**File**: `src/utils/worktree-parser.ts` (NEW)

Implement `parseWorktreeList()` function with:

- Porcelain format parsing
- Branch name extraction from refs
- Detached HEAD handling
- Bare repository detection

#### Step 1.3: Add WorktreeConflictError (1 hour)

**File**: `src/utils/errors.ts`

Add new error class after `MergeConflictError` (line 169)

#### Step 1.4: Update Feature Command (3 hours)

**File**: `src/commands/feature.ts`

**Before** (lines 42-46):

```typescript
// Check if branch already exists
const exists = await gitService.branchExists(branchName);
if (exists) {
  logger.error(`Branch ${chalk.cyan(branchName)} already exists`);
  process.exit(1);
}
```

**After**:

```typescript
// Check if branch exists locally
const exists = await gitService.branchExists(branchName);
if (exists) {
  logger.error(`Branch ${chalk.cyan(branchName)} already exists`);
  process.exit(1);
}

// Check if branch is checked out in another worktree
const worktrees = await gitService.getBranchWorktrees(branchName);
if (worktrees.length > 0) {
  const currentPath = process.cwd();
  // Filter out current worktree
  const otherWorktrees = worktrees.filter((w) => w !== currentPath);

  if (otherWorktrees.length > 0) {
    logger.error(
      `Branch ${chalk.cyan(branchName)} is already checked out in another worktree`,
      "WORKTREE_CONFLICT",
      {
        branch: branchName,
        currentWorktree: currentPath,
        conflictingWorktrees: otherWorktrees,
      },
      [
        `Switch to existing worktree: ${chalk.cyan(`cd ${otherWorktrees[0]}`)}`,
        `Or use a different branch name`,
        `Or remove the worktree: ${chalk.gray(`git worktree remove ${otherWorktrees[0]}`)}`,
      ],
    );
    process.exit(1);
  }
}
```

#### Step 1.5: Testing (6 hours)

**Test file**: `tests/services/GitService.test.ts`

Add test suite for worktree methods:

```typescript
describe("Worktree Methods", () => {
  describe("getWorktrees", () => {
    it("should parse worktree list output", async () => {
      const mockOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature/test`;

      mockGit.raw.mockResolvedValue(mockOutput);

      const worktrees = await gitService.getWorktrees();

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0]).toMatchObject({
        path: "/path/to/main",
        commit: "abc123",
        branch: "main",
      });
      expect(worktrees[1]).toMatchObject({
        path: "/path/to/feature",
        commit: "def456",
        branch: "feature/test",
      });
    });

    it("should handle detached HEAD", async () => {
      const mockOutput = `worktree /path/to/detached
HEAD abc123
detached`;

      mockGit.raw.mockResolvedValue(mockOutput);

      const worktrees = await gitService.getWorktrees();

      expect(worktrees[0].branch).toBeNull();
    });

    it("should handle non-worktree repository", async () => {
      mockGit.raw.mockRejectedValue(new Error("not a worktree"));

      const worktrees = await gitService.getWorktrees();

      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].path).toBe(process.cwd());
    });
  });

  describe("getBranchWorktrees", () => {
    it("should return empty array when branch not checked out", async () => {
      mockGit.raw.mockResolvedValue(
        "worktree /path/main\nHEAD abc\nbranch refs/heads/main",
      );

      const paths = await gitService.getBranchWorktrees("feature/test");

      expect(paths).toEqual([]);
    });

    it("should return worktree paths where branch is active", async () => {
      const mockOutput = `worktree /path/worktree1
HEAD abc123
branch refs/heads/feature/test

worktree /path/worktree2
HEAD def456
branch refs/heads/main

worktree /path/worktree3
HEAD ghi789
branch refs/heads/feature/test`;

      mockGit.raw.mockResolvedValue(mockOutput);

      const paths = await gitService.getBranchWorktrees("feature/test");

      expect(paths).toEqual(["/path/worktree1", "/path/worktree3"]);
    });
  });

  describe("isWorktreeRepository", () => {
    it("should return true for worktree repo", async () => {
      mockGit.raw.mockResolvedValue(
        "worktree /path\nHEAD abc\nbranch refs/heads/main",
      );

      const isWorktree = await gitService.isWorktreeRepository();

      expect(isWorktree).toBe(true);
    });

    it("should return false for standard repo", async () => {
      mockGit.raw.mockRejectedValue(new Error("not a worktree"));

      const isWorktree = await gitService.isWorktreeRepository();

      expect(isWorktree).toBe(false);
    });
  });
});
```

**Test file**: `tests/utils/worktree-parser.test.ts` (NEW)

```typescript
import { parseWorktreeList } from "../../src/utils/worktree-parser";

describe("parseWorktreeList", () => {
  it("should parse standard worktree output", () => {
    const output = `worktree /path/to/main
HEAD abc123def
branch refs/heads/main

worktree /path/to/feature
HEAD def456abc
branch refs/heads/feature/test`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(2);
    expect(worktrees[0]).toEqual({
      path: "/path/to/main",
      commit: "abc123def",
      branch: "main",
      isMain: false,
    });
  });

  it("should handle detached HEAD", () => {
    const output = `worktree /path/to/detached
HEAD abc123def
detached`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees[0].branch).toBeNull();
  });

  it("should detect bare repository", () => {
    const output = `worktree /path/to/.bare
HEAD 0000000
bare`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees[0].isMain).toBe(true);
  });
});
```

**Test file**: `tests/commands/feature.test.ts`

Add worktree conflict tests:

```typescript
describe("worktree conflict detection", () => {
  it("should error when branch checked out in another worktree", async () => {
    mockGit.getBranchInfo.mockResolvedValue({ isClean: true, current: "main" });
    mockGit.getDefaultBranch.mockResolvedValue("main");
    mockGit.branchExists.mockResolvedValue(false);
    mockGit.getBranchWorktrees.mockResolvedValue(["/path/to/other/worktree"]);

    await expect(featureCommand("test-feature", {})).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("already checked out in another worktree"),
      "WORKTREE_CONFLICT",
      expect.objectContaining({
        branch: "feature/test-feature",
        conflictingWorktrees: ["/path/to/other/worktree"],
      }),
      expect.any(Array),
    );
  });

  it("should succeed when branch checked out in current worktree only", async () => {
    mockGit.getBranchInfo.mockResolvedValue({ isClean: true, current: "main" });
    mockGit.branchExists.mockResolvedValue(false);
    mockGit.getBranchWorktrees.mockResolvedValue([process.cwd()]);

    // Should not throw
    await featureCommand("test-feature", {});
  });
});
```

**Total tests**: ~15 new tests

### Deliverables

- ✅ 3 new methods in GitService
- ✅ 1 new utility file (worktree-parser.ts)
- ✅ 1 new error class
- ✅ Updated feature command with conflict detection
- ✅ 15+ new tests
- ✅ Documentation in quickrefs/

---

## Phase 2: Enhanced Error Context

**Goal**: Include worktree context in all error messages for better debugging

**Effort**: 1 day
**Priority**: MEDIUM (Important)

### Implementation Steps

#### Step 2.1: Add Worktree Context to Logger (2 hours)

**File**: `src/utils/logger.ts`

Add worktree detection to error output:

```typescript
/**
 * Get current worktree context for error messages
 */
async function getWorktreeContext(): Promise<string | null> {
  try {
    const git = simpleGit(process.cwd());
    const output = await git.raw(['worktree', 'list']);

    // Find current worktree from output
    const cwd = process.cwd();
    const lines = output.split('\n');
    const currentLine = lines.find(line => line.startsWith(cwd));

    if (currentLine) {
      // Extract branch from line
      const match = currentLine.match(/\[(.+?)\]/);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Enhanced error method with worktree context
 */
async errorWithContext(
  message: string,
  code?: string,
  details?: any,
  suggestions?: string[]
): Promise<void> {
  const worktreeBranch = await getWorktreeContext();

  if (worktreeBranch) {
    this.log(chalk.gray(`Worktree: ${worktreeBranch}`));
  }

  this.error(message, code, details, suggestions);
}
```

#### Step 2.2: Update Error Classes (2 hours)

**File**: `src/utils/errors.ts`

Add worktree path to error details:

```typescript
export class GitError extends WorkflowError {
  constructor(message: string, details?: any, suggestions: string[] = []) {
    // Add worktree context if available
    const enhancedDetails = {
      ...details,
      worktree: process.cwd(), // Can be enhanced with branch info
    };

    super("GIT_ERROR", message, enhancedDetails, suggestions);
    this.name = "GitError";
  }
}
```

#### Step 2.3: Testing (2 hours)

Add tests for error context:

```typescript
describe("error context", () => {
  it("should include worktree path in GitError", () => {
    const error = new GitError("Test error", { file: "test.ts" });

    expect(error.details.worktree).toBe(process.cwd());
  });
});
```

### Deliverables

- ✅ Worktree context in error messages
- ✅ Enhanced error classes
- ✅ 5+ new tests

---

## Phase 3: Basic Worktree Commands

**Goal**: Provide convenient worktree management without replacing `git worktree`

**Effort**: 2-3 days
**Priority**: LOW (Nice-to-have)

### Implementation Steps

#### Step 3.1: Add `gpm worktree list` Command (4 hours)

**File**: `src/commands/worktree.ts` (NEW)

```typescript
import { GitService } from "../services/GitService";
import { logger } from "../utils/logger";
import chalk from "chalk";

interface WorktreeListOptions {
  json?: boolean;
}

/**
 * List all worktrees
 */
export async function worktreeListCommand(
  options: WorktreeListOptions = {},
): Promise<void> {
  try {
    const gitService = new GitService({ workingDir: process.cwd() });
    const worktrees = await gitService.getWorktrees();

    if (options.json) {
      logger.outputJsonResult(true, { worktrees });
      return;
    }

    logger.section("Git Worktrees");

    if (worktrees.length === 0) {
      logger.warn("No worktrees found");
      return;
    }

    for (const worktree of worktrees) {
      const isCurrent = worktree.path === process.cwd();
      const marker = isCurrent ? chalk.green("*") : " ";
      const branch = worktree.branch || chalk.gray("(detached)");
      const mainTag = worktree.isMain ? chalk.blue("[main]") : "";

      logger.log(`${marker} ${chalk.cyan(worktree.path)}`);
      logger.log(`  ${branch} ${mainTag}`);
      logger.log(`  ${chalk.gray(worktree.commit.substring(0, 7))}`);
      logger.blank();
    }

    logger.info(
      `Total: ${worktrees.length} worktree${worktrees.length !== 1 ? "s" : ""}`,
    );
  } catch (error: any) {
    logger.error(error.message);
    process.exit(1);
  }
}
```

#### Step 3.2: Add `gpm worktree prune` Command (3 hours)

**File**: `src/commands/worktree.ts`

```typescript
interface WorktreePruneOptions {
  dryRun?: boolean;
}

/**
 * Prune stale worktree administrative data
 */
export async function worktreePruneCommand(
  options: WorktreePruneOptions = {},
): Promise<void> {
  try {
    const gitService = new GitService({ workingDir: process.cwd() });

    if (options.dryRun) {
      logger.info("Dry run - showing what would be pruned:");
      await gitService.git.raw(["worktree", "prune", "--dry-run", "--verbose"]);
    } else {
      spinner.start("Pruning stale worktrees...");
      await gitService.git.raw(["worktree", "prune", "--verbose"]);
      spinner.succeed("Worktrees pruned");
    }
  } catch (error: any) {
    spinner.fail("Failed to prune worktrees");
    logger.error(error.message);
    process.exit(1);
  }
}
```

#### Step 3.3: Register Commands (1 hour)

**File**: `src/index.ts`

```typescript
import { worktreeListCommand, worktreePruneCommand } from "./commands/worktree";

// Add worktree command group
const worktree = program
  .command("worktree")
  .description("Manage git worktrees");

worktree
  .command("list")
  .description("List all worktrees")
  .option("--json", "Output as JSON")
  .action(worktreeListCommand);

worktree
  .command("prune")
  .description("Prune stale worktree data")
  .option("--dry-run", "Show what would be pruned")
  .action(worktreePruneCommand);
```

#### Step 3.4: Testing (8 hours)

**Test file**: `tests/commands/worktree.test.ts` (NEW)

```typescript
describe("worktree commands", () => {
  describe("list", () => {
    it("should display worktree list", async () => {
      mockGit.getWorktrees.mockResolvedValue([
        { path: "/path/main", commit: "abc123", branch: "main", isMain: true },
        {
          path: "/path/feature",
          commit: "def456",
          branch: "feature/test",
          isMain: false,
        },
      ]);

      await worktreeListCommand({});

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("/path/main"),
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("main"));
    });

    it("should output JSON when requested", async () => {
      const worktrees = [
        { path: "/path/main", commit: "abc123", branch: "main", isMain: true },
      ];
      mockGit.getWorktrees.mockResolvedValue(worktrees);

      await worktreeListCommand({ json: true });

      expect(logger.outputJsonResult).toHaveBeenCalledWith(true, { worktrees });
    });
  });

  describe("prune", () => {
    it("should prune worktrees", async () => {
      await worktreePruneCommand({});

      expect(mockGit.raw).toHaveBeenCalledWith([
        "worktree",
        "prune",
        "--verbose",
      ]);
    });

    it("should support dry-run mode", async () => {
      await worktreePruneCommand({ dryRun: true });

      expect(mockGit.raw).toHaveBeenCalledWith([
        "worktree",
        "prune",
        "--dry-run",
        "--verbose",
      ]);
    });
  });
});
```

#### Step 3.5: Documentation (2 hours)

Update README.md and quickrefs:

````markdown
### Worktree Management

**List worktrees:**

```bash
gpm worktree list           # Human-readable format
gpm worktree list --json    # JSON output
```
````

**Prune stale worktrees:**

```bash
gpm worktree prune              # Remove stale entries
gpm worktree prune --dry-run    # Preview what would be removed
```

```

### Deliverables

- ✅ 2 new worktree commands
- ✅ Command registration
- ✅ 10+ new tests
- ✅ Documentation updates

---

## Testing Strategy

### Test Coverage Targets

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| GitService worktree methods | 0% | 95% | HIGH |
| worktree-parser | 0% | 100% | HIGH |
| feature command conflict detection | 75% | 95% | HIGH |
| worktree commands | 0% | 90% | MEDIUM |
| Error classes | 100% | 100% | - |

### Test Types

#### Unit Tests
- GitService worktree methods
- Worktree parser (porcelain format)
- Error classes
- Command logic

#### Integration Tests
- End-to-end feature command with worktree conflict
- Worktree list across multiple worktrees
- Prune command with orphaned worktrees

#### Edge Case Tests
- Detached HEAD worktrees
- Bare repository detection
- Empty worktree list
- Malformed git output
- Non-worktree repositories

### Manual Testing Checklist

**Phase 1:**
- [ ] Create 3 worktrees with different branches
- [ ] Attempt `gpm feature` with existing branch - verify error message
- [ ] Attempt `gpm feature` with new branch - verify success
- [ ] Test in standard (non-worktree) repo - verify no regression

**Phase 2:**
- [ ] Trigger various errors in worktree context
- [ ] Verify worktree path appears in error output
- [ ] Test JSON error output includes worktree details

**Phase 3:**
- [ ] Run `gpm worktree list` with 0, 1, and 3+ worktrees
- [ ] Create orphaned worktree (delete directory manually)
- [ ] Run `gpm worktree prune --dry-run` and verify detection
- [ ] Run `gpm worktree prune` and verify cleanup

---

## Rollout Plan

### Phase 1 Rollout (Essential)

**Week 1:**
- Day 1-2: Implement worktree methods + parser
- Day 3: Update feature command
- Day 4: Testing and bug fixes
- Day 5: Documentation and PR

**Release**: v1.5.0-beta.1 (Phase 1 only)

### Phase 2 Rollout (Important)

**Week 2:**
- Day 1: Implement error context
- Day 2: Testing
- Day 3: Bug fixes and refinement

**Release**: v1.5.0-beta.2 (Phases 1-2)

### Phase 3 Rollout (Optional)

**Week 3:**
- Day 1-2: Implement worktree commands
- Day 3: Testing
- Day 4: Documentation
- Day 5: Final refinement

**Release**: v1.5.0 (All phases)

### Backwards Compatibility

✅ **No breaking changes**
- All existing commands work unchanged
- Worktree detection is transparent
- Standard repos continue to work normally

---

## Success Metrics

### User Experience Metrics

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| **Error clarity** | 3/10 | 9/10 | User survey |
| **Time to resolve conflict** | 5-10 min | 30 sec | Support tickets |
| **Worktree discovery time** | Manual | Instant | Command execution |

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Test coverage** | >90% | Jest coverage report |
| **Performance impact** | <50ms | Benchmark tests |
| **Error rate** | <1% | Error logs |
| **Adoption rate** | >50% | npm downloads |

### Success Criteria

**Phase 1:**
- ✅ Zero "already checked out" errors reach users
- ✅ All worktree conflicts detected pre-checkout
- ✅ Error messages include actionable worktree paths

**Phase 2:**
- ✅ All errors include worktree context
- ✅ Debugging time reduced by 50%

**Phase 3:**
- ✅ Users can manage worktrees without leaving gpm
- ✅ Worktree list adoption >25% of worktree users

---

## Risk Assessment

### Low Risk
- ✅ Simple-git already handles worktrees correctly
- ✅ Changes are additive (no modifications to core git operations)
- ✅ Backwards compatible (standard repos unaffected)

### Medium Risk
- ⚠️ Git worktree output format changes (mitigation: use --porcelain)
- ⚠️ Performance impact on large repos (mitigation: caching)

### Mitigation Strategies

1. **Output format changes**: Use `--porcelain` flag for stable output
2. **Performance**: Cache worktree list during command execution
3. **Edge cases**: Comprehensive test suite with real worktree scenarios
4. **User feedback**: Beta releases for Phases 1-2 before stable release

---

## Future Enhancements (Out of Scope)

**Not included in this plan:**
- ❌ `gpm worktree add` - Complex, low ROI (users can use `git worktree add`)
- ❌ `gpm worktree remove` - Dangerous operation, defer to git
- ❌ Automatic worktree switching - UX unclear, needs research
- ❌ Worktree-aware PR merging - Complex dependency tracking

**Potential v1.6.0 features:**
- Multi-worktree PR coordination
- Worktree-based CI optimization
- Worktree cleanup automation

---

## Appendix

### Git Worktree Primer

**What are worktrees?**
Git worktrees allow multiple working directories from a single repository. Each worktree can have different branches checked out simultaneously.

**Structure:**
```

project/
├── .bare/ # Bare git repository
│ └── hooks/ # Shared hooks
├── main/ # Worktree for main branch
├── feature-a/ # Worktree for feature-a
└── feature-b/ # Worktree for feature-b

````

**Common commands:**
```bash
# Create new worktree
git worktree add path/to/worktree branch-name

# List worktrees
git worktree list

# Remove worktree
git worktree remove path/to/worktree

# Prune stale worktree data
git worktree prune
````

### References

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [simple-git Documentation](https://github.com/steveukx/git-js)
- [Git Worktree Tutorial](https://morgan.cugerone.com/blog/workarounds-to-git-worktree-using-bare-repository-and-cannot-fetch-remote-branches/)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-15
**Author**: Claude Code + Nathan Schram
**Status**: Ready for Implementation
