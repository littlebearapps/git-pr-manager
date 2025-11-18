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

    // Gather all status data
    const branchInfo = await gitService.getBranchInfo();
    const status = await gitService.getStatus();
    const configExists = await configService.exists();
    let config: any = null;
    if (configExists) {
      config = await configService.getConfig();
    }

    // Prepare JSON output data
    const jsonData = {
      branch: {
        current: branchInfo.current,
        isClean: branchInfo.isClean
      },
      files: {
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        untracked: status.not_added
      },
      config: configExists ? {
        exists: true,
        settings: {
          ciWait: config.ci?.waitForChecks ?? false,
          failFast: config.ci?.failFast ?? false,
          securityScan: config.security?.scanSecrets ?? false,
          branchProtection: config.branchProtection?.enabled ?? false
        },
        hooks: {
          prePush: {
            enabled: config.hooks?.prePush?.enabled ?? false,
            reminder: config.hooks?.prePush?.reminder ?? false
          },
          postCommit: {
            enabled: config.hooks?.postCommit?.enabled ?? false,
            reminder: config.hooks?.postCommit?.reminder ?? false
          }
        }
      } : {
        exists: false
      }
    };

    // Output JSON if in JSON mode (will only output if jsonMode enabled)
    logger.outputJsonResult(true, jsonData);

    // Human-readable output below (will only output if jsonMode disabled)
    logger.section('Git Workflow Status');

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
    if (configExists) {
      logger.log(chalk.bold('Workflow Configuration: ') + chalk.green('.gpm.yml ✓'));

      logger.blank();
      logger.log(chalk.bold('Settings:'));
      logger.log(`  CI Wait: ${config.ci?.waitForChecks ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      logger.log(`  Fail Fast: ${config.ci?.failFast ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      logger.log(`  Security Scan: ${config.security?.scanSecrets ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      logger.log(`  Branch Protection: ${config.branchProtection?.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
    } else {
      logger.log(chalk.bold('Workflow Configuration: ') + chalk.gray('Not initialized'));
      logger.info('Run `gpm init` to create .gpm.yml');
    }

    // ✨ Next Steps - Context-aware suggestions for AI agents and developers
    logger.section('💡 Next Steps');

    if (!configExists) {
      // No configuration - guide through setup
      logger.info('📋 Get started with gpm:');
      logger.info('   gpm init --interactive    # Initialize workflow configuration');
      logger.info('   gpm docs                  # View documentation');
      logger.blank();
      logger.info('💡 Tip: Run \'gpm init --interactive\' for guided setup');
    } else if (branchInfo.current === 'main' || branchInfo.current === 'master') {
      // On main branch - suggest starting new work
      logger.info('🚀 Start new work:');
      logger.info('   gpm feature <name>        # Create feature branch and start work');
      logger.info('   gpm status                # Check repository status');
      logger.blank();
      logger.info('💡 Tip: Always work on feature branches, not main');
    } else if (!branchInfo.isClean) {
      // Uncommitted changes - suggest committing
      logger.info('📝 You have uncommitted changes:');
      logger.info('   git add .                 # Stage changes');
      logger.info('   git commit -m "..."       # Commit with message');
      logger.info('   git push                  # Push to remote');
      logger.blank();
      logger.info('💡 Tip: Commit and push before using gpm ship or gpm auto');
    } else {
      // Clean feature branch - suggest PR workflow
      logger.info('🚢 Ready to create PR:');
      logger.info('   gpm ship                  # Create PR and wait for checks');
      logger.info('   gpm auto --draft          # Create draft PR (faster)');
      logger.info('   gpm security              # Run security scan before PR');
      logger.blank();
      logger.info('💡 Tip: Use \'gpm ship\' for full automated PR workflow');
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
