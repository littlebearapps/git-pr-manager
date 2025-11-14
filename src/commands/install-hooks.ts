import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';

export interface InstallHooksOptions {
  force?: boolean;       // Overwrite existing hooks
  json?: boolean;        // JSON output mode
  prePush?: boolean;     // Install pre-push hook (default: true)
  postCommit?: boolean;  // Install post-commit hook (default: false)
}

const PRE_PUSH_TEMPLATE = `#!/bin/sh
# gwm pre-push hook
# Installed via: gwm install-hooks
# Remove with: gwm uninstall-hooks
#
# This hook reminds you to use gwm for PR workflow.
# It never blocks your push - just a friendly reminder!

# Skip in CI environments
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ] || [ -n "$JENKINS_HOME" ]; then
  exit 0
fi

# Check if gwm is available
if command -v gwm >/dev/null 2>&1; then
  echo ""
  echo "💡 gwm reminder: Consider using 'gwm ship' or 'gwm auto'"
  echo "   • gwm ship       = Create PR + wait for CI + merge"
  echo "   • gwm auto       = Quick PR creation"
  echo "   • gwm security   = Security scan before PR"
  echo ""
  echo "   Remove this reminder: gwm uninstall-hooks"
  echo ""
fi

# Always allow push (exit 0 = success)
exit 0
`;

const POST_COMMIT_TEMPLATE = `#!/bin/sh
# gwm post-commit hook
# Installed via: gwm install-hooks
# Remove with: gwm uninstall-hooks
#
# This hook reminds you to consider creating a PR after commits.
# It never blocks your workflow - just a friendly reminder!

# Skip in CI environments
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ] || [ -n "$JENKINS_HOME" ]; then
  exit 0
fi

# Check if gwm is available
if command -v gwm >/dev/null 2>&1; then
  echo ""
  echo "💡 gwm reminder: Ready to create a PR?"
  echo "   • gwm ship       = Full PR workflow (create + wait + merge)"
  echo "   • gwm auto       = Quick PR creation"
  echo ""
  echo "   Remove this reminder: gwm uninstall-hooks"
  echo ""
fi

# Always succeed
exit 0
`;

/**
 * Install git hooks for gwm workflow reminders
 */
export async function installHooksCommand(options: InstallHooksOptions = {}): Promise<void> {
  try {
    // Default: install pre-push only unless specified
    const installPrePush = options.prePush !== false; // true by default
    const installPostCommit = options.postCommit === true; // false by default

    // Check if .git directory exists
    const gitDir = path.join(process.cwd(), '.git');
    try {
      await fs.access(gitDir);
    } catch {
      const error = 'Not a git repository. Cannot install hooks.';
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
    const installedHooks: string[] = [];

    // Ensure hooks directory exists
    await fs.mkdir(hooksDir, { recursive: true });

    // Install pre-push hook
    if (installPrePush) {
      const prePushPath = path.join(hooksDir, 'pre-push');
      const exists = await fileExists(prePushPath);

      if (exists && !options.force) {
        const isGwm = await isGwmHook(prePushPath);
        if (!isGwm) {
          const error = 'pre-push hook already exists (not created by gwm). Use --force to overwrite.';
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
      }

      // Write hook
      await fs.writeFile(prePushPath, PRE_PUSH_TEMPLATE, 'utf-8');

      // Make executable
      await fs.chmod(prePushPath, 0o755);

      installedHooks.push('pre-push');
    }

    // Install post-commit hook
    if (installPostCommit) {
      const postCommitPath = path.join(hooksDir, 'post-commit');
      const exists = await fileExists(postCommitPath);

      if (exists && !options.force) {
        const isGwm = await isGwmHook(postCommitPath);
        if (!isGwm) {
          const error = 'post-commit hook already exists (not created by gwm). Use --force to overwrite.';
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
      }

      // Write hook
      await fs.writeFile(postCommitPath, POST_COMMIT_TEMPLATE, 'utf-8');

      // Make executable
      await fs.chmod(postCommitPath, 0o755);

      installedHooks.push('post-commit');
    }

    // Update .gwm.yml config to track installation
    const configService = new ConfigService(process.cwd());
    const config = await configService.load();

    if (!config.hooks) {
      config.hooks = {
        prePush: { enabled: false, reminder: true },
        postCommit: { enabled: false, reminder: true }
      };
    }

    if (installPrePush) {
      config.hooks.prePush = { enabled: true, reminder: true };
    }

    if (installPostCommit) {
      config.hooks.postCommit = { enabled: true, reminder: true };
    }

    await configService.save(config);

    // Output results
    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        message: 'Git hooks installed successfully',
        hooks: installedHooks,
        location: '.git/hooks/'
      }));
    } else {
      logger.success('Git hooks installed successfully!');
      installedHooks.forEach(hook => {
        logger.info(`  • ${hook} hook: .git/hooks/${hook}`);
      });
      logger.blank();
      logger.info('💡 The hook(s) will remind you about gwm before pushes/commits');
      logger.info('   Remove with: gwm uninstall-hooks');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        error: errorMessage
      }));
    } else {
      logger.error(`Failed to install hooks: ${errorMessage}`);
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
