# Git Workflow Manager v1.4.3

Production-ready git workflow automation for GitHub with Claude Code integration. Streamlines feature development with intelligent CI polling, comprehensive error reporting, and automated PR workflows.

[![npm version](https://badge.fury.io/js/%40littlebearapps%2Fgit-pr-manager.svg)](https://www.npmjs.com/package/@littlebearapps/git-pr-manager)
[![Node.js CI](https://github.com/littlebearapps/git-pr-manager/workflows/Test/badge.svg)](https://github.com/littlebearapps/git-pr-manager/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ What's New in v1.4.3

### Security Enhancement
- **npm Trusted Publishers with OIDC** - Migrated from token-based authentication to OpenID Connect for secure, token-less publishing from GitHub Actions
  - Zero credential management - no NPM_TOKEN secret needed
  - Short-lived tokens auto-generated per workflow run
  - Cryptographic provenance attestation for published packages
  - See `docs/NPM-TRUSTED-PUBLISHER-SETUP.md` for complete setup guide

### Previous Release (v1.4.0-1.4.2)

### Performance & Efficiency
- **40-60% reduction in API calls** through intelligent LRU caching with ETag support
- **30-40% faster CI wait times** with exponential backoff polling (5s → 30s adaptive intervals)
- **40-50% faster PR validation** through parallel API request batching
- **98% reduction in config load time** with TTL-based file caching

### Enhanced UX
- **Auto-update notifications** - Automatic update checks with smart suppression (CI-aware, 7-day cache)
- **`gpm auto`** - One-command automated workflow (detect → verify → security → PR → CI → merge)
- **Interactive mode** - `gpm init --interactive` with preset selection and preview
- **Machine-readable output** - `--json` flag for all commands (CI/automation-friendly)
- **Verbosity control** - `--quiet`, `--silent`, `--verbose` flags with auto-detection for CI environments
- **Structured errors** - Error codes, details, and actionable suggestions for every failure

### Developer Experience
- **Zero configuration for 80% of use cases** - Smart defaults from `.gpm.yml`
- **Post-install guidance** - Automatic setup help and quick start guide
- **Cross-platform tested** - macOS, Linux, Windows × Node.js 18, 20, 22
- **Production-ready** - npm package, MIT license, comprehensive documentation

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

# Pre-commit verification
gpm verify                      # Run all checks (lint, typecheck, test, build)
gpm verify --skip-lint          # Skip ESLint
gpm verify --skip-typecheck     # Skip TypeScript type check
gpm verify --skip-test          # Skip tests
gpm verify --skip-build         # Skip build

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
