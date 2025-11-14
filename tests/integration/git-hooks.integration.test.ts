import { installHooksCommand } from '../../src/commands/install-hooks';
import { uninstallHooksCommand } from '../../src/commands/uninstall-hooks';
import * as fs from 'fs/promises';
import { ConfigService } from '../../src/services/ConfigService';
import * as gitHooks from '../../src/utils/git-hooks';

// Mock dependencies for integration testing
jest.mock('fs/promises');
jest.mock('../../src/services/ConfigService');
jest.mock('../../src/utils/git-hooks');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    blank: jest.fn(),
    warn: jest.fn()
  }
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;

describe('Git Hooks Integration', () => {
  let mockConfigInstance: jest.Mocked<ConfigService>;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit to prevent actual exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`Process.exit called with code ${code}`);
    }) as any);

    // Mock ConfigService instance
    mockConfigInstance = {
      load: jest.fn().mockResolvedValue({
        branchProtection: {},
        ci: {},
        security: {},
        pr: {},
        autoFix: {},
        hooks: {
          prePush: { enabled: false, reminder: true },
          postCommit: { enabled: false, reminder: true }
        }
      }),
      save: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true)
    } as any;

    mockedConfigService.mockImplementation(() => mockConfigInstance);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  describe('install and uninstall workflow', () => {
    it('should install hooks, then uninstall them successfully', async () => {
      // Setup: Mock git hooks directory
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(false); // For install
      jest.spyOn(gitHooks, 'isGwmHook').mockResolvedValue(true); // For uninstall
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.unlink.mockResolvedValue(undefined);

      // Mock config operations via mockConfigInstance
      mockConfigInstance.load.mockResolvedValue({
        branchProtection: {},
        ci: {},
        security: {},
        pr: {},
        autoFix: {},
        hooks: {
          prePush: { enabled: false, reminder: true },
          postCommit: { enabled: false, reminder: true }
        }
      } as any);
      mockConfigInstance.save.mockResolvedValue(undefined);
      mockConfigInstance.exists.mockResolvedValue(true);

      // Install hooks
      await installHooksCommand({});

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        expect.any(String),
        'utf-8'
      );

      expect(mockedFs.chmod).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        0o755
      );

      // Update mocks for uninstall (hooks now exist)
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);

      // Uninstall hooks
      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('pre-push')
      );
    });

    it('should handle both hooks in full workflow', async () => {
      // Setup: Mock git hooks directory
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(false); // For install
      jest.spyOn(gitHooks, 'isGwmHook').mockResolvedValue(true); // For uninstall
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.unlink.mockResolvedValue(undefined);

      mockConfigInstance.load.mockResolvedValue({
        branchProtection: {},
        ci: {},
        security: {},
        pr: {},
        autoFix: {},
        hooks: {
          prePush: { enabled: false, reminder: true },
          postCommit: { enabled: false, reminder: true }
        }
      } as any);
      mockConfigInstance.save.mockResolvedValue(undefined);
      mockConfigInstance.exists.mockResolvedValue(true);

      // Install both hooks
      await installHooksCommand({ postCommit: true });

      expect(mockedFs.writeFile).toHaveBeenCalledTimes(2);
      expect(mockedFs.chmod).toHaveBeenCalledTimes(2);

      // Update mocks for uninstall (hooks now exist)
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);

      // Uninstall both hooks
      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('hook persistence across reinstall', () => {
    it('should overwrite hook with --force flag', async () => {
      // Setup: Mock git hooks directory and existing gwm hook
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true); // Hook exists
      jest.spyOn(gitHooks, 'isGwmHook').mockResolvedValue(true); // Is a gwm hook
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      mockConfigInstance.load.mockResolvedValue({
        branchProtection: {},
        ci: {},
        security: {},
        pr: {},
        autoFix: {},
        hooks: {
          prePush: { enabled: true, reminder: true },
          postCommit: { enabled: false, reminder: true }
        }
      } as any);
      mockConfigInstance.save.mockResolvedValue(undefined);
      mockConfigInstance.exists.mockResolvedValue(true);

      // Install with force to overwrite
      await installHooksCommand({ force: true });

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('config synchronization', () => {
    it('should keep config in sync with hook installation state', async () => {
      const configSaveSpy = jest.spyOn(mockConfigInstance, 'save');

      // Setup - Mock git hooks directory and no existing hooks
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(false); // Hook files don't exist initially
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);

      mockConfigInstance.load.mockResolvedValue({
        branchProtection: {},
        ci: {},
        security: {},
        pr: {},
        autoFix: {},
        hooks: {
          prePush: { enabled: false, reminder: true },
          postCommit: { enabled: false, reminder: true }
        }
      } as any);
      mockConfigInstance.exists.mockResolvedValue(true);

      // Install hooks
      await installHooksCommand({ postCommit: true });

      // Verify config was updated with both hooks enabled
      expect(configSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: {
            prePush: { enabled: true, reminder: true },
            postCommit: { enabled: true, reminder: true }
          }
        })
      );

      // Setup for uninstall - Update mocks so hooks now exist
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true); // Hooks now exist
      jest.spyOn(gitHooks, 'isGwmHook').mockResolvedValue(true); // And are gwm hooks
      mockedFs.unlink.mockResolvedValue(undefined);

      mockConfigInstance.load.mockResolvedValue({
        branchProtection: {},
        ci: {},
        security: {},
        pr: {},
        autoFix: {},
        hooks: {
          prePush: { enabled: true, reminder: true },
          postCommit: { enabled: true, reminder: true }
        }
      } as any);

      // Uninstall hooks
      await uninstallHooksCommand({});

      // Verify config was updated with both hooks disabled
      expect(configSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: {
            prePush: { enabled: false, reminder: true },
            postCommit: { enabled: false, reminder: true }
          }
        })
      );
    });
  });
});
