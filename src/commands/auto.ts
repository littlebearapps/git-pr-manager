import { GitHubService } from '../services/GitHubService';
import { GitService } from '../services/GitService';
import { ConfigService } from '../services/ConfigService';
import { PRService } from '../services/PRService';
import { VerifyService } from '../services/VerifyService';
import { SecurityScanner } from '../services/SecurityScanner';
import { EnhancedCIPoller } from '../services/EnhancedCIPoller';
import { BranchProtectionChecker } from '../services/BranchProtectionChecker';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import chalk from 'chalk';

interface AutoOptions {
  draft?: boolean;
  noMerge?: boolean;
  skipSecurity?: boolean;
  skipVerify?: boolean;
}

/**
 * Auto workflow - Automated feature branch shipping
 * Detects state, runs checks, creates PR, waits for CI, and merges
 */
export async function autoCommand(options: AutoOptions = {}): Promise<void> {
  // Get GitHub token
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    logger.error(
      'GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable.',
      'AUTH_ERROR',
      undefined,
      ['Run: export GITHUB_TOKEN=your_token_here', 'Or: export GH_TOKEN=your_token_here']
    );
    process.exit(1);
  }

  try {
    logger.section('🚀 Auto Workflow');

    // Initialize services
    const gitService = new GitService({ workingDir: process.cwd() });
    const configService = new ConfigService();
    const config = await configService.getConfig();
    const githubService = new GitHubService({ token });
    const prService = new PRService(githubService, gitService, configService);
    const verifyService = new VerifyService();
    const securityScanner = new SecurityScanner();
    const ciPoller = new EnhancedCIPoller({
      token,
      owner: githubService.owner,
      repo: githubService.repo
    });
    const branchProtectionChecker = new BranchProtectionChecker(
      githubService.octokit,
      githubService.owner,
      githubService.repo
    );

    // Step 1: Detect current state
    logger.info('Detecting current state...');
    const branchInfo = await gitService.getBranchInfo();
    const currentBranch = branchInfo.current;
    const defaultBranch = await gitService.getDefaultBranch();

    // Check if on default branch
    if (currentBranch === defaultBranch) {
      logger.error(
        `Cannot run auto workflow from ${defaultBranch} branch.`,
        'BRANCH_ERROR',
        { currentBranch, defaultBranch },
        [
          `Create a feature branch first: gwm feature <name>`,
          `Or checkout an existing branch: git checkout <branch>`
        ]
      );
      process.exit(1);
    }

    logger.success(`Current branch: ${chalk.cyan(currentBranch)}`);

    // Step 2: Run verification if working directory has changes
    if (!branchInfo.isClean && !options.skipVerify) {
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
      }
    } else if (options.skipVerify) {
      logger.warn('Skipping verification checks (--skip-verify)');
    }

    // Step 3: Security scan
    if (!options.skipSecurity && config.security?.scanSecrets) {
      spinner.start('Running security scan...');

      const securityResult = await securityScanner.scan();

      if (!securityResult.passed) {
        spinner.fail('Security scan failed');
        logger.blank();
        securityResult.blockers.forEach(blocker => logger.error(blocker));
        process.exit(1);
      }

      spinner.succeed('Security scan passed');
    } else if (options.skipSecurity) {
      logger.warn('Skipping security scan (--skip-security)');
    }

    // Step 4: Push changes
    logger.info('Pushing changes to remote...');
    await gitService.push();
    logger.success('Pushed to remote');

    // Step 5: Create or find PR
    spinner.start('Checking for existing PR...');
    const existingPRs = await githubService.listPRs('open');
    const pr = existingPRs.find(p => p.head.ref === currentBranch);
    let prNumber: number;

    if (!pr) {
      spinner.update('Creating pull request...');

      // Generate PR title from branch name
      const title = options.draft
        ? `[DRAFT] ${currentBranch.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())}`
        : currentBranch.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());

      const prResult = await prService.createPR({
        title,
        template: config.pr?.templatePath,
        draft: options.draft ?? false
      });

      prNumber = prResult.number;
      spinner.succeed(`PR created: ${chalk.cyan(prResult.url)}`);
    } else {
      prNumber = pr.number;
      spinner.succeed(`Found existing PR #${pr.number}: ${chalk.cyan(pr.html_url)}`);
    }

    // Step 6: Wait for CI checks
    if (config.ci?.waitForChecks ?? true) {
      logger.blank();
      logger.info(`Waiting for CI checks on PR #${prNumber}...`);

      const startTime = Date.now();
      const checkResult = await ciPoller.waitForChecks(prNumber, {
        timeout: (config.ci?.timeout ?? 30) * 60 * 1000, // minutes to ms
        failFast: config.ci?.failFast ?? true,
        retryFlaky: config.ci?.retryFlaky ?? false,
        onProgress: (progress) => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          logger.info(
            `  ${progress.passed}/${progress.total} passed, ${progress.pending} pending (${elapsed}s elapsed)`
          );

          // Report new failures
          if (progress.newFailures.length > 0) {
            logger.warn(`  New failures: ${progress.newFailures.join(', ')}`);
          }

          // Report new passes
          if (progress.newPasses.length > 0) {
            logger.success(`  Now passing: ${progress.newPasses.join(', ')}`);
          }
        }
      });

      if (!checkResult.success) {
        logger.blank();
        logger.error('CI checks failed', 'CI_FAILURE');
        logger.blank();

        // Show failure details
        if (checkResult.summary.failureDetails.length > 0) {
          logger.log('Failed checks:');
          checkResult.summary.failureDetails.forEach(failure => {
            logger.log(`  ${chalk.red('✗')} ${failure.checkName}`);
            if (failure.summary) {
              logger.log(`    ${failure.summary}`);
            }
            if (failure.suggestedFix) {
              logger.log(`    ${chalk.yellow('Suggestion:')} ${failure.suggestedFix}`);
            }
          });
        }

        logger.blank();
        // Get PR URL for displaying details
        const prDetails = await githubService.getPR(prNumber);
        logger.info(`View details: ${prDetails.html_url}/checks`);
        process.exit(1);
      }

      logger.success(`✅ All CI checks passed (${Math.floor(checkResult.duration / 1000)}s)`);
    } else {
      logger.warn('Skipping CI checks (waitForChecks: false)');
    }

    // Step 7: Validate and merge PR
    if (!options.noMerge) {
      logger.blank();
      spinner.start('Validating PR readiness...');

      const validation = await branchProtectionChecker.validatePRReadiness(prNumber);

      if (!validation.ready) {
        spinner.fail('PR not ready to merge');
        logger.blank();
        logger.error('Issues preventing merge:');
        validation.issues.forEach(issue => logger.log(`  ${chalk.red('✗')} ${issue}`));

        if (validation.warnings.length > 0) {
          logger.blank();
          logger.warn('Warnings:');
          validation.warnings.forEach(warning => logger.log(`  ${chalk.yellow('⚠')} ${warning}`));
        }

        logger.blank();
        const prDetails = await githubService.getPR(prNumber);
        logger.info(`View PR: ${prDetails.html_url}`);
        process.exit(1);
      }

      spinner.succeed('PR ready to merge');

      // Merge PR
      spinner.start('Merging PR...');
      await prService.mergePR(prNumber, { deleteBranch: true });
      spinner.succeed('PR merged successfully');

      // Switch back to default branch
      await gitService.checkout(defaultBranch);
      await gitService.pull();

      logger.blank();
      logger.success(`🎉 Feature shipped! Merged PR #${prNumber}`);
      logger.success(`Switched back to ${defaultBranch} branch`);

      // Output JSON for successful merge
      const prDetails = await githubService.getPR(prNumber);
      logger.outputJsonResult(true, {
        success: true,
        merged: true,
        prNumber,
        prUrl: prDetails.html_url,
        branch: currentBranch,
        defaultBranch
      });
    } else {
      logger.blank();
      logger.success(`✅ Workflow complete (--no-merge flag set)`);
      const prDetails = await githubService.getPR(prNumber);
      logger.info(`PR is ready to merge: ${prDetails.html_url}`);

      // Output JSON for no-merge completion
      logger.outputJsonResult(true, {
        success: true,
        merged: false,
        prNumber,
        prUrl: prDetails.html_url,
        branch: currentBranch,
        defaultBranch
      });
    }
  } catch (error: any) {
    logger.blank();
    logger.error(`Auto workflow failed: ${error.message}`, 'WORKFLOW_ERROR');
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}
