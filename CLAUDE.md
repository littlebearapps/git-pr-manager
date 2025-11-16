# Git PR Manager - Claude Code Context

**Last Updated**: 2025-11-16
**Version**: 1.4.0
**Status**: Production-ready npm package (ready for publishing)

---

## Project Overview

Production-ready git workflow automation for GitHub with Claude Code integration. Streamlines feature development with intelligent CI polling, comprehensive error reporting, automated PR workflows, git hooks integration, and git worktree management.

**Repository**: https://github.com/littlebearapps/git-pr-manager
**npm Package**: @littlebearapps/git-pr-manager (⚠️ Not yet published to npm)
**License**: MIT
**Status**: v1.4.0 - Release Ready 🎉

### Release 1.4.0 - ✅ COMPLETE (2025-11-15)

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

#### 🔴 Critical
- **Package Not Published**: Cannot `npm install -g` yet (using `npm link` for development)
  - **Action**: Publish to npm registry when ready
  - **Status**: v1.4.0 release finalized, awaiting publish decision

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

## CloakPipe Telemetry (Internal)

### Overview

**CloakPipe** is an internal error logging system integrated into gpm for development debugging purposes. It is **private**, **opt-in**, and **automatically excluded** from all public releases.

### How It Works

**For Nathan (Developer)**:
- Enabled automatically via username detection (`os.userInfo().username === 'nathanschram'`)
- Loads from git submodule at `./telemetry/` (not in published package)
- Captures error breadcrumbs and uncaught exceptions
- Sends to private CloakPipe server for debugging

**For External Users**:
- Completely invisible and non-functional
- Gracefully degrades (no errors, no impact)
- Zero performance overhead
- Zero privacy concerns

### Architecture

```typescript
// src/index.ts (lines 28-48)
let telemetry: any = null;
(async () => {
  try {
    const os = await import('os');
    const username = os.userInfo().username;

    if (username === 'nathanschram') {
      // Only loads for Nathan - external users never reach here
      const { initTelemetry, captureBreadcrumb, captureError } =
        await import('../telemetry/src/telemetry.js');

      telemetry = {
        init: () => initTelemetry('git-pr-manager', pkg.version),
        breadcrumb: captureBreadcrumb,
        error: captureError
      };
      telemetry.init();
    }
  } catch {
    // Telemetry not available - gracefully degrade
  }
})();
```

### Defense-in-Depth Security

**Multiple Exclusion Layers**:
1. **Git submodule**: `./telemetry/` directory (private repository)
2. **`.gitignore`**: Prevents accidental commits
3. **`.npmignore`**: Excludes from npm package
4. **`.gitmodules`**: Excluded from npm package
5. **`package.json` files field**: Not in distribution list

**Verification**:
```bash
# Verify telemetry is excluded
npm pack --dry-run 2>&1 | grep telemetry
# Expected: No output (excluded)
```

### Release Checklist (npm/Homebrew)

**✅ No Action Required** - Telemetry automatically excluded!

The following happens automatically during `npm publish`:
1. Git submodule (`./telemetry/`) is excluded via `.npmignore`
2. `.gitmodules` file is excluded via `.npmignore`
3. Package contains 0 telemetry files
4. External users install clean package with no telemetry code

**Manual Verification** (optional):
```bash
# Before publishing
npm pack
tar -tzf littlebearapps-git-pr-manager-*.tgz | grep telemetry
# Expected: No output

# Check package size
ls -lh littlebearapps-git-pr-manager-*.tgz
# Expected: ~325 KB (telemetry would add ~50 KB if included)
```

### Postinstall Behavior

**For Nathan**:
```bash
npm install
# Output:
# 🔧 Setting up internal telemetry...
# (npm install runs in ./telemetry/)
# ✅ Internal telemetry ready
```

**For External Users**:
```bash
npm install
# Output:
# ✨ git-pr-manager installed!
# ✅ GitHub token detected (or setup instructions)
# 📖 Quick Start: ...
# (No telemetry messages - gracefully skipped)
```

### Developer Notes

**When modifying telemetry**:
- Telemetry code is in `./telemetry/` (git submodule - separate repo)
- Always test both scenarios: Nathan-user and external-user
- Ensure graceful degradation (no errors if telemetry unavailable)
- Use optional chaining: `telemetry?.method()` (never `telemetry.method()`)

**When releasing**:
- No special steps needed - automatic exclusion
- Verify with `npm pack --dry-run` if concerned
- External users will never see telemetry code or behavior

### Privacy & Security

**Guarantees**:
- ✅ Only activates for Nathan (username detection)
- ✅ Never included in published packages
- ✅ Never collects user data from external installations
- ✅ Source code not visible to external users
- ✅ Zero impact on external user experience

**What's Captured** (Nathan only):
- Error messages and stack traces (for debugging)
- Command execution breadcrumbs (for workflow analysis)
- Git-pr-manager version and OS info (for compatibility)
- **Not captured**: GitHub tokens, repository data, user code

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
