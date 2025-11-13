import { GitService } from '../services/GitService';
import { ConfigService } from '../services/ConfigService';
import { logger } from '../utils/logger';
import chalk from 'chalk';

/**
 * Show current git and workflow status
 */
export async function statusCommand(): Promise<void> {
  try {
    const gitService = new GitService({ workingDir: process.cwd() });
    const configService = new ConfigService();

    logger.section('Git Workflow Status');

    // Git status
    const branchInfo = await gitService.getBranchInfo();
    const status = await gitService.getStatus();

    logger.log(chalk.bold('Current Branch: ') + chalk.cyan(branchInfo.current));
    logger.log(chalk.bold('Working Directory: ') + (branchInfo.isClean ? chalk.green('Clean ✓') : chalk.yellow('Modified ✗')));

    if (!branchInfo.isClean) {
      logger.blank();
      logger.log(chalk.bold('Uncommitted changes:'));

      if (status.modified.length > 0) {
        logger.log(chalk.yellow('  Modified:'));
        status.modified.forEach(file => logger.log(`    - ${file}`));
      }

      if (status.created.length > 0) {
        logger.log(chalk.green('  Created:'));
        status.created.forEach(file => logger.log(`    - ${file}`));
      }

      if (status.deleted.length > 0) {
        logger.log(chalk.red('  Deleted:'));
        status.deleted.forEach(file => logger.log(`    - ${file}`));
      }

      if (status.not_added.length > 0) {
        logger.log(chalk.gray('  Untracked:'));
        status.not_added.forEach(file => logger.log(`    - ${file}`));
      }
    }

    logger.blank();

    // Workflow configuration
    const configExists = await configService.exists();
    if (configExists) {
      const config = await configService.getConfig();
      logger.log(chalk.bold('Workflow Configuration: ') + chalk.green('.gwm.yml ✓'));

      logger.blank();
      logger.log(chalk.bold('Settings:'));
      logger.log(`  CI Wait: ${config.ci?.waitForChecks ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      logger.log(`  Fail Fast: ${config.ci?.failFast ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      logger.log(`  Security Scan: ${config.security?.scanSecrets ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      logger.log(`  Branch Protection: ${config.branchProtection?.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
    } else {
      logger.log(chalk.bold('Workflow Configuration: ') + chalk.gray('Not initialized'));
      logger.info('Run `gwm init` to create .gwm.yml');
    }

    logger.blank();
  } catch (error: any) {
    logger.error(`Failed to get status: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}
