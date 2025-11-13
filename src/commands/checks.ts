import { EnhancedCIPoller } from '../services/EnhancedCIPoller';
import { OutputFormatter } from '../utils/OutputFormatter';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';

interface ChecksOptions {
  details?: boolean;
  files?: boolean;
}

/**
 * Show detailed CI check status for a PR
 */
export async function checksCommand(prNumberStr: string, options: ChecksOptions): Promise<void> {
  const prNumber = parseInt(prNumberStr, 10);

  if (isNaN(prNumber)) {
    logger.error(`Invalid PR number: ${prNumberStr}`);
    process.exit(1);
  }

  // Get GitHub token from environment
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    logger.error('GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable.');
    process.exit(1);
  }

  try {
    // Parse owner/repo from git remote (will be done by GitHubService)
    // For now, we'll need to get these from the current directory
    spinner.start(`Fetching CI check status for PR #${prNumber}...`);

    // Create a temporary GitHubService to get owner/repo
    const { execSync } = require('child_process');
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    const { owner, repo } = parseGitUrl(remoteUrl);

    const poller = new EnhancedCIPoller({ token, owner, repo });
    const formatter = new OutputFormatter();

    const summary = await poller.getDetailedCheckStatus(prNumber);
    spinner.stop();

    logger.blank();
    logger.section(`CI Check Status - PR #${prNumber}`);

    if (options.files) {
      // Show only affected files
      logger.log('\nAffected Files:');
      const allFiles = new Set<string>();
      summary.failureDetails.forEach(f => f.affectedFiles.forEach(file => allFiles.add(file)));

      if (allFiles.size === 0) {
        logger.info('No affected files found');
      } else {
        allFiles.forEach(file => logger.log(`  - ${file}`));
      }
    } else {
      // Show full summary
      const output = formatter.formatCheckSummary(summary);
      logger.log(output);

      if (options.details && summary.failureDetails.length > 0) {
        logger.blank();
        logger.section('Detailed Annotations');

        for (const failure of summary.failureDetails) {
          // Fetch annotations for this check run
          // Note: We'd need the check run ID which isn't in our current data structure
          logger.warn(`Annotation fetching not yet implemented for: ${failure.checkName}`);
        }
      }
    }

    // Exit with error code if checks failed
    if (summary.overallStatus === 'failure') {
      process.exit(1);
    }
  } catch (error: any) {
    spinner.fail('Failed to fetch CI check status');
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Parse a git URL into owner and repo
 */
function parseGitUrl(url: string): { owner: string; repo: string } {
  // SSH format: git@github.com:littlebearapps/notebridge.git
  const sshMatch = url.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2]
    };
  }

  // HTTPS format: https://github.com/littlebearapps/notebridge.git
  const httpsMatch = url.match(/https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }

  throw new Error(`Could not parse git URL: ${url}`);
}
