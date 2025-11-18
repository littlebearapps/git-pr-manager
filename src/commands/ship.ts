import { GitHubService } from '../services/GitHubService';
import { GitService } from '../services/GitService';
import { ConfigService } from '../services/ConfigService';
import { PRService } from '../services/PRService';
import { VerifyService } from '../services/VerifyService';
import { SecurityScanner } from '../services/SecurityScanner';
import { EnhancedCIPoller } from '../services/EnhancedCIPoller';
import { AutoFixService } from '../services/AutoFixService';
import { OutputFormatter } from '../utils/OutputFormatter';
import { logger } from '../utils/logger';
import { spinner, withSpinner } from '../utils/spinner';
import chalk from 'chalk';
import { ExecutionTracker } from '../utils/ExecutionTracker';

interface ShipOptions {
  wait?: boolean;
  failFast?: boolean;
  retryFlaky?: boolean;
  skipVerify?: boolean;
  skipSecurity?: boolean;
  skipCi?: boolean;
  skipAutoFix?: boolean;
  deleteBranch?: boolean;
  draft?: boolean;
  title?: string;
  template?: string;
}

/**
 * Ship a feature branch - create PR, wait for CI, merge
 */
export async function shipCommand(options: ShipOptions = {}): Promise<void> {
  // Get GitHub token
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    logger.error('GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable.');
    process.exit(1);
  }

  let tracker: ExecutionTracker | null = null;
  try {
    tracker = new ExecutionTracker();
    // Initialize services
    const gitService = new GitService({ workingDir: process.cwd() });
    const configService = new ConfigService();
    const githubService = new GitHubService({ token });
    const prService = new PRService(githubService, gitService, configService);
    const verifyService = new VerifyService();

    // Load configuration
    const config = await configService.getConfig();
    const waitForChecks = options.wait ?? config.ci?.waitForChecks ?? true;
    const failFast = options.failFast ?? config.ci?.failFast ?? true;
    const retryFlaky = options.retryFlaky ?? config.ci?.retryFlaky ?? false;
    const deleteBranch = options.deleteBranch ?? true;

    logger.section('Shipping Feature');

    // Step 1: Preflight checks
    logger.info('Running preflight checks...');

    const branchInfo = await gitService.getBranchInfo();
    const currentBranch = branchInfo.current;
    const defaultBranch = await gitService.getDefaultBranch();

    // Check we're not on default branch
    if (currentBranch === defaultBranch) {
      logger.error(`Cannot ship from ${defaultBranch} branch. Create a feature branch first.`);
      process.exit(1);
    }

    // Check working directory is clean
    if (!branchInfo.isClean) {
      logger.error('Working directory has uncommitted changes. Commit or stash them first.');
      process.exit(1);
    }

    logger.success(`Current branch: ${chalk.cyan(currentBranch)}`);

    // Step 2: Run verification checks
    if (!options.skipVerify) {
      const hasVerify = await verifyService.hasVerifyScript();

      if (hasVerify) {
        spinner.start('Running verification checks...');

        const verifyResult = await verifyService.runChecks({
          onProgress: (msg) => spinner.update(msg)
        });

        if (!verifyResult.success) {
          spinner.fail('Verification checks failed');
          logger.blank();
          logger.error('Verification errors:');
          verifyResult.errors.forEach(err => logger.log(`  ${err}`));
          process.exit(1);
        }

        spinner.succeed(`Verification checks passed (${verifyResult.duration}ms)`);
        tracker.logCompleted('verification', verifyResult.duration);
      } else {
        logger.warn('No verification script found (skipping)');
        tracker.logSkipped('verification', 'no verification script');
      }
    } else {
      logger.warn('Skipping verification checks (--skip-verify)');
      tracker.logSkipped('verification', '--skip-verify flag');
    }

    // Step 2b: Run security scan
    if (!options.skipSecurity) {
      logger.blank();
      spinner.start('Running security scan...');
      const securityStart = Date.now();

      const securityScanner = new SecurityScanner(process.cwd());
      const securityResult = await securityScanner.scan();

      if (!securityResult.passed) {
        spinner.fail('Security scan failed');
        logger.blank();
        logger.error('Security blockers:');
        securityResult.blockers.forEach(blocker => logger.log(`  • ${blocker}`));

        if (securityResult.warnings.length > 0) {
          logger.blank();
          logger.warn('Warnings:');
          securityResult.warnings.forEach(warning => logger.log(`  • ${warning}`));
        }

        logger.blank();
        logger.info('Fix security issues before shipping:');
        logger.log(`  • ${chalk.cyan('gpm security')} - View detailed security report`);
        logger.log('  • Remove secrets and update .gitignore');
        logger.log('  • Update vulnerable dependencies');

        process.exit(1);
      }

      spinner.succeed('Security scan passed');
      tracker.logCompleted('security', Date.now() - securityStart);

      if (securityResult.warnings.length > 0) {
        securityResult.warnings.forEach(warning => logger.warn(`  ${warning}`));
      }
    } else {
      logger.warn('Skipping security scan (--skip-security)');
      tracker.logSkipped('security', '--skip-security flag');
    }

    // Step 3: Check if PR already exists
    logger.blank();
    logger.info('Checking for existing PR...');

    let prNumber: number;
    let prUrl: string;

    const existingPR = await prService.findPRForBranch(currentBranch);

    if (existingPR) {
      logger.info(`Found existing PR #${existingPR.number}`);
      prNumber = existingPR.number;
      prUrl = existingPR.html_url;
      // Skip push/create-pr when PR already exists
      tracker.logSkipped('push', 'PR already exists');
      tracker.logSkipped('create-pr', 'PR already exists');
    } else {
      // Step 4: Push branch
      logger.blank();
      const pushStart = Date.now();
      await withSpinner(
        'Pushing branch to remote...',
        async () => {
          await gitService.push('origin', currentBranch, true);
        }
      );
      tracker.logCompleted('push', Date.now() - pushStart);

      // Step 5: Create PR
      logger.blank();
      spinner.start('Creating pull request...');

      const title = options.title || generatePRTitle(currentBranch);

      const pr = await prService.createPR({
        title,
        head: currentBranch,
        base: defaultBranch,
        draft: options.draft,
        template: options.template
      });

      prNumber = pr.number;
      prUrl = pr.url;

      spinner.succeed(`Created PR #${prNumber}`);
      logger.info(`URL: ${chalk.blue(prUrl)}`);
      tracker.logCompleted('create-pr');
    }

    // Step 6: Wait for CI checks
    if (waitForChecks && !options.skipCi) {
      logger.blank();
      logger.section(`Waiting for CI Checks - PR #${prNumber}`);

      const poller = new EnhancedCIPoller({
        token,
        owner: githubService.owner,
        repo: githubService.repo
      });

      const formatter = new OutputFormatter();

      try {
        const result = await poller.waitForChecks(prNumber, {
          timeout: (config.ci?.timeout || 30) * 60 * 1000, // minutes to ms
          pollInterval: 10000, // 10 seconds
          failFast,
          retryFlaky,
          onProgress: (progress) => {
            // Special formatting for no-checks scenario
            if (progress.total === 0) {
              logger.warn('No CI checks configured');
            } else {
              const formatted = formatter.formatProgress(progress);
              logger.log(formatted);
            }
          }
        });

        logger.blank();

        if (result.success) {
          if (result.summary.total === 0) {
            logger.success('No CI checks to wait for - proceeding with merge');
          } else {
            logger.success('All CI checks passed!');
          }
          tracker.logCompleted('wait-ci', result.duration);
        } else {
          logger.error('CI checks failed');
          logger.blank();

          const formatted = formatter.formatCheckSummary(result.summary);
          logger.log(formatted);

          // Phase 6: Auto-fix on CI failure
          if (!options.skipAutoFix && result.summary.failed > 0) {
            logger.blank();
            logger.section('🔧 Attempting Auto-Fix');

            const autoFixService = new AutoFixService(gitService, githubService);
            const fixResults = [];

            for (const failure of result.summary.failureDetails) {
              logger.info(`Analyzing: ${chalk.cyan(failure.checkName)} (${failure.errorType})`);

              const fixResult = await autoFixService.attemptFix(failure, prNumber);

              if (fixResult.success) {
                logger.success(`✅ Auto-fixed: ${failure.checkName}`);
                logger.info(`   Fix PR: #${fixResult.prNumber}`);
                fixResults.push(fixResult);
              } else {
                const reason = fixResult.reason || 'unknown';
                logger.warn(`⚠️  Cannot auto-fix: ${failure.checkName} (${reason})`);
              }
            }

            if (fixResults.length > 0) {
              logger.blank();
              logger.success(`🎉 Created ${fixResults.length} auto-fix PR(s)`);
              logger.info('CI will re-run on fix PRs. Merge them to continue.');
              logger.blank();
              logger.info('Fix PRs:');
              fixResults.forEach(r => logger.log(`  • PR #${r.prNumber}`));

              // Exit here - user should merge fix PRs
              process.exit(0);
            } else {
              logger.blank();
              logger.warn('No auto-fixes available for these errors.');
              logger.info('Manual fixes required.');
            }
          } else if (options.skipAutoFix) {
            logger.warn('Auto-fix disabled (--skip-auto-fix)');
          }

          logger.blank();
          process.exit(1);
        }
      } catch (error: any) {
        logger.error(`CI check polling failed: ${error.message}`);
        // Track as unknown failure
        try { (tracker as ExecutionTracker).logFailed('unknown', error.message); } catch {}
        process.exit(1);
      }
    } else {
      if (options.skipCi) {
        logger.warn('Skipping CI checks (--skip-ci)');
        tracker.logSkipped('wait-ci', '--skip-ci flag');
      } else {
        logger.warn('CI waiting disabled in config');
        tracker.logSkipped('wait-ci', 'ci.waitForChecks disabled');
      }
    }

    // Step 7: Merge PR
    logger.blank();
    spinner.start('Merging pull request...');
    const mergeStart = Date.now();

    const mergeResult = await prService.mergePR(prNumber, {
      method: 'merge',
      deleteBranch
    });

    if (!mergeResult.merged) {
      spinner.fail('Failed to merge PR');
      process.exit(1);
    }

    spinner.succeed('Pull request merged!');
    tracker.logCompleted('merge', Date.now() - mergeStart);

    if (deleteBranch) {
      logger.success('Remote branch deleted');

      // Checkout default branch and delete local branch
      await gitService.checkout(defaultBranch);
      await gitService.pull();
      await gitService.deleteBranch(currentBranch, true);

      logger.success('Local branch deleted');
      tracker.logCompleted('cleanup');
    } else {
      tracker.logSkipped('cleanup', '--no-delete-branch flag');
    }

    // Output JSON for successful ship (include execution metadata)
    logger.outputJsonResult(true, {
      success: true,
      merged: true,
      prNumber,
      prUrl,
      branch: currentBranch,
      defaultBranch,
      branchDeleted: deleteBranch,
      execution: tracker.getSummary()
    });

    // Final success message
    logger.blank();
    logger.section('✨ Feature Shipped Successfully!');
    logger.log(`PR #${prNumber}: ${chalk.blue(prUrl)}`);
    logger.log(`Branch: ${chalk.cyan(currentBranch)} → ${chalk.cyan(defaultBranch)}`);

  } catch (error: any) {
    spinner.fail('Ship command failed');
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    try { (tracker as ExecutionTracker)?.logFailed('unknown', error.message); } catch {}
    process.exit(1);
  }
}

/**
 * Generate PR title from branch name
 */
function generatePRTitle(branchName: string): string {
  // Remove common prefixes
  let title = branchName
    .replace(/^(feature|feat|fix|bug|hotfix|chore|docs|refactor)\//, '')
    .replace(/[-_]/g, ' ');

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return title;
}
