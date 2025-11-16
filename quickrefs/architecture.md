# Architecture & Code Patterns

**Last Updated**: 2025-11-13

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
