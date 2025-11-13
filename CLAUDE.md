# Git Workflow Manager - Claude Code Context

**Last Updated**: 2025-11-13
**Version**: 1.4.0-beta.1
**Status**: Production-ready npm package

---

## Project Overview

Production-ready git workflow automation for GitHub with Claude Code integration. Streamlines feature development with intelligent CI polling, comprehensive error reporting, and automated PR workflows.

**Repository**: https://github.com/littlebearapps/git-workflow-manager
**npm Package**: @littlebearapps/git-workflow-manager
**License**: MIT

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
**gwm is designed for local developer workflows, not CI orchestration**

**✅ Use gwm for**:
- Local PR automation (`gwm ship`, `gwm auto`)
- Security validation in CI (`gwm security`)
- Developer status checking
- Structured JSON output for scripts

**❌ Don't use gwm for**:
- Orchestrating GitHub Actions workflows
- Creating workflows to monitor other workflows
- Replacing GitHub's built-in PR status checks
- Meta-monitoring (workflows checking workflows)

**Key principle**: Let GitHub Actions handle workflow execution. Use gwm to **enhance developer workflows** and **add validation**, not to orchestrate CI.

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

## Troubleshooting

### Build Fails
- Check TypeScript errors: `npx tsc --noEmit`
- Clean and rebuild: `npm run clean && npm run build`

### Tests Fail
- Run specific test: `npm test -- path/to/test.ts`
- Check coverage: `npm run test:coverage`
- Clear Jest cache: `npx jest --clearCache`

### Update Check Issues
- Clear cache: `gwm check-update --clear-cache`
- Check npm registry: `npm view @littlebearapps/git-workflow-manager`
- Verify connectivity: `curl https://registry.npmjs.org/@littlebearapps/git-workflow-manager`

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
