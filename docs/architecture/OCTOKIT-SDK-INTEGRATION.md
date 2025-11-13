# Octokit SDK Integration Guide

**Version**: 1.0.0
**Date**: 2025-11-12
**Status**: 🚧 Proposal - Ready for Implementation

---

## Overview

This document describes how to integrate the **Claude GitHub SDK** (Octokit wrapper) into git-workflow-manager to enhance PR automation capabilities.

### Benefits of Integration

| Feature | Current (gh CLI) | With Octokit SDK |
|---------|------------------|------------------|
| PR Creation | ✅ `gh pr create --fill` | ✅ Programmatic with templates |
| CI Status Polling | ⚠️ Manual `gh pr checks` | ✅ Automated `waitForChecks()` |
| Error Handling | ⚠️ Exit codes | ✅ Try/catch with detailed errors |
| PR Merge | ✅ `gh pr merge --squash` | ✅ `mergePR()` with validation |
| Branch Cleanup | ✅ `gh api` or git | ✅ `deleteBranch()` |
| Complete Workflow | ❌ Manual orchestration | ✅ `shipFeature()` one-liner |
| Testing | ⚠️ Live API only | ✅ Mock with Nock |
| Type Safety | ❌ No types | ✅ Full TypeScript |

---

## Architecture

### Hybrid Approach (Recommended)

Use **both** gh CLI and Octokit SDK for their respective strengths:

```bash
# git-workflow-manager flow
┌─────────────────────────────────────┐
│ 1. Preflight Checks (bash)         │
│    - Validate working directory     │
│    - Check uncommitted changes      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. Run verify.sh (bash)            │
│    - Lint, typecheck, tests, build │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. Push Branch (git)                │
│    git push origin feature/branch   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. Create PR (CHOICE)               │
│    Option A: gh pr create --fill    │ ← Current (simple)
│    Option B: Octokit SDK (advanced) │ ← New (flexible)
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 5. Wait for CI (ENHANCED)           │
│    Octokit: prAutomation            │ ← Async polling
│             .waitForChecks(pr)       │   with progress
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 6. Merge PR (CHOICE)                │
│    Option A: gh pr merge --squash   │ ← Current
│    Option B: Octokit SDK            │ ← New
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 7. Cleanup (ENHANCED)               │
│    Octokit: prAutomation            │ ← Programmatic
│             .deleteBranch(branch)    │   cleanup
└─────────────────────────────────────┘
```

---

## Implementation Options

### Option 1: Simple Enhancement (Recommended First Step)

**Add Octokit SDK as optional enhancement** while keeping gh CLI as primary.

**When to use Octokit**:
- `--wait-for-ci`: Use `PRAutomation.waitForChecks()` for async polling
- `--rich-pr`: Use SDK to create PRs with enhanced templates
- `--ship-feature`: Use `PRAutomation.shipFeature()` for complete automation

**Implementation**:

```bash
# In git-workflow-manager script
if [[ "$*" == *"--wait-for-ci"* ]]; then
  # Use Octokit SDK for CI polling
  node -e "
    import('claude-github-sdk').then(async ({ PRAutomation }) => {
      const pr = new PRAutomation({
        token: process.env.GITHUB_TOKEN,
        owner: '$OWNER',
        repo: '$REPO'
      });
      const passed = await pr.waitForChecks($PR_NUMBER);
      process.exit(passed ? 0 : 1);
    });
  "
else
  # Use gh CLI for quick status
  gh pr checks $PR_NUMBER --watch
fi
```

**Pros**:
- ✅ Minimal changes to existing workflow
- ✅ Gradual migration path
- ✅ Falls back to gh CLI if SDK unavailable

**Cons**:
- ⚠️ Maintains two code paths
- ⚠️ Requires Node.js runtime

---

### Option 2: Full SDK Migration (Future)

**Replace all gh CLI PR operations with Octokit SDK**.

**Example**:

```javascript
// git-workflow-manager-sdk.js
import { PRAutomation } from 'claude-github-sdk';

const pr = new PRAutomation({
  token: process.env.GITHUB_TOKEN,
  owner: 'littlebearapps',
  repo: process.env.REPO_NAME
});

// Complete workflow in one call
const prUrl = await pr.shipFeature({
  branch: process.env.BRANCH_NAME,
  title: process.env.PR_TITLE,
  body: process.env.PR_BODY,
  waitForChecks: true,
  autoMerge: true,
  cleanup: true
});

console.log(prUrl);
```

**Bash wrapper**:

```bash
# git-workflow-manager calls SDK
BRANCH_NAME="$current_branch" \
PR_TITLE="$pr_title" \
PR_BODY="$pr_body" \
REPO_NAME="$repo_name" \
node git-workflow-manager-sdk.js
```

**Pros**:
- ✅ Clean, type-safe code
- ✅ Better error handling
- ✅ Easier testing (mock API)
- ✅ Single code path

**Cons**:
- ⚠️ Requires rewriting bash logic
- ⚠️ Harder to debug for bash users
- ⚠️ Node.js dependency

---

## Environment Setup

### 1. GitHub Token Configuration

The Octokit SDK requires `GITHUB_TOKEN` environment variable.

**Global Setup** (root directory):

```bash
# In ~/claude-code-tools/.envrc
source ~/.envrc.github
```

**Per-Project Setup** (each working directory):

```bash
# In project/.envrc
# Source the global GitHub token config
source ~/claude-code-tools/.envrc.github

# Or set project-specific token
export GITHUB_TOKEN="$(kc_get github-token-project-specific)"
```

### 2. Verify Token Access

```bash
cd ~/claude-code-tools
source .envrc.github
node sdks/github/examples/verify-installation.js
```

Expected output:
```
✅ GitHub SDK Installation Verification

Test 1: Package imports
  - GitHubClient: ✅ OK
  - PRAutomation: ✅ OK

Test 2: Environment check
  - GITHUB_TOKEN: ✅ Found

Test 3: Client initialization
  - GitHubClient instance: ✅ OK
  - PRAutomation instance: ✅ OK

✨ Installation verification complete!
```

---

## Integration Examples

### Example 1: CI Status Polling

**Before** (gh CLI):
```bash
# Manual polling with gh CLI
gh pr checks $PR_NUMBER --watch
```

**After** (Octokit SDK):
```javascript
import { PRAutomation } from 'claude-github-sdk';

const pr = new PRAutomation({
  token: process.env.GITHUB_TOKEN,
  owner: 'littlebearapps',
  repo: 'auditor-toolkit'
});

// Async polling with timeout and progress
const checksPass = await pr.waitForChecks(prNumber, 600000, 10000);
if (checksPass) {
  console.log('✅ All checks passed');
} else {
  console.log('❌ Checks failed');
}
```

---

### Example 2: Complete PR Workflow

**Before** (bash orchestration):
```bash
# Step 1: Create PR
gh pr create --base main --head feature/new-feature --fill

# Step 2: Wait for CI
gh pr checks $PR_NUMBER --watch

# Step 3: Merge PR
gh pr merge $PR_NUMBER --squash

# Step 4: Delete branch
git push origin --delete feature/new-feature
```

**After** (Octokit SDK):
```javascript
import { PRAutomation } from 'claude-github-sdk';

const pr = new PRAutomation({
  token: process.env.GITHUB_TOKEN,
  owner: 'littlebearapps',
  repo: 'auditor-toolkit'
});

// Complete workflow in one call
const prUrl = await pr.shipFeature({
  branch: 'feature/new-feature',
  title: 'feat: add new feature',
  body: 'Complete implementation with tests',
  waitForChecks: true,
  autoMerge: true,
  cleanup: true
});

console.log(`Feature shipped: ${prUrl}`);
```

---

### Example 3: Enhanced Error Handling

**Before** (bash):
```bash
gh pr create --base main --head feature/new-feature --fill
if [ $? -ne 0 ]; then
  echo "❌ PR creation failed"
  exit 1
fi
```

**After** (JavaScript):
```javascript
try {
  const pr = await prAutomation.createPR({
    title: 'feat: add new feature',
    body: 'Complete implementation with tests',
    head: 'feature/new-feature',
    base: 'main'
  });
  console.log(`✅ Created PR #${pr.number}: ${pr.html_url}`);
} catch (error) {
  if (error.status === 422) {
    console.error('❌ PR creation failed: Branch already has open PR');
  } else if (error.status === 404) {
    console.error('❌ PR creation failed: Repository not found');
  } else {
    console.error(`❌ PR creation failed: ${error.message}`);
  }
  process.exit(1);
}
```

---

## Testing

### Unit Tests with Nock

```javascript
import { PRAutomation } from 'claude-github-sdk';
import { mockPullRequest, mockCombinedStatus } from 'claude-github-sdk/testing';

// Mock GitHub API
mockPullRequest('littlebearapps', 'auditor-toolkit', 123, {
  title: 'feat: add new feature',
  state: 'open',
  merged: false
});

mockCombinedStatus('littlebearapps', 'auditor-toolkit', 'abc123', 'success');

// Test PR automation
const pr = new PRAutomation({
  token: 'test-token',
  owner: 'littlebearapps',
  repo: 'auditor-toolkit'
});

const checksPass = await pr.waitForChecks(123);
expect(checksPass).toBe(true);
```

---

## Migration Path

### Phase 1: Parallel Operation (Weeks 1-2)

- ✅ Install Octokit SDK globally (DONE)
- ✅ Configure GITHUB_TOKEN environment (DONE)
- 🚧 Add `--sdk` flag to git-workflow-manager
- 🚧 Test both paths side-by-side

### Phase 2: Enhanced Features (Weeks 3-4)

- 🚧 Add `--wait-for-ci` with SDK polling
- 🚧 Add `--rich-pr` with template support
- 🚧 Add `--ship-feature` for complete automation

### Phase 3: Full Migration (Month 2-3)

- 🚧 Make SDK default for PR operations
- 🚧 Keep gh CLI as fallback
- 🚧 Update documentation

---

## Next Steps

1. **Choose Integration Option**: Start with Option 1 (Simple Enhancement)
2. **Add SDK Flag**: Implement `--use-sdk` flag in git-workflow-manager
3. **Test Integration**: Run side-by-side tests with existing workflow
4. **Update Documentation**: Document SDK usage in SUBAGENT_PROMPT.md
5. **Rollout**: Deploy to one project, validate, then expand

---

## Resources

- **GitHub SDK Installation**: `~/claude-code-tools/GITHUB-SDK-INSTALLATION.md`
- **SDK Examples**: `~/claude-code-tools/sdks/github/examples/`
- **Research**: `~/claude-code-tools/GITHUB-SDK-AUDIT-FINDINGS.md`
- **Node.js README**: `~/claude-code-tools/sdks/github/node/README.md`

---

**Status**: ✅ Ready for implementation
**Recommendation**: Start with Option 1 (Simple Enhancement) for gradual adoption
