# JSON Output Schemas Reference

**Version**: 1.9.0
**Last Updated**: 2025-11-20

---

## Overview

All `git-pr-manager` commands support machine-readable JSON output via the `--json` flag. This guide documents the JSON schemas for each command's output.

## Standard Response Format

All JSON responses follow a consistent structure:

```json
{
  "success": true,
  "data": {
    /* command-specific data */
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:11.755Z",
    "duration": 1.223,
    "version": "1.4.0"
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "worktree": "/path/to/current/worktree",
      "worktreeBranch": "feature/my-feature"
    },
    "suggestions": ["Suggestion 1", "Suggestion 2"]
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:11.755Z",
    "duration": 0.721,
    "version": "1.4.0"
  }
}
```

**Enhanced Error Context (Phase 2)**:

- `details.worktree` (string, optional): Current working directory (worktree path) - automatically included in git-related errors
- `details.worktreeBranch` (string, optional): Current branch name in the worktree - included when available
- `suggestions` (array, optional): Actionable fix suggestions for the error

### Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `AUTH_ERROR` - GitHub authentication failed
- `RATE_LIMIT_ERROR` - GitHub API rate limit exceeded
- `NETWORK_ERROR` - Network connectivity issue
- `GIT_ERROR` - Git operation failed
- `ERROR` - General error

---

## Command Schemas

### 1. `gpm status --json`

**Command**: Display current git and workflow status

**Success Response**:

```json
{
  "success": true,
  "data": {
    "branch": {
      "current": "feature/my-feature",
      "default": "main",
      "upstream": "origin/feature/my-feature"
    },
    "files": {
      "staged": 2,
      "modified": 1,
      "untracked": 0
    },
    "config": {
      "owner": "littlebearapps",
      "repo": "git-pr-manager",
      "defaultBranch": "main"
    }
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:11.755Z",
    "duration": 0.145,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `branch.current` (string): Current branch name
- `branch.default` (string): Default branch (main/master)
- `branch.upstream` (string|null): Upstream tracking branch
- `files.staged` (number): Number of staged files
- `files.modified` (number): Number of modified files
- `files.untracked` (number): Number of untracked files
- `config.owner` (string): GitHub repository owner
- `config.repo` (string): GitHub repository name
- `config.defaultBranch` (string): Default branch from config

---

### 2. `gpm protect --show --json`

**Command**: Display branch protection settings

**Success Response**:

```json
{
  "success": true,
  "data": {
    "branch": "main",
    "enabled": true,
    "requiredStatusChecks": [
      "Test on ubuntu-latest with Node 20",
      "Code Coverage"
    ],
    "strictChecks": true,
    "requiredReviews": 0,
    "dismissStaleReviews": false,
    "requireCodeOwnerReviews": false,
    "requireConversationResolution": false,
    "requireLinearHistory": false,
    "enforceAdmins": false,
    "allowForcePushes": false,
    "allowDeletions": false
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:04.302Z",
    "duration": 1.223,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `branch` (string): Branch name
- `enabled` (boolean): Whether protection is enabled
- `requiredStatusChecks` (string[]): Required CI checks
- `strictChecks` (boolean): Require branches to be up to date
- `requiredReviews` (number): Number of required reviews
- `dismissStaleReviews` (boolean): Dismiss stale reviews on new push
- `requireCodeOwnerReviews` (boolean): Require code owner reviews
- `requireConversationResolution` (boolean): Require conversation resolution
- `requireLinearHistory` (boolean): Require linear history
- `enforceAdmins` (boolean): Enforce rules for admins
- `allowForcePushes` (boolean): Allow force pushes
- `allowDeletions` (boolean): Allow branch deletion

---

### 3. `gpm security --json`

**Command**: Run security scanning (secrets + vulnerabilities)

**Success Response**:

```json
{
  "success": true,
  "data": {
    "passed": true,
    "secrets": {
      "scanned": false,
      "found": false,
      "count": 0,
      "secrets": [],
      "reason": "detect-secrets not installed (pip install detect-secrets)"
    },
    "vulnerabilities": {
      "scanned": true,
      "total": 0,
      "critical": 0,
      "high": 0,
      "medium": 0,
      "low": 0,
      "vulnerabilities": [],
      "reason": null
    },
    "warnings": [
      "Secret scanning skipped: detect-secrets not installed (pip install detect-secrets)"
    ],
    "blockers": []
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:08.608Z",
    "duration": 1.574,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `passed` (boolean): Overall pass/fail status
- `secrets.scanned` (boolean): Whether secret scanning was performed
- `secrets.found` (boolean): Whether secrets were found
- `secrets.count` (number): Number of secrets found
- `secrets.secrets` (object[]): Array of secret details
- `secrets.reason` (string|null): Reason if scan skipped
- `vulnerabilities.scanned` (boolean): Whether vulnerability scanning was performed
- `vulnerabilities.total` (number): Total vulnerabilities
- `vulnerabilities.critical` (number): Critical severity count
- `vulnerabilities.high` (number): High severity count
- `vulnerabilities.medium` (number): Medium severity count
- `vulnerabilities.low` (number): Low severity count
- `vulnerabilities.vulnerabilities` (object[]): Vulnerability details
- `vulnerabilities.reason` (string|null): Reason if scan skipped
- `warnings` (string[]): Warning messages
- `blockers` (string[]): Blocking issues

**Example with Findings**:

```json
{
  "success": false,
  "data": {
    "passed": false,
    "secrets": {
      "scanned": true,
      "found": true,
      "count": 2,
      "secrets": [
        {
          "file": "src/config.ts",
          "line": 42,
          "type": "AWS Access Key",
          "snippet": "AWS_ACCESS_KEY = 'AKIA...'"
        }
      ],
      "reason": null
    },
    "vulnerabilities": {
      "scanned": true,
      "total": 5,
      "critical": 1,
      "high": 2,
      "medium": 2,
      "low": 0,
      "vulnerabilities": [
        {
          "package": "lodash",
          "version": "4.17.15",
          "severity": "high",
          "cve": "CVE-2020-8203"
        }
      ],
      "reason": null
    },
    "warnings": [],
    "blockers": ["2 secrets found", "1 critical vulnerability"]
  }
}
```

---

### 4. `gpm checks <pr-number> --json`

**Command**: Get CI check status for a pull request

**Success Response**:

```json
{
  "success": true,
  "data": {
    "prNumber": 123,
    "total": 5,
    "passed": 5,
    "failed": 0,
    "pending": 0,
    "skipped": 0,
    "overallStatus": "success",
    "failureDetails": [],
    "startedAt": "2025-11-14T05:10:00.000Z"
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:15.234Z",
    "duration": 2.145,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `prNumber` (number): Pull request number
- `total` (number): Total number of checks
- `passed` (number): Number of passed checks
- `failed` (number): Number of failed checks
- `pending` (number): Number of pending checks
- `skipped` (number): Number of skipped checks
- `overallStatus` (string): "success" | "failure" | "pending"
- `failureDetails` (object[]): Details of failed checks
- `startedAt` (string): ISO timestamp when checks started

**Example with Failures**:

```json
{
  "success": false,
  "data": {
    "prNumber": 123,
    "total": 5,
    "passed": 3,
    "failed": 2,
    "pending": 0,
    "skipped": 0,
    "overallStatus": "failure",
    "failureDetails": [
      {
        "checkName": "Test on ubuntu-latest with Node 20",
        "status": "failure",
        "conclusion": "failure",
        "errorType": "test_failure",
        "affectedFiles": ["src/utils/cache.test.ts"],
        "suggestedFix": "Run npm test locally to debug"
      },
      {
        "checkName": "ESLint",
        "status": "failure",
        "conclusion": "failure",
        "errorType": "linting_error",
        "affectedFiles": ["src/commands/feature.ts"],
        "suggestedFix": "Run npm run lint -- --fix"
      }
    ],
    "startedAt": "2025-11-14T05:10:00.000Z"
  }
}
```

---

### 5. `gpm feature <name> --json`

**Command**: Create a new feature branch

**Success Response**:

```json
{
  "success": true,
  "data": {
    "branch": "feature/my-feature",
    "baseBranch": "main",
    "created": true
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:11.755Z",
    "duration": 0.521,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `branch` (string): Created feature branch name
- `baseBranch` (string): Base branch used for creation
- `created` (boolean): Whether branch was created successfully

**Error Response** (Dirty Working Directory):

```json
{
  "success": false,
  "error": {
    "code": "ERROR",
    "message": "Working directory has uncommitted changes. Commit or stash them first."
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:11.755Z",
    "duration": 0.721,
    "version": "1.4.0"
  }
}
```

**Error Response** (Worktree Conflict):

```json
{
  "success": false,
  "error": {
    "code": "WORKTREE_CONFLICT",
    "message": "Branch 'feature/my-feature' is already checked out in another worktree",
    "details": {
      "branch": "feature/my-feature",
      "currentWorktree": "/Users/user/project/main",
      "conflictingWorktrees": ["/Users/user/project/feature-branch"]
    },
    "suggestions": [
      "Switch to existing worktree: cd /Users/user/project/feature-branch",
      "Or use a different branch name",
      "Or remove the worktree: git worktree remove /Users/user/project/feature-branch"
    ]
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:11.755Z",
    "duration": 0.821,
    "version": "1.4.0"
  }
}
```

---

### 6. `gpm ship --json`

**Command**: Ship feature (create PR, wait for CI, merge)

**Success Response**:

```json
{
  "success": true,
  "data": {
    "merged": true,
    "prNumber": 123,
    "prUrl": "https://github.com/littlebearapps/git-pr-manager/pull/123",
    "branch": "feature/my-feature",
    "defaultBranch": "main",
    "branchDeleted": true
  },
  "metadata": {
    "timestamp": "2025-11-14T05:25:30.123Z",
    "duration": 485.234,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `merged` (boolean): Whether PR was merged
- `prNumber` (number): Pull request number
- `prUrl` (string): GitHub PR URL
- `branch` (string): Feature branch name
- `defaultBranch` (string): Target branch
- `branchDeleted` (boolean): Whether local branch was deleted

---

### 7. `gpm auto --json`

**Command**: Automated workflow (push, create PR, wait for CI, optionally merge)

**Success Response (Merged)**:

```json
{
  "success": true,
  "data": {
    "merged": true,
    "prNumber": 123,
    "prUrl": "https://github.com/littlebearapps/git-pr-manager/pull/123",
    "branch": "feature/my-feature",
    "defaultBranch": "main"
  },
  "metadata": {
    "timestamp": "2025-11-14T05:30:45.678Z",
    "duration": 612.456,
    "version": "1.4.0"
  }
}
```

**Success Response (No Merge - `--no-merge` flag)**:

```json
{
  "success": true,
  "data": {
    "merged": false,
    "prNumber": 123,
    "prUrl": "https://github.com/littlebearapps/git-pr-manager/pull/123",
    "branch": "feature/my-feature",
    "defaultBranch": "main"
  },
  "metadata": {
    "timestamp": "2025-11-14T05:30:45.678Z",
    "duration": 305.123,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `merged` (boolean): Whether PR was merged (false if --no-merge)
- `prNumber` (number): Pull request number
- `prUrl` (string): GitHub PR URL
- `branch` (string): Feature branch name
- `defaultBranch` (string): Target branch

---

### 8. `gpm check-update --json`

**Command**: Check for npm package updates

**Success Response (Update Available)**:

```json
{
  "success": true,
  "data": {
    "updateAvailable": true,
    "currentVersion": "1.4.0",
    "latestVersion": "1.5.0",
    "channel": "latest"
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:20.456Z",
    "duration": 0.234,
    "version": "1.4.0"
  }
}
```

**Success Response (No Update)**:

```json
{
  "success": true,
  "data": {
    "updateAvailable": false,
    "currentVersion": "1.4.0",
    "latestVersion": "1.4.0",
    "channel": "latest"
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:20.456Z",
    "duration": 0.234,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `updateAvailable` (boolean): Whether an update is available
- `currentVersion` (string): Currently installed version
- `latestVersion` (string): Latest available version
- `channel` (string): Release channel ("latest" | "next")

---

### 9. `gpm install-hooks --json`

**Command**: Install git hooks

**Success Response**:

```json
{
  "success": true,
  "data": {
    "installed": true,
    "hooks": ["pre-push", "post-commit"]
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:25.789Z",
    "duration": 0.156,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `installed` (boolean): Whether hooks were installed
- `hooks` (string[]): List of installed hooks

---

### 10. `gpm uninstall-hooks --json`

**Command**: Uninstall git hooks

**Success Response**:

```json
{
  "success": true,
  "data": {
    "uninstalled": true,
    "hooks": ["pre-push", "post-commit"]
  },
  "metadata": {
    "timestamp": "2025-11-14T05:17:30.123Z",
    "duration": 0.089,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `uninstalled` (boolean): Whether hooks were uninstalled
- `hooks` (string[]): List of uninstalled hooks

---

### 11. `gpm init --json`

**Command**: Initialize .gpm.yml configuration

**Success Response**:

```json
{
  "success": true,
  "data": {
    "created": true,
    "template": "basic",
    "filePath": ".gpm.yml",
    "config": {
      "branchProtection": {
        "enabled": false,
        "requireReviews": 0,
        "requireStatusChecks": [],
        "enforceAdmins": false
      },
      "ci": {
        "waitForChecks": true,
        "failFast": true,
        "retryFlaky": false,
        "timeout": 30
      },
      "security": {
        "scanSecrets": true,
        "scanDependencies": true,
        "allowedVulnerabilities": []
      },
      "pr": {
        "autoAssign": [],
        "autoLabel": []
      },
      "autoFix": {
        "enabled": true,
        "maxAttempts": 2,
        "maxChangedLines": 1000,
        "requireTests": true,
        "enableDryRun": false,
        "autoMerge": false,
        "createPR": true
      },
      "hooks": {
        "prePush": {
          "enabled": false,
          "reminder": true
        },
        "postCommit": {
          "enabled": false,
          "reminder": true
        }
      }
    }
  },
  "metadata": {
    "timestamp": "2025-11-14T05:31:46.159Z",
    "duration": 1.187,
    "version": "1.4.0"
  }
}
```

**Fields**:

- `created` (boolean): Whether config was created successfully
- `template` (string): Template used ("basic" | "standard" | "strict")
- `filePath` (string): Path to created config file
- `config` (object): Full configuration object created

**Error Response** (Config Already Exists):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR",
    "message": ".gpm.yml already exists",
    "suggestions": ["Delete the existing file or use --force flag to overwrite"]
  },
  "metadata": {
    "timestamp": "2025-11-14T05:31:34.380Z",
    "duration": 1.02,
    "version": "1.4.0"
  }
}
```

---

### 12. `gpm docs --json`

**Command**: Show documentation index

**Success Response** (Index):

```json
{
  "success": true,
  "data": {
    "version": "1.4.0",
    "installationPath": "/usr/local/lib/node_modules/@littlebearapps/git-pr-manager/",
    "availableGuides": [
      {
        "name": "AI-AGENT-INTEGRATION",
        "description": "AI Agent Setup Guide",
        "command": "gpm docs --guide=AI-AGENT-INTEGRATION"
      },
      {
        "name": "GITHUB-ACTIONS-INTEGRATION",
        "description": "GitHub Actions Integration Guide",
        "command": "gpm docs --guide=GITHUB-ACTIONS-INTEGRATION"
      },
      {
        "name": "JSON-OUTPUT-SCHEMAS",
        "description": "JSON Output Schemas Reference",
        "command": "gpm docs --guide=JSON-OUTPUT-SCHEMAS"
      },
      {
        "name": "CONFIGURATION",
        "description": "Configuration Guide",
        "command": "gpm docs --guide=CONFIGURATION"
      },
      {
        "name": "README",
        "description": "Full README",
        "command": "gpm docs --guide=README"
      }
    ],
    "paths": {
      "guides": "/usr/local/lib/node_modules/@littlebearapps/git-pr-manager/docs/guides",
      "quickrefs": "/usr/local/lib/node_modules/@littlebearapps/git-pr-manager/quickrefs",
      "docs": "/usr/local/lib/node_modules/@littlebearapps/git-pr-manager/docs"
    },
    "links": {
      "npm": "https://www.npmjs.com/package/@littlebearapps/git-pr-manager",
      "github": "https://github.com/littlebearapps/git-pr-manager",
      "issues": "https://github.com/littlebearapps/git-pr-manager/issues"
    }
  },
  "metadata": {
    "timestamp": "2025-11-14T05:31:08.379Z",
    "duration": 0.727,
    "version": "1.4.0"
  }
}
```

**Fields** (Index):

- `version` (string): Package version
- `installationPath` (string): Package installation directory
- `availableGuides` (object[]): List of available documentation guides
- `paths` (object): Paths to documentation directories
- `links` (object): Online documentation links

**Success Response** (Specific Guide):

```json
{
  "success": true,
  "data": {
    "guide": "README",
    "path": "/usr/local/lib/node_modules/@littlebearapps/git-pr-manager/docs/README.md",
    "found": true,
    "contentLength": 4985,
    "contentPreview": "# Documentation Index\n\nComplete documentation for Git PR Manager (GPM)..."
  },
  "metadata": {
    "timestamp": "2025-11-14T05:31:18.242Z",
    "duration": 1.167,
    "version": "1.4.0"
  }
}
```

**Fields** (Specific Guide):

- `guide` (string): Guide name requested
- `path` (string): Full path to guide file
- `found` (boolean): Whether guide was found
- `contentLength` (number): Size of guide content in characters
- `contentPreview` (string): First 500 characters of guide (for JSON mode)

**Note**: In JSON mode, only a preview of the content is returned to keep output manageable. For full content, use the command without `--json` flag.

**Error Response** (Guide Not Found):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR",
    "message": "Guide not found: INVALID-GUIDE",
    "suggestions": [
      "Available guides: AI-AGENT-INTEGRATION, GITHUB-ACTIONS-INTEGRATION, JSON-OUTPUT-SCHEMAS, CONFIGURATION, README"
    ]
  },
  "metadata": {
    "timestamp": "2025-11-14T05:32:00.000Z",
    "duration": 0.123,
    "version": "1.4.0"
  }
}
```

---

## Usage Examples

### Parse JSON with jq

```bash
# Get overall status from checks
gpm checks 123 --json | jq '.data.overallStatus'
# Output: "success"

# Count failed checks
gpm checks 123 --json | jq '.data.failed'
# Output: 0

# Get list of required status checks
gpm protect --show --json | jq '.data.requiredStatusChecks[]'
# Output: "Test on ubuntu-latest with Node 20"
#         "Code Coverage"

# Check if update available
gpm check-update --json | jq '.data.updateAvailable'
# Output: false

# Get vulnerability counts
gpm security --json | jq '.data.vulnerabilities | {total, critical, high}'
# Output: {"total": 0, "critical": 0, "high": 0}
```

### Use in Scripts

```bash
#!/bin/bash

# Wait for CI and check result
RESULT=$(gpm checks 123 --json)
STATUS=$(echo "$RESULT" | jq -r '.data.overallStatus')

if [ "$STATUS" = "success" ]; then
  echo "All checks passed!"
  exit 0
else
  echo "Checks failed"
  echo "$RESULT" | jq '.data.failureDetails[]'
  exit 1
fi
```

### GitHub Actions Integration

```yaml
- name: Check CI status
  id: ci-check
  run: |
    RESULT=$(gpm checks ${{ github.event.pull_request.number }} --json)
    echo "result=$RESULT" >> $GITHUB_OUTPUT

- name: Parse results
  run: |
    echo '${{ steps.ci-check.outputs.result }}' | jq '.data'
```

---

## TypeScript Type Definitions

For TypeScript projects integrating with gpm's JSON output:

```typescript
// Standard response wrapper
interface GpmResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    suggestion?: string;
  };
  metadata: {
    timestamp: string;
    duration: number;
    version: string;
  };
}

// Command-specific data types
interface StatusData {
  branch: {
    current: string;
    default: string;
    upstream: string | null;
  };
  files: {
    staged: number;
    modified: number;
    untracked: number;
  };
  config: {
    owner: string;
    repo: string;
    defaultBranch: string;
  };
}

interface ProtectData {
  branch: string;
  enabled: boolean;
  requiredStatusChecks: string[];
  strictChecks: boolean;
  requiredReviews: number;
  dismissStaleReviews: boolean;
  requireCodeOwnerReviews: boolean;
  requireConversationResolution: boolean;
  requireLinearHistory: boolean;
  enforceAdmins: boolean;
  allowForcePushes: boolean;
  allowDeletions: boolean;
}

interface SecurityData {
  passed: boolean;
  secrets: {
    scanned: boolean;
    found: boolean;
    count: number;
    secrets: Array<{
      file: string;
      line: number;
      type: string;
      snippet: string;
    }>;
    reason: string | null;
  };
  vulnerabilities: {
    scanned: boolean;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    vulnerabilities: Array<{
      package: string;
      version: string;
      severity: string;
      cve: string;
    }>;
    reason: string | null;
  };
  warnings: string[];
  blockers: string[];
}

interface ChecksData {
  prNumber: number;
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  overallStatus: "success" | "failure" | "pending";
  failureDetails: Array<{
    checkName: string;
    status: string;
    conclusion: string;
    errorType: string;
    affectedFiles: string[];
    suggestedFix: string;
  }>;
  startedAt: string;
}

interface FeatureData {
  branch: string;
  baseBranch: string;
  created: boolean;
}

interface ShipData {
  merged: boolean;
  prNumber: number;
  prUrl: string;
  branch: string;
  defaultBranch: string;
  branchDeleted: boolean;
}

interface AutoData {
  merged: boolean;
  prNumber: number;
  prUrl: string;
  branch: string;
  defaultBranch: string;
}

interface UpdateCheckData {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  channel: "latest" | "next";
}

interface HooksData {
  installed?: boolean;
  uninstalled?: boolean;
  hooks: string[];
}

interface InitData {
  created: boolean;
  template: "basic" | "standard" | "strict";
  filePath: string;
  config: {
    branchProtection: {
      enabled: boolean;
      requireReviews: number;
      requireStatusChecks: string[];
      enforceAdmins: boolean;
    };
    ci: {
      waitForChecks: boolean;
      failFast: boolean;
      retryFlaky: boolean;
      timeout: number;
    };
    security: {
      scanSecrets: boolean;
      scanDependencies: boolean;
      allowedVulnerabilities: string[];
    };
    pr: {
      autoAssign: string[];
      autoLabel: string[];
    };
    autoFix: {
      enabled: boolean;
      maxAttempts: number;
      maxChangedLines: number;
      requireTests: boolean;
      enableDryRun: boolean;
      autoMerge: boolean;
      createPR: boolean;
    };
    hooks: {
      prePush: {
        enabled: boolean;
        reminder: boolean;
      };
      postCommit: {
        enabled: boolean;
        reminder: boolean;
      };
    };
  };
}

interface DocsIndexData {
  version: string;
  installationPath: string;
  availableGuides: Array<{
    name: string;
    description: string;
    command: string;
  }>;
  paths: {
    guides: string;
    quickrefs: string;
    docs: string;
  };
  links: {
    npm: string;
    github: string;
    issues: string;
  };
}

interface DocsGuideData {
  guide: string;
  path: string;
  found: boolean;
  contentLength: number;
  contentPreview: string;
}

// Usage example
const response: GpmResponse<ChecksData> = JSON.parse(output);
if (response.success && response.data) {
  console.log(`${response.data.passed}/${response.data.total} checks passed`);
}
```

---

### 13. `gpm doctor --json`

**Command**: System health check - verify required tools and GitHub token

**Success Response**:

```json
{
  "status": "ok",
  "checks": [
    {
      "id": "token.github",
      "status": "ok",
      "details": "GitHub token found (GITHUB_TOKEN)",
      "version": null,
      "recommendedAction": null
    },
    {
      "id": "tool.git",
      "status": "ok",
      "details": "git version 2.51.0",
      "version": "2.51.0",
      "recommendedAction": null
    },
    {
      "id": "tool.node",
      "status": "ok",
      "details": "v20.10.0",
      "version": "20.10.0",
      "recommendedAction": null
    },
    {
      "id": "tool.gh",
      "status": "missing",
      "details": "Not found (optional)",
      "version": null,
      "recommendedAction": "Install: brew install gh"
    }
  ],
  "metadata": {
    "timestamp": "2025-11-20T10:30:00.000Z",
    "gpm_version": "1.9.0",
    "platform": "darwin"
  }
}
```

**Fields**:

- `status` (string): Overall status - "ok", "warnings", "errors"
- `checks` (array): List of all checks performed
  - `id` (string): Check identifier (e.g., "token.github", "tool.git")
  - `status` (string): Check status - "ok", "missing", "incompatible"
  - `details` (string|null): Human-readable details
  - `version` (string|null): Detected version if applicable
  - `recommendedAction` (string|null): Suggested action to resolve issues
- `metadata` (object): Metadata about the check
  - `timestamp` (string): ISO 8601 timestamp
  - `gpm_version` (string): GPM version
  - `platform` (string): Operating system platform

**Exit Codes**:

- `0`: All required tools present (may have warnings for optional tools)
- `1`: Missing required tools or errors

**Use Cases**:

- Verify environment before running workflows
- CI/CD environment validation
- Troubleshooting setup issues

---

### 14. `gpm setup --json`

**Command**: Interactive setup wizard for GitHub token configuration

**Success Response** (token configured):

```json
{
  "success": true,
  "method": "direnv-keychain",
  "location": "/Users/user/project/.envrc",
  "message": "Token stored successfully using direnv + keychain",
  "instructions": [
    "Token stored in macOS Keychain: github-token-gpm",
    "Added to .envrc: source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get github-token-gpm)",
    "Run: direnv allow"
  ]
}
```

**Success Response** (already configured):

```json
{
  "success": true,
  "configured": true,
  "message": "Token already configured"
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "Token validation failed: Invalid token format"
}
```

**Fields**:

- `success` (boolean): Whether setup completed successfully
- `method` (string, optional): Storage method used (direnv-keychain, shell-profile, env-file, env-export)
- `location` (string, optional): File path where token configuration was stored
- `message` (string): Human-readable status message
- `instructions` (array, optional): Step-by-step instructions for completing setup
- `configured` (boolean, optional): True if token was already configured
- `error` (string, optional): Error message if setup failed

**Storage Methods**:

- `direnv-keychain`: direnv + macOS Keychain (highest security)
- `keychain-helper`: Keychain helper script
- `shell-profile`: Shell profile (~/.zshrc, ~/.bashrc)
- `env-file`: .env file
- `env-export`: Current session only

**Exit Codes**:

- `0`: Setup completed successfully
- `1`: Setup failed (validation error, storage error, etc.)

**Use Cases**:

- Automated CI/CD setup scripts
- First-time user onboarding
- Token reconfiguration

---

## Best Practices

### 1. Always Check `success` Field

```bash
# ❌ Bad - assumes success
BRANCH=$(gpm status --json | jq -r '.data.branch.current')

# ✅ Good - check success first
RESULT=$(gpm status --json)
if [ $(echo "$RESULT" | jq -r '.success') = "true" ]; then
  BRANCH=$(echo "$RESULT" | jq -r '.data.branch.current')
else
  echo "Error: $(echo "$RESULT" | jq -r '.error.message')"
  exit 1
fi
```

### 2. Handle Errors Gracefully

```typescript
const response: GpmResponse<ChecksData> = JSON.parse(output);

if (!response.success) {
  console.error(`Error: ${response.error?.message}`);
  if (response.error?.suggestion) {
    console.log(`Suggestion: ${response.error.suggestion}`);
  }
  process.exit(1);
}

// Now safe to access response.data
const { passed, total } = response.data!;
```

### 3. Use Metadata for Monitoring

```bash
# Track command performance
RESULT=$(gpm security --json)
DURATION=$(echo "$RESULT" | jq -r '.metadata.duration')
echo "Security scan completed in ${DURATION}s"

# Log for audit trails
TIMESTAMP=$(echo "$RESULT" | jq -r '.metadata.timestamp')
VERSION=$(echo "$RESULT" | jq -r '.metadata.version')
echo "[$TIMESTAMP] gpm v$VERSION: scan completed"
```

### 4. Validate Schema

```typescript
function isValidGpmResponse<T>(data: unknown): data is GpmResponse<T> {
  const response = data as GpmResponse<T>;
  return (
    typeof response.success === "boolean" &&
    response.metadata !== undefined &&
    typeof response.metadata.timestamp === "string" &&
    typeof response.metadata.duration === "number" &&
    typeof response.metadata.version === "string"
  );
}

// Usage
const parsed = JSON.parse(output);
if (!isValidGpmResponse(parsed)) {
  throw new Error("Invalid gpm response format");
}
```

---

## Exit Codes

gpm uses exit codes consistently across all commands:

- `0` - Success (corresponds to `success: true`)
- `1` - General failure
- `2` - Validation error
- `3` - Authentication error
- `4` - Rate limit error

When using JSON output, **always prefer checking the JSON `success` field** over exit codes for programmatic parsing.

---

## Version Compatibility

### Schema Versioning

JSON schemas follow semantic versioning tied to gpm releases:

- **Major version changes** (2.0.0): Breaking schema changes
- **Minor version changes** (1.5.0): Additive schema changes (new fields)
- **Patch version changes** (1.4.1): No schema changes

### Checking Schema Version

```bash
# Get gpm version from any JSON response
gpm status --json | jq -r '.metadata.version'
# Output: "1.4.0"
```

### Backward Compatibility

- New fields may be added in minor versions (safe to ignore)
- Existing fields will not be removed in minor/patch versions
- Field types will not change in minor/patch versions
- Breaking changes only occur in major versions

---

## Troubleshooting

### Issue: No JSON Output

**Problem**: Command runs but produces no JSON output

**Solutions**:

1. Ensure `--json` flag is used: `gpm status --json`
2. Check that command supports JSON (all commands v1.4.0+)
3. Verify output isn't being filtered (spinner output is suppressed in JSON mode)

### Issue: Invalid JSON

**Problem**: `jq` reports parse errors

**Solutions**:

1. Check for debug output mixed with JSON (use `gpm --json` not `DEBUG=1 gpm --json`)
2. Ensure you're parsing the correct output (not stderr)
3. Validate JSON manually: `gpm status --json | jq .`

### Issue: Missing Fields

**Problem**: Expected fields are `null` or missing

**Solutions**:

1. Check that you're using the correct command (`gpm protect --show --json` not `gpm protect --json`)
2. Verify the operation completed successfully (check `success: true`)
3. Check metadata.version for schema compatibility

---

## Resources

- **Main README**: [README.md](../../README.md)
- **AI Agent Integration**: [AI-AGENT-INTEGRATION.md](AI-AGENT-INTEGRATION.md)
- **GitHub Actions Guide**: [GITHUB-ACTIONS-INTEGRATION.md](GITHUB-ACTIONS-INTEGRATION.md)
- **TypeScript Types**: See `src/types/` directory for internal types

---

## Feedback

For schema suggestions or issues:

- Open an issue: https://github.com/littlebearapps/git-pr-manager/issues
- Reference this schema version in bug reports
