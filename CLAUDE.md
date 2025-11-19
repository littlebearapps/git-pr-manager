# Git PR Manager - Claude Code Context

**Last Updated**: 2025-11-19 (Alternative D)
**Version**: Managed by semantic-release (see Alternative D below)
**Status**: Production - Release Validation Strategy Complete ✅
**Current Focus**: Alternative D – Release Validation & Pre-Release Checks ✅

---

## Project Overview

Production-ready git workflow automation for GitHub with Claude Code integration. Streamlines feature development with intelligent CI polling, comprehensive error reporting, automated PR workflows, git hooks integration, git worktree management, and **multi-language support for Python, Node.js, Go, and Rust**.

**Optional Security Enhancements**
- `detect-secrets` secret scanning is optional—install with `pip install detect-secrets` for regex-based leak detection plus `.secrets.baseline` workflows.
- When it is not installed, `gpm security` still performs `npm audit` so dependency scanning continues without errors.

**Repository**: https://github.com/littlebearapps/git-pr-manager
**npm Package**: @littlebearapps/git-pr-manager
**License**: MIT
**Status**: Production - Multi-Language Support + Release Validation Strategy 🎉

### Release 1.7.0 - Phase 1a-1c: Multi-Language Support ✅ (2025-11-17 to 2025-11-18)

**Phase 1a: Foundation** ✅
- ✅ Automatic language detection (Python, Node.js, Go, Rust)
- ✅ Package manager detection (poetry/pipenv/uv/pip, npm/yarn/pnpm/bun, go-mod, cargo)
- ✅ Intelligent command resolution with fallback chains
- ✅ Makefile integration (prefers Makefile targets when available)
- ✅ Graceful degradation (skips unavailable tools)
- ✅ Backward compatible (existing Node.js projects work without changes)

**Phase 1b: Install Step & Makefile Aliases** ✅
- ✅ Install command support with user prompts (poetry install, npm ci, etc.)
- ✅ `allowInstall` config flag (default: false for safety)
- ✅ `--skip-install` CLI flag to skip installation
- ✅ Makefile alias support (map actual target names to tasks)
- ✅ Example: `{check: 'test', verify: 'lint'}` maps Makefile targets

**Phase 1c: Format & Build Steps + Task Ordering** ✅
- ✅ Format verification (non-destructive: --check, --diff, -l flags)
- ✅ Build command support (marked as optional when not found)
- ✅ Custom task ordering via `tasks` config array
- ✅ `skipTasks` config to permanently skip tasks
- ✅ `stopOnFirstFailure` config for fail-fast control
- ✅ CLI flags: --skip-format, --skip-build, --no-stop-on-first-failure
- ✅ Default order: format → lint → typecheck → test → build (5 tasks)

**📦 Package Manager Support**
- Python: poetry, pipenv, uv, pip (auto-detected from lock files)
- Node.js: pnpm, yarn, bun, npm (auto-detected from lock files)
- Go: go modules (auto-detected from go.mod)
- Rust: cargo (auto-detected from Cargo.toml)

**🔧 Configuration**
- New `verification` section in `.gpm.yml`
- `detectionEnabled`: Enable/disable auto-detection (default: true)
- `preferMakefile`: Prefer Makefile targets over package manager (default: true)
- `commands`: Override specific commands (format, lint, test, typecheck, build, install)
- `tasks`: Custom task execution order (Phase 1c)
- `skipTasks`: Permanently skip tasks (Phase 1c)
- `stopOnFirstFailure`: Fail-fast control (Phase 1c)
- `allowInstall`: Allow dependency installation prompts (Phase 1b)
- `makefileAliases`: Map Makefile target names to tasks (Phase 1b)

**🧪 Testing**
- 807 tests passing (+56 new tests for Phase 1a-1c)
- Phase 1a: 17 integration tests
- Phase 1b: 22 integration tests
- Phase 1c: 17 integration tests
- All tests passing, 89.67% coverage

**See**:
- docs/PHASE-1A-COMPLETION-SUMMARY.md
- docs/PHASE-1B-COMPLETION-SUMMARY.md
- docs/PHASE-1C-COMPLETION-SUMMARY.md

### Alternative D: Release Validation Strategy - ✅ Phase 1 & 2 COMPLETE (2025-11-19)

**Single Source of Truth Architecture**
- ✅ package.json version: `0.0.0-development` (placeholder)
- ✅ npm registry as sole version authority
- ✅ Smart CLI version detection via git tags
- ✅ semantic-release without @semantic-release/git plugin

**Phase 1: Core Implementation** ✅
- ✅ Remove @semantic-release/git plugin from .releaserc.json
- ✅ Set package.json version to 0.0.0-development
- ✅ Update getVersion() to check git tags first
- ✅ Pre-release validation checks (7 checks)
- ✅ Post-publish version verification

**Phase 2: Pre-Release Validation** ✅
- ✅ `gpm doctor --pre-release` command with 7 automated checks:
  - Workflow files exist (ci.yml, publish.yml)
  - Badge URLs match actual workflows
  - package.json version is placeholder (warning)
  - @semantic-release/git plugin NOT present (warning)
  - Working directory clean
  - On main branch
  - All CI checks passed (warning if gh CLI unavailable)
- ✅ Integrated into publish workflow (.github/workflows/publish.yml)
- ✅ 21 comprehensive tests (845 total tests passing)

**Benefits**
- Zero version drift (npm is single source of truth)
- Prevents .secrets.baseline timestamp-only changes
- Automated pre-release validation catches issues before publish
- Simpler workflow (no git commits during release)

**See**: docs/RELEASE-VALIDATION-STRATEGY.md

### Release 1.5.0 - ✅ COMPLETE (2025-11-17)

**E409 Packument Error Handling**
- ✅ Implemented retry mechanism for npm publish E409 conflicts
- ✅ Based on CKEditor/mcp-delegator solution
- ✅ Verifies package publication even when semantic-release reports errors
- ✅ Polls npm registry for up to 60 seconds to confirm package exists
- ✅ Handles known npm registry race condition during publishing
- ✅ See: https://github.com/ckeditor/ckeditor5/issues/16625

**Automated Publishing Infrastructure** (from v1.4.3)
- ✅ semantic-release integration for automated version management
- ✅ OIDC (OpenID Connect) authentication with npm (tokenless publishing)
- ✅ Provenance attestations for enhanced package security
- ✅ Repository made public to support provenance
- ✅ Automated changelog generation from conventional commits
- ✅ GitHub releases created automatically on push to main
- ✅ No manual npm tokens or version bumping required

**Publishing Workflow**
- Push conventional commit (feat:, fix:, docs:, refactor:, perf:) to main
- semantic-release analyzes commits and determines version bump
- If npm publish fails with E409, retry script verifies package exists
- Package published to npm with cryptographic attestations
- GitHub release created with auto-generated changelog
- All automated via GitHub Actions with OIDC

### Release 1.4.0-1.4.2 - ✅ COMPLETE (2025-11-15)

**Phase 2: Git Hooks Integration**
- ✅ Non-blocking reminder hooks (pre-push, post-commit)
- ✅ CI-aware (auto-skip in GitHub Actions, etc.)
- ✅ Config synchronization (.gpm.yml hooks section)
- ✅ Safe install/uninstall with signature detection
- ✅ Full documentation and AI agent integration
- ✅ Rollout testing complete

**Phase 3: Git Worktree Management**
- ✅ `gpmworktree list` command with JSON support
- ✅ `gpmworktree prune` command with dry-run support
- ✅ Comprehensive production testing in bare repo environment
- ✅ 15 new tests, all 678 tests passing
- ✅ Full documentation and examples

**Bug Fixes**
- ✅ Status command JSON output (was producing no output)
- ✅ GitService.pruneWorktrees() stderr capture (git outputs to stderr, not stdout)
- ✅ All 678 tests passing
- ✅ GitHub token setup documentation enhanced

**Documentation Updates**
- ✅ Comprehensive rollout findings
- ✅ Setup guides for new users
- ✅ Enhanced GitHub token configuration
- ✅ Hooks management reference
- ✅ Git worktree management guide and examples
- ✅ JSON output schemas for worktree commands

### Known Issues

#### ℹ️ Enhancement Opportunities
- Add `--force` flag to `gpminit` for intentional config overwrites
- Improve GitHub token error messages with setup guidance

#### 💡 Future Ideas
- **GitHub Audit Tool** - Comprehensive repository health check (see @docs/ideas/GITHUB-AUDIT-TOOL.md)
  - Security posture assessment (branch protection, secret scanning, vulnerabilities)
  - CI/CD workflow analysis (test coverage, security scans, best practices)
  - Code quality tooling detection (linting, formatting across languages)
  - Actionable recommendations with priority scoring
  - Status: Planning phase, 28-38 hour estimate for full implementation

---

## Quick Reference Imports

@quickrefs/commands.md - Common bash commands and scripts
@quickrefs/architecture.md - Code structure and patterns
@quickrefs/testing.md - Testing guidelines and coverage

---

## 🚨 CRITICAL: Release & Publishing Rules

### User Approval Required
**NEVER perform these actions without explicit user approval**:
1. ❌ Merge a PR to main branch
2. ❌ Trigger npm package publication
3. ❌ Create or modify GitHub releases
4. ❌ Delete or modify git tags
5. ❌ Update README.md content (except version numbers/dates - see below)

### 🚫 MANDATORY: Using gpm ship Command

**CRITICAL RULE**: When using `gpm ship`, **ALWAYS use `--draft` flag**

```bash
# ✅ CORRECT - Creates draft PR for user review
npm run dev -- ship --draft
gpm ship --draft

# ❌ FORBIDDEN - Auto-merges without approval
npm run dev -- ship
gpm ship
```

**Why `--draft` is mandatory**:
- Draft PRs **cannot** be auto-merged (GitHub API restriction)
- Forces manual review before merge
- Prevents accidental npm package publication
- User retains full control over merge timing

**Exception**: Only use `gpm ship` without `--draft` if user explicitly says:
- "merge this PR now"
- "ship this to production"
- "publish this to npm"
- Or similar explicit merge approval

**Before ANY merge to main**:
1. ✅ Ask user: "Ready to merge PR #X to main? This will trigger npm publish."
2. ✅ Wait for explicit "yes" / "merge it" / "ship it" response
3. ✅ Only then run `gpm ship` without `--draft` flag

### Automated Publishing Workflow
**Process**: Merging to main → GitHub Actions → semantic-release → npm publish
- semantic-release automatically determines version from commit messages
- Publishing happens automatically on push to main (conventional commits only)
- **Always ask user before merging PR that will trigger publish**

### Version Management Requirements
**Before merging any PR to main, ensure ALL files are updated**:

#### Files with Version Numbers (update all):
1. **package.json** - `version` field (line 3)
2. **CLAUDE.md** - Top metadata (lines 3-5, 16) + release section header
3. **README.md** - "What's New" section (update version, date, features)
4. **docs/TESTS.md** - "Last Updated", "Current Coverage" header

#### README.md Update Policy:
- ✅ **Auto-update allowed**: Version numbers, dates in "What's New" section
- ❌ **User approval required**: New features, descriptions, examples, documentation
- **Rationale**: README.md is public-facing (GitHub + npm) - content changes need review

### Pre-Merge Checklist
Before requesting approval to merge PR:
```bash
✅ All tests passing (npm test)
✅ Build successful (npm run build)
✅ Coverage maintained (npm run test:coverage)
✅ Version updated in: package.json, CLAUDE.md, README.md, docs/TESTS.md
✅ README.md "What's New" section updated with version/date/features
✅ Conventional commit messages for semantic-release
✅ Documentation reflects new features/changes
```

### NPM Publishing (Automated via semantic-release)
**Trigger**: Push to main with conventional commit (feat:, fix:, docs:, etc.)
- **feat:** → minor version bump (1.5.0 → 1.6.0)
- **fix:** → patch version bump (1.5.0 → 1.5.1)
- **BREAKING CHANGE:** → major version bump (1.5.0 → 2.0.0)
- **docs:, refactor:, perf:** → patch version bump (configured in .releaserc.json)

**Workflow**: `.github/workflows/publish.yml`
- Runs tests, builds package, publishes to npm with OIDC
- Includes E409 error handling (retry verification)
- Creates GitHub release with auto-generated changelog
- Publishes with provenance attestations (Sigstore)

**Verification**:
```bash
npm view @littlebearapps/git-pr-manager version  # Check published version
gh release view v1.5.0                           # View GitHub release
```

---

## Core Commands

### Development
```bash
npm install           # Install dependencies
npm run build         # Build TypeScript → dist/
npm run dev           # Run CLI in dev mode
npm test              # Run all tests (512 tests)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report (target: 80%, current: 89.67%)
npm run lint          # ESLint check
npm run clean         # Remove dist/
```

### Testing Specific Components
```bash
npm test -- tests/services/GitHubService.test.ts     # Test GitHub service
npm test -- tests/utils/update-check.test.ts         # Test update checker
npm test -- tests/commands/                          # Test all commands
```

### Local CLI Testing
```bash
npm run dev -- feature my-feature    # Test feature command
npm run dev -- ship --draft          # Test ship command (ALWAYS use --draft!)
npm run dev -- auto --json           # Test auto workflow with JSON
npm run dev -- check-update          # Test update checker
npm run dev -- install-hooks         # Test hooks installation
npm run dev -- install-hooks --post-commit  # Test both hooks
npm run dev -- uninstall-hooks       # Test hooks removal
```

---

## Code Style

### TypeScript Standards
- **ES Modules**: Use `import/export` (not `require()`)
- **Types**: Explicit types for all function parameters and returns
- **Async/Await**: Prefer over `.then()/.catch()` chains
- **Error Handling**: Use try/catch with descriptive error messages
- **Naming**: camelCase for variables/functions, PascalCase for classes/types

### Testing Standards
- **Coverage**: Maintain >80% for all metrics (statements, branches, functions, lines)
- **Structure**: Describe blocks for grouping, clear test names
- **Mocking**: Use `jest.mock()` for external dependencies
- **Assertions**: Prefer `expect().toBe()` over loose equality

### File Organization
```
src/
├── commands/        # CLI commands (feature, ship, auto, etc.)
├── services/        # Core services (GitHub, Git, CI)
├── utils/           # Utilities (logger, cache, config, update-check)
└── types/           # TypeScript type definitions

tests/
├── commands/        # Command tests
├── services/        # Service tests
└── utils/           # Utility tests
```

---

## Development Workflow

### Making Changes
1. **Create feature branch**: `git checkout -b feature/my-feature`
2. **Make changes**: Edit TypeScript files in `src/`
3. **Build**: `npm run build` (ensure TypeScript compiles)
4. **Test**: `npm test` (ensure all 512+ tests pass)
5. **Lint**: `npm run lint` (fix any ESLint issues)
6. **Coverage**: `npm run test:coverage` (maintain >80%)

### Before Committing
- ✅ Build succeeds (`npm run build`)
- ✅ All tests pass (`npm test`)
- ✅ No lint errors (`npm run lint`)
- ✅ Coverage maintained (`npm run test:coverage`)
- ✅ Types are explicit (no `any` without justification)

### Commit Standards
- Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
- Include Co-Authored-By for AI assistance
- Reference issue numbers where applicable

---

## Key Architectural Patterns

### Service Layer
- **GitHubService**: Octokit wrapper with caching, rate limiting
- **GitService**: simple-git wrapper for local operations
- **CIService**: CI check polling with exponential backoff

### Caching Strategy
- **LRU Cache**: In-memory cache with TTL (10 items, configurable TTL)
- **ETag Support**: HTTP caching for GitHub API calls
- **File Cache**: Config files cached with TTL (98% reduction in load time)
- **Disk Cache**: Update checks (7-day TTL in TMPDIR)

### Error Handling
- **Structured Errors**: ErrorCode enum with actionable suggestions
- **Exit Codes**: 0 (success), 1 (general), 2 (validation), 3 (auth), 4 (rate limit)
- **JSON Mode**: Machine-readable errors for CI/AI agents

---

## Testing Guidelines

**See**: @docs/TESTS.md for comprehensive test documentation

### Quick Test Facts
- **Total**: 535 tests (512 unit + 23 update-check)
- **Coverage**: 89.67% statements, 82.82% branches, 95.11% functions
- **Target**: 80% (all metrics) - ✅ EXCEEDED
- **Status**: All passing

### Test Structure
```typescript
describe('ServiceName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const mock = jest.fn().mockResolvedValue(data);

      // Act
      const result = await service.method();

      // Assert
      expect(result).toBe(expected);
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });
});
```

---

## Common Patterns

### Adding a New Command
1. Create `src/commands/my-command.ts`
2. Export async function with options interface
3. Register in `src/index.ts` with commander
4. Create `tests/commands/my-command.test.ts`
5. Update README.md with command documentation

### Adding a New Service
1. Create `src/services/MyService.ts` class
2. Add constructor with dependency injection
3. Implement methods with proper error handling
4. Create `tests/services/MyService.test.ts`
5. Mock external dependencies (Octokit, simple-git, etc.)

### Working with GitHub API
```typescript
// Always use GitHubService wrapper
const github = new GitHubService(token, owner, repo);

// Service handles rate limiting, caching, errors
const pr = await github.createPullRequest({
  title: 'My PR',
  head: 'feature/branch',
  base: 'main'
});
```

---

## Known Behaviors

### Update Checking (Phase 7)
- **Fire-and-forget**: Doesn't block CLI startup (<10ms impact)
- **Smart caching**: 7-day TTL, dual-cache (memory + disk)
- **Auto-suppression**: CI environments, JSON mode, non-TTY
- **Exit codes**: 0 (no update), 1 (update available), 2 (error)

### CI Polling
- **Exponential backoff**: 5s → 30s adaptive intervals
- **Timeout**: 30 minutes default (configurable)
- **Retry logic**: Handles transient failures
- **Early termination**: Stops on critical failures (unless --no-fail-fast)

### Machine-Readable Output
- **JSON Mode**: `--json` flag on all commands
- **Structured**: Consistent schema across commands
- **CI Detection**: Auto-enables in GitHub Actions
- **AI Agents**: Designed for programmatic consumption

---

## Architectural Principles

### Design Philosophy
**gpmis designed for local developer workflows, not CI orchestration**

**✅ Use gpm for**:
- Local PR automation (`gpmship`, `gpmauto`)
- Security validation in CI (`gpmsecurity`)
- Developer status checking
- Structured JSON output for scripts

**❌ Don't use gpm for**:
- Orchestrating GitHub Actions workflows
- Creating workflows to monitor other workflows
- Replacing GitHub's built-in PR status checks
- Meta-monitoring (workflows checking workflows)

**Key principle**: Let GitHub Actions handle workflow execution. Use gpm to **enhance developer workflows** and **add validation**, not to orchestrate CI.

**See**: @docs/guides/GITHUB-ACTIONS-INTEGRATION.md - "Anti-Patterns & Best Practices" section for detailed examples.

---

## Environment Variables

### Required
- `GITHUB_TOKEN` or `GH_TOKEN`: GitHub personal access token

### Optional
- `CI`: Auto-detected, enables CI-specific behavior
- `NO_UPDATE_NOTIFIER`: Suppress update checks (set to `1`)
- `DEBUG`: Enable verbose debug output

---

## NPM Publishing

### Version Bump
```bash
# Prerelease (beta)
npm version prerelease --preid=beta

# Release
npm version patch|minor|major
```

### Publish Flow
1. Update version in package.json
2. Build and test: `npm run build && npm test`
3. Create git tag: `git tag v1.4.0-beta.1`
4. Push: `git push && git push --tags`
5. Create GitHub release (triggers publish workflow)

**OR** manual publish:
```bash
npm publish --tag next    # Prerelease
npm publish --tag latest  # Stable
```

---

<!-- ⚠️ DO NOT DELETE: CloakPipe Telemetry Section - Critical for npm/Homebrew releases -->

## CloakPipe Telemetry (Internal)

**What**: Private error logging for Nathan-only development debugging
**Status**: ✅ Production (v1.4.1) - Automatically excluded from all public releases

### Configuration
- **Product Name**: `gitprmanager` (normalized for CloakPipe)
- **Worker URL**: `https://cloakpipe-worker-prod.littlebearapps.workers.dev`
- **HMAC Key**: `CLOAKPIPE_HMAC_KEY` environment variable (stored in keychain)
- **Activation**: Username detection (`os.userInfo().username === 'nathanschram'`)
- **Location**: `./telemetry/` directory (git cloned on Nathan's machine only)

### Testing Verified
- ✅ End-to-end test successful ([Issue #11](https://github.com/littlebearapps/git-pr-manager/issues/11))
- ✅ Error capture and GitHub issue creation working
- ✅ HMAC authentication validated
- ✅ PII sanitization confirmed

### Release Process (npm/Homebrew)

**✅ No Action Required** - Automatic exclusion via:
1. `.gitignore` excludes `telemetry/` directory
2. `.npmignore` excludes `telemetry/` and `.gitmodules`
3. Package verification: `npm pack --dry-run 2>&1 | grep telemetry` (no output = excluded)

### Implementation Pattern
```typescript
// src/index.ts - Username detection with graceful degradation (lines 29-48)
if (username === 'nathanschram') {
  const { initTelemetry, captureBreadcrumb, captureError } =
    await import('../telemetry/src/telemetry.js');
  telemetry = {
    init: () => initTelemetry('gitprmanager', pkg.version),
    breadcrumb: captureBreadcrumb,
    error: captureError
  };
  telemetry.init();
}
```

**See**: @quickrefs/architecture.md - "CloakPipe Telemetry Pattern" for complete details

---

## Troubleshooting

### Build Fails
- Check TypeScript errors: `npx tsc --noEmit`
- Clean and rebuild: `npm run clean && npm run build`

### Tests Fail
- Run specific test: `npm test -- path/to/test.ts`
- Check coverage: `npm run test:coverage`
- Clear Jest cache: `npx jest --clearCache`

### Update Check Issues
- Clear cache: `gpmcheck-update --clear-cache`
- Check npm registry: `npm view @littlebearapps/git-pr-manager`
- Verify connectivity: `curl https://registry.npmjs.org/@littlebearapps/git-pr-manager`

---

## Resources

- **Main README**: `README.md` - User-facing documentation
- **Test Docs**: `docs/TESTS.md` - Comprehensive test documentation
- **Implementation Plans**: `docs/planning/` - Phase plans with GPT-5 validation
- **Integration Guides**: `docs/guides/` - GitHub Actions, AI agents
- **Architecture Docs**: `docs/architecture/` - Design decisions, migration plans

---

## IMPORTANT Notes

- **ALWAYS run tests before committing** - We maintain >80% coverage
- **ALWAYS build successfully** - TypeScript must compile without errors
- **Use explicit types** - No `any` without justification comments
- **Mock external dependencies** - Tests should not hit real GitHub API
- **Update TESTS.md** - When adding test coverage for new features
- **Respect exit codes** - 0=success, 1=general, 2=validation, 3=auth, 4=rate-limit
- **JSON mode compatibility** - All commands must support `--json` output
