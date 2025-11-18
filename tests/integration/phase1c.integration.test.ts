/**
 * Tests for Phase 1c Integration
 *
 * Phase 1c: Format & Build Support + Verification Order Configuration
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { CommandResolver } from '../../src/services/CommandResolver';

// Mock file system (not used in Phase 1c tests, but required for mocking)
jest.mock('fs/promises');
jest.mock('fs');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    blank: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    divider: jest.fn(),
    section: jest.fn(),
    outputJsonResult: jest.fn(),
    isJsonMode: jest.fn().mockReturnValue(false)
  }
}));

// Mock spinner
jest.mock('../../src/utils/spinner', () => ({
  createSpinner: jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis()
  })),
  spinner: {
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis()
  }
}));

describe('Phase 1c: Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 1c.1: Format Command Integration', () => {
    it('should resolve format command for Python (black check mode)', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Mock Python project with poetry
      jest.spyOn(languageDetector, 'detectPackageManager').mockResolvedValue({
        packageManager: 'poetry',
        lockFile: '/test/project/poetry.lock',
        confidence: 95
      });

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['black --check .', 'ruff format --check .', 'autopep8 --diff --recursive .'],
        lint: ['poetry run ruff check .'],
        test: ['poetry run pytest'],
        typecheck: ['poetry run mypy .'],
        build: [],
        install: ['poetry install']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Execute: resolve format command
      const result = await resolver.resolve({
        task: 'format',
        language: 'python',
        packageManager: 'poetry'
      });

      // Verify: format command in check mode (not fix mode)
      expect(result.command).toBe('black --check .');
      expect(result.source).toBe('package-manager'); // poetry adapts the command
      expect(result.command).toContain('--check'); // Ensure check mode, not fix mode
    });

    it('should resolve format command for Node.js (prettier check mode)', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['prettier --check .', 'biome check --formatter-enabled=true .', 'npx prettier --check .'],
        lint: ['npm run lint'],
        test: ['npm test'],
        typecheck: ['npm run typecheck'],
        build: ['npm run build'],
        install: ['npm ci']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const result = await resolver.resolve({
        task: 'format',
        language: 'nodejs',
        packageManager: 'npm'
      });

      // Verify: prettier check mode (not --write)
      expect(result.command).toBe('prettier --check .');
      expect(result.command).toContain('--check');
      expect(result.command).not.toContain('--write'); // Not in fix mode
    });

    it('should resolve format command for Go (gofmt list mode)', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['gofmt -l .', 'goimports -l .'],
        lint: ['golangci-lint run'],
        test: ['go test ./...'],
        typecheck: [],
        build: ['go build ./...'],
        install: ['go mod download']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const result = await resolver.resolve({
        task: 'format',
        language: 'go',
        packageManager: 'go-mod'
      });

      // Verify: gofmt -l (list mode, not -w write mode)
      expect(result.command).toBe('gofmt -l .');
      expect(result.command).toContain('-l'); // List mode
      expect(result.command).not.toContain('-w'); // Not write mode
    });

    it('should resolve format command for Rust (cargo fmt check mode)', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['cargo fmt --check'],
        lint: ['cargo clippy'],
        test: ['cargo test'],
        typecheck: [],
        build: ['cargo build'],
        install: ['cargo fetch']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const result = await resolver.resolve({
        task: 'format',
        language: 'rust',
        packageManager: 'cargo'
      });

      // Verify: cargo fmt --check (not cargo fmt which modifies files)
      expect(result.command).toBe('cargo fmt --check');
      expect(result.command).toContain('--check');
    });

    it('should prefer Makefile format target over native tools', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['format', 'lint', 'test']);
      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['make format', 'black --check .'],
        lint: ['make lint'],
        test: ['make test'],
        typecheck: [],
        build: [],
        install: []
      });

      const config = {
        preferMakefile: true
      };

      const result = await resolver.resolve({
        task: 'format',
        language: 'python',
        config,
        makefileTargets: ['format', 'lint', 'test']
      });

      // Verify: Makefile target used
      expect(result.command).toBe('make format');
      expect(result.source).toBe('makefile');
    });
  });

  describe('Task 1c.2: Build Command Integration', () => {
    it('should resolve build command for Node.js projects', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['prettier --check .'],
        lint: ['npm run lint'],
        test: ['npm test'],
        typecheck: ['npm run typecheck'],
        build: ['npm run build', 'npx tsc'],
        install: ['npm ci']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const result = await resolver.resolve({
        task: 'build',
        language: 'nodejs',
        packageManager: 'npm'
      });

      // Verify: build command resolved
      expect(result.command).toBe('npm run build');
      expect(result.source).toBe('package-manager');
      expect(result.optional).toBeUndefined(); // Not marked as optional when command exists
    });

    it('should mark build as optional when no build command exists', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['black --check .'],
        lint: ['ruff check .'],
        test: ['pytest'],
        typecheck: ['mypy .'],
        build: [], // No build commands
        install: ['pip install -r requirements.txt']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(false); // No build tool available

      const result = await resolver.resolve({
        task: 'build',
        language: 'python',
        packageManager: 'pip'
      });

      // Verify: build marked as optional when not found
      expect(result.command).toBe('');
      expect(result.source).toBe('not-found');
      expect(result.optional).toBe(true); // Build is optional
    });

    it('should resolve build command for Go projects', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['gofmt -l .'],
        lint: ['golangci-lint run'],
        test: ['go test ./...'],
        typecheck: [],
        build: ['make build', 'go build', 'go build ./...'],
        install: ['go mod download']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const result = await resolver.resolve({
        task: 'build',
        language: 'go',
        packageManager: 'go-mod'
      });

      // Verify: build command resolved
      expect(result.command).toBe('go build');
      expect(result.source).toBe('package-manager'); // go-mod adapts the command
    });

    it('should resolve build command for Rust projects', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['cargo fmt --check'],
        lint: ['cargo clippy'],
        test: ['cargo test'],
        typecheck: [],
        build: ['make build', 'cargo build'],
        install: ['cargo fetch']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const result = await resolver.resolve({
        task: 'build',
        language: 'rust',
        packageManager: 'cargo'
      });

      // Verify: cargo build resolved
      expect(result.command).toBe('cargo build');
      expect(result.source).toBe('package-manager'); // cargo adapts the command
    });

    it('should prefer Makefile build target over native tools', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['build', 'test', 'lint']);
      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: [],
        lint: ['make lint'],
        test: ['make test'],
        typecheck: [],
        build: ['make build', 'go build'],
        install: []
      });

      const config = {
        preferMakefile: true
      };

      const result = await resolver.resolve({
        task: 'build',
        language: 'go',
        config,
        makefileTargets: ['build', 'test', 'lint']
      });

      // Verify: Makefile build target used
      expect(result.command).toBe('make build');
      expect(result.source).toBe('makefile');
    });
  });

  describe('Task 1c.3: Verification Order Configuration', () => {
    it('should use default task order when no config provided', async () => {
      // Default order: format → lint → typecheck → test → build
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['prettier --check .'],
        lint: ['eslint .'],
        test: ['jest'],
        typecheck: ['tsc --noEmit'],
        build: ['tsc'],
        install: ['npm ci']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Verify each task can be resolved in default order
      const tasks = ['format', 'lint', 'typecheck', 'test', 'build'];
      const results = [];

      for (const task of tasks) {
        const result = await resolver.resolve({
          task: task as any,
          language: 'nodejs',
          packageManager: 'npm'
        });
        results.push({ task, command: result.command, source: result.source });
      }

      // Verify all tasks resolved successfully
      expect(results).toHaveLength(5);
      expect(results[0].task).toBe('format');
      expect(results[1].task).toBe('lint');
      expect(results[2].task).toBe('typecheck');
      expect(results[3].task).toBe('test');
      expect(results[4].task).toBe('build');
    });

    it('should use custom task order from config', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['black --check .'],
        lint: ['ruff check .'],
        test: ['pytest'],
        typecheck: ['mypy .'],
        build: [],
        install: ['poetry install']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Custom order: lint → typecheck → format → test
      const config = {
        tasks: ['lint', 'typecheck', 'format', 'test'] as ('lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install')[]
      };

      // Verify tasks can be resolved in custom order
      const tasks = config.tasks;
      const results = [];

      for (const task of tasks) {
        const result = await resolver.resolve({
          task: task as any,
          language: 'python',
          packageManager: 'poetry',
          config
        });
        results.push({ task, command: result.command });
      }

      // Verify custom order respected
      expect(results[0].task).toBe('lint');
      expect(results[1].task).toBe('typecheck');
      expect(results[2].task).toBe('format');
      expect(results[3].task).toBe('test');
    });

    it('should skip tasks from config skipTasks list', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['prettier --check .'],
        lint: ['eslint .'],
        test: ['jest'],
        typecheck: ['tsc --noEmit'],
        build: ['tsc'],
        install: ['npm ci']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Config with skip tasks
      const config = {
        skipTasks: ['format', 'build'] as ('lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install')[]
      };

      // Verify: format and build can still be resolved (verify command handles skipping)
      const formatResult = await resolver.resolve({
        task: 'format',
        language: 'nodejs',
        packageManager: 'npm',
        config
      });

      const buildResult = await resolver.resolve({
        task: 'build',
        language: 'nodejs',
        packageManager: 'npm',
        config
      });

      // Commands still resolve (verify command will skip them)
      expect(formatResult.command).toBe('prettier --check .');
      expect(buildResult.command).toBe('tsc');
    });

    it('should support stopOnFirstFailure configuration', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['black --check .'],
        lint: ['ruff check .'],
        test: ['pytest'],
        typecheck: ['mypy .'],
        build: [],
        install: ['poetry install']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Config with fail-fast disabled
      const config = {
        stopOnFirstFailure: false
      };

      // All commands should still resolve regardless of fail-fast setting
      const lintResult = await resolver.resolve({
        task: 'lint',
        language: 'python',
        packageManager: 'poetry',
        config
      });

      const testResult = await resolver.resolve({
        task: 'test',
        language: 'python',
        packageManager: 'poetry',
        config
      });

      expect(lintResult.command).toBe('ruff check .');
      expect(testResult.command).toBe('pytest');
    });
  });

  describe('Phase 1c: Cross-Feature Integration', () => {
    it('should combine format, build, and custom task ordering', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Mock Makefile with custom targets
      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['check-format', 'build-all', 'test', 'lint']);

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['make format', 'prettier --check .'],
        lint: ['make lint', 'eslint .'],
        test: ['make test', 'jest'],
        typecheck: ['tsc --noEmit'],
        build: ['make build', 'tsc'],
        install: ['npm ci']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Config with custom task order and Makefile aliases
      const config = {
        preferMakefile: true,
        tasks: ['format', 'lint', 'test', 'build'] as ('lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install')[], // Custom order (no typecheck)
        makefileAliases: {
          'check-format': 'format' as ('lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install'),
          'build-all': 'build' as ('lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install')
        }
      };

      // Test 1: Format uses Makefile alias
      const formatResult = await resolver.resolve({
        task: 'format',
        language: 'nodejs',
        packageManager: 'npm',
        config,
        makefileTargets: ['check-format', 'build-all', 'test', 'lint']
      });

      expect(formatResult.command).toBe('make check-format');
      expect(formatResult.source).toBe('makefile');

      // Test 2: Build uses Makefile alias
      const buildResult = await resolver.resolve({
        task: 'build',
        language: 'nodejs',
        packageManager: 'npm',
        config,
        makefileTargets: ['check-format', 'build-all', 'test', 'lint']
      });

      expect(buildResult.command).toBe('make build-all');
      expect(buildResult.source).toBe('makefile');

      // Test 3: Lint uses standard Makefile target
      const lintResult = await resolver.resolve({
        task: 'lint',
        language: 'nodejs',
        packageManager: 'npm',
        config,
        makefileTargets: ['check-format', 'build-all', 'test', 'lint']
      });

      expect(lintResult.command).toBe('make lint');
      expect(lintResult.source).toBe('makefile');
    });

    it('should handle Python project with format check + optional build', async () => {
      const workingDir = '/test/python-project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['poetry run black --check .', 'black --check .', 'ruff format --check .'],
        lint: ['poetry run ruff check .'],
        test: ['poetry run pytest'],
        typecheck: ['poetry run mypy .'],
        build: [], // Python typically has no build step
        install: ['poetry install']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockImplementation(async (...args: unknown[]) => {
        const tool = args[0] as string;
        return tool !== 'nonexistent-build-tool'; // All tools available except build
      });

      const config = {
        tasks: ['format', 'lint', 'typecheck', 'test', 'build'] as ('lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install')[]
      };

      // Test 1: Format resolves correctly
      const formatResult = await resolver.resolve({
        task: 'format',
        language: 'python',
        packageManager: 'poetry',
        config
      });

      expect(formatResult.command).toContain('black --check .');

      // Test 2: Build is optional (no build command)
      const buildResult = await resolver.resolve({
        task: 'build',
        language: 'python',
        packageManager: 'poetry',
        config
      });

      expect(buildResult.source).toBe('not-found');
      expect(buildResult.optional).toBe(true);
    });

    it('should handle Go project with format check + build', async () => {
      const workingDir = '/test/go-project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['format', 'build', 'test', 'lint']);

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        format: ['make format', 'gofmt -l .', 'goimports -l .'],
        lint: ['make lint', 'golangci-lint run'],
        test: ['make test', 'go test ./...'],
        typecheck: [],
        build: ['make build', 'go build', 'go build ./...'],
        install: ['go mod download']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const config = {
        preferMakefile: true,
        tasks: ['format', 'lint', 'build', 'test'] as ('lint' | 'test' | 'typecheck' | 'format' | 'build' | 'install')[] // Custom order
      };

      // Test 1: Format uses Makefile
      const formatResult = await resolver.resolve({
        task: 'format',
        language: 'go',
        packageManager: 'go-mod',
        config,
        makefileTargets: ['format', 'build', 'test', 'lint']
      });

      expect(formatResult.command).toBe('make format');
      expect(formatResult.source).toBe('makefile');

      // Test 2: Build uses Makefile
      const buildResult = await resolver.resolve({
        task: 'build',
        language: 'go',
        packageManager: 'go-mod',
        config,
        makefileTargets: ['format', 'build', 'test', 'lint']
      });

      expect(buildResult.command).toBe('make build');
      expect(buildResult.source).toBe('makefile');
    });
  });
});
