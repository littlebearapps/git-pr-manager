import { getGitHooksDir, fileExists, isGwmHook } from '../../src/utils/git-hooks';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('child_process');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('git-hooks utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGitHooksDir', () => {
    describe('using git rev-parse (primary method)', () => {
      it('should use git rev-parse for standard repo', async () => {
        // Mock git rev-parse returning .git
        mockedExecSync.mockReturnValue('.git');

        const result = await getGitHooksDir('/test/repo');

        expect(mockedExecSync).toHaveBeenCalledWith(
          'git rev-parse --git-common-dir',
          expect.objectContaining({
            cwd: '/test/repo',
            encoding: 'utf-8'
          })
        );

        expect(result).toBe('/test/repo/.git/hooks');
      });

      it('should use git rev-parse for worktree', async () => {
        // Mock git rev-parse returning path to bare repo (absolute path)
        mockedExecSync.mockReturnValue('/test/.bare');

        const result = await getGitHooksDir('/test/repo/main');

        expect(mockedExecSync).toHaveBeenCalledWith(
          'git rev-parse --git-common-dir',
          expect.objectContaining({
            cwd: '/test/repo/main'
          })
        );

        // When git rev-parse returns absolute path, path.resolve uses it directly
        expect(result).toBe('/test/.bare/hooks');
      });

      it('should handle relative path from git rev-parse', async () => {
        // Mock git rev-parse returning relative path
        mockedExecSync.mockReturnValue('../.bare');

        const result = await getGitHooksDir('/test/repo/main');

        expect(result).toBe('/test/repo/.bare/hooks');
      });
    });

    describe('fallback to manual .git detection', () => {
      beforeEach(() => {
        // Mock git rev-parse failing
        mockedExecSync.mockImplementation(() => {
          throw new Error('git command not found');
        });
      });

      it('should handle standard .git directory', async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false
        } as any);

        const result = await getGitHooksDir('/test/repo');

        expect(result).toBe('/test/repo/.git/hooks');
      });

      it('should handle worktree .git file', async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true
        } as any);

        mockedFs.readFile.mockResolvedValue(
          'gitdir: /test/repo/.bare/worktrees/main\n'
        );

        const result = await getGitHooksDir('/test/repo/main');

        // Should navigate from .bare/worktrees/main -> .bare/hooks
        expect(result).toBe('/test/repo/.bare/hooks');
      });

      it('should handle worktree .git file with relative path', async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true
        } as any);

        mockedFs.readFile.mockResolvedValue(
          'gitdir: ../.bare/worktrees/main\n'
        );

        const result = await getGitHooksDir('/test/repo/main');

        expect(result).toBe('/test/repo/.bare/hooks');
      });

      it('should throw error when not in git repo', async () => {
        mockedFs.stat.mockRejectedValue(new Error('ENOENT'));

        await expect(getGitHooksDir('/test/not-a-repo')).rejects.toThrow(
          'Not a git repository'
        );
      });

      it('should throw error when .git file is invalid', async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true
        } as any);

        mockedFs.readFile.mockResolvedValue('invalid content');

        await expect(getGitHooksDir('/test/repo')).rejects.toThrow(
          'Not a git repository'
        );
      });
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockedFs.access.mockResolvedValue(undefined);

      const result = await fileExists('/test/file.txt');

      expect(result).toBe(true);
      expect(mockedFs.access).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false when file does not exist', async () => {
      mockedFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await fileExists('/test/missing.txt');

      expect(result).toBe(false);
    });
  });

  describe('isGwmHook', () => {
    it('should return true for gwm pre-push hook', async () => {
      const hookContent = `#!/bin/sh
# gwm pre-push hook
# Installed via: gwm install-hooks
`;
      mockedFs.readFile.mockResolvedValue(hookContent);

      const result = await isGwmHook('/test/.git/hooks/pre-push');

      expect(result).toBe(true);
    });

    it('should return true for gwm post-commit hook', async () => {
      const hookContent = `#!/bin/sh
# gwm post-commit hook
# Installed via: gwm install-hooks
`;
      mockedFs.readFile.mockResolvedValue(hookContent);

      const result = await isGwmHook('/test/.git/hooks/post-commit');

      expect(result).toBe(true);
    });

    it('should return false for non-gwm hook', async () => {
      const hookContent = `#!/bin/sh
# Some other hook
# Not created by gwm
`;
      mockedFs.readFile.mockResolvedValue(hookContent);

      const result = await isGwmHook('/test/.git/hooks/pre-push');

      expect(result).toBe(false);
    });

    it('should return false when hook file cannot be read', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await isGwmHook('/test/.git/hooks/pre-push');

      expect(result).toBe(false);
    });

    it('should return false for empty file', async () => {
      mockedFs.readFile.mockResolvedValue('');

      const result = await isGwmHook('/test/.git/hooks/pre-push');

      expect(result).toBe(false);
    });
  });
});
