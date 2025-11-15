import { GitService } from '../services/GitService';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';
import chalk from 'chalk';

interface WorktreeListOptions {
  json?: boolean;  // Not used - global --json flag handled by preAction hook
}

interface WorktreePruneOptions {
  dryRun?: boolean;
  json?: boolean;  // Not used - global --json flag handled by preAction hook
}

/**
 * List all worktrees
 */
export async function worktreeListCommand(_options: WorktreeListOptions = {}): Promise<void> {
  try {
    const gitService = new GitService({ workingDir: process.cwd() });
    const worktrees = await gitService.getWorktrees();

    // Output JSON if in JSON mode (logger handles this automatically)
    logger.outputJsonResult(true, { worktrees });

    // Human-readable output (only shown if not in JSON mode)
    logger.section('Git Worktrees');

    if (worktrees.length === 0) {
      logger.warn('No worktrees found');
      return;
    }

    for (const worktree of worktrees) {
      const isCurrent = worktree.path === process.cwd();
      const marker = isCurrent ? chalk.green('*') : ' ';
      const branch = worktree.branch || chalk.gray('(detached)');
      const mainTag = worktree.isMain ? chalk.blue('[main]') : '';

      logger.log(`${marker} ${chalk.cyan(worktree.path)}`);
      logger.log(`  ${branch} ${mainTag}`);
      logger.log(`  ${chalk.gray(worktree.commit.substring(0, 7))}`);
      logger.blank();
    }

    logger.info(`Total: ${worktrees.length} worktree${worktrees.length !== 1 ? 's' : ''}`);

  } catch (error: any) {
    logger.outputJsonResult(false, undefined, {
      code: 'GIT_ERROR',
      message: error.message
    });
    logger.error(error.message, 'GIT_ERROR');
    process.exit(1);
  }
}

/**
 * Prune stale worktree administrative data
 */
export async function worktreePruneCommand(options: WorktreePruneOptions = {}): Promise<void> {
  const spinner = createSpinner();

  try {
    const gitService = new GitService({ workingDir: process.cwd() });

    if (options.dryRun) {
      const result = await gitService.pruneWorktrees(true, true);

      // Output JSON if in JSON mode (logger handles this automatically)
      logger.outputJsonResult(true, {
        dryRun: true,
        output: result
      });

      // Human-readable output (only shown if not in JSON mode)
      logger.info('Dry run - showing what would be pruned:');
      if (result.trim()) {
        logger.log(result);
      } else {
        logger.info('No stale worktrees to prune');
      }
    } else {
      spinner.start('Pruning stale worktrees...');

      const result = await gitService.pruneWorktrees(false, true);

      // Output JSON if in JSON mode (logger handles this automatically)
      logger.outputJsonResult(true, {
        pruned: true,
        output: result
      });

      // Human-readable output (only shown if not in JSON mode)
      spinner.succeed('Worktrees pruned');
      if (result.trim()) {
        logger.log(result);
      }
    }

  } catch (error: any) {
    spinner.fail('Failed to prune worktrees');

    logger.outputJsonResult(false, undefined, {
      code: 'GIT_ERROR',
      message: error.message
    });
    logger.error(error.message, 'GIT_ERROR');
    process.exit(1);
  }
}
