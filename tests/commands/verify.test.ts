/**
 * Integration tests for verify command with multi-language support
 * Phase 1a: Tests language detection, package manager detection, and command resolution
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { verifyCommand } from '../../src/commands/verify';
import { LanguageDetectionService } from '../../src/services/LanguageDetectionService';
import { CommandResolver } from '../../src/services/CommandResolver';
import { ConfigService } from '../../src/services/ConfigService';
import { logger } from '../../src/utils/logger';
import * as childProcess from 'child_process';

// Mock dependencies
jest.mock('../../src/services/LanguageDetectionService');
jest.mock('../../src/services/CommandResolver');
jest.mock('../../src/services/ConfigService');
jest.mock('../../src/utils/logger');
jest.mock('child_process');

// Mock spinner to avoid ora ESM issues
jest.mock('../../src/utils/spinner', () => ({
  spinner: {
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn()
  },
  createSpinner: jest.fn(() => ({
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn()
  }))
}));

const MockedLanguageDetectionService = LanguageDetectionService as jest.MockedClass<typeof LanguageDetectionService>;
const MockedCommandResolver = CommandResolver as jest.MockedClass<typeof CommandResolver>;
const MockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;
const mockedExec = childProcess.exec as jest.MockedFunction<typeof childProcess.exec>;

describe('verify command - multi-language integration', () => {
  let mockLanguageDetector: jest.Mocked<LanguageDetectionService>;
  let mockCommandResolver: jest.Mocked<CommandResolver>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.log to capture JSON output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock instances
    mockLanguageDetector = {
      detectLanguage: jest.fn(),
      detectPackageManager: jest.fn(),
      getMakefileTargets: jest.fn(),
    } as any;

    mockCommandResolver = {
      resolve: jest.fn(),
    } as any;

    mockConfigService = {
      load: jest.fn(),
    } as any;

    // Mock constructors
    MockedLanguageDetectionService.mockImplementation(() => mockLanguageDetector);
    MockedCommandResolver.mockImplementation(() => mockCommandResolver);
    MockedConfigService.mockImplementation(() => mockConfigService);

    // Default mock implementations
    mockLanguageDetector.detectLanguage.mockResolvedValue({
      primary: 'nodejs',
      additional: [],
      confidence: 95,
      sources: ['package.json']
    });

    mockLanguageDetector.detectPackageManager.mockResolvedValue({
      packageManager: 'npm',
      lockFile: 'package-lock.json',
      confidence: 95
    });

    mockLanguageDetector.getMakefileTargets.mockResolvedValue([]);

    mockConfigService.load.mockResolvedValue({
      branchProtection: { enabled: false },
      verification: {
        detectionEnabled: true,
        preferMakefile: true
      }
    } as any);

    // Mock exec to succeed by default
    (mockedExec as any).mockImplementation((_cmd: string, _opts: any, callback: any) => {
      callback(null, { stdout: 'success', stderr: '' });
      return {} as any;
    });

    // Mock logger to not throw
    (logger.isJsonMode as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Node.js project with npm', () => {
    it('should verify Node.js project successfully', async () => {
      // Mock command resolution
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npm run lint', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm test', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipInstall: true });

      // Verify language detection was called
      expect(mockLanguageDetector.detectLanguage).toHaveBeenCalled();
      expect(mockLanguageDetector.detectPackageManager).toHaveBeenCalledWith('nodejs');

      // Verify command resolver was called for each step
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'lint',
          language: 'nodejs',
          packageManager: 'npm'
        })
      );
    });

    it('should skip install when --skip-install is provided', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npm run lint', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm test', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipInstall: true });

      // Install should not be resolved
      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: 'install' })
      );
    });
  });

  describe('Python project with poetry', () => {
    beforeEach(() => {
      mockLanguageDetector.detectLanguage.mockResolvedValue({
        primary: 'python',
        additional: [],
        confidence: 95,
        sources: ['pyproject.toml']
      });

      mockLanguageDetector.detectPackageManager.mockResolvedValue({
        packageManager: 'poetry',
        lockFile: 'poetry.lock',
        confidence: 95
      });
    });

    it('should verify Python project with poetry', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'poetry run ruff check .', source: 'package-manager', language: 'python', packageManager: 'poetry' })
        .mockResolvedValueOnce({ command: 'poetry run mypy .', source: 'package-manager', language: 'python', packageManager: 'poetry' })
        .mockResolvedValueOnce({ command: 'poetry run pytest', source: 'package-manager', language: 'python', packageManager: 'poetry' })
        .mockResolvedValueOnce({ command: '', source: 'not-found', language: 'python', packageManager: 'poetry' });

      await verifyCommand({ skipInstall: true });

      expect(mockLanguageDetector.detectLanguage).toHaveBeenCalled();
      expect(mockLanguageDetector.detectPackageManager).toHaveBeenCalledWith('python');

      // Verify Python commands were resolved
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'lint',
          language: 'python',
          packageManager: 'poetry'
        })
      );
    });

    it('should gracefully skip build when not available for Python', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'poetry run ruff check .', source: 'package-manager', language: 'python', packageManager: 'poetry' })
        .mockResolvedValueOnce({ command: 'poetry run mypy .', source: 'package-manager', language: 'python', packageManager: 'poetry' })
        .mockResolvedValueOnce({ command: 'poetry run pytest', source: 'package-manager', language: 'python', packageManager: 'poetry' })
        .mockResolvedValueOnce({ command: '', source: 'not-found', language: 'python', packageManager: 'poetry' });

      await verifyCommand({ skipInstall: true });

      // Build step should be skipped (last resolve call returns not-found)
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ task: 'build' })
      );
    });
  });

  describe('Makefile integration', () => {
    beforeEach(() => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue(['lint', 'test', 'build']);
    });

    it('should prefer Makefile targets when available', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'make lint', source: 'makefile', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'make test', source: 'makefile', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'make build', source: 'makefile', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipInstall: true });

      // Verify makefileTargets were passed
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          makefileTargets: ['lint', 'test', 'build']
        })
      );
    });
  });

  describe('Config overrides', () => {
    it('should respect verification config commands', async () => {
      mockConfigService.load.mockResolvedValue({
        branchProtection: { enabled: false },
        verification: {
          detectionEnabled: true,
          preferMakefile: true,
          commands: {
            lint: 'custom-lint',
            test: 'custom-test'
          }
        }
      } as any);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'custom-lint', source: 'config', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'custom-test', source: 'config', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipInstall: true });

      // Verify config was loaded and passed to resolver
      expect(mockConfigService.load).toHaveBeenCalled();
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            commands: {
              lint: 'custom-lint',
              test: 'custom-test'
            }
          })
        })
      );
    });
  });

  describe('Skip options', () => {
    it('should skip lint when --skip-lint is provided', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm test', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipLint: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: 'lint' })
      );
    });

    it('should skip typecheck when --skip-typecheck is provided', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npm run lint', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm test', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipTypecheck: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: 'typecheck' })
      );
    });

    it('should skip test when --skip-test is provided', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npm run lint', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipTest: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: 'test' })
      );
    });

    it('should skip build when --skip-build is provided', async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npm run lint', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm test', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipBuild: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: 'build' })
      );
    });
  });

  describe('JSON output mode', () => {
    it('should output JSON with language and packageManager', async () => {
      (logger.isJsonMode as jest.Mock).mockReturnValue(true);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npm run lint', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm test', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      await verifyCommand({ skipInstall: true, json: true });

      // Verify JSON was output with language and packageManager
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"language"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"packageManager"')
      );
    });
  });

  describe('Error handling', () => {
    it('should exit with error code when verification fails', async () => {
      // Mock exec to fail for lint step
      (mockedExec as any).mockImplementation((cmd: string, _opts: any, callback: any) => {
        if (cmd.includes('lint')) {
          callback(new Error('Lint failed'), { stdout: '', stderr: 'lint errors' });
        } else {
          callback(null, { stdout: 'success', stderr: '' });
        }
        return {} as any;
      });

      mockCommandResolver.resolve
        .mockResolvedValueOnce({ command: 'npm run lint', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npx tsc --noEmit', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm test', source: 'package-manager', language: 'nodejs', packageManager: 'npm' })
        .mockResolvedValueOnce({ command: 'npm run build', source: 'package-manager', language: 'nodejs', packageManager: 'npm' });

      // Mock process.exit to prevent test from exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      await verifyCommand({ skipInstall: true });

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });
});
