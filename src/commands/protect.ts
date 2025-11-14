import { GitHubService } from '../services/GitHubService';
import { GitService } from '../services/GitService';
import { BranchProtectionChecker } from '../services/BranchProtectionChecker';
import { ProtectionPreset } from '../types';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import chalk from 'chalk';

interface ProtectOptions {
  branch?: string;
  preset?: ProtectionPreset;
  show?: boolean;
}

/**
 * Configure branch protection
 */
export async function protectCommand(options: ProtectOptions = {}): Promise<void> {
  // Get GitHub token
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    logger.error('GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable.');
    process.exit(1);
  }

  try {
    // Initialize services
    const gitService = new GitService({ workingDir: process.cwd() });
    const githubService = new GitHubService({ token });
    const protectionChecker = new BranchProtectionChecker(
      githubService.octokit,
      githubService.owner,
      githubService.repo
    );

    const branch = options.branch || await gitService.getDefaultBranch();

    logger.section(`Branch Protection - ${chalk.cyan(branch)}`);

    // Show current protection status
    if (options.show || !options.preset) {
      spinner.start('Fetching branch protection settings...');
      const protection = await protectionChecker.getProtection(branch);
      spinner.succeed();

      // Build JSON data for structured output
      const jsonData = {
        branch,
        enabled: protection.enabled,
        requiredStatusChecks: protection.requiredStatusChecks || [],
        strictChecks: protection.strictChecks || false,
        requiredReviews: protection.requiredReviews || 0,
        dismissStaleReviews: protection.dismissStaleReviews || false,
        requireCodeOwnerReviews: protection.requireCodeOwnerReviews || false,
        requireConversationResolution: protection.requireConversationResolution || false,
        requireLinearHistory: protection.requireLinearHistory || false,
        enforceAdmins: protection.enforceAdmins || false,
        allowForcePushes: protection.allowForcePushes || false,
        allowDeletions: protection.allowDeletions || false
      };

      // Output JSON if in JSON mode (will only output if jsonMode enabled)
      logger.outputJsonResult(true, jsonData);

      // Human-readable output below (will only output if jsonMode disabled)
      logger.blank();

      if (!protection.enabled) {
        logger.warn('Branch protection is NOT enabled');
        logger.blank();
        logger.info('Enable protection with:');
        logger.log(`  ${chalk.cyan('gwm protect --preset basic')}    # Basic protection`);
        logger.log(`  ${chalk.cyan('gwm protect --preset standard')} # Recommended`);
        logger.log(`  ${chalk.cyan('gwm protect --preset strict')}   # Maximum protection`);
        return;
      }

      logger.success('Branch protection is enabled');
      logger.blank();

      // Display protection settings
      logger.info('Protection Rules:');

      if (protection.requiredStatusChecks && protection.requiredStatusChecks.length > 0) {
        logger.log(`  ✅ Required status checks: ${protection.requiredStatusChecks.join(', ')}`);
        logger.log(`     ${protection.strictChecks ? '✅' : '⚠️ '} Strict (branch must be up-to-date)`);
      } else {
        logger.log('  ⚠️  No required status checks');
      }

      if (protection.requiredReviews && protection.requiredReviews > 0) {
        logger.log(`  ✅ Required approving reviews: ${protection.requiredReviews}`);
        if (protection.dismissStaleReviews) {
          logger.log('     ✅ Dismiss stale reviews');
        }
        if (protection.requireCodeOwnerReviews) {
          logger.log('     ✅ Require code owner reviews');
        }
      } else {
        logger.log('  ⚠️  No required reviews');
      }

      logger.log(`  ${protection.requireConversationResolution ? '✅' : '⚠️ '} Require conversation resolution`);
      logger.log(`  ${protection.requireLinearHistory ? '✅' : '⚠️ '} Require linear history`);
      logger.log(`  ${protection.enforceAdmins ? '✅' : '⚠️ '} Enforce for administrators`);
      logger.log(`  ${protection.allowForcePushes ? '⚠️ ' : '✅'} ${protection.allowForcePushes ? 'Allows' : 'Blocks'} force pushes`);
      logger.log(`  ${protection.allowDeletions ? '⚠️ ' : '✅'} ${protection.allowDeletions ? 'Allows' : 'Blocks'} deletions`);

      logger.blank();
      logger.info('Update protection with:');
      logger.log(`  ${chalk.cyan(`gwm protect --preset standard --branch ${branch}`)}`);

      return;
    }

    // Setup protection with preset
    const preset = options.preset || 'standard';

    logger.info(`Applying ${chalk.cyan(preset)} protection preset...`);
    logger.blank();

    // Show what will be configured
    const presetDescriptions = {
      basic: [
        '• No required status checks',
        '• No required reviews',
        '• No restrictions'
      ],
      standard: [
        '• Required status checks: ci, security',
        '• Strict branch updates',
        '• Dismiss stale reviews',
        '• Require conversation resolution',
        '• Block force pushes and deletions'
      ],
      strict: [
        '• Required status checks: ci, security, tests, lint',
        '• Strict branch updates',
        '• 1 required approving review',
        '• Require code owner reviews',
        '• Dismiss stale reviews',
        '• Require conversation resolution',
        '• Require linear history',
        '• Enforce for admins',
        '• Block force pushes and deletions'
      ]
    };

    logger.info('Configuration:');
    presetDescriptions[preset].forEach(desc => logger.log(`  ${desc}`));

    logger.blank();
    spinner.start('Updating branch protection...');

    await protectionChecker.setupProtection(branch, preset);

    spinner.succeed('Branch protection updated!');

    logger.blank();
    logger.success(`${chalk.cyan(branch)} is now protected with ${chalk.cyan(preset)} preset`);

    logger.blank();
    logger.info('Verify protection:');
    logger.log(`  ${chalk.cyan('gwm protect --show')}`);

  } catch (error: any) {
    spinner.fail('Failed to configure branch protection');
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}
