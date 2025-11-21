import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../utils/logger";
import { ConfigService } from "../services/ConfigService";
import { getGitHooksDir, fileExists, isGpmHook } from "../utils/git-hooks";

export interface HooksStatusOptions {
  json?: boolean; // JSON output mode
}

interface HookInfo {
  enabled: boolean;
  path: string;
  exists: boolean;
  isGpmHook: boolean;
  lastModified?: string;
}

interface HooksStatus {
  installed: boolean;
  hooks: {
    prePush: HookInfo;
    postCommit: HookInfo;
  };
  config: {
    disableInCI?: boolean;
    preCommit?: {
      enabled?: boolean;
      reminder?: boolean;
      autoFix?: boolean;
    };
    prePush?: {
      enabled?: boolean;
      reminder?: boolean;
      runValidation?: boolean;
    };
    postCommit?: {
      enabled?: boolean;
      reminder?: boolean;
    };
  };
  autoDisableContexts: string[];
}

export async function hooksStatusCommand(
  options: HooksStatusOptions,
): Promise<void> {
  try {
    const hooksDir = await getGitHooksDir();
    const configService = new ConfigService();
    const config = await configService.load();

    // Get hook file paths
    const prePushPath = path.join(hooksDir, "pre-push");
    const postCommitPath = path.join(hooksDir, "post-commit");

    // Check hook files
    const prePushExists = await fileExists(prePushPath);
    const postCommitExists = await fileExists(postCommitPath);

    const prePushIsGpm = prePushExists ? await isGpmHook(prePushPath) : false;
    const postCommitIsGpm = postCommitExists
      ? await isGpmHook(postCommitPath)
      : false;

    // Get file stats for last modified
    let prePushModified: string | undefined;
    let postCommitModified: string | undefined;

    if (prePushExists) {
      const stats = await fs.stat(prePushPath);
      prePushModified = stats.mtime.toISOString();
    }

    if (postCommitExists) {
      const stats = await fs.stat(postCommitPath);
      postCommitModified = stats.mtime.toISOString();
    }

    // Build status object
    const status: HooksStatus = {
      installed: prePushIsGpm || postCommitIsGpm,
      hooks: {
        prePush: {
          enabled: prePushIsGpm,
          path: prePushPath,
          exists: prePushExists,
          isGpmHook: prePushIsGpm,
          lastModified: prePushModified,
        },
        postCommit: {
          enabled: postCommitIsGpm,
          path: postCommitPath,
          exists: postCommitExists,
          isGpmHook: postCommitIsGpm,
          lastModified: postCommitModified,
        },
      },
      config: {
        disableInCI: config.hooks?.disableInCI,
        preCommit: config.hooks?.preCommit,
        prePush: config.hooks?.prePush,
        postCommit: config.hooks?.postCommit,
      },
      autoDisableContexts: [
        "CI",
        "GITHUB_ACTIONS",
        "GITLAB_CI",
        "JENKINS_HOME",
      ],
    };

    // Output
    if (options.json) {
      logger.outputJsonResult(true, status);
    } else {
      // Human-readable output
      logger.section("Git Hooks Status");

      if (!status.installed) {
        logger.warn("No gpm hooks installed");
        logger.info("\nInstall hooks with: gpm install-hooks");
        return;
      }

      logger.blank();

      // Pre-push hook
      logger.info("Pre-push Hook:");
      if (status.hooks.prePush.isGpmHook) {
        logger.success(`  ✅ Installed at ${status.hooks.prePush.path}`);
        if (status.hooks.prePush.lastModified) {
          logger.info(
            `  Last modified: ${new Date(status.hooks.prePush.lastModified).toLocaleString()}`,
          );
        }
      } else if (status.hooks.prePush.exists) {
        logger.warn(`  ⚠️  Exists but not a gpm hook`);
        logger.info(`  Run 'gpm install-hooks --force' to overwrite`);
      } else {
        logger.warn(`  ❌ Not installed`);
      }

      logger.blank();

      // Post-commit hook
      logger.info("Post-commit Hook:");
      if (status.hooks.postCommit.isGpmHook) {
        logger.success(`  ✅ Installed at ${status.hooks.postCommit.path}`);
        if (status.hooks.postCommit.lastModified) {
          logger.info(
            `  Last modified: ${new Date(status.hooks.postCommit.lastModified).toLocaleString()}`,
          );
        }
      } else if (status.hooks.postCommit.exists) {
        logger.warn(`  ⚠️  Exists but not a gpm hook`);
        logger.info(
          `  Run 'gpm install-hooks --post-commit --force' to overwrite`,
        );
      } else {
        logger.warn(`  ❌ Not installed`);
        logger.info(`  Install with: gpm install-hooks --post-commit`);
      }

      logger.blank();

      // Configuration section
      logger.info("Configuration (.gpm.yml):");
      logger.info(
        `  Disable in CI: ${(status.config.disableInCI ?? true) ? "✅ Yes" : "❌ No"}`,
      );

      if (status.config.preCommit) {
        logger.info(
          `  Pre-commit auto-fix: ${(status.config.preCommit.autoFix ?? true) ? "✅ Enabled" : "❌ Disabled"}`,
        );
      }

      if (status.config.prePush) {
        logger.info(
          `  Pre-push validation: ${(status.config.prePush.runValidation ?? false) ? "✅ Enabled" : "❌ Disabled"}`,
        );
      }

      logger.blank();
      logger.info("Auto-disable contexts:");
      status.autoDisableContexts.forEach((ctx) => {
        logger.info(`  • $${ctx}`);
      });

      logger.blank();
      logger.divider();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (options.json) {
      logger.outputJsonResult(false, null, {
        code: "HOOKS_STATUS_ERROR",
        message,
      });
    } else {
      logger.error(`Failed to get hooks status: ${message}`);
    }
    process.exit(1);
  }
}
