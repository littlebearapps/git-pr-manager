import { uninstallHooksCommand } from '../../src/commands/uninstall-hooks';
import * as fs from 'fs/promises';
import { ConfigService } from '../../src/services/ConfigService';
import * as gitHooks from '../../src/utils/git-hooks';

// Mock dependencies
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

describe('uninstall-hooks', () => {
  let mockConfigInstance: jest.Mocked<ConfigService>;
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.log for JSON output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // Mock process.exit
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
          prePush: { enabled: true, reminder: true },
          postCommit: { enabled: true, reminder: true }
        }
      }),
      save: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true)
    } as any;

    mockedConfigService.mockImplementation(() => mockConfigInstance);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('success cases', () => {
    it('should remove gpm pre-push hook', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);
      mockedFs.unlink.mockResolvedValue(undefined);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('pre-push')
      );

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: expect.objectContaining({
            prePush: { enabled: false, reminder: true }
          })
        })
      );
    });

    it('should remove gpm post-commit hook', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);
      mockedFs.unlink.mockResolvedValue(undefined);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('post-commit')
      );

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: expect.objectContaining({
            postCommit: { enabled: false, reminder: true }
          })
        })
      );
    });

    it('should remove both hooks if both are gpm hooks', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);
      mockedFs.unlink.mockResolvedValue(undefined);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledTimes(2);
      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: {
            prePush: { enabled: false, reminder: true },
            postCommit: { enabled: false, reminder: true }
          }
        })
      );
    });

    it('should skip non-gpm hooks', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);

      // First call (pre-push): not a gpm hook
      // Second call (post-commit): is a gpm hook
      let isGpmCallCount = 0;
      jest.spyOn(gitHooks, 'isGpmHook').mockImplementation(async () => {
        isGpmCallCount++;
        return isGpmCallCount === 2; // Only second call returns true
      });

      mockedFs.unlink.mockResolvedValue(undefined);

      await uninstallHooksCommand({});

      // Should only remove the gpm post-commit hook
      expect(mockedFs.unlink).toHaveBeenCalledTimes(1);
      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('post-commit')
      );

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: expect.objectContaining({
            postCommit: { enabled: false, reminder: true }
          })
        })
      );
    });

    it('should output JSON when --json flag is set', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);
      mockedFs.unlink.mockResolvedValue(undefined);

      await uninstallHooksCommand({ json: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success":true')
      );
    });

    it('should handle case when no hooks exist', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(false);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    it('should error when not in a git repository', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockRejectedValue(new Error('Not a git repository'));

      await expect(uninstallHooksCommand({})).rejects.toThrow('Process.exit called with code 1');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON error when not in git repo with --json', async () => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockRejectedValue(new Error('Not a git repository'));

      await expect(uninstallHooksCommand({ json: true })).rejects.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success":false')
      );
    });
  });

  describe('hook detection', () => {
    beforeEach(() => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);
      mockedFs.unlink.mockResolvedValue(undefined);
    });

    it('should detect gpm pre-push hook by signature', async () => {
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('pre-push')
      );
    });

    it('should detect gpm post-commit hook by signature', async () => {
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('post-commit')
      );
    });

    it('should not remove hook without gpm signature', async () => {
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(false);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('config updates', () => {
    beforeEach(() => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      mockedFs.unlink.mockResolvedValue(undefined);
    });

    it('should update config when removing pre-push hook', async () => {
      // First call (pre-push): exists and is gpm hook
      // Second call (post-commit): doesn't exist
      let fileExistsCallCount = 0;
      jest.spyOn(gitHooks, 'fileExists').mockImplementation(async (path) => {
        fileExistsCallCount++;
        return fileExistsCallCount === 1 && path.includes('pre-push');
      });

      let isGpmCallCount = 0;
      jest.spyOn(gitHooks, 'isGpmHook').mockImplementation(async (path) => {
        isGpmCallCount++;
        return isGpmCallCount === 1 && path.includes('pre-push');
      });

      await uninstallHooksCommand({});

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: expect.objectContaining({
            prePush: { enabled: false, reminder: true }
          })
        })
      );
    });

    it('should update config when removing post-commit hook', async () => {
      // First call (pre-push): doesn't exist
      // Second call (post-commit): exists and is gpm hook
      let fileExistsCallCount = 0;
      jest.spyOn(gitHooks, 'fileExists').mockImplementation(async (path) => {
        fileExistsCallCount++;
        return fileExistsCallCount === 2 && path.includes('post-commit');
      });

      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);

      await uninstallHooksCommand({});

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: expect.objectContaining({
            postCommit: { enabled: false, reminder: true }
          })
        })
      );
    });

    it('should handle missing config gracefully', async () => {
      mockConfigInstance.exists.mockResolvedValue(false);
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalled();
      expect(mockConfigInstance.save).not.toHaveBeenCalled();
    });
  });

  describe('output messages', () => {
    beforeEach(() => {
      jest.spyOn(gitHooks, 'getGitHooksDir').mockResolvedValue('/test/repo/.git/hooks');
      jest.spyOn(gitHooks, 'fileExists').mockResolvedValue(true);
      mockedFs.unlink.mockResolvedValue(undefined);
    });

    it('should report removed hooks', async () => {
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(true);

      await uninstallHooksCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.removed).toContain('pre-push');
    });

    it('should report skipped hooks', async () => {
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(false);

      await uninstallHooksCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.skipped).toContain('pre-push (not created by gpm)');
    });

    it('should report when no gpm hooks found', async () => {
      jest.spyOn(gitHooks, 'isGpmHook').mockResolvedValue(false);

      await uninstallHooksCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.message).toContain('No gpm hooks found');
    });
  });
});
