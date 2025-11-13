# Git Workflow Manager v1.4.0-beta.1

Production-ready git workflow automation for GitHub with Claude Code integration. Streamlines feature development with intelligent CI polling, comprehensive error reporting, and automated PR workflows.

[![npm version](https://badge.fury.io/js/%40littlebearapps%2Fgit-workflow-manager.svg)](https://www.npmjs.com/package/@littlebearapps/git-workflow-manager)
[![Node.js CI](https://github.com/littlebearapps/git-workflow-manager/workflows/Test/badge.svg)](https://github.com/littlebearapps/git-workflow-manager/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ What's New in v1.4.0

### Performance & Efficiency
- **40-60% reduction in API calls** through intelligent LRU caching with ETag support
- **30-40% faster CI wait times** with exponential backoff polling (5s → 30s adaptive intervals)
- **40-50% faster PR validation** through parallel API request batching
- **98% reduction in config load time** with TTL-based file caching

### Enhanced UX
- **`gwm auto`** - One-command automated workflow (detect → verify → security → PR → CI → merge)
- **Interactive mode** - `gwm init --interactive` with preset selection and preview
- **Machine-readable output** - `--json` flag for all commands (CI/automation-friendly)
- **Verbosity control** - `--quiet`, `--silent`, `--verbose` flags with auto-detection for CI environments
- **Structured errors** - Error codes, details, and actionable suggestions for every failure

### Developer Experience
- **Zero configuration for 80% of use cases** - Smart defaults from `.gwm.yml`
- **Post-install guidance** - Automatic setup help and quick start guide
- **Cross-platform tested** - macOS, Linux, Windows × Node.js 18, 20, 22
- **Production-ready** - npm package, MIT license, comprehensive documentation

## 🚀 Quick Start

### Installation

```bash
npm install -g @littlebearapps/git-workflow-manager
```

### Setup

```bash
# Set GitHub token
export GITHUB_TOKEN="ghp_your_token_here"

# Initialize configuration (interactive mode)
gwm init --interactive

# Or use a preset
gwm init --template standard
```

### Basic Usage

```bash
# Start a new feature
gwm feature add-login-form

# ... make your changes ...

# Ship it! (automated workflow)
gwm auto
```

That's it! `gwm auto` will:
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
gwm auto                        # Full automation
gwm auto --draft                # Create draft PR
gwm auto --no-merge             # Stop after CI passes
gwm auto --skip-security        # Skip security scan
gwm auto --skip-verify          # Skip verification

# Manual workflow control
gwm feature <name>              # Start new feature branch
gwm ship                        # Ship feature with full control
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
gwm checks <pr-number>          # Show check status
gwm checks <pr-number> --details # Full error details
gwm checks <pr-number> --files   # Affected files only

# Show current git and workflow status
gwm status
```

### Configuration & Security

```bash
# Initialize configuration
gwm init                        # Basic template
gwm init --interactive          # Interactive wizard
gwm init --template standard    # Standard preset
gwm init --template strict      # Strict preset

# Branch protection
gwm protect --show              # View current settings
gwm protect --preset standard   # Configure protection
gwm protect --branch main --preset strict

# Security scanning
gwm security                    # Run security scan
```

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

Use `gwm` in your GitHub Actions workflows for automated PR validation and CI orchestration:

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

      - name: Install gwm
        run: npm install -g @littlebearapps/git-workflow-manager

      - name: Run security scan
        run: gwm security --json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Wait for CI checks
        run: gwm checks ${{ github.event.pull_request.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**See**: [GitHub Actions Integration Guide](docs/guides/GITHUB-ACTIONS-INTEGRATION.md) for complete workflows and examples.

### AI Agent Integration

`gwm` is designed for CLI AI agents (Claude Code, Aider, Cursor, etc.) with machine-readable JSON output:

```bash
# AI agents can execute gwm commands
gwm checks 123 --json    # Get structured CI status
gwm security --json      # Security scan results
gwm auto --json          # Full PR workflow
```

**Example AI Agent Workflow**:
```
User: "Create a PR for this feature"
AI Agent: [Executes] gwm auto --json
AI Agent: [Parses] {"prNumber": 47, "url": "...", "ciStatus": "pending"}
AI Agent: [Reports] "✅ PR #47 created. CI checks pending."
```

**See**: [AI Agent Integration Guide](docs/guides/AI-AGENT-INTEGRATION.md) for implementation examples in Python, JavaScript, and Go.

## 🎯 Key Features

### Complete Workflow Automation
- Feature branch creation → PR → CI → Merge in one command
- Smart defaults from `.gwm.yml` configuration
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

### `.gwm.yml` Example

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

### Environment Variables

```bash
# GitHub authentication (required)
export GITHUB_TOKEN="ghp_your_token_here"
# or
export GH_TOKEN="ghp_your_token_here"

# Enable debug mode (optional)
export DEBUG=1
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
- **212 tests** (184 unit + 28 integration) - ✅ All passing
- **84.78% coverage** (target: 80%) - ✅ Exceeded
- Core infrastructure: GitHubService (87%), GitService (100%), EnhancedCIPoller (93%)
- Auto-fix workflows with verification and rollback
- Integration workflows validated
- Edge cases and error handling covered
- See [Test Documentation](docs/TESTS.md) for details

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and code of conduct.

```bash
# Development setup
git clone https://github.com/littlebearapps/git-workflow-manager.git
cd git-workflow-manager
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

### v1.4.0-beta.1 Highlights

**Added**:
- `gwm auto` - Automated workflow command
- Interactive mode for `gwm init`
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
- Package name: `@littlebearapps/git-workflow-manager`
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

For support, please [open an issue](https://github.com/littlebearapps/git-workflow-manager/issues) or contact nathan@littlebearapps.com.
