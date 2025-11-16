import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';
import { getGitHooksDir, fileExists, isGpmHook } from '../utils/git-hooks';

export interface UninstallHooksOptions {
  json?: boolean;  // JSON output mode
}

/**
 * Uninstall gpm git hooks
 * Only removes hooks that were created by gpm (checks for gpm signature)
 */
export async function uninstallHooksCommand(options: UninstallHooksOptions = {}): Promise<void> {
  try {
    // Get hooks directory (works for both standard repos and worktrees)
    let hooksDir: string;
    try {
      hooksDir = await getGitHooksDir();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Not a git repository';
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: errorMsg + '. No hooks to uninstall.'
        }));
      } else {
        logger.error(errorMsg + '. No hooks to uninstall.');
      }
      process.exit(1);
    }

    const removedHooks: string[] = [];
    const skippedHooks: string[] = [];

    // Check and remove pre-push hook
    const prePushPath = path.join(hooksDir, 'pre-push');
    const prePushExists = await fileExists(prePushPath);

    if (prePushExists) {
      const isGpm = await isGpmHook(prePushPath);
      if (isGpm) {
        await fs.unlink(prePushPath);
        removedHooks.push('pre-push');
      } else {
        skippedHooks.push('pre-push (not created by gpm)');
      }
    }

    // Check and remove post-commit hook
    const postCommitPath = path.join(hooksDir, 'post-commit');
    const postCommitExists = await fileExists(postCommitPath);

    if (postCommitExists) {
      const isGpm = await isGpmHook(postCommitPath);
      if (isGpm) {
        await fs.unlink(postCommitPath);
        removedHooks.push('post-commit');
      } else {
        skippedHooks.push('post-commit (not created by gpm)');
      }
    }

    // Update .gpm.yml config to reflect removal
    const configService = new ConfigService(process.cwd());
    const configExists = await configService.exists();

    if (configExists) {
      const config = await configService.load();

      if (config.hooks) {
        if (removedHooks.includes('pre-push')) {
          config.hooks.prePush = { enabled: false, reminder: true };
        }
        if (removedHooks.includes('post-commit')) {
          config.hooks.postCommit = { enabled: false, reminder: true };
        }

        await configService.save(config);
      }
    }

    // Output results
    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        message: removedHooks.length > 0
          ? 'Git hooks uninstalled successfully'
          : 'No gpm hooks found to uninstall',
        removed: removedHooks,
        skipped: skippedHooks
      }));
    } else {
      if (removedHooks.length > 0) {
        logger.success('Git hooks uninstalled successfully!');
        removedHooks.forEach(hook => {
          logger.info(`  • Removed ${hook} hook`);
        });
      } else {
        logger.info('No gpm hooks found to uninstall');
      }

      if (skippedHooks.length > 0) {
        logger.blank();
        logger.warn('Skipped hooks (not created by gpm):');
        skippedHooks.forEach(hook => {
          logger.info(`  • ${hook}`);
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: errorMessage
      }));
    } else {
      logger.error(`Failed to uninstall hooks: ${errorMessage}`);
    }
    process.exit(1);
  }
}
