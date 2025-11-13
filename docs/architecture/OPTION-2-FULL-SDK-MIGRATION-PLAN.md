# git-workflow-manager: Option 2 - Full SDK Migration Plan

**Version**: 1.0.0
**Date**: 2025-11-12
**Status**: 📋 Planning Phase - Ready for Review
**Research Sources**: Octokit.js documentation, GitHub API docs, Context7

---

## Executive Summary

This document outlines a complete migration strategy for git-workflow-manager from bash + gh CLI to Node.js + Octokit SDK. This represents Option 2 from the integration guide - a full rewrite prioritizing type safety, testability, and programmatic control.

### Key Benefits

| Aspect | Current (Bash + gh CLI) | After Migration (Node.js + SDK) |
|--------|-------------------------|----------------------------------|
| **Type Safety** | ❌ No types, string-based | ✅ Full TypeScript definitions |
| **Error Handling** | ⚠️ Exit codes, string parsing | ✅ Try/catch with structured errors |
| **Testing** | ⚠️ Live API only | ✅ Mock with Nock, unit + integration tests |
| **CI Polling** | ⚠️ Manual `gh pr checks --watch` | ✅ Async `waitForChecks()` with progress |
| **Maintainability** | ⚠️ Complex bash scripts | ✅ Modular TypeScript/JavaScript |
| **Debugging** | ⚠️ Echo debugging | ✅ Structured logging, stack traces |
| **IDE Support** | ❌ No autocomplete | ✅ IntelliSense, inline documentation |
| **Code Reuse** | ⚠️ Functions repeated | ✅ Shared SDK code across projects |

### Migration Effort

**Estimated Time**: 2-3 weeks (60-80 hours)
- **Week 1**: Core PR automation (20-30 hours)
- **Week 2**: Git integration + testing (20-30 hours)
- **Week 3**: Polish + documentation (15-20 hours)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [Command Mapping](#command-mapping)
4. [Technical Design](#technical-design)
5. [Error Handling Strategy](#error-handling-strategy)
6. [Implementation Phases](#implementation-phases)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Plan](#rollback-plan)
9. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Current Tech Stack

```
git-workflow-manager (v0.3.0)
├── Language: Bash
├── Git Operations: git CLI
├── GitHub Operations: gh CLI
├── PR Templates: ✅ Supported (v0.3.0)
├── CI Polling: ⚠️ Manual (`gh pr checks --watch`)
├── Testing: ❌ None (manual only)
└── Type Safety: ❌ None
```

### Current Workflow (Bash)

```bash
gwm ship
  ├── 1. Preflight Checks (bash)
  │   ├── Current branch validation
  │   ├── Uncommitted changes check
  │   ├── Remote configured
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
  │   ├── Option A: gh pr create --fill
  │   └── Option B: gh pr create --body-file (with template)
  │
  ├── 5. Wait for CI (gh CLI - BLOCKING)
  │   └── gh pr checks --watch (manual polling)
  │
  ├── 6. Merge PR (gh CLI)
  │   └── gh pr merge --squash
  │
  └── 7. Delete Branch (git CLI)
      └── git push origin --delete feature/branch
```

### Pain Points in Current Implementation

1. **CI Polling** - `gh pr checks --watch` is blocking and provides poor feedback
2. **Error Handling** - Exit codes are ambiguous, string parsing is fragile
3. **Testing** - No automated tests, relies on manual verification
4. **Debugging** - Echo statements only, no structured logging
5. **Extensibility** - Hard to add features (webhooks, notifications, etc.)
6. **Code Reuse** - Cannot share logic with other tools
7. **Type Safety** - No compile-time checks, runtime errors only

---

## Target Architecture

### New Tech Stack

```
git-workflow-manager (v1.0.0 - SDK-based)
├── Language: TypeScript (compiled to JavaScript)
├── Git Operations: simple-git (npm package)
├── GitHub Operations: Octokit SDK (@octokit/rest)
├── PR Templates: ✅ Enhanced (programmatic merging)
├── CI Polling: ✅ Async polling with progress
├── Testing: ✅ Jest + Nock (unit + integration)
└── Type Safety: ✅ Full TypeScript
```

### Project Structure

```
git-workflow-manager/
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── commands/
│   │   ├── init.ts              # gwm init
│   │   ├── feature-start.ts     # gwm feature start
│   │   ├── ship.ts              # gwm ship ⭐
│   │   └── status.ts            # gwm status
│   ├── lib/
│   │   ├── github.ts            # Octokit wrapper
│   │   ├── git.ts               # Git operations (simple-git)
│   │   ├── pr-template.ts       # Template discovery + merging
│   │   ├── ci-poller.ts         # Async CI status polling
│   │   ├── verify.ts            # Run verify.sh with progress
│   │   └── config.ts            # .gwm.yml management
│   ├── types/
│   │   ├── config.ts            # Config types
│   │   ├── pr.ts                # PR types
│   │   └── checks.ts            # CI check types
│   └── utils/
│       ├── logger.ts            # Structured logging
│       ├── spinner.ts           # CLI progress indicators
│       └── errors.ts            # Custom error classes
├── tests/
│   ├── unit/
│   │   ├── github.test.ts
│   │   ├── pr-template.test.ts
│   │   └── ci-poller.test.ts
│   ├── integration/
│   │   ├── ship-workflow.test.ts
│   │   └── pr-creation.test.ts
│   └── fixtures/
│       ├── pr-templates/
│       └── mock-responses/
├── dist/                        # Compiled JavaScript
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

### New Workflow (Node.js + SDK)

```javascript
gwm ship
  ├── 1. Preflight Checks (TypeScript)
  │   ├── GitService.getCurrentBranch()
  │   ├── GitService.hasUncommittedChanges()
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
  │   └── PRService.createPR({ title, body, head, base })
  │
  ├── 5. Wait for CI (Octokit SDK - ASYNC)
  │   └── CIPoller.waitForChecks(prNumber)
  │       ├── Poll every 10s
  │       ├── Show live progress
  │       ├── Timeout after 10 min
  │       └── Return success/failure
  │
  ├── 6. Merge PR (Octokit SDK)
  │   └── PRService.mergePR(prNumber, 'squash')
  │
  └── 7. Delete Branch (Octokit SDK)
      └── BranchService.deleteBranch(branchName)
```

---

## Command Mapping

### Current (Bash + gh CLI) → Target (Node.js + Octokit)

#### Command: `gwm init`

**Current Implementation** (Bash):
```bash
gh auth status
git remote get-url origin
# Create .gwm.yml
```

**New Implementation** (TypeScript):
```typescript
import { Octokit } from 'octokit';
import simpleGit from 'simple-git';

async function init() {
  const git = simpleGit();
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Verify GitHub auth
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log(`✅ GitHub authenticated (user: ${user.login})`);

  // Get remote URL
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');
  console.log(`✅ Remote configured: ${origin.refs.fetch}`);

  // Create .gwm.yml
  const config = {
    version: '1.0.0',
    verify: {
      enabled: true,
      script: 'scripts/phase-2/verify.sh'
    },
    pr: {
      useTemplate: true,
      autoMerge: true,
      deleteBranchAfterMerge: true
    }
  };

  await fs.writeFile('.gwm.yml', yaml.dump(config));
  console.log('✅ Configuration created: .gwm.yml');
}
```

**Octokit Methods Used**:
- `octokit.rest.users.getAuthenticated()` - Verify GitHub auth

---

#### Command: `gwm feature start <name>`

**Current Implementation** (Bash):
```bash
git checkout main
git pull origin main
git checkout -b feature/$name
```

**New Implementation** (TypeScript):
```typescript
async function featureStart(name: string) {
  const git = simpleGit();

  // Verify on main
  const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
  if (currentBranch !== 'main') {
    throw new Error('Must be on main branch');
  }

  // Check for uncommitted changes
  const status = await git.status();
  if (status.files.length > 0) {
    throw new Error('Uncommitted changes detected');
  }

  // Pull latest
  console.log('🔄 Pulling latest from origin/main...');
  await git.pull('origin', 'main');

  // Create feature branch
  const branchName = `feature/${name}`;
  await git.checkoutLocalBranch(branchName);

  console.log(`✅ Created ${branchName}`);
  console.log('\nNext steps:');
  console.log('  1. Make your changes');
  console.log('  2. Commit: git commit -m "feat: description"');
  console.log('  3. Ship: gwm ship');
}
```

**Octokit Methods Used**: None (pure git operations)

---

#### Command: `gwm ship` (⭐ PRIMARY COMMAND)

**Current Implementation** (Bash):
```bash
# Preflight
git rev-parse --abbrev-ref HEAD
git diff-index --quiet HEAD --
gh auth status

# Verify
bash scripts/phase-2/verify.sh

# Push
git push origin $BRANCH

# Create PR
gh pr create --base main --head $BRANCH --fill

# Wait for CI
gh pr checks $PR_NUMBER --watch

# Merge
gh pr merge $PR_NUMBER --squash --delete-branch
```

**New Implementation** (TypeScript):
```typescript
async function ship(options: ShipOptions) {
  const git = simpleGit();
  const github = new GitHubService(process.env.GITHUB_TOKEN);
  const config = await Config.load('.gwm.yml');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 1: Preflight Checks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('🚀 Shipping feature...\n');

  const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
  if (!currentBranch.match(/^(feature|fix|chore)\//)) {
    throw new InvalidBranchError('Must be on a feature/fix/chore branch');
  }

  const status = await git.status();
  if (status.files.length > 0) {
    throw new UncommittedChangesError('Uncommitted changes detected');
  }

  const remotes = await git.getRemotes(true);
  if (!remotes.find(r => r.name === 'origin')) {
    throw new ConfigError('No remote origin configured');
  }

  await github.verifyAuth();
  console.log('✅ Preflight checks passed\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 2: Run verify.sh
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (config.verify.enabled && !options.noVerify) {
    const verify = new VerifyService(config.verify.script);
    await verify.runWithProgress();
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 3: Push Branch
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`⬆️  Pushing ${currentBranch} to origin...`);
  await git.push('origin', currentBranch);
  console.log('✅ Branch pushed\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 4: Create PR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('📝 Creating pull request...');

  // Get PR title and body
  const prTemplate = new PRTemplateService(git);
  const { title, body } = await prTemplate.generatePRContent({
    branch: currentBranch,
    useTemplate: config.pr.useTemplate,
    templateName: options.template
  });

  // Create PR via Octokit
  const pr = await github.createPR({
    title,
    body,
    head: currentBranch,
    base: 'main'
  });

  console.log(`✅ Pull request created: ${pr.html_url}\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 5: Wait for CI Checks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!options.forceMerge) {
    console.log('⏳ Waiting for CI checks...');

    const poller = new CIPoller(github, pr.number);
    const checksPass = await poller.waitForChecks({
      timeout: 600000,      // 10 minutes
      interval: 10000,      // Poll every 10s
      onProgress: (status) => {
        console.log(`   ${status.completed}/${status.total} checks complete`);
      }
    });

    if (!checksPass) {
      throw new CIFailedError('CI checks failed');
    }

    console.log('✅ All checks passed\n');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 6: Merge PR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('🔀 Merging pull request...');

  await github.mergePR(pr.number, {
    mergeMethod: 'squash',
    commitTitle: title,
    deleteBranch: false  // We'll delete manually
  });

  console.log('✅ Pull request merged\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 7: Delete Branch
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (config.pr.deleteBranchAfterMerge && !options.noDelete) {
    console.log(`🗑️  Deleting ${currentBranch}...`);

    await github.deleteBranch(currentBranch);

    // Checkout main locally
    await git.checkout('main');
    await git.pull('origin', 'main');

    console.log('✅ Branch deleted\n');
  }

  console.log('✨ Feature shipped successfully!');
  console.log(`PR: ${pr.html_url}`);
}
```

**Octokit Methods Used**:
- `octokit.rest.users.getAuthenticated()` - Verify auth
- `octokit.rest.pulls.create()` - Create PR
- `octokit.rest.pulls.get()` - Get PR details
- `octokit.rest.repos.getCombinedStatusForRef()` - Get CI status
- `octokit.rest.checks.listForRef()` - Get check runs
- `octokit.rest.pulls.merge()` - Merge PR
- `octokit.rest.git.deleteRef()` - Delete branch

---

## Technical Design

### Core Services

#### 1. GitHubService

Wraps Octokit SDK for all GitHub operations.

```typescript
import { Octokit } from 'octokit';
import { RequestError } from '@octokit/request-error';

export interface CreatePROptions {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface MergePROptions {
  mergeMethod: 'merge' | 'squash' | 'rebase';
  commitTitle?: string;
  commitMessage?: string;
  deleteBranch?: boolean;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });

    // Parse owner/repo from git remote
    // e.g., git@github.com:littlebearapps/notebridge.git
    const { owner, repo } = this.parseRemoteUrl();
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Verify GitHub authentication
   */
  async verifyAuth(): Promise<void> {
    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      console.log(`✅ GitHub authenticated (user: ${user.login})`);
    } catch (error) {
      if (error instanceof RequestError) {
        throw new AuthError(`GitHub authentication failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create pull request
   */
  async createPR(options: CreatePROptions) {
    const { title, body, head, base = 'main', draft = false } = options;

    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        head,
        base,
        draft
      });

      return {
        number: data.number,
        html_url: data.html_url,
        head: data.head.sha
      };
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.status === 422) {
          throw new PRExistsError('Pull request already exists for this branch');
        } else if (error.status === 404) {
          throw new NotFoundError('Repository not found or no access');
        }
      }
      throw error;
    }
  }

  /**
   * Get pull request details
   */
  async getPR(prNumber: number) {
    const { data } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    return data;
  }

  /**
   * Merge pull request
   */
  async mergePR(prNumber: number, options: MergePROptions) {
    const { mergeMethod, commitTitle, commitMessage, deleteBranch = false } = options;

    try {
      const { data } = await this.octokit.rest.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: mergeMethod,
        commit_title: commitTitle,
        commit_message: commitMessage
      });

      return {
        merged: data.merged,
        sha: data.sha
      };
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.status === 405) {
          throw new MergeBlockedError('PR cannot be merged (conflicts or failed checks)');
        } else if (error.status === 409) {
          throw new MergeConflictError('PR has merge conflicts');
        }
      }
      throw error;
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(branch: string) {
    await this.octokit.rest.git.deleteRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branch}`
    });
  }

  private parseRemoteUrl(): { owner: string; repo: string } {
    // Parse from git remote (implementation omitted for brevity)
    // Returns { owner: 'littlebearapps', repo: 'notebridge' }
  }
}
```

#### 2. CIPoller

Async CI status polling with progress updates.

```typescript
export interface CIStatus {
  state: 'pending' | 'success' | 'failure' | 'error';
  completed: number;
  total: number;
  checks: CheckRun[];
}

export interface CheckRun {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
}

export interface WaitOptions {
  timeout: number;
  interval: number;
  onProgress?: (status: CIStatus) => void;
}

export class CIPoller {
  private github: GitHubService;
  private prNumber: number;

  constructor(github: GitHubService, prNumber: number) {
    this.github = github;
    this.prNumber = prNumber;
  }

  /**
   * Wait for all CI checks to complete
   *
   * Polls GitHub's combined status + check runs APIs
   * Returns true if all checks pass, false if any fail
   */
  async waitForChecks(options: WaitOptions): Promise<boolean> {
    const { timeout, interval, onProgress } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Get PR details to get head SHA
      const pr = await this.github.getPR(this.prNumber);
      const headSha = pr.head.sha;

      // Get combined status (legacy commit statuses)
      const { data: combinedStatus } = await this.github.octokit.rest.repos
        .getCombinedStatusForRef({
          owner: this.github.owner,
          repo: this.github.repo,
          ref: headSha
        });

      // Get check runs (GitHub Actions, Apps)
      const { data: checkRuns } = await this.github.octokit.rest.checks
        .listForRef({
          owner: this.github.owner,
          repo: this.github.repo,
          ref: headSha
        });

      // Combine both status types
      const allChecks = [
        ...combinedStatus.statuses.map(s => ({
          name: s.context,
          status: s.state === 'pending' ? 'in_progress' : 'completed',
          conclusion: s.state === 'success' ? 'success' : s.state === 'failure' ? 'failure' : null
        })),
        ...checkRuns.check_runs.map(c => ({
          name: c.name,
          status: c.status,
          conclusion: c.conclusion
        }))
      ];

      const status: CIStatus = {
        state: this.determineOverallState(allChecks),
        completed: allChecks.filter(c => c.status === 'completed').length,
        total: allChecks.length,
        checks: allChecks
      };

      // Call progress callback
      if (onProgress) {
        onProgress(status);
      }

      // Check if all done
      if (status.state === 'success') {
        return true;
      } else if (status.state === 'failure' || status.state === 'error') {
        return false;
      }

      // Wait before next poll
      await this.sleep(interval);
    }

    throw new TimeoutError('Timeout waiting for CI checks');
  }

  private determineOverallState(checks: CheckRun[]): CIStatus['state'] {
    if (checks.length === 0) return 'success'; // No checks = pass

    const allCompleted = checks.every(c => c.status === 'completed');

    if (!allCompleted) return 'pending';

    const anyFailed = checks.some(c =>
      c.conclusion === 'failure' || c.conclusion === 'cancelled'
    );

    return anyFailed ? 'failure' : 'success';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 3. PRTemplateService

Template discovery and placeholder replacement.

```typescript
export class PRTemplateService {
  private git: SimpleGit;

  constructor(git: SimpleGit) {
    this.git = git;
  }

  /**
   * Generate PR title and body
   */
  async generatePRContent(options: {
    branch: string;
    useTemplate: boolean;
    templateName?: string;
  }): Promise<{ title: string; body: string }> {
    const { branch, useTemplate, templateName } = options;

    // Get commits for this branch
    const log = await this.git.log({ from: 'main', to: branch });
    const commits = log.all;

    // Generate title from first commit or branch name
    const title = commits[0]?.message || this.branchToTitle(branch);

    // Generate body
    let body: string;

    if (useTemplate) {
      // Try to find and use template
      const template = await this.discoverTemplate(templateName);

      if (template) {
        body = await this.mergeTemplateWithData(template, {
          branch,
          title,
          commits
        });
      } else {
        // Fallback to commit messages
        body = this.generateBodyFromCommits(commits);
      }
    } else {
      // No template - use commit messages
      body = this.generateBodyFromCommits(commits);
    }

    return { title, body };
  }

  /**
   * Discover PR template in standard locations
   */
  private async discoverTemplate(name?: string): Promise<string | null> {
    const templatePaths = [
      `.github/PULL_REQUEST_TEMPLATE/${name || 'default'}.md`,
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/pull_request_template.md',
      'docs/PULL_REQUEST_TEMPLATE.md'
    ];

    for (const path of templatePaths) {
      if (await this.fileExists(path)) {
        return fs.readFile(path, 'utf-8');
      }
    }

    return null;
  }

  /**
   * Merge template with actual data
   */
  private async mergeTemplateWithData(
    template: string,
    data: { branch: string; title: string; commits: any[] }
  ): Promise<string> {
    let merged = template;

    // Replace {{BRANCH}}
    merged = merged.replace(/\{\{BRANCH\}\}/g, data.branch);

    // Replace {{SUMMARY}}
    merged = merged.replace(/\{\{SUMMARY\}\}/g, data.title);

    // Replace {{COMMITS}}
    const commitList = data.commits
      .map(c => `- ${c.message}`)
      .join('\n');
    merged = merged.replace(/\{\{COMMITS\}\}/g, commitList);

    // Replace {{CHANGES}}
    const changes = await this.getChangesSummary();
    merged = merged.replace(/\{\{CHANGES\}\}/g, changes);

    return merged;
  }

  private generateBodyFromCommits(commits: any[]): string {
    return commits.map(c => `- ${c.message}`).join('\n');
  }

  private branchToTitle(branch: string): string {
    // feature/add-export-button → "Add export button"
    return branch
      .replace(/^(feature|fix|chore)\//, '')
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private async getChangesSummary(): Promise<string> {
    const diff = await this.git.diff(['main', '--stat']);
    return diff;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## Error Handling Strategy

### Custom Error Classes

```typescript
/**
 * Base error class for git-workflow-manager
 */
export class GWMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * GitHub authentication error
 */
export class AuthError extends GWMError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * PR creation/merge errors
 */
export class PRExistsError extends GWMError {}
export class MergeBlockedError extends GWMError {}
export class MergeConflictError extends GWMError {}

/**
 * CI check errors
 */
export class CIFailedError extends GWMError {
  constructor(
    message: string,
    public failedChecks: string[]
  ) {
    super(message);
  }
}

export class TimeoutError extends GWMError {}

/**
 * Git operation errors
 */
export class UncommittedChangesError extends GWMError {}
export class InvalidBranchError extends GWMError {}
export class ConfigError extends GWMError {}
export class NotFoundError extends GWMError {}
```

### Error Handling Pattern

```typescript
try {
  await ship(options);
} catch (error) {
  // Handle Octokit request errors
  if (error instanceof RequestError) {
    if (error.status === 401) {
      console.error('❌ GitHub authentication failed');
      console.error('   Set GITHUB_TOKEN environment variable');
      process.exit(1);
    } else if (error.status === 422) {
      console.error('❌ Pull request already exists for this branch');
      console.error('   View PR: gh pr view');
      process.exit(1);
    } else if (error.status === 404) {
      console.error('❌ Repository not found or no access');
      process.exit(1);
    }
  }

  // Handle custom errors
  if (error instanceof CIFailedError) {
    console.error('❌ CI checks failed:');
    error.failedChecks.forEach(check => {
      console.error(`   - ${check}`);
    });
    console.error('\nFix the issues and push again, or use --force-merge to skip checks');
    process.exit(1);
  }

  if (error instanceof MergeConflictError) {
    console.error('❌ PR has merge conflicts');
    console.error('   Resolve conflicts manually:');
    console.error('   1. git fetch origin main');
    console.error('   2. git merge origin/main');
    console.error('   3. Resolve conflicts');
    console.error('   4. git push');
    process.exit(1);
  }

  // Unknown error
  console.error('❌ Unexpected error:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1 - 20-30 hours)

**Goals**:
- ✅ Project setup (TypeScript, dependencies)
- ✅ Core services (GitHubService, GitService)
- ✅ CLI framework (commander.js)
- ✅ Basic error handling

**Deliverables**:
```
✅ src/lib/github.ts - Octokit wrapper
✅ src/lib/git.ts - simple-git wrapper
✅ src/utils/errors.ts - Custom error classes
✅ src/utils/logger.ts - Structured logging
✅ src/index.ts - CLI entry point
✅ package.json - Dependencies configured
✅ tsconfig.json - TypeScript config
```

**Testing**:
- Unit tests for GitHubService (mock with Nock)
- Unit tests for error classes
- Integration test: Verify auth

---

### Phase 2: PR Automation (Week 1-2 - 20-30 hours)

**Goals**:
- ✅ CI polling implementation
- ✅ PR template support
- ✅ Complete ship workflow

**Deliverables**:
```
✅ src/lib/ci-poller.ts - Async CI polling
✅ src/lib/pr-template.ts - Template discovery + merging
✅ src/commands/ship.ts - Complete ship command
✅ tests/unit/ci-poller.test.ts - CI poller tests
✅ tests/integration/ship-workflow.test.ts - End-to-end test
```

**Testing**:
- Unit tests for CIPoller with mocked responses
- Unit tests for PRTemplateService
- Integration test: Create PR → Wait for checks → Merge

---

### Phase 3: Additional Commands (Week 2 - 10-15 hours)

**Goals**:
- ✅ Implement `gwm init`
- ✅ Implement `gwm feature start`
- ✅ Implement `gwm status`

**Deliverables**:
```
✅ src/commands/init.ts
✅ src/commands/feature-start.ts
✅ src/commands/status.ts
✅ src/lib/config.ts - .gwm.yml management
```

---

### Phase 4: Polish + Documentation (Week 3 - 15-20 hours)

**Goals**:
- ✅ Comprehensive documentation
- ✅ Examples and usage guides
- ✅ Migration guide from v0.3.0
- ✅ Performance optimization

**Deliverables**:
```
✅ README.md - Complete usage guide
✅ MIGRATION-GUIDE.md - v0.3.0 → v1.0.0
✅ EXAMPLES.md - Real-world examples
✅ Performance benchmarks
✅ Release notes
```

---

## Testing Strategy

### Unit Tests (Jest + Nock)

```typescript
// tests/unit/github.test.ts
import { GitHubService } from '../../src/lib/github';
import nock from 'nock';

describe('GitHubService', () => {
  let github: GitHubService;

  beforeEach(() => {
    github = new GitHubService('test-token');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('createPR', () => {
    it('creates a pull request successfully', async () => {
      nock('https://api.github.com')
        .post('/repos/littlebearapps/notebridge/pulls')
        .reply(201, {
          number: 123,
          html_url: 'https://github.com/littlebearapps/notebridge/pull/123',
          head: { sha: 'abc123' }
        });

      const pr = await github.createPR({
        title: 'feat: add new feature',
        body: 'Description',
        head: 'feature/new-feature',
        base: 'main'
      });

      expect(pr.number).toBe(123);
      expect(pr.html_url).toContain('/pull/123');
    });

    it('throws PRExistsError when PR already exists', async () => {
      nock('https://api.github.com')
        .post('/repos/littlebearapps/notebridge/pulls')
        .reply(422, {
          message: 'Validation Failed',
          errors: [{ message: 'A pull request already exists' }]
        });

      await expect(
        github.createPR({
          title: 'feat: add new feature',
          body: 'Description',
          head: 'feature/new-feature',
          base: 'main'
        })
      ).rejects.toThrow(PRExistsError);
    });
  });

  describe('mergePR', () => {
    it('merges PR successfully', async () => {
      nock('https://api.github.com')
        .put('/repos/littlebearapps/notebridge/pulls/123/merge')
        .reply(200, {
          sha: 'merged-sha',
          merged: true,
          message: 'Pull Request successfully merged'
        });

      const result = await github.mergePR(123, {
        mergeMethod: 'squash',
        commitTitle: 'feat: add new feature'
      });

      expect(result.merged).toBe(true);
      expect(result.sha).toBe('merged-sha');
    });

    it('throws MergeConflictError on conflicts', async () => {
      nock('https://api.github.com')
        .put('/repos/littlebearapps/notebridge/pulls/123/merge')
        .reply(409, {
          message: 'Merge conflict'
        });

      await expect(
        github.mergePR(123, { mergeMethod: 'squash' })
      ).rejects.toThrow(MergeConflictError);
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/ship-workflow.test.ts
import { ship } from '../../src/commands/ship';
import nock from 'nock';

describe('ship workflow (integration)', () => {
  it('completes full workflow: PR → CI → Merge → Cleanup', async () => {
    // Mock GitHub API calls
    nock('https://api.github.com')
      .get('/user')
      .reply(200, { login: 'nathanschram' })
      .post('/repos/littlebearapps/test-repo/pulls')
      .reply(201, {
        number: 1,
        html_url: 'https://github.com/littlebearapps/test-repo/pull/1',
        head: { sha: 'abc123' }
      })
      .get('/repos/littlebearapps/test-repo/pulls/1')
      .times(3)
      .reply(200, {
        number: 1,
        head: { sha: 'abc123' }
      })
      .get('/repos/littlebearapps/test-repo/commits/abc123/status')
      .reply(200, { state: 'pending', statuses: [] })
      .get('/repos/littlebearapps/test-repo/commits/abc123/check-runs')
      .reply(200, { check_runs: [
        { name: 'Test', status: 'in_progress', conclusion: null }
      ]})
      .get('/repos/littlebearapps/test-repo/commits/abc123/status')
      .reply(200, { state: 'success', statuses: [] })
      .get('/repos/littlebearapps/test-repo/commits/abc123/check-runs')
      .reply(200, { check_runs: [
        { name: 'Test', status: 'completed', conclusion: 'success' }
      ]})
      .put('/repos/littlebearapps/test-repo/pulls/1/merge')
      .reply(200, { sha: 'merged-sha', merged: true })
      .delete('/repos/littlebearapps/test-repo/git/refs/heads/feature/test')
      .reply(204);

    // Run ship command
    await ship({
      noVerify: true,
      forceMerge: false,
      noDelete: false
    });

    // Verify all API calls were made
    expect(nock.isDone()).toBe(true);
  });
});
```

---

## Rollback Plan

### If Migration Fails

**Option A**: Keep both implementations side-by-side
```bash
# Old implementation (bash)
gwm-legacy ship

# New implementation (Node.js)
gwm ship
```

**Option B**: Revert to v0.3.0
```bash
# Restore bash scripts
git checkout v0.3.0 -- scripts/
git checkout v0.3.0 -- gwm

# Update PATH
export PATH="$PATH:~/claude-code-tools/lba/apps/subagents/git-workflow-manager/v0.3.0"
```

### Gradual Migration Strategy

1. **Week 1**: Deploy to 1 test project (convert-my-file)
2. **Week 2**: Deploy to 3 projects (notebridge, palette-kit, cloakpipe)
3. **Week 3**: Deploy to all remaining projects

**Rollback Trigger**: >3 critical bugs or >50% developer complaints

---

## Success Metrics

### Technical Metrics

- ✅ **100% test coverage** for core services
- ✅ **<5s** to create PR (vs ~10s with gh CLI)
- ✅ **Real-time** CI progress (vs blocking `gh pr checks --watch`)
- ✅ **Zero** bash scripts (full TypeScript)
- ✅ **<10MB** package size (including dependencies)

### Developer Experience Metrics

- ✅ **IntelliSense** works in VSCode
- ✅ **Error messages** are actionable (not exit codes)
- ✅ **Debugging** is easy (TypeScript source maps)
- ✅ **Testing** is simple (mock with Nock)

### Adoption Metrics

- ✅ **80%** developer satisfaction (survey)
- ✅ **<5** support requests per week
- ✅ **0** critical bugs after 2 weeks

---

## Next Steps

### Immediate (Today)

1. ✅ Review this plan with stakeholders
2. ✅ Approve migration approach
3. ✅ Set up project repository structure

### Short Term (This Week)

1. 🚧 Phase 1 implementation (core infrastructure)
2. 🚧 Unit tests for GitHubService
3. 🚧 Integration test for auth verification

### Medium Term (Next 2 Weeks)

1. 🚧 Phase 2 implementation (PR automation)
2. 🚧 Phase 3 implementation (additional commands)
3. 🚧 Phase 4 implementation (polish + docs)

### Long Term (Next Month)

1. 🚧 Deploy to test project
2. 🚧 Gradual rollout to all projects
3. 🚧 Deprecate v0.3.0 (bash implementation)

---

## Appendix

### Dependencies

```json
{
  "dependencies": {
    "octokit": "^4.0.2",
    "simple-git": "^3.27.0",
    "commander": "^12.1.0",
    "chalk": "^5.4.1",
    "ora": "^8.1.1",
    "yaml": "^2.6.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "typescript": "^5.7.2",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.14",
    "ts-jest": "^29.2.6",
    "nock": "^13.5.6",
    "ts-node": "^10.9.2"
  }
}
```

### Octokit API Methods Reference

| Operation | Octokit Method | Purpose |
|-----------|----------------|---------|
| Verify Auth | `octokit.rest.users.getAuthenticated()` | Check token validity |
| Create PR | `octokit.rest.pulls.create()` | Create new pull request |
| Get PR | `octokit.rest.pulls.get()` | Get PR details |
| Get Combined Status | `octokit.rest.repos.getCombinedStatusForRef()` | Get commit statuses |
| Get Check Runs | `octokit.rest.checks.listForRef()` | Get GitHub Actions checks |
| Merge PR | `octokit.rest.pulls.merge()` | Merge pull request |
| Delete Branch | `octokit.rest.git.deleteRef()` | Delete remote branch |

---

**Status**: ✅ Ready for review and implementation
**Recommendation**: Approve plan and begin Phase 1 implementation
