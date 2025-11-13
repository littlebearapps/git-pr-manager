# AI Agent Integration Guide

**Version**: 1.4.0-beta.1
**Last Updated**: 2025-11-13

---

## Overview

This guide shows how to integrate `git-workflow-manager` (`gwm`) with CLI-based AI coding agents like Claude Code, Aider, Cursor, and others for automated git workflow management.

## Why Use gwm with AI Agents?

- **Structured Output**: `--json` flag provides machine-readable data for AI parsing
- **Autonomous Workflows**: AI agents can execute complete PR workflows without human intervention
- **Error Analysis**: Rich error reporting helps AI agents understand and fix issues
- **Workflow Automation**: AI agents can orchestrate complex multi-step git operations
- **Context Awareness**: AI agents can check CI status and make decisions based on results

---

## Quick Start

### 1. Install gwm Globally

```bash
npm install -g @littlebearapps/git-workflow-manager
```

### 2. Configure Environment

```bash
# Set GitHub token (required)
export GITHUB_TOKEN="ghp_your_token_here"

# Verify installation
gwm --version
```

### 3. Test with AI Agent

**Example Claude Code conversation**:
```
User: "Create a PR for my feature"

Claude: Let me create a PR using gwm:
  - Running: gwm auto --draft
  - PR #47 created successfully
  - CI checks pending...
```

---

## Configuration for Different Team Sizes

### Solo Developer Setup (Recommended Default)

**Use case**: You're the only developer, reviewing code with AI before PRs

**Configuration** (`.gwm.yml`):
```yaml
branchProtection:
  enabled: false  # Or set requireReviews: 0
  requireReviews: 0  # No human reviews needed
  requireStatusChecks:
    - quality-gate    # Still require CI to pass
  enforceAdmins: false

ci:
  waitForChecks: true
  failFast: true
  timeout: 30

security:
  scanSecrets: true
  scanDependencies: true

autoFix:
  enabled: true
  maxAttempts: 2
```

**Why this setup**:
- ✅ No review bottleneck (you review with AI before PR)
- ✅ Still requires CI checks to pass
- ✅ Security scanning enabled
- ✅ Auto-fix for simple issues
- ⚡ Fast merge workflow

**AI Agent Guidance**:
```
When user is solo developer:
- Recommend requireReviews: 0
- Explain: "You review code with me before creating PRs, so no additional review needed"
- Still enforce CI checks and security scanning
```

---

### Small Team Setup (2-5 developers)

**Use case**: Small team, occasional reviews, trust-based

**Configuration**:
```yaml
branchProtection:
  enabled: true
  requireReviews: 1  # At least 1 review
  requireStatusChecks:
    - quality-gate
    - gwm-security
  enforceAdmins: false  # Allow admins to bypass

ci:
  waitForChecks: true
  failFast: true
  retryFlaky: true  # More forgiving for team

security:
  scanSecrets: true
  scanDependencies: true
```

**Why this setup**:
- ✅ Light review requirement (1 person)
- ✅ Admins can bypass if needed
- ✅ Flaky test retry enabled
- 🤝 Balance between safety and speed

**AI Agent Guidance**:
```
When team is small (2-5 people):
- Recommend requireReviews: 1
- Explain: "Lightweight review process, admins can bypass if urgent"
- Enable retry for flaky tests
```

---

### Enterprise/Large Team Setup (6+ developers)

**Use case**: Multiple teams, strict compliance, regulated environments

**Configuration**:
```yaml
branchProtection:
  enabled: true
  requireReviews: 2  # At least 2 reviews
  requireStatusChecks:
    - quality-gate
    - gwm-security
    - integration-tests
    - e2e-tests
  enforceAdmins: true  # Even admins follow rules

ci:
  waitForChecks: true
  failFast: true
  retryFlaky: false  # Strict - no retries
  timeout: 45  # Longer timeout for complex builds

security:
  scanSecrets: true
  scanDependencies: true
  allowedVulnerabilities: []  # Block all vulnerabilities

autoFix:
  enabled: false  # Disable auto-fix for auditability
```

**Why this setup**:
- ✅ Strict review requirements (2 people)
- ✅ All checks must pass (no flaky retry)
- ✅ Admin enforcement for compliance
- ✅ Zero vulnerability tolerance
- 🔒 Audit trail preserved

**AI Agent Guidance**:
```
When team is large or enterprise:
- Recommend requireReviews: 2
- Enable enforceAdmins: true
- Disable autoFix (manual fixes for audit trail)
- Explain: "Stricter requirements for compliance"
```

---

## Configuring Branch Protection

### Understanding the Options

**`branchProtection.enabled`**:
- `true`: Validates protection rules match GitHub settings
- `false`: Skips validation (useful for solo devs)

**`branchProtection.requireReviews`**:
- `0`: No reviews required (solo dev)
- `1`: Light review requirement (small team)
- `2+`: Strict review requirement (enterprise)

**`branchProtection.requireStatusChecks`**:
- List of CI check names that must pass
- Leave empty `[]` for no required checks
- Example: `["quality-gate", "gwm-security"]`

**`branchProtection.enforceAdmins`**:
- `false`: Admins can bypass rules (flexibility)
- `true`: Even admins follow rules (compliance)

### How to Apply Configuration

**1. Edit `.gwm.yml`** (update requireReviews, etc.)

**2. Apply to GitHub** (if using branch protection):
```bash
gwm protect  # Applies settings to GitHub
```

**3. Verify** (check GitHub settings match):
```bash
gwm protect --show  # Display current protection
```

### Changing Configuration Later

**Remove review requirement**:
```yaml
branchProtection:
  requireReviews: 0  # Change from 1 to 0
```

Then:
```bash
gwm protect  # Re-applies with 0 reviews
```

**Disable protection entirely**:
```yaml
branchProtection:
  enabled: false  # Skip validation
```

---

## AI Agent Setup Checklist

When setting up gwm for a new repository, AI agents should:

### 1. **Ask About Team Size** (if not obvious)
```
AI: "Are you working solo, or is this a team repository?"

User: "Solo developer"
AI: "I'll configure with requireReviews: 0 since you review code before PRs"

User: "Team of 3"
AI: "I'll configure with requireReviews: 1 for lightweight review"
```

### 2. **Show Configuration Before Applying**
```yaml
# Proposed .gwm.yml (show to user first)
branchProtection:
  enabled: true
  requireReviews: 0  # ← Solo dev, no reviews
  requireStatusChecks:
    - quality-gate
```

### 3. **Explain the Impact**
```
AI: "This configuration will:
✅ Require CI checks to pass
✅ NOT require PR reviews (you're solo)
✅ Enable security scanning
✅ Enable auto-fix for simple issues

To apply GitHub branch protection: gwm protect
To skip protection: Leave requireReviews: 0 and don't run gwm protect"
```

### 4. **Don't Auto-Run `gwm protect`**
```
❌ Bad: Run gwm protect without asking
✅ Good: Explain what it does, let user decide

"If you want GitHub to enforce these rules, run:
  gwm protect

This will configure branch protection on GitHub.
For solo dev, you may prefer to skip this and just use gwm locally."
```

---

## Supported AI Agents

### Claude Code (Anthropic)

**Setup**:
1. Install gwm globally: `npm install -g @littlebearapps/git-workflow-manager`
2. Set `GITHUB_TOKEN` in shell environment
3. Claude Code inherits environment variables automatically

**Usage**:
```
User: "Check the status of PR #123"
Claude: [Executes] gwm checks 123 --json
Claude: [Parses JSON] "All 5 checks passed ✅"
```

**Advantages**:
- Deep integration with git workflows
- Can parse complex JSON output
- Understands error messages and suggests fixes
- Can execute multi-step workflows autonomously

---

### Aider (Paul Gauthier)

**Setup**:
1. Install gwm: `npm install -g @littlebearapps/git-workflow-manager`
2. Export GITHUB_TOKEN in shell
3. Launch Aider in project directory

**Usage**:
```
You: /run gwm auto

Aider: Running command: gwm auto
[Output]: Feature branch created...
[Output]: PR #48 created...
[Output]: Waiting for CI...
[Output]: All checks passed!
```

**Advantages**:
- `/run` command for direct CLI execution
- Git-aware context
- Can commit changes before running gwm

---

### Cursor (Anysphere)

**Setup**:
1. Install gwm globally
2. Configure GITHUB_TOKEN in terminal
3. Use Cursor's terminal integration

**Usage** (via Cursor terminal):
```bash
# AI generates and runs:
gwm feature add-auth
# Make changes...
gwm auto
```

**Advantages**:
- IDE integration
- Visual feedback in editor
- Can reference code changes in PR description

---

### GitHub Copilot CLI

**Setup**:
```bash
npm install -g @littlebearapps/git-workflow-manager
export GITHUB_TOKEN="ghp_..."
```

**Usage**:
```bash
# Natural language command
gh copilot suggest "create a PR with gwm"

# Generates:
gwm auto --title "feat: add authentication"
```

---

### Custom AI Agents

Any AI agent with shell access can use gwm:

**Requirements**:
- Can execute bash commands
- Can parse JSON output
- Has access to environment variables

**Integration**:
```python
import subprocess
import json

def run_gwm(command):
    """Run gwm command and parse JSON output"""
    result = subprocess.run(
        f"gwm {command} --json",
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        return json.loads(result.stdout)
    else:
        raise Exception(f"gwm failed: {result.stderr}")

# Example: Check CI status
status = run_gwm("checks 123")
print(f"Passed: {status['passed']}, Failed: {status['failed']}")
```

---

## Machine-Readable Output

### JSON Mode

All gwm commands support `--json` flag:

```bash
gwm status --json
gwm checks 123 --json
gwm security --json
gwm auto --json
```

### Parsing JSON in Different Languages

**JavaScript/Node.js**:
```javascript
const { execSync } = require('child_process');

function runGwm(command) {
  const output = execSync(`gwm ${command} --json`, { encoding: 'utf-8' });
  return JSON.parse(output);
}

const status = runGwm('checks 123');
console.log(`Overall status: ${status.overallStatus}`);
```

**Python**:
```python
import subprocess
import json

def run_gwm(command):
    result = subprocess.run(
        f"gwm {command} --json",
        shell=True,
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

status = run_gwm('checks 123')
print(f"Overall status: {status['overallStatus']}")
```

**Go**:
```go
package main

import (
    "encoding/json"
    "os/exec"
)

type CheckStatus struct {
    Total          int    `json:"total"`
    Passed         int    `json:"passed"`
    Failed         int    `json:"failed"`
    OverallStatus  string `json:"overallStatus"`
}

func runGwm(command string) (*CheckStatus, error) {
    cmd := exec.Command("gwm", command, "--json")
    output, err := cmd.Output()
    if err != nil {
        return nil, err
    }

    var status CheckStatus
    err = json.Unmarshal(output, &status)
    return &status, err
}
```

---

## Common AI Agent Workflows

### Workflow 1: Autonomous PR Creation

**User Request**: "Create a PR for this feature"

**AI Agent Execution**:
```bash
# Step 1: Check current branch
gwm status --json

# Step 2: Create PR with automation
gwm auto --json

# Step 3: Parse output and report
# {"prNumber": 47, "url": "https://github.com/...", "ciStatus": "pending"}
```

**AI Response**: "✅ PR #47 created: https://github.com/user/repo/pull/47. CI checks are pending."

---

### Workflow 2: CI Status Monitoring

**User Request**: "Has PR #123 passed CI?"

**AI Agent Execution**:
```bash
gwm checks 123 --json
```

**Output**:
```json
{
  "total": 5,
  "passed": 5,
  "failed": 0,
  "pending": 0,
  "overallStatus": "success"
}
```

**AI Response**: "✅ All 5 checks passed! PR #123 is ready to merge."

---

### Workflow 3: Error Diagnosis and Fix

**User Request**: "Why did the CI fail?"

**AI Agent Execution**:
```bash
gwm checks 123 --json
```

**Output**:
```json
{
  "failed": 1,
  "failureDetails": [
    {
      "checkName": "Test Suite",
      "errorType": "test_failure",
      "summary": "3 tests failed in auth.test.ts",
      "affectedFiles": ["src/auth.test.ts"],
      "suggestedFix": "Run npm test to see details"
    }
  ]
}
```

**AI Response**:
```
❌ Test Suite failed:
- 3 tests failed in auth.test.ts
- Suggested fix: Run npm test locally to see details

Would you like me to:
1. Read the test file and identify the failures?
2. Run the tests locally?
3. Attempt to fix the failing tests?
```

---

### Workflow 4: Security Scanning

**User Request**: "Scan for security issues before committing"

**AI Agent Execution**:
```bash
gwm security --json
```

**Output**:
```json
{
  "passed": false,
  "secretsFound": 1,
  "secrets": [
    {
      "file": "config/database.js",
      "line": 12,
      "type": "AWS Access Key",
      "pattern": "AKIA..."
    }
  ]
}
```

**AI Response**:
```
⚠️ Security issue found:
- AWS Access Key detected in config/database.js:12

I'll help you fix this:
1. Remove the hardcoded key
2. Add it to .env file
3. Update .gitignore to exclude .env
4. Use environment variable instead

Proceed with fix?
```

---

### Workflow 5: Branch Protection Validation

**User Request**: "Can I merge this PR?"

**AI Agent Execution**:
```bash
# Check PR status
gwm checks $PR_NUMBER --json

# Validate branch protection
gwm protect --show --json
```

**AI Decision Logic**:
```javascript
const checks = runGwm(`checks ${prNumber}`);
const protection = runGwm('protect --show');

if (checks.overallStatus === 'success' &&
    protection.requireReviews <= checks.approvals) {
  return 'Ready to merge ✅';
} else {
  return `Not ready: ${checks.failed} checks failed, need ${protection.requireReviews - checks.approvals} more reviews`;
}
```

### Workflow 6: Update Management

**User Request**: "Is gwm up to date?"

**AI Agent Execution**:
```bash
# Check for updates (machine-readable)
gwm check-update --json
```

**AI Response**:
```javascript
const updateCheck = runGwm('check-update');

if (updateCheck.success && updateCheck.updateAvailable) {
  return `Update available: ${updateCheck.currentVersion} → ${updateCheck.latestVersion}
Run: npm install -g @littlebearapps/git-workflow-manager`;
} else if (updateCheck.success) {
  return `gwm is up to date (${updateCheck.currentVersion})`;
} else {
  return `Failed to check for updates: ${updateCheck.error}`;
}
```

**Exit Codes**:
- `0` - No update available (already latest)
- `1` - Update available
- `2` - Error during check

**JSON Output**:
```json
{
  "success": true,
  "updateAvailable": true,
  "currentVersion": "1.4.0-beta.1",
  "latestVersion": "1.5.0",
  "channel": "latest",
  "cached": false
}
```

**AI Agent Integration**:
```javascript
// Check for updates periodically
async function checkGwmUpdates() {
  const result = runGwm('check-update');

  if (result.updateAvailable) {
    // Option 1: Notify user
    console.log(`📦 gwm update available: ${result.latestVersion}`);

    // Option 2: Auto-update (optional, ask user first)
    if (await askUser('Update gwm?')) {
      execSync('npm install -g @littlebearapps/git-workflow-manager');
    }
  }
}
```

---

## Error Handling for AI Agents

### Exit Codes

- `0` - Success
- `1` - General failure
- `2` - Validation error (e.g., missing config)
- `3` - Authentication error (e.g., invalid GITHUB_TOKEN)
- `4` - Rate limit exceeded

### Parsing Errors

```javascript
function runGwmSafely(command) {
  try {
    const output = execSync(`gwm ${command} --json`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return { success: true, data: JSON.parse(output) };
  } catch (error) {
    // Parse error from stderr
    const errorOutput = error.stderr || error.message;

    if (errorOutput.includes('Rate limit exceeded')) {
      return { success: false, error: 'RATE_LIMIT', message: errorOutput };
    } else if (errorOutput.includes('GITHUB_TOKEN')) {
      return { success: false, error: 'AUTH', message: errorOutput };
    } else {
      return { success: false, error: 'UNKNOWN', message: errorOutput };
    }
  }
}
```

### Retry Logic

```javascript
async function runGwmWithRetry(command, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = runGwmSafely(command);

    if (result.success) {
      return result.data;
    }

    // Retry on rate limit
    if (result.error === 'RATE_LIMIT') {
      console.log(`Rate limited, waiting ${i + 1} minutes...`);
      await sleep((i + 1) * 60000);
      continue;
    }

    // Don't retry on auth errors
    if (result.error === 'AUTH') {
      throw new Error('GitHub authentication failed');
    }

    // Retry on unknown errors
    console.log(`Attempt ${i + 1} failed, retrying...`);
    await sleep(1000);
  }

  throw new Error('Max retries exceeded');
}
```

---

## Best Practices for AI Agents

### 1. Always Use JSON Mode

```bash
# Good
gwm checks 123 --json

# Bad (human-readable output is harder to parse)
gwm checks 123
```

### 2. Validate Before Executing

```bash
# Check environment first
gwm status --json

# Verify GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN not set"
  exit 1
fi
```

### 3. Handle Rate Limits Gracefully

```javascript
const result = runGwm('checks 123');

if (result.error === 'RATE_LIMIT') {
  // Wait and retry, or notify user
  console.log('Rate limited. GitHub API limit: 5000 requests/hour');
  console.log('Check status at: https://api.github.com/rate_limit');
}
```

### 4. Provide Context in Error Messages

```javascript
try {
  const result = runGwm('auto');
} catch (error) {
  // Good: Provide context and suggestions
  console.log(`Failed to create PR: ${error.message}`);
  console.log('Possible causes:');
  console.log('  1. No GITHUB_TOKEN set');
  console.log('  2. Branch has no changes');
  console.log('  3. PR already exists');
  console.log('Run: gwm status --json to diagnose');
}
```

### 5. Cache Expensive Operations

```javascript
// Cache CI status for 30 seconds
const cache = new Map();

function getCIStatus(prNumber) {
  const cacheKey = `pr-${prNumber}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }

  const data = runGwm(`checks ${prNumber}`);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

---

## Advanced Integration

### Multi-Step Workflow Orchestration

```javascript
class GitWorkflowAgent {
  async createFeaturePR(featureName, title) {
    // Step 1: Create feature branch
    const branch = await this.runGwm(`feature ${featureName}`);
    console.log(`Created branch: ${branch.name}`);

    // Step 2: User makes changes (AI agent edits files)
    await this.makeChanges();

    // Step 3: Run security scan
    const security = await this.runGwm('security');
    if (!security.passed) {
      throw new Error('Security scan failed');
    }

    // Step 4: Create PR
    const pr = await this.runGwm(`auto --title "${title}"`);
    console.log(`PR created: ${pr.url}`);

    // Step 5: Wait for CI
    const checks = await this.waitForCI(pr.number);

    // Step 6: Auto-merge if all checks pass
    if (checks.overallStatus === 'success') {
      await this.mergePR(pr.number);
    }

    return pr;
  }

  async waitForCI(prNumber, timeout = 30 * 60 * 1000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const checks = await this.runGwm(`checks ${prNumber}`);

      if (checks.overallStatus === 'success') {
        return checks;
      }

      if (checks.overallStatus === 'failure') {
        throw new Error(`CI failed: ${checks.failed} checks failed`);
      }

      // Exponential backoff
      await sleep(Math.min(30000, 5000 * Math.pow(1.5, attempts++)));
    }

    throw new Error('CI timeout');
  }

  async runGwm(command) {
    const output = execSync(`gwm ${command} --json`, { encoding: 'utf-8' });
    return JSON.parse(output);
  }
}
```

### Event-Driven Integration

```javascript
// Listen for PR events and trigger gwm
async function handlePREvent(event) {
  if (event.action === 'opened' || event.action === 'synchronize') {
    // Run security scan on new PRs
    const security = await runGwm('security');

    if (!security.passed) {
      // Comment on PR with security issues
      await github.issues.createComment({
        issue_number: event.number,
        body: formatSecurityReport(security)
      });
    }
  }

  if (event.action === 'labeled' && event.label.name === 'auto-merge') {
    // Auto-merge labeled PRs
    const checks = await runGwm(`checks ${event.number}`);

    if (checks.overallStatus === 'success') {
      await github.pulls.merge({
        pull_number: event.number,
        merge_method: 'squash'
      });
    }
  }
}
```

---

## Troubleshooting

### Issue: "Command not found: gwm"

**Solution for AI agents**:
```javascript
// Check if gwm is installed
function checkGwmInstalled() {
  try {
    execSync('gwm --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.log('gwm not installed. Installing...');
    execSync('npm install -g @littlebearapps/git-workflow-manager');
    return true;
  }
}
```

### Issue: "GITHUB_TOKEN not found"

**Solution**:
```javascript
function ensureGitHubToken() {
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    throw new Error(
      'GitHub token not found. Set GITHUB_TOKEN:\n' +
      '  export GITHUB_TOKEN="ghp_..."\n' +
      'Generate at: https://github.com/settings/tokens'
    );
  }
}
```

### Issue: JSON parsing fails

**Solution**:
```javascript
function safeParseJSON(output) {
  try {
    return JSON.parse(output);
  } catch (error) {
    console.error('Failed to parse gwm output:', output);
    console.error('Error:', error.message);

    // Try to extract JSON from mixed output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Invalid JSON output from gwm');
  }
}
```

---

## Example: Complete AI Agent Implementation

```javascript
#!/usr/bin/env node
/**
 * Example AI agent that uses gwm for PR automation
 */

const { execSync } = require('child_process');

class GitWorkflowAI {
  constructor() {
    this.ensureSetup();
  }

  ensureSetup() {
    // Check gwm is installed
    try {
      execSync('gwm --version', { stdio: 'ignore' });
    } catch (error) {
      console.log('Installing git-workflow-manager...');
      execSync('npm install -g @littlebearapps/git-workflow-manager');
    }

    // Check GITHUB_TOKEN
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable not set');
    }
  }

  runGwm(command) {
    try {
      const output = execSync(`gwm ${command} --json`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      return JSON.parse(output);
    } catch (error) {
      console.error('gwm error:', error.stderr);
      throw error;
    }
  }

  async handleUserRequest(request) {
    if (request.includes('create PR')) {
      return this.createPR();
    } else if (request.includes('check CI')) {
      const prNumber = this.extractPRNumber(request);
      return this.checkCI(prNumber);
    } else if (request.includes('merge')) {
      const prNumber = this.extractPRNumber(request);
      return this.mergePR(prNumber);
    }
  }

  createPR() {
    console.log('Creating PR with gwm auto...');

    // Run security scan first
    const security = this.runGwm('security');
    if (!security.passed) {
      return `❌ Security scan failed: ${security.secretsFound} secrets found`;
    }

    // Create PR
    const result = this.runGwm('auto');
    return `✅ PR #${result.prNumber} created: ${result.url}`;
  }

  checkCI(prNumber) {
    console.log(`Checking CI for PR #${prNumber}...`);

    const checks = this.runGwm(`checks ${prNumber}`);

    if (checks.overallStatus === 'success') {
      return `✅ All ${checks.passed} checks passed!`;
    } else if (checks.overallStatus === 'pending') {
      return `⏳ ${checks.passed}/${checks.total} checks completed, ${checks.pending} pending...`;
    } else {
      const failures = checks.failureDetails
        .map(f => `  - ${f.checkName}: ${f.summary}`)
        .join('\n');
      return `❌ ${checks.failed} check(s) failed:\n${failures}`;
    }
  }

  extractPRNumber(request) {
    const match = request.match(/#?(\d+)/);
    return match ? match[1] : null;
  }
}

// Usage
const agent = new GitWorkflowAI();
const response = await agent.handleUserRequest(process.argv[2]);
console.log(response);
```

**Run it**:
```bash
./ai-agent.js "create PR"
./ai-agent.js "check CI for PR #123"
```

---

## Best Practices for AI Agents

### ✅ Use gwm for Local Automation, Not CI Orchestration

**gwm is designed for**:
- ✅ Local developer workflows (`gwm ship`, `gwm auto`)
- ✅ Security scanning in CI (`gwm security`)
- ✅ Status checking during development
- ✅ Automated PR management from developer machines

**gwm is NOT designed for**:
- ❌ Orchestrating GitHub Actions workflows
- ❌ Creating workflows to monitor other workflows
- ❌ Replacing GitHub's built-in PR status checks

**Example - Good AI agent integration**:
```
User: "Create a PR for my changes"

AI Agent:
1. Check status: gwm status --json
2. Create PR: gwm auto --draft
3. Monitor checks: gwm checks <pr-number> (optional, locally)
4. Provide feedback to user

✅ This is good - AI uses gwm locally for automation
```

**Example - Bad AI agent integration**:
```
User: "Set up gwm in GitHub Actions"

AI Agent:
1. Creates workflow to run gwm checks
2. gwm checks monitors other workflows
3. Workflow waits for other workflows

❌ This is bad - creates circular dependencies
```

---

### ✅ Propose gwm as Validation, Not Meta-Monitoring

When proposing GitHub Actions integration:

**✅ Good proposal**:
```yaml
# Add gwm as validation step in existing workflow
jobs:
  security:
    steps:
      - name: Security scan
        run: gwm security  # Adds value
```

**❌ Bad proposal**:
```yaml
# Create separate workflow to check other workflows
jobs:
  check-status:
    steps:
      - name: Monitor CI
        run: gwm checks $PR_NUMBER  # Redundant
```

**Why the second is bad**:
- GitHub already provides PR check status
- Creates workflow to monitor workflows (circular)
- Adds complexity without value
- Delays feedback (waits for other workflows)

**Better alternative**: Tell user to run `gwm checks` locally when they need status updates.

---

### ✅ Recommend Local Usage for Monitoring

When users ask about CI monitoring:

**✅ Good response**:
```
"You can monitor PR checks locally:
  gwm checks 47          # Check PR #47 status
  gwm status             # Check current branch
  gwm ship               # Automated workflow

GitHub's PR UI already shows check status in CI."
```

**❌ Bad response**:
```
"Let's create a workflow to monitor checks:
  [proposes separate workflow file]

This will run gwm checks on every PR."
```

---

### ✅ Understand gwm's Design Philosophy

**Core principle**: gwm enhances **developer workflows**, not CI orchestration.

**When to recommend gwm**:
- ✅ User wants to automate PR creation locally
- ✅ User needs security scanning in CI
- ✅ User wants structured JSON output
- ✅ User needs to monitor checks during development

**When NOT to recommend gwm**:
- ❌ GitHub's built-in features already cover the need
- ❌ Would create meta-workflows (workflows checking workflows)
- ❌ Would duplicate existing CI checks
- ❌ Would add complexity without clear benefit

---

### ✅ Suggest Appropriate Integration Points

**Good integration points**:
1. **Local development**: `gwm ship`, `gwm auto`, `gwm checks`
2. **CI validation**: `gwm security` as additional scanning
3. **Pre-commit hooks**: `gwm security` for local validation
4. **Documentation**: `gwm docs` for discovery

**Poor integration points**:
1. ❌ Separate workflow to check other workflows
2. ❌ Monitoring GitHub's built-in PR checks
3. ❌ Orchestrating existing CI pipelines
4. ❌ Duplicating functionality GitHub provides

---

## Resources

- **gwm CLI Reference**: `gwm --help`
- **JSON Schema**: All JSON outputs follow consistent schema (see examples above)
- **GitHub Actions Integration**: See [GITHUB-ACTIONS-INTEGRATION.md](GITHUB-ACTIONS-INTEGRATION.md)
- **Anti-Patterns**: See GITHUB-ACTIONS-INTEGRATION.md for anti-patterns to avoid
- **API Rate Limits**: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting

---

## Next Steps

1. **Install gwm**: `npm install -g @littlebearapps/git-workflow-manager`
2. **Set up token**: `export GITHUB_TOKEN="ghp_..."`
3. **Test integration**: Have your AI agent run `gwm status --json`
4. **Build workflows**: Implement the patterns above in your AI agent
5. **Monitor usage**: Track API calls and optimize caching

For GitHub Actions integration, see [GITHUB-ACTIONS-INTEGRATION.md](GITHUB-ACTIONS-INTEGRATION.md).
