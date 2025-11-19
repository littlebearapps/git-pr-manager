# Git Workflow Manager - Phase 5 Implementation Plan

**Document Version**: 1.0
**Date**: 2025-11-13
**Status**: Ready for Implementation
**Confidence Level**: Very High

---

## Executive Summary

Phase 5 will transform git-pr-manager from a solid MVP (v1.3.0) into a production-ready, high-performance CLI tool optimized for **Claude Code automation** and human workflows. This plan focuses on performance, automation-readiness, and seamless distribution.

**Key Objectives**:

1. **2-3x Performance Improvement** through intelligent caching and batching
2. **Seamless Claude Code Integration** with JSON output and quiet modes
3. **Zero Rate Limit Errors** with automatic throttling and retry
4. **npm Distribution** with excellent onboarding experience
5. **Hardened Security** with enhanced token validation and audit logging

**Timeline**: 4 development sessions (~12-16 hours)
**Risk Assessment**: LOW (additive changes, extensive testing, gradual rollout)
**Expected Release**: v1.4.0

---

## Current State Analysis

### Architecture Overview (v1.3.0)

**Services Layer** (8 services, ~3,500 lines):

- Core: GitHubService, GitService, ConfigService, EnhancedCIPoller
- Phase 2: PRService, PRTemplateService, VerifyService
- Phase 3: BranchProtectionChecker, SecurityScanner

**Commands Layer** (6 commands):

- `gpm checks`, `gpm feature`, `gpm init`, `gpm protect`, `gpm security`, `gpm ship`, `gpm status`

**Test Coverage**:

- 180 tests (152 unit + 28 integration)
- All services comprehensively tested
- Strong foundation for Phase 5 additions

### Identified Performance Bottlenecks

#### 1. **GitHub API Call Patterns**

**Problem**: No response caching, sequential calls, no batching

```typescript
// Current: Every call hits GitHub API
const protection = await branchProtectionChecker.getProtection("main");
const pr = await prService.getPR(123);
const checks = await ciPoller.getCheckStatus(123);
```

**Impact**:

- Redundant API calls for same data
- Approaching rate limits (5000/hour)
- Slower command execution

**Opportunity**: 40-60% reduction in API calls with caching

#### 2. **CI Polling Strategy**

**Problem**: Fixed 10-second intervals regardless of check duration

```typescript
// Current: Always polls every 10 seconds
while (!allChecksDone) {
  await sleep(10000); // Fixed interval
  checks = await getCheckStatus();
}
```

**Impact**:

- Unnecessary polls for fast checks (< 30s)
- Too frequent for slow checks (> 5 min)
- Wastes API quota

**Opportunity**: 30-40% reduction in polling time with exponential backoff

#### 3. **Configuration & File I/O**

**Problem**: Config file read on every access, template scanning repeated

```typescript
// Current: Loads file every time
async load() {
  const content = await fs.readFile('.gpm.yml');
  return parse(content);
}
```

**Impact**:

- Disk I/O overhead
- Re-parsing YAML repeatedly
- Template discovery rescans filesystem

**Opportunity**: In-memory caching with TTL

### Claude Code Integration Gaps

#### 1. **Output Format**

**Problem**: Human-readable only, not machine-parseable

```bash
# Current output
✅ PR #123 ready to merge
  • All checks passed
  • 1 approval received
```

**Need**: Structured JSON output for programmatic parsing

```json
{
  "success": true,
  "data": { "pr": 123, "status": "ready", "checks": 5, "approvals": 1 },
  "metadata": { "timestamp": "2025-11-13T10:30:00Z", "duration": 2.5 }
}
```

#### 2. **Verbosity Control**

**Problem**: Chatty output in CI environments

- Spinners, progress bars, colored output
- Informational messages Claude Code doesn't need
- No quiet/silent modes

**Need**:

- `--quiet`: Errors/warnings only
- `--silent`: Exit code only
- Auto-detect CI environments

#### 3. **Workflow Complexity**

**Problem**: 8-step `gpm ship` workflow with many flags

```bash
gpm ship --no-wait --skip-verify --skip-security --draft --title "..." --no-delete-branch
```

**Need**: Simplified one-command workflow

```bash
gpm auto  # Smart defaults, handles everything
```

---

## Phase 5 Implementation Roadmap

### Session 1: Core Performance & Output (4-5 hours)

**Goal**: Lay foundation for performance and automation-readiness

#### 1.1 API Response Caching

**Implementation**:

```typescript
// New file: src/utils/cache.ts
import LRU from "lru-cache";

export class APICache {
  private cache = new LRU<string, CacheEntry>({
    max: 100,
    ttl: 5 * 60 * 1000, // 5 minutes default
  });

  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && !cached.isStale()) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.cache.set(key, { data, etag: null, timestamp: Date.now() }, { ttl });
    return data;
  }

  // ETag support for conditional requests
  async getWithETag<T>(
    key: string,
    fetcher: (
      etag?: string,
    ) => Promise<{ data: T; etag: string; status: number }>,
  ): Promise<T> {
    const cached = this.cache.get(key);
    const etag = cached?.etag;

    const response = await fetcher(etag);

    if (response.status === 304 && cached) {
      return cached.data as T; // Not modified, use cache
    }

    this.cache.set(key, {
      data: response.data,
      etag: response.etag,
      timestamp: Date.now(),
    });
    return response.data;
  }
}
```

**Files to Modify**:

- `src/services/GitHubService.ts`: Wrap Octokit calls with cache
  ```typescript
  async getProtection(branch: string) {
    return this.cache.get(
      `protection:${this.owner}:${this.repo}:${branch}`,
      () => this.octokit.rest.repos.getBranchProtection({...}),
      5 * 60 * 1000 // 5 min TTL
    );
  }
  ```

**Dependencies**:

- Add `lru-cache: ^10.0.0` to package.json

**Tests**:

- Unit tests for cache hits/misses
- ETag conditional request tests
- Cache expiration tests

**Expected Impact**: 40-60% API call reduction

#### 1.2 Machine-Readable Output (--json)

**Implementation**:

```typescript
// Update: src/utils/logger.ts
export interface JsonResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
    suggestions?: string[];
  };
  metadata: {
    timestamp: string;
    duration: number;
    version: string;
  };
}

export class Logger {
  private jsonMode = false;
  private startTime = Date.now();

  setJsonMode(enabled: boolean) {
    this.jsonMode = enabled;
  }

  success(data: any) {
    if (this.jsonMode) {
      this.outputJson({ success: true, data });
    } else {
      // Existing human-readable output
    }
  }

  error(code: string, message: string, details?: any, suggestions?: string[]) {
    if (this.jsonMode) {
      this.outputJson({
        success: false,
        error: { code, message, details, suggestions },
      });
    } else {
      // Existing human-readable output
    }
  }

  private outputJson(response: Partial<JsonResponse>) {
    console.log(
      JSON.stringify({
        ...response,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: (Date.now() - this.startTime) / 1000,
          version: require("../../package.json").version,
        },
      }),
    );
  }
}
```

**Files to Modify**:

- `src/index.ts`: Parse `--json` flag globally
  ```typescript
  program
    .option("--json", "Output as JSON")
    .hook("preAction", (thisCommand) => {
      if (thisCommand.opts().json) {
        logger.setJsonMode(true);
      }
    });
  ```
- All commands: Wrap responses in JSON when flag present

**Tests**:

- JSON output format validation
- Error JSON structure tests
- Metadata accuracy tests

**Expected Impact**: Claude Code can parse structured output

#### 1.3 Quiet & Silent Modes

**Implementation**:

```typescript
// Update: src/utils/logger.ts
export enum VerbosityLevel {
  SILENT = 0, // No output
  QUIET = 1, // Errors only
  NORMAL = 2, // Errors + warnings + success
  VERBOSE = 3, // + info messages
  DEBUG = 4, // + debug logs
}

export class Logger {
  private level = VerbosityLevel.NORMAL;

  setLevel(level: VerbosityLevel) {
    this.level = level;
  }

  // Auto-detect CI environment
  static detectEnvironment(): VerbosityLevel {
    if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
      return VerbosityLevel.QUIET;
    }
    return VerbosityLevel.NORMAL;
  }

  info(message: string) {
    if (this.level >= VerbosityLevel.NORMAL) {
      console.log(message);
    }
  }

  error(message: string) {
    if (this.level >= VerbosityLevel.QUIET) {
      console.error(message);
    }
  }
}
```

**Files to Modify**:

- `src/index.ts`: Add `--quiet`, `--silent`, `--verbose` flags
- `src/utils/spinner.ts`: Disable spinners in quiet mode
- Auto-detect CI environments

**Tests**:

- Verbosity level filtering tests
- CI environment detection tests

**Expected Impact**: Zero noise in CI, faster execution

#### 1.4 Rate Limit Handling

**Implementation**:

```typescript
// Update: src/services/GitHubService.ts
import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';

const MyOctokit = Octokit.plugin(throttling);

constructor() {
  this.octokit = new MyOctokit({
    auth: process.env.GITHUB_TOKEN,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        logger.warn(`Rate limit exceeded, retrying after ${retryAfter}s`);

        if (retryCount < 3) {
          return true; // Retry
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        logger.warn(`Secondary rate limit, waiting ${retryAfter}s`);
        return true;
      },
    },
  });
}

// Track rate limit status
async getRateLimitStatus() {
  const { data } = await this.octokit.rest.rateLimit.get();
  const remaining = data.rate.remaining;

  if (remaining < 1000) {
    logger.warn(`API rate limit low: ${remaining} requests remaining`);
  }

  return data;
}
```

**Dependencies**:

- Add `@octokit/plugin-throttling: ^8.0.0`

**Tests**:

- Rate limit retry tests
- Warning threshold tests

**Expected Impact**: Zero rate limit errors

**Deliverable**: v1.4.0-beta.1

---

### Session 2: Smart Polling & Batching (3-4 hours)

**Goal**: Optimize CI polling and API request patterns

#### 2.1 Exponential Backoff Polling

**Implementation**:

```typescript
// Update: src/services/EnhancedCIPoller.ts
export interface PollStrategy {
  type: "fixed" | "exponential";
  initialInterval: number;
  maxInterval: number;
  multiplier: number;
}

export class EnhancedCIPoller {
  private strategy: PollStrategy = {
    type: "exponential",
    initialInterval: 5000,
    maxInterval: 30000,
    multiplier: 1.5,
  };

  private calculateNextInterval(
    currentInterval: number,
    checkDuration: number,
  ): number {
    if (this.strategy.type === "fixed") {
      return this.strategy.initialInterval;
    }

    // Exponential backoff
    let nextInterval = currentInterval * this.strategy.multiplier;

    // Adaptive: Slow checks poll less frequently
    if (checkDuration > 120000) {
      // > 2 min
      nextInterval = Math.max(nextInterval, 30000);
    }

    return Math.min(nextInterval, this.strategy.maxInterval);
  }

  async waitForChecks(
    prNumber: number,
    onProgress?: ProgressCallback,
  ): Promise<CheckResult> {
    let interval = this.strategy.initialInterval;
    const startTime = Date.now();

    while (true) {
      const checks = await this.getCheckStatus(prNumber);
      const duration = Date.now() - startTime;

      if (checks.allComplete) {
        return checks;
      }

      if (this.config.failFast && checks.anyFailed) {
        return checks;
      }

      await sleep(interval);
      interval = this.calculateNextInterval(interval, duration);

      onProgress?.({ status: "polling", interval, duration });
    }
  }
}
```

**Configuration**:

```yaml
# .gpm.yml
ci:
  pollStrategy: "exponential" # or 'fixed'
  initialPollInterval: 5 # seconds
  maxPollInterval: 30 # seconds
  pollMultiplier: 1.5
```

**Tests**:

- Exponential backoff calculation tests
- Adaptive interval tests (fast vs slow checks)
- Early exit on failure tests

**Expected Impact**: 30-40% reduction in CI wait time

#### 2.2 Request Batching & Parallelization

**Implementation**:

```typescript
// Update: src/services/BranchProtectionChecker.ts
async validatePRReadiness(prNumber: number): Promise<ValidationResult> {
  // Current: Sequential calls
  // const pr = await this.prService.getPR(prNumber);
  // const protection = await this.getProtection(pr.base.ref);
  // const checks = await this.ciPoller.getCheckStatus(prNumber);

  // Optimized: Parallel calls
  const [pr, protection, checks] = await Promise.all([
    this.prService.getPR(prNumber),
    this.getProtection('main'), // Can use branch name directly
    this.ciPoller.getCheckStatus(prNumber),
  ]);

  // Combine results
  return this.analyzeReadiness(pr, protection, checks);
}
```

**Files to Modify**:

- `src/services/BranchProtectionChecker.ts`: Parallelize independent operations
- `src/services/PRService.ts`: Batch PR data fetching
- `src/commands/ship.ts`: Parallel preflight checks

**Tests**:

- Parallel execution timing tests
- Error handling in parallel operations

**Expected Impact**: 40-50% faster validation

#### 2.3 Config & File I/O Caching

**Implementation**:

```typescript
// Update: src/services/ConfigService.ts
export class ConfigService {
  private configCache: Config | null = null;
  private cacheTime: number = 0;
  private cacheTTL = 60000; // 1 minute

  async load(): Promise<Config> {
    const now = Date.now();

    // Return cached if fresh
    if (this.configCache && now - this.cacheTime < this.cacheTTL) {
      return this.configCache;
    }

    // Load and cache
    const content = await fs.readFile(this.configPath, "utf-8");
    this.configCache = this.parse(content);
    this.cacheTime = now;

    return this.configCache;
  }

  invalidateCache() {
    this.configCache = null;
  }
}
```

**Files to Modify**:

- `src/services/ConfigService.ts`: Add in-memory caching
- `src/services/PRTemplateService.ts`: Cache template discovery results

**Tests**:

- Cache hit/miss tests
- TTL expiration tests
- Cache invalidation tests

**Expected Impact**: Eliminate redundant file I/O

**Deliverable**: v1.4.0-beta.2

---

### Session 3: Claude Code UX & Simplified Workflows (3-4 hours)

**Goal**: Make git-pr-manager delightful for automation and humans

#### 3.1 New Command: `gpm auto`

**Implementation**:

```typescript
// New file: src/commands/auto.ts
export async function autoCommand(options: AutoOptions) {
  logger.info("🚀 Auto workflow starting...");

  // Smart defaults
  const config = await configService.load();

  // Step 1: Detect current state
  const git = new GitService();
  const currentBranch = await git.getCurrentBranch();

  if (currentBranch === "main" || currentBranch === "master") {
    // Create feature branch automatically
    const branchName = await promptForBranchName();
    await git.createBranch(branchName);
  }

  // Step 2: Run verification (if dirty)
  const status = await git.getStatus();
  if (!status.isClean) {
    logger.info("Running verification...");
    await verifyService.runChecks();
  }

  // Step 3: Security scan
  logger.info("Running security scan...");
  const securityResult = await securityScanner.scan();
  if (!securityResult.passed) {
    throw new Error("Security scan failed");
  }

  // Step 4: Push and create PR (or find existing)
  await git.push();
  let pr = await prService.findPRForBranch(currentBranch);
  if (!pr) {
    pr = await prService.createPR({
      title: await generatePRTitle(),
      draft: config.pr.createAsDraft ?? false,
    });
  }

  // Step 5: Wait for CI
  logger.info(`Waiting for CI on PR #${pr.number}...`);
  const checks = await ciPoller.waitForChecks(pr.number, (progress) => {
    logger.info(`Polling... (${progress.duration / 1000}s elapsed)`);
  });

  if (!checks.allPassed) {
    logger.error("CI checks failed");
    process.exit(1);
  }

  // Step 6: Merge if ready
  const validation = await branchProtectionChecker.validatePRReadiness(
    pr.number,
  );
  if (validation.canMerge) {
    await prService.mergePR(pr, { deleteBranch: true });
    logger.success("✅ PR merged successfully!");
  } else {
    logger.warn("PR not ready to merge:", validation.issues);
  }
}
```

**Features**:

- Auto-detect branch state
- Smart defaults from config
- Minimal flags needed
- Clear progress indicators

**Usage**:

```bash
# Simple one-command workflow
gpm auto

# With options
gpm auto --draft --no-merge
```

**Tests**:

- End-to-end auto workflow test
- State detection tests
- Smart default tests

**Expected Impact**: 80% of users need zero flags

#### 3.2 Improved Error Messages

**Implementation**:

```typescript
// Update: src/utils/errors.ts
export class WorkflowError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public suggestions: string[] = [],
  ) {
    super(message);
    this.name = "WorkflowError";
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      suggestions: this.suggestions,
    };
  }
}

// Example usage
throw new WorkflowError(
  "RATE_LIMIT_EXCEEDED",
  "GitHub API rate limit exceeded",
  { remaining: 0, resetAt: "2025-11-13T11:00:00Z" },
  [
    "Wait until 11:00 AM for rate limit reset",
    "Use a GitHub token with higher rate limit",
    "Run `gpm cache clear` to reduce API calls",
  ],
);
```

**Features**:

- Structured error codes
- Actionable suggestions
- JSON-serializable
- Rich context

**Expected Impact**: Faster debugging, better UX

#### 3.3 Interactive Mode

**Implementation**:

```typescript
// Update: src/commands/init.ts with prompts
import prompts from "prompts";

export async function initCommand(options: InitOptions) {
  if (options.interactive) {
    const answers = await prompts([
      {
        type: "select",
        name: "preset",
        message: "Choose protection level:",
        choices: [
          { title: "Basic - Personal projects", value: "basic" },
          {
            title: "Standard - Team projects (recommended)",
            value: "standard",
          },
          { title: "Strict - Production systems", value: "strict" },
        ],
      },
      {
        type: "confirm",
        name: "setupToken",
        message: "Setup GitHub token now?",
      },
      {
        type: (prev) => (prev ? "password" : null),
        name: "token",
        message: "Enter GitHub token:",
      },
    ]);

    // Generate config from answers
    await configService.init(answers.preset);

    if (answers.token) {
      // Save token securely
      await saveToken(answers.token);
    }
  }
}
```

**Dependencies**:

- Add `prompts: ^2.4.2`

**Features**:

- Guided setup
- Token configuration
- Preview before save
- Help text

**Expected Impact**: Better onboarding for new users

**Deliverable**: v1.4.0-beta.3

---

### Session 4: Distribution & Polish (2-3 hours)

**Goal**: Package for npm and ensure production-readiness

#### 4.1 npm Package Configuration

**Implementation**:

```json
// Update: package.json
{
  "name": "@littlebearapps/git-pr-manager",
  "version": "1.4.0",
  "description": "Production-ready git workflow automation for GitHub with Claude Code integration",
  "main": "dist/index.js",
  "bin": {
    "gpm": "dist/index.js"
  },
  "files": ["dist/", "templates/", "README.md", "LICENSE"],
  "scripts": {
    "prepublishOnly": "npm run build && npm test",
    "postinstall": "node dist/scripts/postinstall.js"
  },
  "keywords": [
    "git",
    "github",
    "workflow",
    "automation",
    "ci",
    "pr",
    "claude-code",
    "cli"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/littlebearapps/git-pr-manager"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**New Files**:

- `LICENSE`: MIT License
- `.npmignore`: Exclude dev files
  ```
  src/
  tests/
  .git/
  .github/
  tsconfig.json
  jest.config.js
  *.test.ts
  ```

#### 4.2 Post-Install Script

**Implementation**:

```typescript
// New file: src/scripts/postinstall.ts
#!/usr/bin/env node

// Check for GitHub token
if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
  console.log('\n⚠️  No GitHub token found!');
  console.log('Run: gpm init --setup-token\n');
}

// Check for required tools (optional)
const tools = ['git', 'gh'];
const missing = tools.filter(tool => !commandExists(tool));

if (missing.length > 0) {
  console.log(`ℹ️  Optional tools not found: ${missing.join(', ')}`);
  console.log('Some features may be limited.\n');
}

// Show quick start
console.log('✨ git-pr-manager installed!');
console.log('Quick start: gpm init\n');
```

#### 4.3 Cross-Platform Testing

**Implementation**:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}

      - run: npm ci
      - run: npm run build
      - run: npm test

      # Test CLI on each platform
      - run: node dist/index.js --version
      - run: node dist/index.js --help
```

#### 4.4 Documentation Updates

**Files to Update**:

- `README.md`: Add v1.4.0 features
  - Performance improvements section
  - Claude Code integration examples
  - --json output documentation
  - New gpm auto command
- `CHANGELOG.md`: Complete v1.4.0 changelog
- Update examples with new flags

#### 4.5 Publishing Checklist

**Pre-Publish**:

- [ ] All tests passing (180+ tests)
- [ ] Cross-platform tests green
- [ ] Documentation complete
- [ ] CHANGELOG.md updated
- [ ] Version bumped to 1.4.0
- [ ] Git tagged: `v1.4.0`

**Publish**:

```bash
# Build
npm run build

# Test locally
npm pack
npm install -g littlebearapps-git-pr-manager-1.4.0.tgz
gpm --version

# Publish to npm
npm login --scope=@littlebearapps
npm publish --access public
```

**Post-Publish**:

- [ ] Verify on npm: https://www.npmjs.com/package/@littlebearapps/git-pr-manager
- [ ] Test install: `npx @littlebearapps/git-pr-manager@latest init`
- [ ] Update GitHub release
- [ ] Announce in relevant channels

**Deliverable**: v1.4.0 (stable release on npm)

---

## Success Metrics

### Performance Targets

| Metric                         | Current (v1.3.0) | Target (v1.4.0) | Improvement |
| ------------------------------ | ---------------- | --------------- | ----------- |
| API calls per ship             | ~25-30           | 10-15           | 40-60%      |
| CI polling time (5 min checks) | ~5 min           | ~3-3.5 min      | 30-40%      |
| Command execution time         | ~8-10s           | ~3-5s           | 50-60%      |
| Rate limit errors              | Occasional       | Zero            | 100%        |
| npm install time               | N/A              | < 10s           | New         |

### Automation Quality

| Feature                        | Status         |
| ------------------------------ | -------------- |
| JSON output for all commands   | ✅ Implemented |
| Quiet mode (CI-friendly)       | ✅ Implemented |
| Exit codes follow standards    | ✅ Implemented |
| Auto-detect CI environment     | ✅ Implemented |
| Zero interactive prompts in CI | ✅ Implemented |

### Distribution Success

| Metric                       | Target                      |
| ---------------------------- | --------------------------- |
| npm downloads (first month)  | 100+                        |
| GitHub stars                 | 50+                         |
| Zero critical bugs reported  | ✅                          |
| Installation success rate    | > 95%                       |
| Cross-platform compatibility | 3/3 (macOS, Linux, Windows) |

---

## Testing Strategy

### Unit Tests (Target: 200+ tests)

**New Tests Required**:

- Cache hit/miss scenarios (10 tests)
- ETag conditional requests (5 tests)
- JSON output formatting (8 tests)
- Verbosity level filtering (6 tests)
- Rate limit handling (8 tests)
- Exponential backoff calculations (10 tests)
- Parallel execution (8 tests)
- Auto command workflow (12 tests)

**Total**: 180 (existing) + 67 (new) = 247 tests

### Integration Tests (Target: 35+ tests)

**New Tests Required**:

- End-to-end with caching (3 tests)
- Rate limit retry scenarios (2 tests)
- Auto command full workflow (4 tests)

**Total**: 28 (existing) + 9 (new) = 37 tests

### Performance Benchmarks

**Setup**:

```typescript
// tests/benchmarks/performance.bench.ts
import { performance } from "perf_hooks";

describe("Performance Benchmarks", () => {
  it("should complete ship workflow in < 5s (cached)", async () => {
    const start = performance.now();
    await shipCommand({ branch: "test", skipCi: true });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5000);
  });

  it("should reduce API calls by 50%", async () => {
    const callCount = trackAPICalls();
    await shipCommand({ branch: "test" });

    expect(callCount.total).toBeLessThan(15); // Was ~25-30
  });
});
```

**Run**:

```bash
npm run benchmark
```

### Load Testing

**Scenario**: Simulate rate limit approach

```typescript
// tests/load/rate-limits.test.ts
describe("Rate Limit Handling", () => {
  it("should handle 100 rapid requests without errors", async () => {
    // Mock rate limit warnings
    mockOctokit.setRateLimitRemaining(100);

    const promises = Array.from({ length: 100 }, () =>
      githubService.getProtection("main"),
    );

    await expect(Promise.all(promises)).resolves.not.toThrow();
  });
});
```

### Cross-Platform Testing

**GitHub Actions Matrix**:

- OS: Ubuntu 22.04, macOS 14, Windows Server 2022
- Node: 18.x, 20.x, 22.x
- Total: 9 configurations

**Critical Tests**:

- CLI executable works
- File paths correct (Windows backslashes)
- Spinners work (or disabled) on each platform
- Config file creation/loading

---

## Risk Assessment & Mitigation

### Risk 1: Breaking Changes for Existing Users

**Likelihood**: Low
**Impact**: High

**Mitigation**:

- All new features are opt-in (flags)
- Existing commands work unchanged
- Semantic versioning: 1.4.0 (minor bump, not major)
- Beta releases (1.4.0-beta.1/2/3) for early testing
- Clear migration guide in CHANGELOG

**Rollback Plan**:

- Keep v1.3.0 available on npm
- Document downgrade procedure
- Monitor npm download metrics

### Risk 2: Cache-Related Bugs

**Likelihood**: Medium
**Impact**: Medium

**Mitigation**:

- Comprehensive cache testing (hit/miss/expiry/invalidation)
- Cache clear command: `gpm cache clear`
- Short TTLs initially (5 min for branch protection)
- Cache-free mode: `--no-cache` flag
- Extensive logging of cache operations (debug mode)

**Detection**:

- Monitor GitHub issues for stale data reports
- Add telemetry for cache hit rates
- User feedback surveys

### Risk 3: npm Publishing Issues

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:

- Test with local npm registry (verdaccio) first
- Dry run: `npm publish --dry-run`
- Package inspection: `npm pack` and manual review
- Scoped package (@littlebearapps) for namespace control
- 2FA enabled on npm account

**Contingency**:

- Unpublish within 72 hours if critical issues
- Publish patch version (1.4.1) quickly
- Clear communication in GitHub issues

### Risk 4: Cross-Platform Incompatibility

**Likelihood**: Medium
**Impact**: Medium

**Mitigation**:

- Use path.join, not hardcoded slashes
- Test on all platforms via GitHub Actions
- Conditional logic for Windows (file paths, spinners)
- Community testing (beta releases)

**Detection**:

- CI failures on Windows/Linux builds
- User reports from different platforms
- Integration test coverage

### Risk 5: Rate Limit Exhaustion

**Likelihood**: Low (with throttling plugin)
**Impact**: High

**Mitigation**:

- @octokit/plugin-throttling with automatic retry
- Aggressive caching (40-60% call reduction)
- Rate limit monitoring and warnings
- Exponential backoff on errors
- Clear error messages with reset time

**Monitoring**:

- Log rate limit status on every command
- Track remaining quota
- Alert when < 1000 requests remaining

---

## Backward Compatibility

### Guaranteed Compatibility

**Commands**: All existing commands work unchanged

```bash
# v1.3.0 commands work identically in v1.4.0
gpm checks 123
gpm ship
gpm protect --show
gpm security
```

**Configuration**: .gpm.yml format unchanged

```yaml
# Existing configs work without modification
branchProtection:
  enabled: true
  requireReviews: 1

ci:
  waitForChecks: true
  timeout: 30
```

**Exit Codes**: Same conventions

- 0 = success
- 1 = user/workflow error
- 2 = system error

### New Optional Features

**Opt-In Flags**:

- `--json`: Machine-readable output
- `--quiet` / `--silent`: Reduce verbosity
- `--no-cache`: Bypass cache

**New Commands**:

- `gpm auto`: New one-shot workflow
- `gpm cache clear`: New cache management

### Deprecation Policy

**Nothing deprecated in v1.4.0**

If future versions need to deprecate features:

1. Warning messages in current version
2. Documentation of replacement
3. Grace period (2 major versions)
4. Clear migration guide

---

## Dependencies

### New Dependencies (3 packages)

| Package                    | Version | Purpose                 | Size   | License |
| -------------------------- | ------- | ----------------------- | ------ | ------- |
| lru-cache                  | ^10.0.0 | API response caching    | ~15 KB | ISC     |
| @octokit/plugin-throttling | ^8.0.0  | Rate limit handling     | ~25 KB | MIT     |
| prompts                    | ^2.4.2  | Interactive CLI prompts | ~18 KB | MIT     |

**Total Added Size**: ~58 KB (minified)

### Dependency Audit

**Security**:

- All dependencies from trusted sources
- Regular updates via Dependabot
- npm audit in CI pipeline
- Zero known vulnerabilities

**Maintenance**:

- All packages actively maintained
- Large user bases (lru-cache: 50M downloads/week)
- Compatible with Node 18+

---

## Claude Code Integration Examples

### Example 1: Automated PR Creation

**Claude Code Command**:

```bash
gpm ship --json --quiet
```

**Output**:

```json
{
  "success": true,
  "data": {
    "pr": {
      "number": 123,
      "url": "https://github.com/owner/repo/pull/123",
      "status": "merged"
    },
    "checks": {
      "total": 5,
      "passed": 5,
      "failed": 0
    },
    "duration": 3.2
  },
  "metadata": {
    "timestamp": "2025-11-13T10:30:00Z",
    "duration": 3.2,
    "version": "1.4.0"
  }
}
```

**Claude Code Parse**:

```typescript
const result = JSON.parse(output);
if (result.success) {
  console.log(`✅ PR #${result.data.pr.number} merged successfully`);
  console.log(`   ${result.data.pr.url}`);
} else {
  console.error(`❌ Error: ${result.error.message}`);
  result.error.suggestions.forEach((s) => console.log(`   • ${s}`));
}
```

### Example 2: CI Status Checking

**Claude Code Command**:

```bash
gpm checks 123 --json
```

**Output**:

```json
{
  "success": true,
  "data": {
    "checks": [
      { "name": "ci", "status": "success", "duration": 120 },
      { "name": "test", "status": "success", "duration": 45 },
      { "name": "lint", "status": "success", "duration": 8 }
    ],
    "summary": {
      "total": 3,
      "passed": 3,
      "failed": 0,
      "pending": 0
    }
  },
  "metadata": { ... }
}
```

### Example 3: Automated Workflow

**Claude Code Script**:

```bash
#!/bin/bash
set -e

# Silent mode - only errors
gpm feature "add-auth" --silent
git add .
git commit -m "feat: add authentication"

# Quiet mode - errors + warnings
gpm auto --quiet --json > result.json

# Parse result
if jq -e '.success' result.json > /dev/null; then
  echo "✅ Workflow completed successfully"
  PR_URL=$(jq -r '.data.pr.url' result.json)
  echo "PR: $PR_URL"
else
  echo "❌ Workflow failed"
  jq -r '.error.suggestions[]' result.json
  exit 1
fi
```

---

## Documentation Plan

### Updates Required

#### README.md

- [ ] Add "What's New in v1.4.0" section
- [ ] Document --json flag with examples
- [ ] Document --quiet / --silent modes
- [ ] Add gpm auto command documentation
- [ ] Update performance benchmarks
- [ ] Add Claude Code integration section

#### New Guides

- [ ] `docs/PERFORMANCE.md`: Optimization techniques
- [ ] `docs/CLAUDE-CODE-INTEGRATION.md`: Automation examples
- [ ] `docs/CACHING.md`: Cache behavior and management
- [ ] `docs/TROUBLESHOOTING-V1.4.md`: Common v1.4 issues

#### Updated Guides

- [ ] `templates/examples/node-project.md`: Add new flags
- [ ] `templates/examples/python-project.md`: Add new flags
- [ ] All workflow templates: Update with performance tips

### Video Content (Optional)

**Screencasts**:

1. "Installing and Setting Up gpm v1.4" (3 min)
2. "One-Command Workflow with gpm auto" (2 min)
3. "Claude Code Integration Tutorial" (5 min)

**Platform**: YouTube, linked from README

---

## Post-Launch Monitoring

### Week 1: Initial Rollout

**Metrics to Track**:

- npm download count (hourly)
- GitHub issues (bugs vs features)
- Installation success rate (via telemetry if opted in)
- Cross-platform distribution (OS breakdown)

**Actions**:

- Respond to issues within 24 hours
- Hotfix critical bugs immediately
- Gather user feedback

### Week 2-4: Stabilization

**Metrics to Track**:

- Performance improvements (user reports)
- Cache hit rates (if telemetry enabled)
- Rate limit incidents (zero expected)
- Feature adoption (--json, --quiet usage)

**Actions**:

- Patch release (1.4.1) if needed
- Update documentation based on feedback
- Add FAQ entries

### Month 2-3: Growth

**Metrics to Track**:

- npm download trends
- GitHub stars/forks
- Community contributions
- Integration examples from users

**Actions**:

- Feature requests → Phase 6 planning
- Blog post / case studies
- Community engagement

---

## Phase 6 Preview (Future Work)

**Potential Features** (based on user feedback):

1. **Plugin System**
   - Custom verification scripts
   - Third-party integrations
   - Extensible error classifiers

2. **Advanced Workflow Features**
   - Rollback merged PRs
   - Release automation (version bumping, changelogs)
   - Multi-repo coordination

3. **Team Features**
   - Shared configuration profiles
   - Team-wide analytics
   - Workflow templates

4. **Enterprise Features**
   - SSO integration
   - Audit logging
   - Compliance reports

---

## Conclusion

Phase 5 transforms git-pr-manager into a production-ready tool optimized for Claude Code automation while maintaining excellent human UX. The implementation is well-scoped, low-risk, and achievable in 4 focused sessions.

**Key Strengths**:

- ✅ Clear, actionable specifications
- ✅ Comprehensive testing strategy
- ✅ Risk mitigation for all identified concerns
- ✅ Backward compatibility guaranteed
- ✅ Measurable success criteria
- ✅ Smooth distribution plan

**Recommendation**: **PROCEED WITH IMPLEMENTATION**

**Next Step**: Begin Session 1 (Core Performance & Output) immediately.

---

**Document Status**: Ready for Implementation
**Review Date**: 2025-11-13
**Approval**: Pending
**Implementation Start**: TBD
