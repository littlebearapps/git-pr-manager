import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';

export interface UninstallHooksOptions {
  json?: boolean;  // JSON output mode
}

/**
 * Uninstall gwm git hooks
 * Only removes hooks that were created by gwm (checks for gwm signature)
 */
export async function uninstallHooksCommand(options: UninstallHooksOptions = {}): Promise<void> {
  try {
    // Check if .git directory exists
    const gitDir = path.join(process.cwd(), '.git');
    try {
      await fs.access(gitDir);
    } catch {
      const error = 'Not a git repository. No hooks to uninstall.';
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: error
        }));
      } else {
        logger.error(error);
      }
      process.exit(1);
    }

    const hooksDir = path.join(gitDir, 'hooks');
    const removedHooks: string[] = [];
    const skippedHooks: string[] = [];

    // Check and remove pre-push hook
    const prePushPath = path.join(hooksDir, 'pre-push');
    const prePushExists = await fileExists(prePushPath);

    if (prePushExists) {
      const isGwm = await isGwmHook(prePushPath);
      if (isGwm) {
        await fs.unlink(prePushPath);
        removedHooks.push('pre-push');
      } else {
        skippedHooks.push('pre-push (not created by gwm)');
      }
    }

    // Check and remove post-commit hook
    const postCommitPath = path.join(hooksDir, 'post-commit');
    const postCommitExists = await fileExists(postCommitPath);

    if (postCommitExists) {
      const isGwm = await isGwmHook(postCommitPath);
      if (isGwm) {
        await fs.unlink(postCommitPath);
        removedHooks.push('post-commit');
      } else {
        skippedHooks.push('post-commit (not created by gwm)');
      }
    }

    // Update .gwm.yml config to reflect removal
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
          : 'No gwm hooks found to uninstall',
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
        logger.info('No gwm hooks found to uninstall');
      }

      if (skippedHooks.length > 0) {
        logger.blank();
        logger.warn('Skipped hooks (not created by gwm):');
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

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a hook was created by gwm
 * Checks for gwm signature on line 2
 */
async function isGwmHook(hookPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(hookPath, { encoding: 'utf-8' });
    const lines = content.split('\n');
    // Check for gwm signature on line 2 (0-indexed line 1)
    return !!(lines[1] && (
      lines[1].includes('gwm pre-push hook') ||
      lines[1].includes('gwm post-commit hook')
    ));
  } catch {
    return false;
  }
}
