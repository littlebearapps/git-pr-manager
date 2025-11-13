import { installHooksCommand } from '../../src/commands/install-hooks';
import { uninstallHooksCommand } from '../../src/commands/uninstall-hooks';
import * as fs from 'fs/promises';
import { ConfigService } from '../../src/services/ConfigService';

// Mock dependencies for integration testing
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
      // Setup: Mock git repository exists
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# content');
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

      // Uninstall hooks
      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('pre-push')
      );
    });

    it('should handle both hooks in full workflow', async () => {
      // Setup
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockImplementation(async (path) => {
        if (path.toString().includes('pre-push')) {
          return '#!/bin/sh\n# gwm pre-push hook\n# content';
        }
        return '#!/bin/sh\n# gwm post-commit hook\n# content';
      });
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

      // Uninstall both hooks
      await uninstallHooksCommand({});

      expect(mockedFs.unlink).toHaveBeenCalledTimes(2);
    });
  });

  describe('hook persistence across reinstall', () => {
    it('should overwrite hook with --force flag', async () => {
      // Setup
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# old version');
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

      // Setup - Mock .git directory exists, but hook files don't
      let accessCallCount = 0;
      mockedFs.access.mockImplementation(async () => {
        accessCallCount++;
        if (accessCallCount === 1) {
          return Promise.resolve(); // .git directory exists
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); // Hook files don't exist
      });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
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

      // Setup for uninstall - Reset access mock to allow hook files to exist
      mockedFs.access.mockResolvedValue(undefined); // All files exist for uninstall
      mockedFs.readFile.mockImplementation(async (path) => {
        if (path.toString().includes('pre-push')) {
          return '#!/bin/sh\n# gwm pre-push hook\n# content';
        }
        return '#!/bin/sh\n# gwm post-commit hook\n# content';
      });
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
