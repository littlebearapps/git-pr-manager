#!/usr/bin/env node

/**
 * Doctor command - checks system requirements and optional dependencies
 * Helps users verify their gpm setup and identify missing tools
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { logger } from "../utils/logger";
import { ToolDetector } from "../services/ToolDetector";
import pkg from "../../package.json";


interface PreReleaseCheck {
  name: string;
  check: () => Promise<boolean> | boolean;
  error: string;
  warning?: boolean; // If true, warn but don't fail
}

interface DoctorOptions {
  preRelease?: boolean;
  json?: boolean;
}

/**
 * Pre-release validation checks
 */
const PRE_RELEASE_CHECKS: PreReleaseCheck[] = [
  {
    name: "Workflow files exist",
    check: () => {
      const workflows = [
        ".github/workflows/ci.yml",
        ".github/workflows/publish.yml",
      ];
      return workflows.every((w) => existsSync(w));
    },
    error: "Required workflow files missing",
  },
  {
    name: "Badge URLs match workflows",
    check: () => {
      if (!existsSync("README.md")) return false;
      if (!existsSync(".github/workflows")) return false;

      const readme = readFileSync("README.md", "utf-8");
      const workflowFiles = readdirSync(".github/workflows").filter(
        (f) => f.endsWith(".yml") && !f.endsWith(".deprecated"),
      );

      const workflowNames: string[] = [];
      for (const file of workflowFiles) {
        const content = readFileSync(`.github/workflows/${file}`, "utf-8");
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        if (nameMatch) {
          workflowNames.push(nameMatch[1].trim());
        }
      }

      // Extract badge workflow names from README
      const badgeMatches = readme.matchAll(/workflows\/([^\/]+)\/badge\.svg/g);
      for (const match of badgeMatches) {
        const badgeWorkflowName = match[1];
        if (!workflowNames.includes(badgeWorkflowName)) {
          return false;
        }
      }
      return true;
    },
    error: "README badges reference non-existent workflows",
  },
  {
    name: "package.json version is placeholder",
    check: () => {
      if (!existsSync("package.json")) {
        return false;
      }
      const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
      return packageJson.version === "0.0.0-development";
    },
    error:
      'package.json version should be "0.0.0-development" for single source of truth',
    warning: true,
  },
  {
    name: "@semantic-release/git plugin NOT present",
    check: () => {
      if (!existsSync(".releaserc.json")) {
        return true; // OK if no config file
      }
      const releaserc = JSON.parse(readFileSync(".releaserc.json", "utf-8"));
      if (!releaserc.plugins) {
        return true; // OK if no plugins
      }
      // Check that git plugin is NOT present
      return !releaserc.plugins.some(
        (p: any) =>
          p === "@semantic-release/git" ||
          (Array.isArray(p) && p[0] === "@semantic-release/git"),
      );
    },
    error:
      "@semantic-release/git plugin found - should be removed for Alternative D",
    warning: true,
  },
  {
    name: "Working directory clean",
    check: () => {
      try {
        const status = execSync("git status --porcelain", {
          encoding: "utf-8",
        });
        return status.trim().length === 0;
      } catch {
        return false;
      }
    },
    error: "Uncommitted changes detected",
  },
  {
    name: "On main branch",
    check: () => {
      try {
        const branch = execSync("git branch --show-current", {
          encoding: "utf-8",
        });
        return branch.trim() === "main";
      } catch {
        return false;
      }
    },
    error: "Not on main branch - releases must be from main",
  },
  {
    name: "All CI checks passed",
    check: () => {
      try {
        // Get latest commit SHA
        const sha = execSync("git rev-parse HEAD", {
          encoding: "utf-8",
        }).trim();

        // Check if all required workflows passed for this commit
        const result = execSync(
          `gh run list --commit ${sha} --json conclusion,status`,
          { encoding: "utf-8", stdio: "pipe" },
        );
        const runs = JSON.parse(result);

        return runs.every(
          (run: any) =>
            run.status === "completed" && run.conclusion === "success",
        );
      } catch {
        // gh CLI not available or other error - skip this check
        return true;
      }
    },
    error: "CI checks have not all passed for HEAD commit",
    warning: true, // Warning because gh CLI might not be available
  },
];

/**
 * Doctor command - check system requirements
 */
export async function doctorCommand(
  options: DoctorOptions = {},
): Promise<void> {
  console.error("DEBUG: doctorCommand called with options:", options);
  // JSON mode with new ToolDetector
  if (options.json && !options.preRelease) {
    try {
      console.error("DEBUG: Creating detector...");
      const detector = new ToolDetector();
      console.error("DEBUG: Generating response...");
      const response = await detector.generateDoctorResponse(pkg.version);
      console.error("DEBUG: Outputting JSON...");
      console.log(JSON.stringify(response, null, 2));

      // Exit with error code if there are errors
      if (response.status === "errors") {
        process.exit(1);
      }
    } catch (error) {
      console.error("Error in doctor JSON mode:", error);
      process.exit(1);
    }
    return;
  }
  // Pre-release validation mode
  if (options.preRelease) {
    logger.section("Pre-Release Validation");

    let hasErrors = false;
    let hasWarnings = false;

    for (const check of PRE_RELEASE_CHECKS) {
      try {
        const passed = await Promise.resolve(check.check());
        if (passed) {
          logger.success(`✅ ${check.name}`);
        } else {
          if (check.warning) {
            logger.warn(`⚠️  ${check.name}: ${check.error}`);
            hasWarnings = true;
          } else {
            logger.error(`❌ ${check.name}: ${check.error}`);
            hasErrors = true;
          }
        }
      } catch (error: any) {
        logger.error(
          `❌ ${check.name}: Check failed - ${error.message || error}`,
        );
        hasErrors = true;
      }
    }

    logger.blank();
    logger.divider();

    if (hasErrors) {
      logger.error("⛔ Pre-release validation FAILED");
      logger.info("   Fix the errors above before publishing");
      process.exit(1);
    } else if (hasWarnings) {
      logger.warn("⚠️  Pre-release validation passed with warnings");
      logger.info("   Review warnings - they may indicate issues");
    } else {
      logger.success("✅ Pre-release validation PASSED");
      logger.info("   Ready to publish!");
    }

    return;
  }

  // Standard system health check - use ToolDetector for consistency
  logger.section("System Health Check");

  try {
    const detector = new ToolDetector();
    const response = await detector.generateDoctorResponse(pkg.version);

    // Display each check with appropriate formatting
    for (const check of response.checks) {
      // Format check display name from id (e.g., "tool.git" → "git")
      const displayName = check.id.split(".").pop() || check.id;

      if (check.status === "ok") {
        logger.success(`${displayName}${check.details ? `: ${check.details}` : ""}`);
      } else if (check.status === "missing") {
        const isRequired = check.id.startsWith("tool.git") || check.id.startsWith("tool.node");
        if (isRequired) {
          logger.error(`${displayName}: ${check.details || "Not found"}`);
        } else {
          logger.warn(`${displayName}: ${check.details || "Not found (optional)"}`);
        }

        // Show recommended action if available
        if (check.recommendedAction) {
          logger.info(`   → ${check.recommendedAction}`);
        }
      } else if (check.status === "incompatible") {
        logger.warn(`${displayName}: ${check.details || "Incompatible version"}`);
        if (check.recommendedAction) {
          logger.info(`   → ${check.recommendedAction}`);
        }
      }
    }

    logger.blank();
    logger.divider();

    // Summary based on overall status
    if (response.status === "errors") {
      logger.error("Required tools are missing - gpm may not work correctly");
      logger.info("   Please install missing required tools before using gpm");
    } else if (response.status === "warnings") {
      logger.warn("Some optional tools or features are missing");
      logger.info("   gpm will work but some features may be limited:");
      logger.info("   • Secret scanning requires detect-secrets");
      logger.info("   • Python security scans require pip-audit");
      logger.info("   • Enhanced GitHub features require gh CLI");
    } else {
      logger.success("All checks passed - your setup looks good!");
    }

    logger.blank();
    logger.log("Next Steps:");
    logger.info("  gpm setup             - Run setup wizard for missing tools");
    logger.info("  gpm init              - Initialize .gpm.yml configuration");
    logger.info("  gpm docs              - View documentation");
  } catch (error: any) {
    logger.error(`Doctor check failed: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
  }
}
