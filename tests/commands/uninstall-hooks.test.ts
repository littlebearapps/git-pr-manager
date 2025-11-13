import { uninstallHooksCommand } from '../../src/commands/uninstall-hooks';
import * as fs from 'fs/promises';
import { ConfigService } from '../../src/services/ConfigService';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../src/services/ConfigService');
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
    it('should remove gwm pre-push hook', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# content');
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

    it('should remove gwm post-commit hook', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm post-commit hook\n# content');
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

    it('should remove both hooks if both are gwm hooks', async () => {
      let callCount = 0;
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return '#!/bin/sh\n# gwm pre-push hook\n# content';
        }
        return '#!/bin/sh\n# gwm post-commit hook\n# content';
      });
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

    it('should skip non-gwm hooks', async () => {
      let callCount = 0;
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return '#!/bin/sh\n# some other pre-push hook\n# content';
        }
        return '#!/bin/sh\n# gwm post-commit hook\n# content';
      });
      mockedFs.unlink.mockResolvedValue(undefined);

      await uninstallHooksCommand({});

      // Should only remove the gwm post-commit hook
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
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# content');
      mockedFs.unlink.mockResolvedValue(undefined);

      await uninstallHooksCommand({ json: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success":true')
      );
    });

    it('should handle case when no hooks exist', async () => {
      // Mock .git directory exists but hook files don't exist
      let callCount = 0;
      mockedFs.access.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // .git directory exists
          return Promise.resolve();
        }
        // Hook files don't exist
        throw new Error('ENOENT');
      });

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    it('should error when not in a git repository', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(uninstallHooksCommand({})).rejects.toThrow('Process.exit called with code 1');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON error when not in git repo with --json', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(uninstallHooksCommand({ json: true })).rejects.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success":false')
      );
    });
  });

  describe('hook detection', () => {
    beforeEach(() => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.unlink.mockResolvedValue(undefined);
    });

    it('should detect gwm pre-push hook by signature', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# old content');

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('pre-push')
      );
    });

    it('should detect gwm post-commit hook by signature', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm post-commit hook\n# old content');

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('post-commit')
      );
    });

    it('should not remove hook without gwm signature', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# some other hook\n# content');

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('config updates', () => {
    beforeEach(() => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.unlink.mockResolvedValue(undefined);
    });

    it('should update config when removing pre-push hook', async () => {
      mockedFs.readFile.mockImplementation(async (path) => {
        if (path.toString().includes('pre-push')) {
          return '#!/bin/sh\n# gwm pre-push hook\n# content';
        }
        return '#!/bin/sh\n# some other hook\n# content';
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
      mockedFs.readFile.mockImplementation(async (path) => {
        if (path.toString().includes('post-commit')) {
          return '#!/bin/sh\n# gwm post-commit hook\n# content';
        }
        throw new Error('ENOENT');
      });

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
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# content');

      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalled();
      expect(mockConfigInstance.save).not.toHaveBeenCalled();
    });
  });

  describe('output messages', () => {
    beforeEach(() => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.unlink.mockResolvedValue(undefined);
    });

    it('should report removed hooks', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# content');

      await uninstallHooksCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.removed).toContain('pre-push');
    });

    it('should report skipped hooks', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# some other hook\n# content');

      await uninstallHooksCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.skipped).toContain('pre-push (not created by gwm)');
    });

    it('should report when no gwm hooks found', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# some other hook\n# content');

      await uninstallHooksCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.message).toContain('No gwm hooks found');
    });
  });
});
