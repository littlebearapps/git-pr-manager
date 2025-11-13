# Testing Guidelines & Quick Reference

**Last Updated**: 2025-11-13

---

## Quick Stats

- **Total Tests**: 535 (512 unit + 23 update-check)
- **Coverage**: 89.67% statements, 82.82% branches, 95.11% functions, 89.61% lines
- **Target**: 80% (all metrics) - ✅ EXCEEDED
- **Status**: All passing

**See**: @docs/TESTS.md for comprehensive test documentation and detailed coverage breakdown

---

## Running Tests

### All Tests
```bash
npm test                       # Run all 535 tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage report
```

### Specific Test Suites
```bash
# By category
npm test -- tests/services/    # Service tests
npm test -- tests/commands/    # Command tests
npm test -- tests/utils/       # Utility tests

# Specific files
npm test -- tests/services/GitHubService.test.ts
npm test -- tests/utils/update-check.test.ts
npm test -- tests/commands/auto.test.ts
```

### Coverage Reports
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

---

## Test Structure

### Standard Test Pattern
```typescript
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('ServiceName', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange - Setup test data and mocks
      const mockFn = jest.fn().mockResolvedValue(data);

      // Act - Execute the code under test
      const result = await service.method();

      // Assert - Verify results
      expect(result).toBe(expected);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(expectedArgs);
    });

    it('should handle error case', async () => {
      // Arrange
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));

      // Act & Assert
      await expect(service.method()).rejects.toThrow('Test error');
    });
  });
});
```

---

## Mocking Patterns

### Service Mocking (Octokit)
```typescript
jest.mock('@octokit/rest');
const mockOctokit = {
  pulls: {
    create: jest.fn(),
    get: jest.fn(),
    merge: jest.fn(),
  },
  repos: {
    get: jest.fn(),
  },
  checks: {
    listForRef: jest.fn(),
  },
} as any;
```

### External Module Mocking
```typescript
// Mock package-json (ESM module)
const mockPackageJson = jest.fn();
jest.mock('package-json', () => mockPackageJson);

// Then in tests
mockPackageJson.mockResolvedValue({ version: '2.0.0' });
```

### File System Mocking
```typescript
jest.mock('fs/promises');
const mockFs = require('fs/promises');

mockFs.readFile.mockResolvedValue('file content');
mockFs.writeFile.mockResolvedValue(undefined);
```

---

## Common Test Scenarios

### Testing Async Functions
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

### Testing Promises
```typescript
it('should resolve promise', async () => {
  await expect(promiseFunction()).resolves.toBe(value);
});

it('should reject promise', async () => {
  await expect(promiseFunction()).rejects.toThrow('Error');
});
```

### Testing Error Handling
```typescript
it('should throw WorkflowError', () => {
  expect(() => functionThatThrows()).toThrow(WorkflowError);
  expect(() => functionThatThrows()).toThrow('Error message');
});

it('should handle async errors', async () => {
  await expect(asyncFunction()).rejects.toThrow(WorkflowError);
});
```

### Testing Callbacks
```typescript
it('should call callback', () => {
  const callback = jest.fn();
  functionWithCallback(callback);
  expect(callback).toHaveBeenCalledWith(expectedArgs);
});
```

---

## Coverage Requirements

### Thresholds (jest.config.js)
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

### Current Coverage by Category
| Category | Coverage | Status |
|----------|----------|--------|
| Overall | 89.67% | ✅ Excellent |
| Services | 88.30% | ✅ Excellent |
| Utils | 93.19% | ✅ Excellent |
| Types | 100% | ✅ Perfect |

---

## Test Organization

### Directory Structure
```
tests/
├── commands/              # Command tests (1:1 with src/commands/)
│   ├── auto.test.ts
│   ├── checks.test.ts
│   ├── check-update.test.ts
│   ├── feature.test.ts
│   ├── init.test.ts
│   ├── protect.test.ts
│   ├── security.test.ts
│   ├── ship.test.ts
│   └── status.test.ts
│
├── services/              # Service tests (1:1 with src/services/)
│   ├── CIService.test.ts
│   ├── GitHubService.test.ts
│   └── GitService.test.ts
│
└── utils/                 # Utility tests (1:1 with src/utils/)
    ├── cache.test.ts
    ├── config.test.ts
    ├── error.test.ts
    ├── logger.test.ts
    ├── spinner.test.ts
    └── update-check.test.ts
```

---

## Testing Best Practices

### ✅ Do
- **Test behavior, not implementation**: Focus on what, not how
- **One assertion per test**: Keep tests focused
- **Clear test names**: `should <expected behavior> when <condition>`
- **Arrange-Act-Assert**: Structure tests clearly
- **Mock external dependencies**: Tests shouldn't hit real APIs
- **Test edge cases**: null, undefined, empty arrays, errors
- **Maintain coverage**: >80% for all metrics

### ❌ Don't
- **Test private methods**: Test public interface only
- **Share state between tests**: Use beforeEach for setup
- **Skip cleanup**: Use afterEach to restore mocks
- **Ignore coverage**: Check reports regularly
- **Write flaky tests**: Tests should be deterministic
- **Test implementation details**: Focus on contract, not internals

---

## Common Testing Utilities

### Jest Matchers
```typescript
// Equality
expect(value).toBe(expected);           // ===
expect(value).toEqual(expected);        // Deep equality
expect(value).toStrictEqual(expected);  // Strict deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3, 1);  // Floating point

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toMatchObject({ key: value });

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(ErrorClass);
expect(() => fn()).toThrow('message');

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();

// Mocks
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenLastCalledWith(arg);
```

---

## Debugging Tests

### Run Specific Test
```bash
# Single file
npm test -- tests/utils/update-check.test.ts

# Single describe block
npm test -- tests/utils/update-check.test.ts -t "checkForUpdate"

# Single test
npm test -- tests/utils/update-check.test.ts -t "should detect update available"
```

### Verbose Output
```bash
npm test -- --verbose
npm test -- tests/utils/update-check.test.ts --verbose
```

### Debug Mode
```bash
# Node debugger
node --inspect-brk node_modules/.bin/jest tests/utils/update-check.test.ts

# VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Clear Cache
```bash
npx jest --clearCache
npm test
```

---

## Adding New Tests

### 1. Create Test File
```bash
# Match source file structure
src/utils/my-util.ts → tests/utils/my-util.test.ts
```

### 2. Write Test
```typescript
import { describe, it, expect } from '@jest/globals';
import { myUtil } from '../../src/utils/my-util';

describe('myUtil', () => {
  it('should do something', () => {
    const result = myUtil('input');
    expect(result).toBe('expected');
  });
});
```

### 3. Run Test
```bash
npm test -- tests/utils/my-util.test.ts
```

### 4. Check Coverage
```bash
npm run test:coverage
# Ensure new file has >80% coverage
```

### 5. Update TESTS.md
```bash
# Document new test suite in docs/TESTS.md
# Update coverage metrics
# Add to appropriate priority section
```

---

## Test Maintenance

### Regular Tasks
- **Run full suite**: `npm test` before every commit
- **Check coverage**: `npm run test:coverage` weekly
- **Update snapshots**: `npm test -- -u` when UI changes
- **Refactor tests**: Keep tests clean and maintainable
- **Document changes**: Update TESTS.md when adding test categories

### Before Release
- ✅ All tests pass: `npm test`
- ✅ Coverage >80%: `npm run test:coverage`
- ✅ No skipped tests: Remove `.skip()` or `xit()`
- ✅ No focused tests: Remove `.only()` or `fit()`
- ✅ TESTS.md updated: Current coverage metrics

---

## Integration Tests

### Purpose
- Test multiple components working together
- Verify end-to-end workflows
- Validate error handling across layers

### Example
```typescript
describe('Auto Workflow Integration', () => {
  it('should complete full workflow', async () => {
    // Setup all mocks
    mockGit.status.mockResolvedValue({ current: 'feature/test' });
    mockGithub.createPR.mockResolvedValue({ number: 123 });
    mockCI.waitForChecks.mockResolvedValue({ status: 'success' });

    // Execute workflow
    await autoCommand({ json: false });

    // Verify all steps executed
    expect(mockGit.status).toHaveBeenCalled();
    expect(mockGithub.createPR).toHaveBeenCalled();
    expect(mockCI.waitForChecks).toHaveBeenCalled();
  });
});
```

---

## Performance Testing

### Timing Tests
```typescript
it('should complete within time limit', async () => {
  const start = Date.now();
  await performanceIntensiveOperation();
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(1000); // <1 second
});
```

### Memory Testing
```typescript
it('should not leak memory', async () => {
  const initialMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < 1000; i++) {
    await operation();
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const increase = finalMemory - initialMemory;

  expect(increase).toBeLessThan(10 * 1024 * 1024); // <10MB
});
```

---

## Resources

- **Comprehensive Test Docs**: `docs/TESTS.md` - Full test documentation
- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Coverage Reports**: `coverage/lcov-report/index.html` (after `npm run test:coverage`)
- **Test Standards**: This file - Quick reference for common patterns
