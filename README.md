# Git Workflow Manager

Production-ready git workflow automation for GitHub with Claude Code integration. Streamlines feature development with intelligent CI polling, comprehensive error reporting, automated PR workflows, **multi-language verification** (Python, Node.js, Go, Rust), and **automated release validation**.

[![npm version](https://badge.fury.io/js/%40littlebearapps%2Fgit-pr-manager.svg)](https://www.npmjs.com/package/@littlebearapps/git-pr-manager)
[![Node.js CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)](https://github.com/littlebearapps/git-pr-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ What's New

### Release Validation Strategy (Alternative D) - Nov 2025
- ✅ **Zero-drift version management**: package.json uses `0.0.0-development` placeholder; semantic-release determines actual versions
- ✅ **Pre-release validation**: `gpm doctor --pre-release` runs 7 automated checks before publishing
  - Verifies workflow files exist and badge URLs are correct
  - Ensures working directory is clean and on main branch
  - Validates all CI checks have passed
- ✅ **Automated publish workflow integration**: Pre-release validation integrated into `.github/workflows/publish.yml`
- ✅ **Smart CLI version detection**: Runtime version lookup via git tags (development) or npm (production)
- ✅ **Single source of truth**: npm registry is authoritative; eliminates version drift between git and npm
- 📚 See [docs/RELEASE-VALIDATION-STRATEGY.md](docs/RELEASE-VALIDATION-STRATEGY.md) for complete details

### Sprint 3 – Output Polish & Documentation (Nov 2025)
- ✅ Cross-command spacing review: redundant `logger.blank()` → `logger.section()` pairs removed so sections render with a single intentional spacer everywhere.
- ✅ CLI docs polish: README, CLAUDE.md, quickrefs, and the new `docs/SPRINT-3-COMPLETION-SUMMARY.md` all explain Sprint 1‑3 deliverables and optional tooling.
- ✅ Optional secret scanning guidance now documents `detect-secrets` as an add-on while clarifying that `gpm security` still runs `npm audit` even when Python tooling is absent.

### Sprint 2 – Reliability & Observability
- ✅ npm vulnerability remediation ensures dependencies install cleanly on fresh machines (Issue #1).
- ✅ JSON output standardization keeps machine-readable logs consistent across commands via the shared logger refactor (Issue #3).

### Sprint 1 – AI Agent Enablement
- ✅ ExecutionTracker utility instruments `gpm ship` with per-phase timing + structured metadata for JSON output (Issue #5).
- ✅ CI polling hardened: the "0/0 checks" race condition is handled gracefully with smarter EnhancedCIPoller messaging (Issue #4).

## 🚀 Quick Start

### Installation

```bash
npm install -g @littlebearapps/git-pr-manager
```

### Setup

#### 1. GitHub Token (Required for PR operations)

Create a GitHub Personal Access Token with `repo` scope:

1. Go to https://github.com/settings/tokens/new
2. Give it a name (e.g., "gpm")
3. Select scopes: `repo` (full control)
4. Click "Generate token"
5. Copy the token (starts with `ghp_`)

**Set the token** (choose one method):

```bash
# Option 1: Export in shell (temporary - current session only)
export GITHUB_TOKEN="ghp_your_token_here"

# Option 2: Add to ~/.zshrc or ~/.bashrc (persistent)
echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.zshrc
source ~/.zshrc

# Option 3: Project-specific .env file
echo 'GITHUB_TOKEN=ghp_your_token_here' >> .env
# Add .env to .gitignore if not already there

# Verify token is set
echo $GITHUB_TOKEN  # Should show your token
```

**Note**: Commands that require GitHub token: `ship`, `auto`, `checks`, `feature` (when pushing). Local commands like `status`, `security`, `init` work without a token.

#### 2. Initialize Configuration

```bash
# Interactive setup wizard (recommended for first time)
gpm init --interactive

# Or use a preset template
gpm init --template standard  # Balanced settings
gpm init --template strict    # Maximum protection
gpm init --template basic     # Minimal configuration
```

#### 3. Optional: Install Git Hooks

```bash
# Install reminder hooks (non-blocking, helpful)
gpm install-hooks

# Or install both pre-push and post-commit hooks
gpm install-hooks --post-commit
```

#### 4. Optional Security Enhancements

**Secret Scanning (detect-secrets)**  
`gpm security` already runs `npm audit`, but you can enable richer secret detection if you have Python available:

```bash
pip install detect-secrets
```

- Adds regex-based scanning for API keys/tokens
- Supports `.secrets.baseline` files to manage known findings
- Integrates nicely with `gpm security` output and pre-commit hooks

> ℹ️ Missing `detect-secrets` only skips the secrets portion of the scan. Dependency checks (npm audit) still run, so gpm works perfectly without this optional tool.

### Basic Usage

```bash
# Start a new feature
gpm feature add-login-form

# ... make your changes ...

# Ship it! (automated workflow)
gpm auto
```

That's it! `gpm auto` will:
1. Run verification checks
2. Run security scans
3. Push changes
4. Create PR
5. Wait for CI to pass
6. Merge and cleanup

## 📖 Commands

### Workflow Automation

```bash
# Automated end-to-end workflow (recommended)
gpm auto                        # Full automation
gpm auto --draft                # Create draft PR
gpm auto --no-merge             # Stop after CI passes
gpm auto --skip-security        # Skip security scan
gpm auto --skip-verify          # Skip verification

# Manual workflow control
gpm feature <name>              # Start new feature branch
gpm ship                        # Ship feature with full control
  --no-wait                     # Don't wait for CI
  --skip-verify                 # Skip pre-commit checks
  --skip-security               # Skip security scan
  --draft                       # Create draft PR
  --title <title>               # Custom PR title
  --template <path>             # PR template path
```

### CI & Status

```bash
# Check CI status with detailed error reports
gpm checks <pr-number>          # Show check status
gpm checks <pr-number> --details # Full error details
gpm checks <pr-number> --files   # Affected files only

# Show current git and workflow status
gpm status
```

### Configuration & Security

```bash
# Initialize configuration
gpm init                        # Basic template
gpm init --interactive          # Interactive wizard
gpm init --template standard    # Standard preset
gpm init --template strict      # Strict preset

# Branch protection
gpm protect --show              # View current settings
gpm protect --preset standard   # Configure protection
gpm protect --branch main --preset strict

# Security scanning
gpm security                    # Run security scan

# Pre-commit verification (Phase 1c: Enhanced Pipeline)
gpm verify                      # Run all checks (format, lint, typecheck, test, build)
gpm verify --skip-format        # Skip code formatting check
gpm verify --skip-lint          # Skip linting
gpm verify --skip-typecheck     # Skip type checking
gpm verify --skip-test          # Skip tests
gpm verify --skip-build         # Skip build
gpm verify --no-stop-on-first-failure  # Continue through all tasks

# System health check
gpm doctor                      # Check requirements & dependencies

# Check for updates
gpm check-update                # Check for available updates
gpm check-update --json         # Machine-readable output
gpm check-update --clear-cache  # Force fresh check
gpm check-update --channel next # Check prerelease channel
```

### Git Hooks

```bash
# Install pre-push hook (default)
gpm install-hooks               # Reminder-only, non-blocking

# Install both pre-push and post-commit hooks
gpm install-hooks --post-commit # Additional post-commit reminders

# Force overwrite existing hooks
gpm install-hooks --force       # Overwrite non-gpm hooks

# Uninstall gpm hooks
gpm uninstall-hooks            # Remove all gpm hooks

# Check hook status
gpm status --json              # Shows hooks.prePush and hooks.postCommit
```

**Hook Behavior**:
- **Non-blocking**: Never prevent commits or pushes
- **Reminder-only**: Display helpful workflow suggestions
- **Optional**: Can be disabled/uninstalled anytime
- **CI-aware**: Automatically skipped in CI environments
- **Worktree-compatible**: Works with both standard repos and git worktrees

**Pre-push hook** reminds you to:
- Run `gpm ship` for automated PR creation
- Run `gpm security` to scan for secrets
- Consider `gpm auto` for full workflow

**Post-commit hook** (optional) reminds you to:
- Create PR if on feature branch
- Run security scans before pushing

### Git Worktree Management

```bash
# List all worktrees
gpm worktree list              # Show all worktrees with branch info
gpm worktree list --json       # Machine-readable output

# Prune stale worktree data
gpm worktree prune             # Remove stale administrative data
gpm worktree prune --dry-run   # Preview what would be pruned
gpm worktree prune --json      # Machine-readable output
```

**Use cases**:
- **Multi-project workflows**: Work on multiple features simultaneously
- **Code review**: Keep separate worktrees for reviewing PRs
- **Maintenance**: Clean up stale worktree administrative data

**Worktree list output** shows:
- Path to each worktree
- Current branch name (or `(detached)` for detached HEAD)
- Latest commit hash
- Main worktree marker (`[main]`)
- Current worktree indicator (`*`)

### Output Control

All commands support output control flags:

```bash
--json      # Machine-readable JSON output
--quiet     # Errors only
--silent    # No output (exit codes only)
--verbose   # Detailed output
```

## 🌍 Multi-Language Support

`gpm verify` automatically detects your project language and package manager, running appropriate verification commands for each ecosystem.

### Supported Languages & Package Managers

| Language | Package Managers | Auto-Detection |
|----------|-----------------|----------------|
| **Python** | poetry, pipenv, uv, pip | `pyproject.toml`, `Pipfile`, `requirements.txt` |
| **Node.js** | pnpm, yarn, bun, npm | `package.json`, lock files |
| **Go** | go modules | `go.mod` |
| **Rust** | cargo | `Cargo.toml` |

### How It Works

When you run `gpm verify`, it automatically:

1. **Detects your language** from project markers (e.g., `pyproject.toml`, `package.json`)
2. **Detects your package manager** from lock files and config
3. **Resolves appropriate commands** for lint, typecheck, test, and build
4. **Runs verification** with language-specific tools

### Examples

#### Python with Poetry

```bash
# Auto-detects poetry from poetry.lock
gpm verify

# Runs:
# ✓ black --check .              (format)
# ✓ poetry run ruff check .      (lint)
# ✓ poetry run mypy .            (typecheck)
# ✓ poetry run pytest            (test)
# (build skipped - optional for Python)
```

#### Node.js with npm

```bash
# Auto-detects npm from package-lock.json
gpm verify

# Runs:
# ✓ prettier --check .     (format)
# ✓ npm run lint           (lint)
# ✓ npx tsc --noEmit       (typecheck)
# ✓ npm test               (test)
# ✓ npm run build          (build)
```

#### Node.js with yarn

```bash
# Auto-detects yarn from yarn.lock
gpm verify

# Runs:
# ✓ prettier --check .     (format)
# ✓ yarn lint              (lint)
# ✓ yarn typecheck         (typecheck)
# ✓ yarn test              (test)
# ✓ yarn build             (build)
```

#### Go Project

```bash
# Auto-detects Go from go.mod
gpm verify

# Runs:
# ✓ gofmt -l .         (format)
# ✓ golangci-lint run  (lint)
# ✓ go test ./...      (test)
# ✓ go build           (build)
```

#### Rust Project

```bash
# Auto-detects Rust from Cargo.toml
gpm verify

# Runs:
# ✓ cargo fmt --check  (format)
# ✓ cargo clippy       (lint)
# ✓ cargo test         (test)
# ✓ cargo build        (build)
```

### Makefile Integration

If your project has a `Makefile`, `gpm` will prefer Makefile targets:

```makefile
# Makefile
format:
    black --check .

lint:
    ruff check .
    mypy .

test:
    pytest tests/

build:
    python setup.py build
```

```bash
gpm verify
# Runs:
# ✓ make format
# ✓ make lint
# ✓ make test
# ✓ make build
```

**Phase 1b Enhancement: Makefile Customization**

Customize Makefile integration with aliases and custom mappings:

```yaml
# .gpm.yml
makefile:
  preferMakefile: true           # Default: true

  # Custom task → target mapping
  makefileTargets:
    lint: check                  # Use 'make check' for lint task
    test: verify                 # Use 'make verify' for test task

  # Target → task mapping (aliases)
  makefileAliases:
    check: lint                  # 'check' target maps to 'lint' task
    verify: test                 # 'verify' target maps to 'test' task
    compile: build               # 'compile' target maps to 'build' task
```

**Use cases**:
- **Custom target names**: Your Makefile uses `check` instead of `lint`
- **Standardization**: Map project-specific targets to standard tasks
- **Legacy support**: Adapt existing Makefiles without renaming targets

### Install Step (Phase 1b)

Automatically install dependencies before verification:

```bash
# Allow install (will run npm ci, poetry install, etc.)
gpm verify --allow-install

# Skip install (default behavior)
gpm verify --skip-install
```

Supported package managers:
- **Node.js**: `npm ci`, `pnpm install --frozen-lockfile`, `yarn install --frozen-lockfile`, `bun install`
- **Python**: `poetry install`, `pipenv install`, `uv sync`, `pip install -r requirements.txt`
- **Go**: `go mod download`
- **Rust**: `cargo fetch`

### Workspace Detection (Phase 1b)

Automatically detects and uses workspace root for Node.js projects:

```bash
# Workspace structure
my-workspace/
├── package.json          # Workspace root (workspaces: ["packages/*"])
├── packages/
│   ├── app/
│   │   └── package.json
│   └── lib/
│       └── package.json
```

**Supported workspace types**:
- **npm/yarn**: `package.json` with `workspaces` field
- **Yarn 2+**: `.yarnrc.yml` in workspace root
- **pnpm**: `pnpm-workspace.yaml` in workspace root

```bash
# Run from any package directory
cd packages/app
gpm status
# ℹ Workspace Root: /my-workspace
# ℹ Package Manager: pnpm
# ℹ Makefile Targets: lint, test, build
```

### Customization

Override language detection or commands in `.gpm.yml`:

```yaml
# .gpm.yml
verification:
  # Disable auto-detection
  detectionEnabled: false

  # Prefer Makefile targets over package manager (default: true)
  preferMakefile: true

  # Override specific commands
  commands:
    format: "black --check ."
    lint: "make lint"
    test: "make test"
    typecheck: "mypy src/"
    build: "python -m build"

  # Phase 1c: Task ordering and control
  tasks: ['format', 'lint', 'typecheck', 'test', 'build']  # Custom execution order
  skipTasks: ['build']                                     # Skip specific tasks
  stopOnFirstFailure: true                                 # Stop on first error (default: true)
```

### Command Resolution Priority

`gpm` resolves commands in this order:

1. **Custom commands** from `.gpm.yml`
2. **Makefile targets** (if `preferMakefile: true`)
3. **Package manager scripts** (e.g., `npm run lint`, `poetry run ruff`)
4. **Native tools** (e.g., `npx eslint`, `ruff check`)
5. **Not found** (step skipped gracefully)

### Skip Options

Skip specific verification steps:

```bash
gpm verify --skip-format        # Skip code formatting check
gpm verify --skip-lint          # Skip linting
gpm verify --skip-typecheck     # Skip type checking
gpm verify --skip-test          # Skip tests
gpm verify --skip-build         # Skip build
gpm verify --skip-install       # Skip dependency installation
```

## 🔧 CI/CD & Automation

### GitHub Actions Integration

Use `gpm` in your GitHub Actions workflows for automated PR validation and CI orchestration:

```yaml
name: PR Validation
on: pull_request

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install gpm
        run: npm install -g @littlebearapps/git-pr-manager

      - name: Run security scan
        run: gpm security --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Wait for CI checks
        run: gpm checks ${{ github.event.pull_request.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**See**: [GitHub Actions Integration Guide](docs/guides/GITHUB-ACTIONS-INTEGRATION.md) for complete workflows and examples.

### AI Agent Integration

`gpm` is designed for CLI AI agents (Claude Code, Aider, Cursor, etc.) with machine-readable JSON output:

```bash
# AI agents can execute gpm commands
gpm checks 123 --json    # Get structured CI status
gpm security --json      # Security scan results
gpm auto --json          # Full PR workflow
```

**Example AI Agent Workflow**:
```
User: "Create a PR for this feature"
AI Agent: [Executes] gpm auto --json
AI Agent: [Parses] {"prNumber": 47, "url": "...", "ciStatus": "pending"}
AI Agent: [Reports] "✅ PR #47 created. CI checks pending."
```

**See**: [AI Agent Integration Guide](docs/guides/AI-AGENT-INTEGRATION.md) for implementation examples in Python, JavaScript, and Go.

## 🎯 Key Features

### Complete Workflow Automation
- Feature branch creation → PR → CI → Merge in one command
- Smart defaults from `.gpm.yml` configuration
- Automatic branch cleanup after merge
- Draft PR support for work-in-progress

### Enterprise Security
- **Secret Detection**: Automatic scanning for API keys, tokens, passwords
- **Vulnerability Scanning**: npm audit, pip-audit integration
- **Critical Issue Blocking**: Prevent merges with security vulnerabilities
- **Language Detection**: Auto-detects Python, Node.js, and configures scanners

### Intelligent CI Polling
- **Exponential Backoff**: Adaptive polling (5s → 30s) reduces API calls
- **Progress Tracking**: Real-time updates on check status
- **Rich Error Reports**: Detailed classification with suggested fixes
- **Fail-Fast Mode**: Exit early on critical failures
- **Retry Logic**: Handle flaky tests automatically

### Branch Protection
- **Validation**: Check protection requirements before merge
- **Configuration**: Apply presets (basic, standard, strict)
- **PR Readiness**: Validate checks, reviews, conflicts, conversations
- **Staleness Detection**: Warn on outdated branches (strict mode)

### Git Worktree Support
- **Conflict Detection**: Automatically detects when a branch is checked out in another worktree
- **Smart Worktree Parsing**: Handles bare repositories, detached HEAD states, and multiple worktrees
- **Actionable Error Messages**: Provides clear guidance when conflicts occur
- **Enhanced Error Context**: Automatically includes worktree path and branch in all git-related errors
- **Seamless Integration**: Works transparently with standard git repositories
- **Current Worktree Filtering**: Ignores current worktree when checking for conflicts

### Performance Optimizations
- **API Response Caching**: LRU cache with ETag support (5-minute TTL)
- **Request Batching**: Parallel API calls with Promise.all()
- **Config Caching**: TTL-based file caching (60-second default)
- **Rate Limit Handling**: Automatic retry with exponential backoff

### Enhanced Error Reporting
- **Error Classification**: Pattern-based categorization (tests, linting, types, security, build)
- **File Extraction**: Parse affected files from error messages
- **Suggested Fixes**: Context-aware command recommendations
- **Structured Output**: Error codes, details, and suggestions
- **JSON Mode**: Machine-readable errors for automation

### Automated Error Fixing (Phase 6)
- **Intelligent Auto-Fix**: Automatically resolves linting, formatting, and security issues
- **Post-Fix Verification**: Runs tests after fixes to ensure nothing broke
- **Automatic Rollback**: Reverts changes if verification fails
- **Dry-Run Mode**: Preview fixes without making changes
- **Comprehensive Metrics**: Track fix success rates, rollbacks, and performance
- **Change Size Limits**: Configurable maximum changed lines (default: 1000)
- **Attempt Tracking**: Prevents infinite loops with configurable max attempts
- **Enhanced Logging**: Structured logs with timestamps and context

For detailed documentation, see [AUTO-FIX.md](AUTO-FIX.md)

## 📋 Configuration

### `.gpm.yml` Example

```yaml
branchProtection:
  enabled: true
  requireReviews: 1              # Number of required reviews
  requireStatusChecks:           # Required CI checks
    - test
    - lint
    - typecheck
  enforceAdmins: false           # Apply to admins too

ci:
  waitForChecks: true            # Wait for CI to complete
  failFast: true                 # Exit on first critical failure
  retryFlaky: false              # Retry flaky tests
  timeout: 30                    # Timeout in minutes

security:
  scanSecrets: true              # Run secret detection
  scanDependencies: true         # Run vulnerability scan
  allowedVulnerabilities: []     # Allow specific CVEs

pr:
  templatePath: .github/PULL_REQUEST_TEMPLATE.md
  autoAssign: []                 # Auto-assign reviewers
  autoLabel: []                  # Auto-apply labels

autoFix:
  enabled: true                  # Enable auto-fix globally
  maxAttempts: 2                 # Max fix attempts per error type (1-5)
  maxChangedLines: 1000          # Max lines that can be changed (1-10000)
  requireTests: true             # Run tests after fix to verify
  enableDryRun: false            # Enable dry-run mode by default
  autoMerge: false               # Auto-merge fix PRs if checks pass
  createPR: true                 # Create PR for fixes (vs direct commit)

# Phase 1b: Advanced Features
install:
  enabled: true                  # Enable install step
  skipByDefault: false           # Skip install unless --allow-install is set

makefile:
  preferMakefile: true           # Prefer Makefile targets over native tools
  makefileTargets:               # Custom task → target mapping
    lint: check                  # Use 'make check' for lint task
    test: verify                 # Use 'make verify' for test task
  makefileAliases:               # Target → task mapping (reverse)
    check: lint                  # 'check' target maps to 'lint' task
    verify: test                 # 'verify' target maps to 'test' task

workspace:
  autoDetect: true               # Auto-detect Node.js workspaces
  preferRoot: true               # Run commands from workspace root
```

### Configuration Presets

**Basic** - Personal/experimental projects:
- No required reviews
- Minimal checks
- Fast iteration

**Standard** - Team projects (recommended):
- 0 required reviews (optional)
- Core checks (test)
- Balanced protection

**Strict** - Production systems:
- 1+ required reviews
- All checks (test, lint, typecheck)
- Enforce on admins
- Staleness detection

### System Health Check

Use `gpm doctor` to verify your setup and identify missing dependencies:

```bash
gpm doctor
```

**What it checks**:
- ✅ **GitHub Token**: Verifies `GITHUB_TOKEN` or `GH_TOKEN` is set
- ✅ **Required Tools**: `git`, `node` (needed for gpm to run)
- ✅ **Optional Tools**: `gh` (GitHub CLI), `detect-secrets`, `pip-audit`, `npm`

**Example output**:
```
▸ System Health Check
────────────────────────────────────────────────────────────────────────────────
✅ GitHub token: GITHUB_TOKEN

Required Tools:
────────────────────────────────────────────────────────────────────────────────
✅ git                  git version 2.51.0
✅ node                 v20.10.0

Optional Tools:
────────────────────────────────────────────────────────────────────────────────
✅ gh                   gh version 2.78.0 (2025-08-21)
⚠️  detect-secrets       NOT FOUND (optional)
    Secret scanning in code
    Install: pip install detect-secrets
⚠️  pip-audit            NOT FOUND (optional)
    Python dependency vulnerability scanning
    Install: pip install pip-audit
✅ npm                  11.6.0

────────────────────────────────────────────────────────────────────────────────
ℹ️  Some optional tools are missing
   gpm will work but some features may be limited:
   • Secret scanning requires detect-secrets
   • Python security scans require pip-audit
   • Enhanced GitHub features require gh CLI

Next Steps:
  gpm init              - Initialize .gpm.yml configuration
  gpm docs              - View documentation
  gpm --help            - Show all commands
```

**When to use**:
- After first installation to verify setup
- When encountering "tool not found" warnings
- Before installing optional security tools
- To verify environment configuration in CI/CD

**Optional dependencies explained**:
- **detect-secrets** (Python): Scans code for hardcoded secrets (API keys, tokens, passwords). Required for `gpm security` secret scanning.
- **pip-audit** (Python): Scans Python dependencies for known vulnerabilities. Used by `gpm security` for Python projects.
- **gh** (GitHub CLI): Enhances PR operations with additional GitHub features. Not required but recommended.
- **npm**: Used for JavaScript dependency scanning in `gpm security`. Already installed if you're using gpm.

### Pre-Release Validation

Use `gpm doctor --pre-release` to validate your repository is ready for publishing (part of Alternative D release strategy):

```bash
gpm doctor --pre-release
```

**7 Automated Checks**:
- ✅ Required workflow files exist (`.github/workflows/ci.yml`, `publish.yml`)
- ✅ README badge URLs match actual workflow names
- ⚠️ `package.json` version is `0.0.0-development` (warning only)
- ⚠️ `@semantic-release/git` plugin NOT present in `.releaserc.json` (warning only)
- ✅ Working directory is clean (no uncommitted changes)
- ✅ Currently on main branch
- ⚠️ All CI checks passed for HEAD commit (warning if gh CLI unavailable)

**When to use**:
- Before publishing to npm (integrated into publish workflow)
- Validates release readiness automatically
- Catches configuration issues before semantic-release runs

### Environment Variables

#### Required for GitHub API Operations

```bash
# GitHub authentication (required for PR/merge operations)
export GITHUB_TOKEN="ghp_your_token_here"
# or
export GH_TOKEN="ghp_your_token_here"  # Alternative variable name
```

**Token Permissions Needed**:
- `repo` - Full control of private repositories
  - Includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`

**Where to get token**: https://github.com/settings/tokens/new

**Commands that require token**:
- `gpm ship` - Create PR and merge
- `gpm auto` - Automated PR workflow
- `gpm checks <pr>` - Check CI status
- `gpm feature <name>` - Create feature branch (if pushing to remote)

**Commands that work without token**:
- `gpm status` - Local git status
- `gpm security` - Local security scan
- `gpm init` - Initialize configuration
- `gpm doctor` - Check system requirements and dependencies
- `gpm install-hooks` / `gpm uninstall-hooks` - Manage git hooks
- `gpm worktree list` / `gpm worktree prune` - Git worktree management
- `gpm docs` - View documentation

#### Optional Environment Variables

```bash
# Enable debug mode (verbose logging)
export DEBUG=1

# Disable update notifications
export NO_UPDATE_NOTIFIER=1

# CI environment detection (auto-detected)
export CI=true              # Generic CI indicator
export GITHUB_ACTIONS=true  # GitHub Actions
export GITLAB_CI=true       # GitLab CI
export JENKINS_HOME=/var/jenkins  # Jenkins
```

## 🏗️ Architecture

```
src/
├── commands/           # CLI command handlers
│   ├── auto.ts         # Automated workflow (v1.4.0)
│   ├── checks.ts       # CI check status
│   ├── feature.ts      # Branch creation
│   ├── init.ts         # Config initialization
│   ├── protect.ts      # Branch protection
│   ├── security.ts     # Security scanning
│   ├── ship.ts         # Manual workflow
│   └── status.ts       # Git status
├── services/           # Core business logic
│   ├── GitHubService.ts          # GitHub API (Octokit)
│   ├── GitService.ts             # Git operations (simple-git)
│   ├── ConfigService.ts          # Config management
│   ├── PRService.ts              # PR lifecycle
│   ├── PRTemplateService.ts      # Template discovery
│   ├── VerifyService.ts          # Pre-commit checks
│   ├── SecurityScanner.ts        # Security scanning
│   ├── BranchProtectionChecker.ts # Protection validation
│   ├── EnhancedCIPoller.ts       # CI polling
│   └── AutoFixService.ts         # Automated error fixing (v1.5.0)
├── scripts/            # Build scripts
│   └── postinstall.ts  # Post-install guidance (v1.4.0)
├── types/              # TypeScript definitions
│   └── index.ts        # All types and interfaces
├── utils/              # Utility functions
│   ├── cache.ts        # API response caching (v1.4.0)
│   ├── errors.ts       # Structured errors (v1.4.0)
│   ├── ErrorClassifier.ts # Error classification
│   ├── SuggestionEngine.ts # Fix suggestions
│   ├── OutputFormatter.ts # Console formatting
│   ├── logger.ts       # Logging utility (v1.4.0: JSON mode)
│   └── spinner.ts      # Progress indicators
└── index.ts            # CLI entry point
```

## 📊 Performance Metrics

| Metric | v1.3.0 | v1.4.0 | Improvement |
|--------|--------|--------|-------------|
| CI Wait Time (5 min checks) | 10 min | 6-7 min | **30-40% ↓** |
| PR Validation | 800ms | 380ms | **40-50% ↓** |
| Config Load (cached) | 5ms | 0.1ms | **98% ↓** |
| API Rate Limit Errors | 5-10/day | 0/day | **100% ↓** |
| API Calls per Ship | 25-30 | 10-15 | **40-60% ↓** |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint
```

**Test Coverage**:
- **593 tests** (565 unit + 28 integration) - ✅ All passing
- **89.67% coverage** (target: 80%) - ✅ Exceeded
- Core infrastructure: GitHubService (87%), GitService (100%), EnhancedCIPoller (93%)
- Auto-fix workflows with verification and rollback
- All command JSON outputs tested and validated
- Integration workflows validated
- Edge cases and error handling covered
- See [Test Documentation](docs/TESTS.md) for details

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and code of conduct.

```bash
# Development setup
git clone https://github.com/littlebearapps/git-pr-manager.git
cd git-pr-manager
npm install

# Build
npm run build

# Test
npm test

# Development mode
npm run dev -- auto
```

## 📚 Documentation

### Implementation History
- [Phase 1 - Core SDK Infrastructure](docs/implementation/PHASE-1-COMPLETE.md)
- [Phase 2 - PR Automation](docs/implementation/PHASE-2-COMPLETE.md)
- [Phase 3 - Security Integration](docs/implementation/PHASE-3-COMPLETE.md)
- [Phase 4 - Testing Infrastructure](docs/implementation/PHASE-4-COMPLETE.md)
- [Phase 5 - Performance & UX](docs/implementation/PHASE-5-PROGRESS.md)
- [Phase 6 - Automated Error Fixing](AUTO-FIX.md)

### Guides
- [Quick Reference](docs/guides/QUICK-REFERENCE.md)
- [Workflow Documentation](docs/guides/WORKFLOW-DOCUMENTATION.md)
- [Subagent Prompt](docs/guides/SUBAGENT_PROMPT.md)
- [Auto-Fix Feature Documentation](AUTO-FIX.md)
- [Test Documentation](docs/TESTS.md)
- [GitHub Actions Integration](docs/guides/GITHUB-ACTIONS-INTEGRATION.md) ⭐ NEW
- [AI Agent Integration](docs/guides/AI-AGENT-INTEGRATION.md) ⭐ NEW

### Architecture
- [Octokit SDK Integration](docs/architecture/OCTOKIT-SDK-INTEGRATION.md)
- [Full SDK Migration Plan](docs/architecture/OPTION-2-FULL-SDK-MIGRATION-PLAN.md)

### Planning
- [Comprehensive Enhancement Plan](docs/planning/COMPREHENSIVE-ENHANCEMENT-PLAN.md)
- [Enhancement Ideas](docs/planning/ENHANCEMENT-IDEAS.md)

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### v1.4.0 Highlights

**Phase 2: Git Hooks Integration**
- `gpm install-hooks` - Install non-blocking git hooks (pre-push, post-commit)
- `gpm uninstall-hooks` - Remove gpm git hooks
- CI-aware hooks (auto-skip in GitHub Actions)
- Config synchronization (.gpm.yml hooks section)

**Bug Fixes**:
- Fixed `gpm status --json` producing no output
- Enhanced GitHub token setup documentation

**Previous Features**:
- `gpm auto` - Automated workflow command
- Interactive mode for `gpm init`
- Machine-readable JSON output (`--json` flag)
- Verbosity levels (`--quiet`, `--silent`, `--verbose`)
- Structured error classes with suggestions
- API response caching (LRU + ETag)
- Exponential backoff CI polling
- Request batching & parallelization
- Config file caching
- Rate limit handling with retry
- Post-install guidance script
- Cross-platform GitHub Actions testing

**Performance**:
- 30-40% reduction in CI wait time
- 40-50% faster PR validation
- 98% reduction in cached config loads
- 40-60% fewer API calls
- Zero rate limit errors

**Changed**:
- Package name: `@littlebearapps/git-pr-manager`
- Enhanced error messages with actionable suggestions

## 📄 License

MIT License - Copyright (c) 2025 Nathan Schram / Little Bear Apps

See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [simple-git](https://github.com/steveukx/git-js) - Git operations
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Ora](https://github.com/sindresorhus/ora) - Progress indicators
- [prompts](https://github.com/terkelg/prompts) - Interactive prompts

---

**Made with ❤️ by [Little Bear Apps](https://littlebearapps.com)**

For support, please [open an issue](https://github.com/littlebearapps/git-pr-manager/issues) or contact nathan@littlebearapps.com.
