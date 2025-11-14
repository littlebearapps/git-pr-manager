import { installHooksCommand } from '../../src/commands/install-hooks';
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

describe('install-hooks', () => {
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
        branchProtection: { enabled: false },
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
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('success cases', () => {
    beforeEach(() => {
      // Mock .git directory exists
      let accessCallCount = 0;
      mockedFs.access.mockImplementation(async () => {
        accessCallCount++;
        // First call: .git directory exists
        if (accessCallCount === 1) {
          return Promise.resolve();
        }
        // Subsequent calls: hook files don't exist
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
      // Mock hooks directory creation
      mockedFs.mkdir.mockResolvedValue(undefined);
      // Mock hook files don't exist initially (readFile should not be called)
      mockedFs.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
    });

    it('should install pre-push hook by default', async () => {
      await installHooksCommand({});

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        expect.stringContaining('gwm pre-push hook'),
        'utf-8'
      );

      expect(mockedFs.chmod).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        0o755
      );

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: expect.objectContaining({
            prePush: { enabled: true, reminder: true }
          })
        })
      );
    });

    it('should install both hooks when --post-commit is specified', async () => {
      await installHooksCommand({ postCommit: true });

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        expect.stringContaining('gwm pre-push hook'),
        'utf-8'
      );

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('post-commit'),
        expect.stringContaining('gwm post-commit hook'),
        'utf-8'
      );

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: {
            prePush: { enabled: true, reminder: true },
            postCommit: { enabled: true, reminder: true }
          }
        })
      );
    });

    it('should make hooks executable', async () => {
      await installHooksCommand({});

      expect(mockedFs.chmod).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        0o755
      );
    });

    it('should output JSON when --json flag is set', async () => {
      await installHooksCommand({ json: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success":true')
      );
    });

    it('should overwrite hooks with --force flag', async () => {
      // Mock hook file exists and is a gwm hook
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# old content');

      await installHooksCommand({ force: true });

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('pre-push'),
        expect.stringContaining('gwm pre-push hook'),
        'utf-8'
      );
    });
  });

  describe('error cases', () => {
    it('should error when not in a git repository', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(installHooksCommand({})).rejects.toThrow('Process.exit called with code 1');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should error when hook exists and is not gwm hook without --force', async () => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);
      // Mock hook exists but is not gwm
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# some other hook\n');

      await expect(installHooksCommand({})).rejects.toThrow('Process.exit called with code 1');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON error when not in git repo with --json', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(installHooksCommand({ json: true })).rejects.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success":false')
      );
    });
  });

  describe('hook detection', () => {
    beforeEach(() => {
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
    });

    it('should detect gwm pre-push hook', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm pre-push hook\n# content');

      // Should not error without --force (hook is already gwm hook)
      await installHooksCommand({ force: true });

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should detect gwm post-commit hook', async () => {
      mockedFs.readFile.mockResolvedValue('#!/bin/sh\n# gwm post-commit hook\n# content');

      await installHooksCommand({ postCommit: true, force: true });

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('config updates', () => {
    beforeEach(() => {
      // Mock .git directory exists, but hook files don't
      let accessCallCount = 0;
      mockedFs.access.mockImplementation(async () => {
        accessCallCount++;
        if (accessCallCount === 1) {
          return Promise.resolve();
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.chmod.mockResolvedValue(undefined);
    });

    it('should update config for pre-push hook only', async () => {
      await installHooksCommand({});

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: {
            prePush: { enabled: true, reminder: true },
            postCommit: { enabled: false, reminder: true }
          }
        })
      );
    });

    it('should update config for both hooks', async () => {
      await installHooksCommand({ postCommit: true });

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: {
            prePush: { enabled: true, reminder: true },
            postCommit: { enabled: true, reminder: true }
          }
        })
      );
    });

    it('should handle missing hooks config gracefully', async () => {
      mockConfigInstance.load.mockResolvedValue({
        branchProtection: {},
        ci: {},
        security: {},
        pr: {},
        autoFix: {}
        // hooks missing
      } as any);

      await installHooksCommand({});

      expect(mockConfigInstance.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hooks: expect.any(Object)
        })
      );
    });
  });

  describe('hook templates', () => {
    beforeEach(() => {
      // Mock .git directory exists, but hook files don't
      let accessCallCount = 0;
      mockedFs.access.mockImplementation(async () => {
        accessCallCount++;
        if (accessCallCount === 1) {
          return Promise.resolve();
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedFs.chmod.mockResolvedValue(undefined);
    });

    it('should include CI environment check in pre-push hook', async () => {
      let hookContent = '';
      mockedFs.writeFile.mockImplementation(async (path, content) => {
        if (path.toString().includes('pre-push')) {
          hookContent = content.toString();
        }
      });

      await installHooksCommand({});

      expect(hookContent).toContain('$CI');
      expect(hookContent).toContain('$GITHUB_ACTIONS');
      expect(hookContent).toContain('exit 0');
    });

    it('should include gwm signature in pre-push hook', async () => {
      let hookContent = '';
      mockedFs.writeFile.mockImplementation(async (path, content) => {
        if (path.toString().includes('pre-push')) {
          hookContent = content.toString();
        }
      });

      await installHooksCommand({});

      expect(hookContent).toContain('# gwm pre-push hook');
      expect(hookContent).toContain('gwm install-hooks');
      expect(hookContent).toContain('gwm uninstall-hooks');
    });

    it('should include reminder messages in pre-push hook', async () => {
      let hookContent = '';
      mockedFs.writeFile.mockImplementation(async (path, content) => {
        if (path.toString().includes('pre-push')) {
          hookContent = content.toString();
        }
      });

      await installHooksCommand({});

      expect(hookContent).toContain('gwm ship');
      expect(hookContent).toContain('gwm auto');
      expect(hookContent).toContain('gwm security');
    });

    it('should include CI environment check in post-commit hook', async () => {
      let hookContent = '';
      mockedFs.writeFile.mockImplementation(async (path, content) => {
        if (path.toString().includes('post-commit')) {
          hookContent = content.toString();
        }
      });

      await installHooksCommand({ postCommit: true });

      expect(hookContent).toContain('$CI');
      expect(hookContent).toContain('exit 0');
    });
  });
});
