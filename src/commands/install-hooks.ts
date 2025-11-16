import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/ConfigService';
import { getGitHooksDir, fileExists, isGpmHook } from '../utils/git-hooks';

export interface InstallHooksOptions {
  force?: boolean;       // Overwrite existing hooks
  json?: boolean;        // JSON output mode
  prePush?: boolean;     // Install pre-push hook (default: true)
  postCommit?: boolean;  // Install post-commit hook (default: false)
}

const PRE_PUSH_TEMPLATE = `#!/bin/sh
# gpm pre-push hook
# Installed via: gpm install-hooks
# Remove with: gpm uninstall-hooks
#
# This hook reminds you to use gpm for PR workflow.
# It never blocks your push - just a friendly reminder!

# Skip in CI environments
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ] || [ -n "$JENKINS_HOME" ]; then
  exit 0
fi

# Check if gpm is available
if command -v gpm >/dev/null 2>&1; then
  echo ""
  echo "💡 gpm reminder: Consider using 'gpm ship' or 'gpm auto'"
  echo "   • gpm ship       = Create PR + wait for CI + merge"
  echo "   • gpm auto       = Quick PR creation"
  echo "   • gpm security   = Security scan before PR"
  echo ""
  echo "   Remove this reminder: gpm uninstall-hooks"
  echo ""
fi

# Always allow push (exit 0 = success)
exit 0
`;

const POST_COMMIT_TEMPLATE = `#!/bin/sh
# gpm post-commit hook
# Installed via: gpm install-hooks
# Remove with: gpm uninstall-hooks
#
# This hook reminds you to consider creating a PR after commits.
# It never blocks your workflow - just a friendly reminder!

# Skip in CI environments
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$GITLAB_CI" ] || [ -n "$JENKINS_HOME" ]; then
  exit 0
fi

# Check if gpm is available
if command -v gpm >/dev/null 2>&1; then
  echo ""
  echo "💡 gpm reminder: Ready to create a PR?"
  echo "   • gpm ship       = Full PR workflow (create + wait + merge)"
  echo "   • gpm auto       = Quick PR creation"
  echo ""
  echo "   Remove this reminder: gpm uninstall-hooks"
  echo ""
fi

# Always succeed
exit 0
`;

/**
 * Install git hooks for gpm workflow reminders
 */
export async function installHooksCommand(options: InstallHooksOptions = {}): Promise<void> {
  try {
    // Default: install pre-push only unless specified
    const installPrePush = options.prePush !== false; // true by default
    const installPostCommit = options.postCommit === true; // false by default

    // Get hooks directory (works for both standard repos and worktrees)
    let hooksDir: string;
    try {
      hooksDir = await getGitHooksDir();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Not a git repository';
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: errorMsg + '. Cannot install hooks.'
        }));
      } else {
        logger.error(errorMsg + '. Cannot install hooks.');
      }
      process.exit(1);
    }

    const installedHooks: string[] = [];

    // Ensure hooks directory exists
    await fs.mkdir(hooksDir, { recursive: true });

    // Install pre-push hook
    if (installPrePush) {
      const prePushPath = path.join(hooksDir, 'pre-push');
      const exists = await fileExists(prePushPath);

      if (exists && !options.force) {
        const isGpm = await isGpmHook(prePushPath);
        if (!isGpm) {
          const error = 'pre-push hook already exists (not created by gpm). Use --force to overwrite.';
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
        const isGpm = await isGpmHook(postCommitPath);
        if (!isGpm) {
          const error = 'post-commit hook already exists (not created by gpm). Use --force to overwrite.';
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

    // Update .gpm.yml config to track installation
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
        location: hooksDir
      }));
    } else {
      logger.success('Git hooks installed successfully!');
      installedHooks.forEach(hook => {
        logger.info(`  • ${hook} hook: ${path.join(hooksDir, hook)}`);
      });
      logger.blank();
      logger.info('💡 The hook(s) will remind you about gpm before pushes/commits');
      logger.info('   Remove with: gpm uninstall-hooks');
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
