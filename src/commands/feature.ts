import { GitService } from '../services/GitService';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import chalk from 'chalk';

interface FeatureOptions {
  from?: string; // Base branch (defaults to main/master)
}

/**
 * Start a new feature branch
 */
export async function featureCommand(
  featureName: string,
  options: FeatureOptions = {}
): Promise<void> {
  try {
    const gitService = new GitService({ workingDir: process.cwd() });

    logger.section('Starting New Feature');

    // Get base branch
    const baseBranch = options.from || await gitService.getDefaultBranch();

    // Check working directory is clean
    const branchInfo = await gitService.getBranchInfo();
    if (!branchInfo.isClean) {
      logger.error('Working directory has uncommitted changes. Commit or stash them first.');
      process.exit(1);
    }

    // Validate feature name
    if (!featureName || featureName.length === 0) {
      logger.error('Feature name is required');
      process.exit(1);
    }

    // Sanitize feature name (remove special characters, convert to kebab-case)
    const branchName = sanitizeBranchName(featureName);

    // Check if branch already exists
    const exists = await gitService.branchExists(branchName);
    if (exists) {
      logger.error(`Branch ${chalk.cyan(branchName)} already exists`);
      process.exit(1);
    }

    // Check if branch is checked out in another worktree
    const worktrees = await gitService.getBranchWorktrees(branchName);
    if (worktrees.length > 0) {
      const currentPath = process.cwd();
      // Filter out current worktree
      const otherWorktrees = worktrees.filter(w => w !== currentPath);

      if (otherWorktrees.length > 0) {
        logger.error(
          `Branch ${chalk.cyan(branchName)} is already checked out in another worktree`,
          'WORKTREE_CONFLICT',
          {
            branch: branchName,
            currentWorktree: currentPath,
            conflictingWorktrees: otherWorktrees
          },
          [
            `Switch to existing worktree: ${chalk.cyan(`cd ${otherWorktrees[0]}`)}`,
            `Or use a different branch name`,
            `Or remove the worktree: ${chalk.gray(`git worktree remove ${otherWorktrees[0]}`)}`
          ]
        );
        process.exit(1);
      }
    }

    // Fetch latest changes
    spinner.start(`Fetching latest changes from ${baseBranch}...`);
    await gitService.fetch();
    spinner.succeed();

    // Checkout base branch and pull
    spinner.start(`Updating ${baseBranch}...`);
    await gitService.checkout(baseBranch);
    await gitService.pull();
    spinner.succeed();

    // Create and checkout feature branch
    spinner.start(`Creating branch ${chalk.cyan(branchName)}...`);
    await gitService.createBranch(branchName, baseBranch);
    spinner.succeed();

    // Output JSON for successful branch creation
    logger.outputJsonResult(true, {
      success: true,
      branch: branchName,
      baseBranch,
      created: true
    });

    // Human-readable output
    logger.blank();
    logger.success('Feature branch created!');
    logger.log(`Branch: ${chalk.cyan(branchName)}`);
    logger.log(`Base: ${chalk.gray(baseBranch)}`);

    logger.blank();
    logger.info('Next steps:');
    logger.log('  1. Make your changes');
    logger.log('  2. Commit your changes');
    logger.log(`  3. Run ${chalk.cyan('gwm ship')} to create PR and merge`);

  } catch (error: any) {
    spinner.fail('Failed to create feature branch');
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Sanitize branch name to follow git conventions
 */
function sanitizeBranchName(name: string): string {
  // Convert to lowercase
  let sanitized = name.toLowerCase();

  // Replace spaces and underscores with hyphens
  sanitized = sanitized.replace(/[\s_]+/g, '-');

  // Remove special characters except hyphens and slashes
  sanitized = sanitized.replace(/[^a-z0-9-/]/g, '');

  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Add feature/ prefix if not already prefixed
  if (!sanitized.includes('/')) {
    sanitized = `feature/${sanitized}`;
  }

  return sanitized;
}
