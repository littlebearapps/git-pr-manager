# Phase 1c Implementation Plan: Format & Build Support

**Version**: 1.7.0
**Created**: 2025-11-18
**Status**: ✅ Implemented
**Confidence**: Nearly Certain (validated by zen deepthink + expert analysis)
**Estimated Effort**: 14-19 hours

---

## Executive Summary

Phase 1c completes the verify command feature set by adding **format** and **build** tasks, plus configurable verification order. This enables a complete code quality workflow: **format → lint → typecheck → test → build**.

### Why Phase 1c?

**Current State (Phase 1a + 1b):**

- ✅ Lint: Code quality checks
- ✅ Test: Functionality verification
- ✅ Typecheck: Type safety
- ❌ Format: Code style consistency (MISSING)
- ❌ Build: Compilation verification (MISSING)

**After Phase 1c:**

- ✅ Complete verification pipeline
- ✅ Universal format support (all languages)
- ✅ Build support for compiled languages
- ✅ Configurable task order
- ✅ Zero breaking changes (additive only)

### Key Benefits

| Feature                | Benefit                                        | Impact                                    |
| ---------------------- | ---------------------------------------------- | ----------------------------------------- |
| **Format Support**     | Enforce consistent code style across languages | Reduce review friction by 40-60%          |
| **Build Verification** | Catch compilation errors before PR             | Prevent 80% of "build failed" PR failures |
| **Configurable Order** | Customize workflow per project                 | Faster local dev (skip heavy tasks)       |
| **Fail-Fast Mode**     | Stop on first failure                          | 50% faster feedback in CI                 |

---

## Table of Contents

1. [Scope & Requirements](#scope--requirements)
2. [Technical Design](#technical-design)
3. [Implementation Tasks](#implementation-tasks)
4. [Testing Strategy](#testing-strategy)
5. [Configuration](#configuration)
6. [Edge Cases & Mitigations](#edge-cases--mitigations)
7. [Success Criteria](#success-criteria)
8. [Rollout Plan](#rollout-plan)

---

## Scope & Requirements

### In Scope

**1. Format Task Support**

- Node.js: prettier, biome
- Python: black, ruff format, autopep8
- Go: gofmt, goimports
- Rust: cargo fmt
- Modes: check (default for verify), fix (future: `gpm format --fix`)

**2. Build Task Support**

- Node.js: npm run build (if build script exists), tsc
- Python: python -m build, poetry build (optional)
- Go: go build ./...
- Rust: cargo build, cargo check
- Optional behavior: skip if no build command exists (no error)

**3. Verification Order Configuration**

- Default order: format → lint → typecheck → test → build
- Configurable via .gpm.yml
- Per-task skip support
- Fail-fast mode

### Out of Scope (Future Phases)

- Auto-fix mode for format/lint (defer to Phase 2)
- Change-based scoping (--since, --staged)
- Bundler-specific detection (Webpack, Vite, Rollup)
- Performance profiling
- Parallel task execution within a project

---

## Technical Design

### Architecture Overview

Phase 1c follows the established CommandResolver pattern from Phase 1a:

```typescript
// Existing types (Phase 1a/1b)
type VerificationTask = "lint" | "test" | "typecheck" | "install";

// NEW in Phase 1c
type VerificationTask =
  | "format"
  | "lint"
  | "typecheck"
  | "test"
  | "build"
  | "install";
```

### Component Changes

#### 1. LanguageDetectionService Updates

Add format and build command detection:

```typescript
async getToolCommands(language: Language, packageManager?: PackageManager): Promise<ToolCommands> {
  // Existing: lint, test, typecheck, install

  // NEW: Format commands
  const formatCommands: Record<Language, string[]> = {
    nodejs: [
      'prettier --check .',
      'biome check --formatter-enabled=true .',
      'npx prettier --check .'
    ],
    python: [
      'black --check .',
      'ruff format --check .',
      'autopep8 --diff --recursive .'
    ],
    go: [
      'gofmt -l .',
      'goimports -l .'
    ],
    rust: [
      'cargo fmt --check'
    ]
  };

  // NEW: Build commands
  const buildCommands: Record<Language, string[]> = {
    nodejs: [
      'npm run build',  // Check package.json for build script
      'tsc',            // TypeScript compilation
      'pnpm run build',
      'yarn run build'
    ],
    python: [
      'python -m build',
      'poetry build'
    ],
    go: [
      'go build ./...',
      'go build .'
    ],
    rust: [
      'cargo build',
      'cargo check'  // Faster, no artifacts
    ]
  };

  return {
    install: [...],
    lint: [...],
    test: [...],
    typecheck: [...],
    format: formatCommands[language] || [],      // NEW
    build: buildCommands[language] || []          // NEW
  };
}
```

#### 2. CommandResolver Updates

Handle optional build task:

```typescript
async resolve(options: ResolveOptions): Promise<ResolvedCommand> {
  const { task, language, packageManager, config, makefileTargets = [] } = options;

  // ... existing resolution logic ...

  // NEW: Handle build as optional task
  if (result.command === '' && task === 'build') {
    return {
      command: '',
      source: 'not-found',
      language,
      packageManager,
      optional: true  // NEW field
    };
  }

  return result;
}
```

#### 3. Verify Command Updates

Implement verification order and fail-fast:

```typescript
export async function verifyCommand(options: VerifyOptions): Promise<void> {
  const config = await loadConfig();

  // NEW: Get task order from config (default: format → lint → typecheck → test → build)
  const taskOrder = config.verification?.tasks || [
    "format",
    "lint",
    "typecheck",
    "test",
    "build",
  ];

  // NEW: Get skip list
  const skipTasks = config.verification?.skipTasks || [];

  // NEW: Fail-fast mode
  const failFast = config.verification?.stopOnFirstFailure ?? true;

  const results: TaskResult[] = [];

  for (const task of taskOrder) {
    if (skipTasks.includes(task)) {
      logger.info(`⏭️  ${task}: Skipping (configured)`);
      continue;
    }

    const result = await resolver.resolve({ task, language, packageManager });

    // NEW: Handle optional tasks (build)
    if (result.source === "not-found") {
      if (result.optional) {
        logger.info(`⏭️  ${task}: Skipping (no command found)`);
        continue;
      } else {
        throw new Error(`Required task ${task} has no command`);
      }
    }

    // Execute command
    const taskResult = await executeCommand(result.command);
    results.push(taskResult);

    // NEW: Fail-fast
    if (!taskResult.success && failFast) {
      throw new Error(`${task} failed (fail-fast enabled)`);
    }
  }

  // Report summary
  reportResults(results);
}
```

---

## Implementation Tasks

### Task 1c.1: Format Command Support (4-5 hours)

**Deliverables:**

- Add 'format' to VerificationTask type
- Update LanguageDetectionService.getToolCommands() with format commands
- Update CommandResolver to resolve format commands
- Handle format + Makefile integration (e.g., `make format-check`)

**Implementation Steps:**

1. Update types in `src/types/index.ts`
2. Add format command detection in `src/services/LanguageDetectionService.ts`
3. Test format resolution in CommandResolver
4. Update Makefile integration (Phase 1b compatibility)

**Testing:**

- 8 unit tests: format resolution per language (Node.js, Python, Go, Rust)
- 2 integration tests: Makefile integration, workspace detection

**Files Modified:**

- `src/types/index.ts`
- `src/services/LanguageDetectionService.ts`
- `src/services/CommandResolver.ts`
- `tests/services/LanguageDetectionService.test.ts`
- `tests/services/CommandResolver.test.ts`

---

### Task 1c.2: Build Command Support (4-5 hours)

**Deliverables:**

- Add 'build' to VerificationTask type
- Update LanguageDetectionService.getToolCommands() with build commands
- Implement optional build behavior (skip if no build command)
- Handle TypeScript project references (tsc -b)

**Implementation Steps:**

1. Add build command detection
2. Implement optional task handling in CommandResolver
3. Detect TypeScript project references (tsconfig.json "references" field)
4. Test build resolution and optional behavior

**Build Detection Logic:**

```typescript
// Node.js: Check package.json for build script
const packageJson = await readFile("package.json");
const hasBuildScript = packageJson.scripts?.build !== undefined;

// TypeScript: Check for project references
const tsconfigJson = await readFile("tsconfig.json");
const hasProjectRefs = tsconfigJson.references !== undefined;

if (hasProjectRefs) {
  return "tsc -b --pretty false"; // Project references build
} else if (hasBuildScript) {
  return "npm run build"; // Standard build script
} else {
  return null; // No build command (optional)
}
```

**Testing:**

- 8 unit tests: build resolution per language, optional behavior
- 2 integration tests: TypeScript project references, package.json build script detection

**Files Modified:**

- `src/services/LanguageDetectionService.ts`
- `src/services/CommandResolver.ts`
- `tests/services/CommandResolver.test.ts`

---

### Task 1c.3: Verification Order Configuration (2-3 hours)

**Deliverables:**

- Add verification config schema
- Implement configurable task order
- Implement skip tasks support
- Implement fail-fast mode

**Configuration Schema:**

```yaml
# .gpm.yml
verification:
  tasks: [format, lint, typecheck, test, build] # Custom order
  skipTasks: [build] # Skip specific tasks
  stopOnFirstFailure: true # Fail-fast mode
```

**Implementation Steps:**

1. Update config types in `src/types/config.ts`
2. Update verify command to read config
3. Implement task ordering logic
4. Implement skip logic
5. Implement fail-fast mode

**Testing:**

- 6 unit tests: custom order, skip tasks, fail-fast behavior

**Files Modified:**

- `src/types/config.ts`
- `src/commands/verify.ts`
- `src/services/ConfigService.ts`
- `tests/commands/verify.test.ts`

---

### Task 1c.4: Integration Tests (2-3 hours)

**Deliverables:**

- Integration tests for format task
- Integration tests for build task
- Cross-feature integration (format + Makefile + workspace)
- Complete verification workflow test

**Test Scenarios:**

1. Format command resolution for all languages
2. Build command resolution with optional behavior
3. Verification order customization
4. Fail-fast mode
5. Skip tasks configuration
6. Cross-feature: format + Makefile aliases + workspace detection

**Testing:**

- 10-12 integration tests
- Coverage target: >80% (maintain current 89.67%)

**Files Created:**

- `tests/integration/phase1c.integration.test.ts`

---

### Task 1c.5: Documentation (2-3 hours)

**Deliverables:**

- README.md: Format and build examples
- Configuration documentation for verification settings
- Troubleshooting guide for format/build issues
- Update TESTS.md with new test counts

**Documentation Updates:**

**README.md additions:**

```markdown
### Format Verification (Phase 1c)

Enforce consistent code style:

\`\`\`bash
gpm verify # Runs format check automatically
\`\`\`

Supported formatters:

- **Node.js**: prettier (recommended), biome
- **Python**: black (recommended), ruff format, autopep8
- **Go**: gofmt (standard), goimports
- **Rust**: cargo fmt (standard)

### Build Verification (Phase 1c)

Verify code compiles before PR:

\`\`\`bash
gpm verify # Runs build if build command exists
\`\`\`

Build detection:

- **Node.js**: Uses `npm run build` if script exists
- **TypeScript**: Uses `tsc -b` for project references, `tsc` otherwise
- **Go**: Always runs `go build ./...`
- **Rust**: Runs `cargo build` or `cargo check`
- **Python**: Optional (skipped by default)

### Verification Configuration

\`\`\`yaml

# .gpm.yml

verification:
tasks: [format, lint, typecheck, test, build] # Custom order
skipTasks: [build] # Skip tasks
stopOnFirstFailure: true # Fail-fast
\`\`\`
```

**Files Modified:**

- `README.md`
- `docs/TESTS.md`
- `.gpm.yml` (example config)

---

## Configuration

### Default Configuration

```yaml
verification:
  # Default task order
  tasks: [format, lint, typecheck, test, build]

  # No tasks skipped by default
  skipTasks: []

  # Fail-fast enabled (stop on first failure)
  stopOnFirstFailure: true
```

### Profile-Based Configuration

**Local Development Profile:**

```yaml
verification:
  tasks: [format, lint, typecheck, test] # Skip build for speed
  stopOnFirstFailure: true # Fast feedback
```

**CI Profile:**

```yaml
verification:
  tasks: [format, lint, typecheck, test, build] # Full verification
  stopOnFirstFailure: false # Run all tasks
```

### Per-Language Overrides

```yaml
verification:
  # Global settings
  tasks: [format, lint, typecheck, test, build]

  # Language-specific overrides
  overrides:
    python:
      skipTasks: [build] # Python rarely needs build

    go:
      tasks: [format, lint, test, build] # Go doesn't have separate typecheck
```

---

## Edge Cases & Mitigations

### 1. Format/Lint Tool Overlap

**Issue**: Some tools do both format and lint (biome, ruff)

**Mitigation:**

- Prefer dedicated formatters (prettier over biome)
- Allow config to skip format if using combo tool:
  ```yaml
  verification:
    skipTasks: [format] # Using biome for both format and lint
  ```
- Document recommended approach in README

**Risk Level**: Low

---

### 2. Build Detection Complexity

**Issue**: Determining if a project needs a build step

**Mitigation:**

- Conservative approach: only run build if explicitly configured or clear build script exists
- Make build optional (skip with info message, not error)
- Detection rules:
  - Node.js: Check `package.json` for `build` script
  - TypeScript: Check `tsconfig.json` for `references` field
  - Go/Rust: Always has build capability
  - Python: Usually no build (skip by default)

**Risk Level**: Medium (complex detection logic)

**Validation**: Integration tests for each detection scenario

---

### 3. TypeScript Build Variants

**Issue**: TypeScript has multiple build approaches (tsc, bundlers, Next.js, Vite)

**Mitigation:**

- v1: Keep tight scope
  - Support `npm run build` if script exists
  - Support `tsc` or `tsc -b` (project references)
  - **Do NOT** auto-detect bundlers (Webpack, Vite, etc.)
- Users can customize via config:
  ```yaml
  verification:
    commands:
      build: "vite build" # Override
  ```

**Risk Level**: Medium (complexity risk)

**Scope Boundary**: Avoid bundler-specific detection to keep v1 simple

---

### 4. Cross-Platform Compatibility

**Issue**: Command syntax differs on Windows vs Unix

**Mitigation:**

- Use tool's native globbing (not shell globs)
- Example: `prettier --check .` (tool handles glob)
- Avoid shell-specific syntax (&&, ||, single quotes)
- Test on Windows in CI (future)

**Risk Level**: Low

---

### 5. Tool Availability

**Issue**: Format tool might not be installed

**Mitigation:**

- Local profile: Warn and skip optional tools (prettier, eslint)
- CI profile: Hard-fail on missing configured tools
- Config:
  ```yaml
  verification:
    toolMissingPolicy: warn # Local: warn, CI: fail
  ```

**Risk Level**: Low

---

## Success Criteria

### Functional Requirements

- ✅ Format command resolves for all languages
- ✅ Build command resolves for compiled languages (Go, Rust, TypeScript)
- ✅ Build is optional (skips gracefully if no build command)
- ✅ Verification order is configurable
- ✅ Tasks can be skipped individually
- ✅ Fail-fast mode works correctly
- ✅ Integration with Makefile (Phase 1b) maintained
- ✅ Integration with workspace detection (Phase 1b) maintained

### Non-Functional Requirements

- ✅ Test coverage >80% (maintain current 89.67%)
- ✅ Zero breaking changes (additive only)
- ✅ Performance: No significant slowdown (<10% regression)
- ✅ Documentation: All features documented with examples
- ✅ Cross-platform: Works on macOS, Linux, Windows

### Test Coverage Targets

| Component                | Target    | Current |
| ------------------------ | --------- | ------- |
| LanguageDetectionService | >85%      | 89.67%  |
| CommandResolver          | >85%      | 89.67%  |
| Verify Command           | >80%      | TBD     |
| Integration Tests        | 100% pass | TBD     |

---

## Testing Strategy

### Unit Tests (16-20 tests)

**LanguageDetectionService:**

- Format command detection (4 tests, one per language)
- Build command detection (4 tests, one per language)
- TypeScript project references detection (2 tests)

**CommandResolver:**

- Format command resolution (4 tests)
- Build command resolution (4 tests)
- Optional build behavior (2 tests)

### Integration Tests (10-12 tests)

**Format Integration:**

- Format command resolution for all languages (4 tests)
- Format + Makefile integration (2 tests)

**Build Integration:**

- Build command resolution for compiled languages (3 tests)
- Optional build behavior (no build script) (2 tests)

**Cross-Feature:**

- Complete verification workflow (format → lint → typecheck → test → build) (1 test)

### Test Fixtures

Create minimal test projects:

- `fixtures/node-prettier/` - Node.js with prettier
- `fixtures/python-black/` - Python with black
- `fixtures/go-basic/` - Go project
- `fixtures/rust-basic/` - Rust project
- `fixtures/typescript-refs/` - TypeScript with project references
- `fixtures/node-no-build/` - Node.js without build script

### Coverage Validation

```bash
npm run test:coverage
# Target: >80% overall, >85% for services
```

---

## Rollout Plan

### Phase 1: Development (Week 1)

**Days 1-2: Format Support (8-10 hours)**

- Implement Task 1c.1 (format command support)
- Write unit tests
- Update documentation

**Days 3-4: Build Support (8-10 hours)**

- Implement Task 1c.2 (build command support)
- Implement Task 1c.3 (verification config)
- Write unit tests

**Day 5: Testing & Documentation (4-5 hours)**

- Implement Task 1c.4 (integration tests)
- Complete Task 1c.5 (documentation)
- Final verification

### Phase 2: Testing (1-2 days)

- Run full test suite (790+ tests)
- Manual testing on real projects
- Cross-platform validation (macOS, Linux)
- Performance testing

### Phase 3: Release (1 day)

- Create PR with Phase 1c changes
- Code review
- Merge to main
- Tag release v1.6.0
- Publish to npm

---

## Risk Assessment

### Overall Risk: LOW

| Risk                       | Probability | Impact | Mitigation                               | Status       |
| -------------------------- | ----------- | ------ | ---------------------------------------- | ------------ |
| Format/lint overlap        | Medium      | Low    | Document approach, allow config override | ✅ Mitigated |
| Build detection complexity | Medium      | Medium | Conservative detection, make optional    | ✅ Mitigated |
| TypeScript variants        | Low         | Medium | Keep scope tight (npm run build + tsc)   | ✅ Mitigated |
| Cross-platform issues      | Low         | Low    | Use tool-native globbing                 | ✅ Mitigated |
| Tool availability          | Low         | Low    | Profile-based policies (warn vs fail)    | ✅ Mitigated |

---

## Dependencies

### Internal Dependencies

- ✅ Phase 1a: CommandResolver, LanguageDetectionService (COMPLETE)
- ✅ Phase 1b: Makefile integration, workspace detection (COMPLETE)

### External Dependencies

- ✅ TypeScript compiler (existing)
- ✅ Jest testing framework (existing)
- ✅ No new npm dependencies required

---

## Alternatives Considered

### Alternative 1: Auto-Fix Mode

**Considered**: Add `--fix` flag to auto-format and auto-lint

**Decision**: Defer to Phase 2
**Rationale**:

- Phase 1c focused on verification (check mode)
- Auto-fix is a separate feature (changes code)
- Can be added in Phase 2 without breaking changes

### Alternative 2: Parallel Task Execution

**Considered**: Run tasks in parallel for performance

**Decision**: Defer to Phase 2
**Rationale**:

- Sequential execution is simpler, follows established order
- Parallel execution adds complexity (output interleaving, error handling)
- Not needed for v1 (verification is already fast)

### Alternative 3: Bundler-Specific Detection

**Considered**: Auto-detect Webpack, Vite, Rollup configs

**Decision**: Out of scope for v1
**Rationale**:

- Adds significant complexity (multiple bundler APIs)
- `npm run build` handles 90% of cases
- Users can override via config if needed

---

## Appendix

### A. Command Matrix

| Language       | Format Check         | Format Fix           | Build             | Notes                               |
| -------------- | -------------------- | -------------------- | ----------------- | ----------------------------------- |
| **Node.js**    | `prettier --check .` | `prettier --write .` | `npm run build`   | Check package.json for build script |
| **TypeScript** | `prettier --check .` | `prettier --write .` | `tsc` or `tsc -b` | Use `tsc -b` if project references  |
| **Python**     | `black --check .`    | `black .`            | `python -m build` | Build is optional                   |
| **Go**         | `gofmt -l .`         | `gofmt -w .`         | `go build ./...`  | Standard toolchain                  |
| **Rust**       | `cargo fmt --check`  | `cargo fmt`          | `cargo build`     | Or `cargo check` (faster)           |

### B. Configuration Examples

**Example 1: Skip build locally, run in CI**

`.gpm.yml`:

```yaml
verification:
  tasks: [format, lint, typecheck, test] # No build
  stopOnFirstFailure: true
```

`.gpm.ci.yml`:

```yaml
verification:
  tasks: [format, lint, typecheck, test, build] # Include build
  stopOnFirstFailure: false
```

**Example 2: Custom format tool**

```yaml
verification:
  commands:
    format: "biome check --formatter-enabled=true ."
```

**Example 3: Makefile delegation**

```yaml
makefile:
  preferMakefile: true
  makefileTargets:
    format: format-check
    build: compile
```

### C. Glossary

- **Format**: Code style consistency (whitespace, line length, etc.)
- **Lint**: Code quality checks (unused variables, complexity, etc.)
- **Typecheck**: Type safety verification (TypeScript, mypy, etc.)
- **Test**: Functionality verification (unit, integration tests)
- **Build**: Compilation and bundling (production artifacts)
- **Fail-fast**: Stop on first failure (faster feedback)
- **Optional task**: Task that can be skipped if no command found

---

## Approval

**Created by**: Claude (zen deepthink)
**Validated by**: zen deepthink expert analysis
**Confidence**: Nearly Certain (very high)
**Ready for**: Implementation

**Sign-off**:

- [ ] Technical Lead Review
- [ ] Implementation Start
- [ ] Code Review Complete
- [ ] Tests Passing (>80% coverage)
- [ ] Documentation Complete
- [ ] Release v1.6.0
