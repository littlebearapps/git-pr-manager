# Architecture & Code Patterns

**Last Updated**: 2025-11-17

---

## Directory Structure

```
git-pr-manager/
├── src/
│   ├── commands/           # CLI commands
│   │   ├── auto.ts         # Automated workflow
│   │   ├── checks.ts       # CI status checks
│   │   ├── check-update.ts # Update checking
│   │   ├── feature.ts      # Feature branch creation
│   │   ├── init.ts         # Config initialization
│   │   ├── protect.ts      # Branch protection
│   │   ├── security.ts     # Security scanning
│   │   ├── ship.ts         # Ship feature workflow
│   │   └── status.ts       # Git/workflow status
│   │
│   ├── services/           # Core business logic
│   │   ├── CIService.ts    # CI polling & checks
│   │   ├── GitHubService.ts # GitHub API wrapper
│   │   └── GitService.ts   # Local git operations
│   │
│   ├── utils/              # Utilities
│   │   ├── cache.ts        # LRU caching with ETag
│   │   ├── config.ts       # .gpm.yml configuration
│   │   ├── error.ts        # Error types & codes
│   │   ├── logger.ts       # Logging & output
│   │   ├── spinner.ts      # CLI spinners
│   │   └── update-check.ts # npm update checking
│   │
│   ├── types/              # TypeScript types
│   │   ├── ci.ts           # CI check types
│   │   ├── commands.ts     # Command option types
│   │   ├── config.ts       # Config schema types
│   │   ├── git.ts          # Git operation types
│   │   └── github.ts       # GitHub API types
│   │
│   └── index.ts            # CLI entry point
│
├── tests/                  # Test suites
│   ├── commands/           # Command tests
│   ├── services/           # Service tests
│   └── utils/              # Utility tests
│
├── docs/                   # Documentation
│   ├── guides/             # Integration guides
│   ├── planning/           # Implementation plans
│   ├── architecture/       # Architecture docs
│   └── TESTS.md            # Test documentation
│
├── quickrefs/              # Claude Code quick references
│   ├── commands.md         # Common commands
│   ├── architecture.md     # This file
│   └── testing.md          # Testing guidelines
│
└── .github/                # GitHub Actions
    └── workflows/
        ├── test.yml        # CI test workflow
        └── publish.yml     # npm publish workflow
```

---

## Core Architecture Patterns

### Service Layer Pattern
**Purpose**: Encapsulate external API interactions and business logic

```typescript
// Services handle all external dependencies
class GitHubService {
  private octokit: Octokit;
  private cache: LRUCache;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.cache = new LRUCache({ max: 10, ttl: 5 * 60 * 1000 });
  }

  async getPullRequest(prNumber: number): Promise<PullRequest> {
    // Cache, rate limiting, error handling
  }
}
```

**Key Services**:
- **GitHubService**: GitHub API wrapper (Octokit)
- **GitService**: Local git operations (simple-git)
- **CIService**: CI check polling with exponential backoff

---

### Command Pattern
**Purpose**: CLI commands as modular, testable functions

```typescript
// Commands are async functions exported from command files
export async function featureCommand(
  name: string,
  options: FeatureOptions
): Promise<void> {
  // 1. Validate inputs
  // 2. Initialize services
  // 3. Execute workflow
  // 4. Handle errors
  // 5. Log results (or JSON output)
}
```

**Registration** (in `src/index.ts`):
```typescript
program
  .command('feature')
  .description('Start a new feature branch')
  .argument('<name>', 'Feature name')
  .option('--from <branch>', 'Base branch')
  .action(featureCommand);
```

---

### Caching Strategy

#### LRU Cache (In-Memory)
**Location**: `src/utils/cache.ts`
**Usage**: API responses, expensive operations

```typescript
const cache = new LRUCache({
  max: 10,              // Max items
  ttl: 5 * 60 * 1000,   // 5 minutes
});

// Cache with ETag support
cache.set('key', { data, etag });
const cached = cache.get('key');
```

**Cached Data**:
- GitHub API responses (PRs, checks, repos)
- Config files (.gpm.yml)
- Update check results

#### Disk Cache (Persistent)
**Location**: `TMPDIR/gpm-update-check/`
**Usage**: Update check results

```typescript
// 7-day TTL for update checks
const cacheFile = join(tmpdir(), 'gpm-update-check', `${pkg}_${channel}.json`);
```

---

### Error Handling Pattern

#### Structured Errors
```typescript
export enum ErrorCode {
  VALIDATION = 'VALIDATION_ERROR',
  AUTH = 'AUTH_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  NETWORK = 'NETWORK_ERROR',
  GIT = 'GIT_ERROR',
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public suggestion?: string
  ) {
    super(message);
  }
}
```

#### Exit Codes
- **0**: Success
- **1**: General failure
- **2**: Validation error
- **3**: Authentication error
- **4**: Rate limit exceeded

#### Error Response (JSON mode)
```json
{
  "success": false,
  "error": {
    "code": "AUTH_ERROR",
    "message": "GitHub token invalid",
    "suggestion": "Generate token at https://github.com/settings/tokens"
  }
}
```

---

### Logger Pattern

#### Verbosity Levels
```typescript
enum VerbosityLevel {
  SILENT = 0,   // No output
  QUIET = 1,    // Errors/warnings only
  NORMAL = 2,   // Standard output
  VERBOSE = 3,  // Detailed output
}
```

#### Usage
```typescript
import { logger } from '../utils/logger';

logger.info('Starting workflow...');
logger.warn('Rate limit approaching');
logger.error('Failed to create PR');
logger.debug('API response:', data);  // Only in verbose mode
```

#### JSON Mode
```typescript
// Auto-detected or explicit --json flag
if (options.json) {
  console.log(JSON.stringify({
    success: true,
    data: result
  }));
} else {
  logger.info('PR created successfully!');
}
```

---

### Spinner Pattern

#### Usage
```typescript
import { createSpinner } from '../utils/spinner';

const spinner = createSpinner('Creating PR...');
try {
  const pr = await github.createPullRequest();
  spinner.succeed('PR created!');
} catch (error) {
  spinner.fail('Failed to create PR');
  throw error;
}
```

**Features**:
- Auto-suppressed in CI environments
- Auto-suppressed in JSON mode
- Auto-suppressed in non-TTY

---

### Configuration Pattern

#### Schema (`.gpm.yml`)
```yaml
github:
  defaultBranch: main
  protectMain: true

ci:
  waitForChecks: true
  timeout: 1800000  # 30 minutes
  retryFlaky: true

workflow:
  autoDelete: true
  defaultTemplate: standard
```

#### Loading with Cache
```typescript
import { loadConfig } from '../utils/config';

// Cached with TTL (98% reduction in load time)
const config = await loadConfig();
```

---

### Testing Patterns

#### Service Mocking
```typescript
describe('GitHubService', () => {
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        create: jest.fn(),
        get: jest.fn(),
      },
    } as any;
  });

  it('should create PR', async () => {
    mockOctokit.pulls.create.mockResolvedValue({ data: pr });

    const result = await github.createPullRequest(options);

    expect(result).toEqual(pr);
    expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
      owner,
      repo,
      title,
      head,
      base,
    });
  });
});
```

#### Command Testing
```typescript
describe('featureCommand', () => {
  it('should create feature branch', async () => {
    const mockGit = {
      checkoutBranch: jest.fn().mockResolvedValue(undefined),
    };

    await featureCommand('my-feature', { from: 'main' });

    expect(mockGit.checkoutBranch).toHaveBeenCalledWith(
      'feature/my-feature',
      'main'
    );
  });
});
```

---

## Multi-Language Support Pattern (v1.6.0+)

### Purpose
Automatic detection and support for Python, Node.js, Go, and Rust projects with intelligent command resolution and package manager detection.

### Architecture Overview

**Core Services**:
- **LanguageDetectionService**: Detects project language and package manager
- **CommandResolver**: Resolves verification commands with fallback chains
- **ConfigService**: Supports verification configuration overrides

### Language Detection Pattern

**Location**: `src/services/LanguageDetectionService.ts`

```typescript
// Auto-detect language from marker files
const detection = await languageDetector.detectLanguage();

// Result structure
interface DetectedLanguage {
  primary: 'python' | 'nodejs' | 'go' | 'rust';
  additional: Language[];  // For monorepos
  confidence: number;      // 0-100%
  sources: string[];      // Files that led to detection
}
```

**Detection Rules**:

| Language | Marker Files | Priority |
|----------|-------------|----------|
| **Python** | `pyproject.toml`, `Pipfile`, `requirements.txt` | 1st |
| **Node.js** | `package.json` | 2nd |
| **Go** | `go.mod` | 3rd |
| **Rust** | `Cargo.toml` | 4th |

**Override**: Config file (.gpm.yml) always takes precedence:
```yaml
verification:
  language: python  # Override auto-detection
```

### Package Manager Detection Pattern

**Location**: `src/services/LanguageDetectionService.ts:detectPackageManager()`

```typescript
// Detect package manager from lock files
const pkgMgr = await languageDetector.detectPackageManager('python');

// Result structure
interface PackageManagerInfo {
  packageManager: string;  // 'poetry', 'npm', 'pnpm', etc.
  lockFile: string;       // 'poetry.lock', 'package-lock.json', etc.
  confidence: number;     // 0-100%
}
```

**Detection Rules**:

**Python**:
- `poetry.lock` → poetry
- `Pipfile.lock` → pipenv
- `uv.lock` → uv
- `requirements.txt` → pip (fallback)

**Node.js**:
- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `bun.lockb` → bun
- `package-lock.json` → npm (fallback)

**Go**: `go.sum` → go modules (single package manager)

**Rust**: `Cargo.lock` → cargo (single package manager)

### Command Resolution Pattern

**Location**: `src/services/CommandResolver.ts`

```typescript
// Resolve verification command with fallback chain
const resolved = await commandResolver.resolve({
  task: 'lint',
  language: 'python',
  packageManager: 'poetry',
  makefileTargets: ['lint', 'test'],
  config: verificationConfig,
  preferMakefile: true
});

// Result structure
interface ResolvedCommand {
  command: string;              // 'poetry run ruff check .'
  source: 'config' | 'makefile' | 'package-manager' | 'native' | 'not-found';
  language: Language;
  packageManager?: string;
}
```

**Resolution Priority** (5 levels):

```typescript
1. Custom commands from .gpm.yml → verification.commands
   Example: { lint: 'make lint' }

2. Makefile targets (if preferMakefile: true)
   Example: 'make lint' if Makefile has 'lint:' target

3. Package manager scripts
   Python: 'poetry run ruff check .'
   Node.js: 'npm run lint'

4. Native tools (direct tool invocation)
   Example: 'ruff check .'

5. Not found (step skipped gracefully)
```

### Tool Command Mapping

**Location**: `src/services/LanguageDetectionService.ts:getToolCommands()`

**Python**:
```typescript
{
  lint: ['poetry run ruff check .', 'ruff check .', 'flake8 .'],
  test: ['poetry run pytest', 'pytest tests/', 'python -m pytest'],
  typecheck: ['poetry run mypy .', 'mypy .', 'pyright .'],
  build: [] // No build step typically
}
```

**Node.js**:
```typescript
{
  lint: ['npm run lint', 'npx eslint .'],
  test: ['npm test', 'npx jest', 'npx vitest'],
  typecheck: ['npm run typecheck', 'npx tsc --noEmit'],
  build: ['npm run build', 'npx tsc']
}
```

**Go**:
```typescript
{
  lint: ['make lint', 'golangci-lint run'],
  test: ['make test', 'go test ./...'],
  format: ['gofmt -w .', 'goimports -w .'],
  build: ['make build', 'go build ./...']
}
```

**Rust**:
```typescript
{
  lint: ['make lint', 'cargo clippy'],
  test: ['make test', 'cargo test'],
  format: ['cargo fmt'],
  build: ['make build', 'cargo build']
}
```

### Makefile Integration Pattern

**Parse Makefile targets**:
```typescript
// LanguageDetectionService.ts
async getMakefileTargets(): Promise<string[]> {
  // Parse Makefile for targets (simple regex: /^([a-zA-Z0-9_-]+):/gm)
  // Return array of target names: ['lint', 'test', 'build']
}
```

**Prefer Makefile when available**:
```yaml
# .gpm.yml
verification:
  preferMakefile: true  # Default: true
```

**Resolution example**:
```typescript
// If Makefile has 'lint:' target and preferMakefile: true
// → 'make lint' (source: 'makefile')

// Otherwise fall back to package manager
// → 'poetry run ruff check .' (source: 'package-manager')
```

### Configuration Override Pattern

**Location**: `src/types/config.ts`, `src/services/ConfigService.ts`

```yaml
# .gpm.yml
verification:
  # Enable/disable auto-detection
  detectionEnabled: true  # Default: true

  # Prefer Makefile targets over package manager
  preferMakefile: true    # Default: true

  # Override detected language
  language: python        # Optional

  # Override detected package manager
  packageManager: poetry  # Optional

  # Override specific commands (highest priority)
  commands:
    lint: 'make lint'
    test: 'poetry run pytest tests/ --cov=src'
    typecheck: 'mypy src/'
```

### Usage Pattern (verify command)

**Location**: `src/commands/verify.ts`

```typescript
async function verifyCommand(options: VerifyOptions): Promise<void> {
  // 1. Load config
  const config = await configService.load();

  // 2. Detect language (unless disabled)
  const detection = await languageDetector.detectLanguage();

  // 3. Detect package manager
  const pkgMgr = await languageDetector.detectPackageManager(detection.primary);

  // 4. Get Makefile targets
  const makefileTargets = await languageDetector.getMakefileTargets();

  // 5. Resolve each verification step
  for (const task of ['lint', 'typecheck', 'test', 'build']) {
    if (options[`skip${capitalize(task)}`]) continue;

    const resolved = await commandResolver.resolve({
      task,
      language: detection.primary,
      packageManager: pkgMgr.packageManager,
      makefileTargets,
      config: config.verification
    });

    if (resolved.source === 'not-found') {
      logger.warn(`${task} command not found - skipping`);
      continue;
    }

    // 6. Execute resolved command
    await executeCommand(resolved.command);
  }
}
```

### Testing Pattern

**Mock services**:
```typescript
jest.mock('../../src/services/LanguageDetectionService');
jest.mock('../../src/services/CommandResolver');

const mockLanguageDetector = {
  detectLanguage: jest.fn().mockResolvedValue({
    primary: 'python',
    additional: [],
    confidence: 95,
    sources: ['pyproject.toml']
  }),
  detectPackageManager: jest.fn().mockResolvedValue({
    packageManager: 'poetry',
    lockFile: 'poetry.lock',
    confidence: 95
  }),
  getMakefileTargets: jest.fn().mockResolvedValue(['lint', 'test'])
};
```

**Test language detection**:
```typescript
it('should detect Python project with poetry', async () => {
  const result = await languageDetector.detectLanguage();

  expect(result.primary).toBe('python');
  expect(result.sources).toContain('pyproject.toml');
  expect(result.confidence).toBeGreaterThanOrEqual(95);
});
```

**Test command resolution**:
```typescript
it('should resolve lint command for Python project', async () => {
  const resolved = await commandResolver.resolve({
    task: 'lint',
    language: 'python',
    packageManager: 'poetry'
  });

  expect(resolved.command).toBe('poetry run ruff check .');
  expect(resolved.source).toBe('package-manager');
});
```

### Backward Compatibility

**Node.js fallback**:
```typescript
// If no language detected, fallback to Node.js
// Ensures existing Node.js projects work without changes
if (!detection.primary) {
  return {
    primary: 'nodejs',
    additional: [],
    confidence: 50,
    sources: ['fallback']
  };
}
```

**No breaking changes**:
- All new config fields are optional
- Existing `.gpm.yml` files work unchanged
- Node.js + npm is default fallback
- All verification flags work as before (--skip-lint, --skip-test, etc.)

---

## CloakPipe Telemetry Pattern (Internal)

### Purpose
Private, opt-in error logging for internal development debugging. Automatically excluded from public releases.

### Implementation Pattern

**Location**: `src/index.ts` (lines 28-48)

```typescript
// Internal telemetry (optional - Nathan only, private)
let telemetry: any = null;
(async () => {
  try {
    const os = await import('os');
    const username = os.userInfo().username;

    if (username === 'nathanschram') {
      // @ts-expect-error - Optional internal telemetry module (no types needed)
      const { initTelemetry, captureBreadcrumb, captureError } =
        await import('../telemetry/src/telemetry.js');

      telemetry = {
        init: () => initTelemetry('gitprmanager', pkg.version),
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

### Key Design Principles

**1. Username Detection**
- Only activates for `username === 'nathanschram'`
- External users never trigger telemetry code path
- Zero overhead for public installations

**2. Dynamic Import**
- Uses `await import()` for optional loading
- Fails gracefully if telemetry module unavailable
- No compile-time dependency on telemetry

**3. Optional Chaining**
- All usage: `telemetry?.method()` (never `telemetry.method()`)
- Safe even if initialization failed
- No null pointer exceptions

**4. Git Submodule Approach**
- Telemetry code in `./telemetry/` (separate private repo)
- Not included in git repository (submodule)
- Automatically excluded from npm package

### Defense-in-Depth Exclusion

**Multiple Protection Layers**:
```
1. Git submodule → ./telemetry/ (private repo, not cloned by default)
2. .gitignore → telemetry/ (prevents accidental commits)
3. .npmignore → telemetry/, .gitmodules (excludes from package)
4. package.json files field → doesn't list telemetry/ (explicit exclusion)
```

**Result**: 0 telemetry files in published npm package (verified)

### Usage Pattern

**Breadcrumbs** (command execution context):
```typescript
// src/index.ts - preAction hook
telemetry?.breadcrumb(`command:${thisCommand.name()}`, {
  args: thisCommand.args,
  options: Object.keys(opts)
});
```

**Error Capture** (uncaught exceptions):
```typescript
// src/index.ts - global error handlers
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  telemetry?.error(error, { type: 'uncaughtException' });
  // ...
});
```

### Testing Scenarios

**Nathan User** (development):
```bash
npm install
# Output: 🔧 Setting up internal telemetry...
#         ✅ Internal telemetry ready

# Telemetry active - errors sent to CloakPipe server
```

**External User** (production):
```bash
npm install
# Output: ✨ git-pr-manager installed!
#         📖 Quick Start: ...

# Telemetry code not present - graceful no-op
```

### Release Process Impact

**npm publish**:
- ✅ Automatic exclusion (no action required)
- ✅ Package size: ~325 KB (no telemetry overhead)
- ✅ Zero telemetry code in distribution

**Homebrew** (future):
- ✅ Same exclusion applies
- ✅ Tarball created from npm package
- ✅ No telemetry code distributed

**Verification**:
```bash
# Before release
npm pack --dry-run 2>&1 | grep telemetry
# Expected: No output (excluded)

# Check tarball
npm pack
tar -tzf *.tgz | grep telemetry
# Expected: No output (not in package)
```

### Maintenance Notes

**When modifying telemetry**:
- Submodule code: `./telemetry/` (separate repo)
- Always use optional chaining: `telemetry?.method()`
- Test both Nathan and external user scenarios
- Never require telemetry for core functionality

**When releasing**:
- No special steps - automatic exclusion
- Optional: Verify with `npm pack --dry-run`
- External users see no telemetry behavior

---

## Key Design Decisions

### 1. TypeScript Over JavaScript
- **Type safety**: Catch errors at compile time
- **IntelliSense**: Better IDE support
- **Documentation**: Types serve as inline docs
- **Refactoring**: Safe, confident refactoring

### 2. Commander.js for CLI
- **Industry standard**: Well-maintained, widely used
- **Type support**: Works well with TypeScript
- **Features**: Subcommands, options, help generation
- **Testability**: Easy to test commands

### 3. Octokit for GitHub API
- **Official**: Maintained by GitHub
- **Type-safe**: Full TypeScript support
- **Features**: Pagination, rate limiting, auth
- **Plugins**: Throttling, retry logic

### 4. Jest for Testing
- **Fast**: Parallel execution, watch mode
- **Features**: Mocking, coverage, snapshots
- **TypeScript**: Works with ts-jest
- **Ecosystem**: Large community, many resources

### 5. LRU Cache + ETag
- **Performance**: 40-60% reduction in API calls
- **Simplicity**: No external cache dependencies
- **Reliability**: Memory-based, no network
- **Standards**: HTTP ETag support

---

## Performance Optimizations

### 1. Intelligent Caching
- **LRU Cache**: 5-minute TTL for API responses
- **ETag Support**: Conditional requests (304 responses)
- **Config Cache**: 98% reduction in file reads
- **Update Cache**: 7-day TTL, disk + memory

### 2. Parallel API Requests
- **Batching**: Multiple requests in parallel
- **Result**: 40-50% faster PR validation

### 3. Exponential Backoff
- **CI Polling**: 5s → 30s adaptive intervals
- **Result**: 30-40% faster CI wait times

### 4. Fire-and-Forget Pattern
- **Update Check**: Non-blocking (<10ms impact)
- **Background**: Doesn't delay CLI startup

---

## Extension Points

### Adding a New Command
1. Create `src/commands/my-command.ts`
2. Export async function with options
3. Register in `src/index.ts`
4. Add tests in `tests/commands/my-command.test.ts`
5. Update docs (README, CLAUDE.md)

### Adding a New Service
1. Create `src/services/MyService.ts`
2. Implement with dependency injection
3. Add error handling and logging
4. Add tests in `tests/services/MyService.test.ts`
5. Mock external dependencies

### Adding a New Utility
1. Create `src/utils/my-util.ts`
2. Export pure functions (prefer stateless)
3. Add JSDoc comments
4. Add tests in `tests/utils/my-util.test.ts`
5. Document in quickrefs if commonly used

---

## Anti-Patterns to Avoid

### ❌ Avoid
- Direct Octokit usage outside GitHubService
- `any` types without justification
- Synchronous file operations
- Hardcoded values (use config)
- Silent failures (always log errors)
- Nested callbacks (use async/await)

### ✅ Prefer
- Service layer for all external APIs
- Explicit types for all parameters
- Async/await for promises
- Config-driven behavior
- Structured error handling
- Flat, readable code

---

## Dependencies Overview

### Production Dependencies
- **@octokit/rest**: GitHub API client
- **@octokit/plugin-throttling**: Rate limit handling
- **commander**: CLI framework
- **simple-git**: Git operations
- **chalk**: Terminal colors
- **ora**: Spinners
- **prompts**: Interactive prompts
- **lru-cache**: Caching
- **yaml**: YAML parsing
- **semver**: Version comparison
- **package-json**: npm registry queries

### Dev Dependencies
- **typescript**: TypeScript compiler
- **ts-jest**: Jest TypeScript support
- **jest**: Testing framework
- **eslint**: Linting
- **@typescript-eslint**: TypeScript ESLint
- **nock**: HTTP mocking

---

## References

- **Main README**: User-facing documentation
- **TESTS.md**: Test documentation and coverage
- **Implementation Plans**: `docs/planning/` for phase plans
- **Integration Guides**: `docs/guides/` for AI agents, GitHub Actions
