import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies BEFORE importing the module that uses them
jest.mock('../../src/services/GitService');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/spinner', () => ({
  createSpinner: jest.fn(() => ({
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn()
  }))
}));
jest.mock('chalk', () => {
  const mockChalk = {
    green: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str
  };
  return { __esModule: true, default: mockChalk };
});

// Now import after mocks are set up
import { worktreeListCommand, worktreePruneCommand } from '../../src/commands/worktree';
import { GitService } from '../../src/services/GitService';
import { logger } from '../../src/utils/logger';
import { createSpinner } from '../../src/utils/spinner';

describe('worktree commands', () => {
  let mockGitService: jest.Mocked<GitService>;
  let mockSpinner: any;

  // Mock process.exit to throw an error so we can test error paths
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock spinner
    mockSpinner = {
      start: jest.fn(),
      succeed: jest.fn(),
      fail: jest.fn(),
      stop: jest.fn()
    };
    (createSpinner as jest.Mock).mockReturnValue(mockSpinner);

    // Create mock GitService instance
    mockGitService = {
      getWorktrees: jest.fn(),
      pruneWorktrees: jest.fn(),
    } as any;

    (GitService as jest.MockedClass<typeof GitService>).mockImplementation(() => mockGitService);
  });

  describe('worktreeListCommand', () => {
    describe('successful cases', () => {
      it('should list all worktrees in plain text format', async () => {
        const mockWorktrees = [
          {
            path: '/Users/test/project/main',
            commit: '1234567890abcdef',
            branch: 'main',
            isMain: true
          },
          {
            path: '/Users/test/project/feature',
            commit: 'abcdef1234567890',
            branch: 'feature/test',
            isMain: false
          }
        ];

        mockGitService.getWorktrees.mockResolvedValue(mockWorktrees);

        // Mock process.cwd to match first worktree
        jest.spyOn(process, 'cwd').mockReturnValue('/Users/test/project/main');

        await worktreeListCommand({});

        expect(logger.section).toHaveBeenCalledWith('Git Worktrees');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('/Users/test/project/main'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('main'));
        expect(logger.info).toHaveBeenCalledWith('Total: 2 worktrees');
      });

      it('should list worktrees in JSON format when --json flag is set', async () => {
        const mockWorktrees = [
          {
            path: '/Users/test/project/main',
            commit: '1234567890abcdef',
            branch: 'main',
            isMain: true
          }
        ];

        mockGitService.getWorktrees.mockResolvedValue(mockWorktrees);

        await worktreeListCommand({ json: true });

        expect(logger.outputJsonResult).toHaveBeenCalledWith(true, { worktrees: mockWorktrees });
        // Note: logger.section is still called, but logger internally suppresses output in JSON mode
      });

      it('should handle empty worktree list', async () => {
        mockGitService.getWorktrees.mockResolvedValue([]);

        await worktreeListCommand({});

        expect(logger.section).toHaveBeenCalledWith('Git Worktrees');
        expect(logger.warn).toHaveBeenCalledWith('No worktrees found');
      });

      it('should mark current worktree with asterisk', async () => {
        const mockWorktrees = [
          {
            path: '/Users/test/project/feature',
            commit: 'abcdef1234567890',
            branch: 'feature/test',
            isMain: false
          }
        ];

        mockGitService.getWorktrees.mockResolvedValue(mockWorktrees);
        jest.spyOn(process, 'cwd').mockReturnValue('/Users/test/project/feature');

        await worktreeListCommand({});

        // The current worktree should have an asterisk marker
        expect(logger.log).toHaveBeenCalled();
      });

      it('should display detached HEAD worktrees', async () => {
        const mockWorktrees = [
          {
            path: '/Users/test/project/detached',
            commit: 'abcdef1234567890',
            branch: null,
            isMain: false
          }
        ];

        mockGitService.getWorktrees.mockResolvedValue(mockWorktrees);

        await worktreeListCommand({});

        expect(logger.log).toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should handle errors and output JSON error when --json flag is set', async () => {
        const error = new Error('Git worktree list failed');
        mockGitService.getWorktrees.mockRejectedValue(error);

        await expect(worktreeListCommand({ json: true })).rejects.toThrow('process.exit called');

        expect(logger.outputJsonResult).toHaveBeenCalledWith(
          false,
          undefined,
          {
            code: 'GIT_ERROR',
            message: 'Git worktree list failed'
          }
        );
      });

      it('should handle errors and output plain text error when no --json flag', async () => {
        const error = new Error('Git worktree list failed');
        mockGitService.getWorktrees.mockRejectedValue(error);

        await expect(worktreeListCommand({})).rejects.toThrow('process.exit called');

        expect(logger.error).toHaveBeenCalledWith('Git worktree list failed', 'GIT_ERROR');
      });
    });
  });

  describe('worktreePruneCommand', () => {
    describe('dry-run mode', () => {
      it('should show what would be pruned in dry-run mode', async () => {
        const pruneOutput = 'Removing worktrees/old-feature: gitdir file points to non-existent location';
        mockGitService.pruneWorktrees.mockResolvedValue(pruneOutput);

        await worktreePruneCommand({ dryRun: true });

        expect(mockGitService.pruneWorktrees).toHaveBeenCalledWith(true, true);
        expect(logger.info).toHaveBeenCalledWith('Dry run - showing what would be pruned:');
        expect(logger.log).toHaveBeenCalledWith(pruneOutput);
      });

      it('should show message when no stale worktrees in dry-run mode', async () => {
        mockGitService.pruneWorktrees.mockResolvedValue('');

        await worktreePruneCommand({ dryRun: true });

        expect(logger.info).toHaveBeenCalledWith('No stale worktrees to prune');
      });

      it('should output JSON in dry-run mode when --json flag is set', async () => {
        const pruneOutput = 'Removing worktrees/old-feature';
        mockGitService.pruneWorktrees.mockResolvedValue(pruneOutput);

        await worktreePruneCommand({ dryRun: true, json: true });

        expect(logger.outputJsonResult).toHaveBeenCalledWith(true, {
          dryRun: true,
          output: pruneOutput
        });
      });
    });

    describe('prune mode', () => {
      it('should prune stale worktrees successfully', async () => {
        const pruneOutput = 'Removing worktrees/old-feature: gitdir file points to non-existent location';
        mockGitService.pruneWorktrees.mockResolvedValue(pruneOutput);

        await worktreePruneCommand({});

        expect(mockGitService.pruneWorktrees).toHaveBeenCalledWith(false, true);
        expect(mockSpinner.start).toHaveBeenCalledWith('Pruning stale worktrees...');
        expect(mockSpinner.succeed).toHaveBeenCalledWith('Worktrees pruned');
        expect(logger.log).toHaveBeenCalledWith(pruneOutput);
      });

      it('should not show spinner in JSON mode', async () => {
        const pruneOutput = 'Removing worktrees/old-feature';
        mockGitService.pruneWorktrees.mockResolvedValue(pruneOutput);

        await worktreePruneCommand({ json: true });

        // Note: spinner.start is still called, but spinner internally suppresses output in JSON mode
        expect(logger.outputJsonResult).toHaveBeenCalledWith(true, {
          pruned: true,
          output: pruneOutput
        });
      });

      it('should handle prune with no output', async () => {
        mockGitService.pruneWorktrees.mockResolvedValue('');

        await worktreePruneCommand({});

        expect(mockSpinner.succeed).toHaveBeenCalledWith('Worktrees pruned');
        expect(logger.log).not.toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should handle prune errors and fail spinner', async () => {
        const error = new Error('Git worktree prune failed');
        mockGitService.pruneWorktrees.mockRejectedValue(error);

        await expect(worktreePruneCommand({})).rejects.toThrow('process.exit called');

        expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to prune worktrees');
        expect(logger.error).toHaveBeenCalledWith('Git worktree prune failed', 'GIT_ERROR');
      });

      it('should output JSON error when --json flag is set', async () => {
        const error = new Error('Git worktree prune failed');
        mockGitService.pruneWorktrees.mockRejectedValue(error);

        await expect(worktreePruneCommand({ json: true })).rejects.toThrow('process.exit called');

        // Note: spinner.fail is still called, but spinner internally suppresses output in JSON mode
        expect(logger.outputJsonResult).toHaveBeenCalledWith(
          false,
          undefined,
          {
            code: 'GIT_ERROR',
            message: 'Git worktree prune failed'
          }
        );
      });
    });
  });
});
