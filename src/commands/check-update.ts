import chalk from 'chalk';
import { checkForUpdate, clearUpdateCache } from '../utils/update-check';
import { logger } from '../utils/logger';

interface CheckUpdateOptions {
  json?: boolean;
  clearCache?: boolean;
  channel?: 'latest' | 'next';
}

/**
 * Check for available updates
 *
 * This command explicitly checks for updates and provides machine-readable output.
 * Useful for AI agents and automated workflows.
 *
 * Exit codes:
 * - 0: No update available
 * - 1: Update available
 * - 2: Error during check
 *
 * @example
 * ```bash
 * # Check for updates (human-readable)
 * gwm check-update
 *
 * # Check for updates (machine-readable JSON)
 * gwm check-update --json
 *
 * # Clear cache and force fresh check
 * gwm check-update --clear-cache
 *
 * # Check specific channel
 * gwm check-update --channel next
 * ```
 */
export async function checkUpdateCommand(options: CheckUpdateOptions): Promise<void> {
  const pkg = require('../../package.json');

  try {
    // Clear cache if requested
    if (options.clearCache) {
      await clearUpdateCache();
      if (!options.json) {
        logger.info('Update cache cleared');
      }
    }

    // Determine channel
    const channel = options.channel || (pkg.version.includes('-') ? 'next' : 'latest');

    // Check for updates
    const result = await checkForUpdate({
      packageName: pkg.name,
      currentVersion: pkg.version,
      channel,
    });

    // Handle errors
    if (result.error) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: false,
              error: result.error,
              currentVersion: pkg.version,
              channel,
            },
            null,
            2
          )
        );
      } else {
        logger.error(`Failed to check for updates: ${result.error}`);
      }
      process.exit(2);
    }

    // Output results
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            updateAvailable: result.updateAvailable,
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            channel: result.channel,
            cached: result.cached,
          },
          null,
          2
        )
      );
    } else {
      // Human-readable output
      console.log('');
      console.log(chalk.bold('Update Check Results'));
      console.log('─'.repeat(50));
      console.log(`${chalk.dim('Current version:')}  ${result.currentVersion}`);
      console.log(`${chalk.dim('Latest version:')}   ${result.latestVersion}`);
      console.log(`${chalk.dim('Channel:')}          ${result.channel}`);
      console.log(
        `${chalk.dim('Cached:')}           ${result.cached ? chalk.yellow('Yes') : chalk.green('No')}`
      );
      console.log('─'.repeat(50));

      if (result.updateAvailable) {
        console.log('');
        console.log(chalk.green.bold('✓ Update available!'));
        console.log('');
        console.log(
          `Run ${chalk.cyan(`npm install -g ${pkg.name}`)} to update.`
        );
        console.log('');
      } else {
        console.log('');
        console.log(chalk.green.bold('✓ You are using the latest version'));
        console.log('');
      }
    }

    // Exit with appropriate code
    process.exit(result.updateAvailable ? 1 : 0);
  } catch (error) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            currentVersion: pkg.version,
          },
          null,
          2
        )
      );
    } else {
      logger.error(
        `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    process.exit(2);
  }
}
