/**
 * Tests for Phase 1b Integration
 *
 * Phase 1b: Advanced Features - Install Support + Makefile Enhancements + Workspace Detection
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { LanguageDetectionService } from '../../src/services/LanguageDetectionService';
import { CommandResolver } from '../../src/services/CommandResolver';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

// Mock file system
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

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('Phase 1b: Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 1b.1: Install Step Integration', () => {
    it('should resolve install command for npm when lock file exists', async () => {
      // Setup: Node.js project with package-lock.json
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Mock package manager detection
      jest.spyOn(languageDetector, 'detectPackageManager').mockResolvedValue({
        packageManager: 'npm',
        lockFile: '/test/project/package-lock.json',
        confidence: 95
      });

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        install: ['npm ci'],
        lint: ['npm run lint'],
        test: ['npm test'],
        typecheck: ['npm run typecheck'],
        build: ['npm run build']
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Execute: resolve install command
      const result = await resolver.resolve({
        task: 'install',
        language: 'nodejs',
        packageManager: 'npm'
      });

      // Verify: install command resolved correctly
      expect(result.command).toBe('npm ci');
      expect(result.source).toBe('package-manager');
      expect(result.packageManager).toBe('npm');
    });

    it('should resolve install command for different package managers', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Test pnpm
      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        install: ['pnpm install --frozen-lockfile'],
        lint: [],
        test: [],
        typecheck: [],
        build: []
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const pnpmResult = await resolver.resolve({
        task: 'install',
        language: 'nodejs',
        packageManager: 'pnpm'
      });

      expect(pnpmResult.command).toBe('pnpm install --frozen-lockfile');

      // Test yarn
      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        install: ['yarn install --frozen-lockfile'],
        lint: [],
        test: [],
        typecheck: [],
        build: []
      });

      const yarnResult = await resolver.resolve({
        task: 'install',
        language: 'nodejs',
        packageManager: 'yarn'
      });

      expect(yarnResult.command).toBe('yarn install --frozen-lockfile');
    });

    it('should resolve Python install commands', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Test poetry
      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        install: ['poetry install'],
        lint: ['poetry run ruff check .'],
        test: ['poetry run pytest'],
        typecheck: ['poetry run mypy .'],
        build: []
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const result = await resolver.resolve({
        task: 'install',
        language: 'python',
        packageManager: 'poetry'
      });

      expect(result.command).toBe('poetry install');
      expect(result.packageManager).toBe('poetry');
    });
  });

  describe('Task 1b.2: Makefile Enhancements Integration', () => {
    it('should use Makefile custom target mapping', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Mock Makefile detection
      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['check', 'verify', 'build']);
      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        lint: ['make lint', 'ruff check .'],
        test: ['make test', 'pytest'],
        typecheck: ['make typecheck', 'mypy .'],
        build: ['make build'],
        install: []
      });

      // Config with custom Makefile target mapping
      const config = {
        makefileTargets: {
          lint: 'check'  // Map 'lint' task to 'check' target
        }
      };

      const result = await resolver.resolve({
        task: 'lint',
        language: 'python',
        config,
        makefileTargets: ['check', 'verify', 'build']
      });

      // Verify: custom mapping used
      expect(result.command).toBe('make check');
      expect(result.source).toBe('makefile');
    });

    it('should use Makefile aliases for similar targets', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        lint: ['make lint', 'eslint .'],
        test: ['make test', 'jest'],
        typecheck: [],
        build: [],
        install: []
      });

      // Config with Makefile aliases (check → test)
      const config = {
        preferMakefile: true,
        makefileAliases: {
          check: 'test' as const,  // 'check' target maps to 'test' task
          verify: 'lint' as const  // 'verify' target maps to 'lint' task
        }
      };

      // Test: resolve 'test' task when Makefile has 'check' target
      const testResult = await resolver.resolve({
        task: 'test',
        language: 'nodejs',
        config,
        makefileTargets: ['check', 'verify', 'build']
      });

      expect(testResult.command).toBe('make check');
      expect(testResult.source).toBe('makefile');

      // Test: resolve 'lint' task when Makefile has 'verify' target
      const lintResult = await resolver.resolve({
        task: 'lint',
        language: 'nodejs',
        config,
        makefileTargets: ['check', 'verify', 'build']
      });

      expect(lintResult.command).toBe('make verify');
      expect(lintResult.source).toBe('makefile');
    });

    it('should fall back to native tools when Makefile target not found', async () => {
      const workingDir = '/test/project';
      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        lint: ['make lint', 'ruff check .'],
        test: ['pytest'],
        typecheck: [],
        build: [],
        install: []
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      const config = {
        preferMakefile: true
      };

      // Makefile exists but doesn't have 'lint' target
      const result = await resolver.resolve({
        task: 'lint',
        language: 'python',
        config,
        makefileTargets: ['test', 'build']  // No 'lint' target
      });

      // Verify: fell back to native tool (ruff)
      expect(result.command).toBe('ruff check .');
      expect(result.source).toBe('native');
    });
  });

  describe('Task 1b.3: Workspace Detection Integration', () => {
    it('should detect npm workspace and display workspace root', async () => {
      // Setup: npm workspace (package.json with workspaces field)
      const workingDir = path.normalize('/test/workspace/packages/app');
      const workspaceRoot = path.normalize('/test/workspace');

      const languageDetector = new LanguageDetectionService(workingDir);

      // Mock file system for workspace detection
      mockedFs.readFile.mockImplementation(async (filePath: any) => {
        const pathStr = filePath.toString();
        if (pathStr === path.join(workspaceRoot, 'package.json')) {
          return JSON.stringify({
            name: 'my-workspace',
            workspaces: ['packages/*']
          }) as any;
        }
        throw new Error('File not found');
      });

      mockedExistsSync.mockReturnValue(false);

      // Execute: detect workspace
      const detectedRoot = await languageDetector.detectWorkspaceRoot();

      // Verify: workspace root detected
      expect(detectedRoot).toBe(workspaceRoot);
    });

    it('should detect Yarn workspace from .yarnrc.yml', async () => {
      const workingDir = path.normalize('/test/workspace/packages/app');
      const workspaceRoot = path.normalize('/test/workspace');

      const languageDetector = new LanguageDetectionService(workingDir);

      // Mock file system for Yarn workspace - need to simulate directory traversal
      mockedExistsSync.mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        // .yarnrc.yml exists at workspace root
        if (pathStr === path.join(workspaceRoot, '.yarnrc.yml')) {
          return true;
        }
        // package.json exists at workspace root
        if (pathStr === path.join(workspaceRoot, 'package.json')) {
          return true;
        }
        return false;
      });

      // Execute: detect workspace
      const detectedRoot = await languageDetector.detectWorkspaceRoot();

      // Verify: workspace root detected
      expect(detectedRoot).toBe(workspaceRoot);
    });

    it('should detect pnpm workspace from pnpm-workspace.yaml', async () => {
      const workingDir = path.normalize('/test/workspace/packages/app');
      const workspaceRoot = path.normalize('/test/workspace');

      const languageDetector = new LanguageDetectionService(workingDir);

      // Mock file system for pnpm workspace - need to simulate directory traversal
      mockedExistsSync.mockImplementation((filePath: any) => {
        const pathStr = filePath.toString();
        // pnpm-workspace.yaml exists at workspace root
        if (pathStr === path.join(workspaceRoot, 'pnpm-workspace.yaml')) {
          return true;
        }
        // package.json exists at workspace root
        if (pathStr === path.join(workspaceRoot, 'package.json')) {
          return true;
        }
        return false;
      });

      // Execute: detect workspace
      const detectedRoot = await languageDetector.detectWorkspaceRoot();

      // Verify: workspace root detected
      expect(detectedRoot).toBe(workspaceRoot);
    });

    it('should show workspace root in detection summary', async () => {
      const workingDir = '/test/workspace/packages/app';
      const workspaceRoot = '/test/workspace';

      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Mock workspace detection
      jest.spyOn(languageDetector, 'detectWorkspaceRoot').mockResolvedValue(workspaceRoot);
      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['lint', 'test', 'build']);

      // Execute: get detection summary
      const summary = await resolver.getDetectionSummary('nodejs', 'npm');

      // Verify: summary includes workspace root
      expect(summary).toContain('Workspace Root');
      expect(summary).toContain(workspaceRoot);
    });

    it('should not show workspace root when not in a workspace', async () => {
      const workingDir = '/test/simple-project';

      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Mock no workspace detected
      jest.spyOn(languageDetector, 'detectWorkspaceRoot').mockResolvedValue(null);
      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['lint', 'test']);

      // Execute: get detection summary
      const summary = await resolver.getDetectionSummary('nodejs', 'npm');

      // Verify: summary does NOT include workspace root
      expect(summary).not.toContain('Workspace Root');
    });

    it('should handle workspace detection errors gracefully', async () => {
      const workingDir = '/test/workspace/packages/app';

      const languageDetector = new LanguageDetectionService(workingDir);

      // Mock file system errors
      mockedFs.readFile.mockRejectedValue(new Error('Permission denied'));
      mockedExistsSync.mockReturnValue(false);

      // Execute: detect workspace (should return null on error)
      const detectedRoot = await languageDetector.detectWorkspaceRoot();

      // Verify: gracefully returns null
      expect(detectedRoot).toBeNull();
    });
  });

  describe('Phase 1b: Cross-Feature Integration', () => {
    it('should combine install step, Makefile aliases, and workspace detection', async () => {
      // Setup: Workspace project with custom Makefile aliases
      const workingDir = '/test/workspace/packages/app';
      const workspaceRoot = '/test/workspace';

      const resolver = new CommandResolver(workingDir);
      const languageDetector = (resolver as any).languageDetector;

      // Mock workspace detection
      jest.spyOn(languageDetector, 'detectWorkspaceRoot').mockResolvedValue(workspaceRoot);

      // Mock Makefile targets
      jest.spyOn(languageDetector, 'getMakefileTargets').mockResolvedValue(['check', 'install-deps', 'build']);

      // Mock tool commands
      jest.spyOn(languageDetector, 'getToolCommands').mockResolvedValue({
        install: ['npm ci'],
        lint: ['npm run lint'],
        test: ['npm test'],
        typecheck: [],
        build: []
      });

      jest.spyOn(languageDetector, 'checkToolAvailable').mockResolvedValue(true);

      // Config with Makefile aliases and custom install target
      const config = {
        preferMakefile: true,
        makefileAliases: {
          check: 'lint' as const,
          'install-deps': 'install' as const
        }
      };

      // Test 1: Install command uses Makefile alias
      const installResult = await resolver.resolve({
        task: 'install',
        language: 'nodejs',
        packageManager: 'npm',
        config,
        makefileTargets: ['check', 'install-deps', 'build']
      });

      expect(installResult.command).toBe('make install-deps');
      expect(installResult.source).toBe('makefile');

      // Test 2: Lint command uses Makefile alias
      const lintResult = await resolver.resolve({
        task: 'lint',
        language: 'nodejs',
        packageManager: 'npm',
        config,
        makefileTargets: ['check', 'install-deps', 'build']
      });

      expect(lintResult.command).toBe('make check');
      expect(lintResult.source).toBe('makefile');

      // Test 3: Detection summary includes workspace info
      const summary = await resolver.getDetectionSummary('nodejs', 'npm');

      expect(summary).toContain('Workspace Root');
      expect(summary).toContain(workspaceRoot);
      expect(summary).toContain('Makefile Targets');
      expect(summary).toContain('check');
    });
  });
});
