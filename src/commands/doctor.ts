#!/usr/bin/env node

/**
 * Doctor command - checks system requirements and optional dependencies
 * Helps users verify their gpm setup and identify missing tools
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger";
import { ToolDetector } from "../services/ToolDetector";
import pkg from "../../package.json";

interface Tool {
  name: string;
  required: boolean;
  purpose: string;
  installCommand?: string;
  checkCommand?: string;
}

interface SetupOption {
  priority: "recommended" | "alternative";
  method: string;
  security: "high" | "medium" | "low";
  steps: string[];
}

interface TokenCheckResult {
  found: boolean;
  source?: string;
  setupOptions?: SetupOption[];
}

interface AvailableTools {
  direnv: boolean;
  keychain: boolean;
  hasEnvrc: boolean;
  hasEnv: boolean;
}

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

const TOOLS: Tool[] = [
  {
    name: "git",
    required: true,
    purpose: "Version control - required for all gpm operations",
    checkCommand: "git --version",
  },
  {
    name: "node",
    required: true,
    purpose: "JavaScript runtime - required to run gpm",
    checkCommand: "node --version",
  },
  {
    name: "gh",
    required: false,
    purpose: "GitHub CLI - enhanced PR features",
    installCommand: "https://cli.github.com/",
    checkCommand: "gh --version",
  },
  {
    name: "detect-secrets",
    required: false,
    purpose: "Secret scanning in code",
    installCommand: "pip install detect-secrets",
    checkCommand: "detect-secrets --version",
  },
  {
    name: "pip-audit",
    required: false,
    purpose: "Python dependency vulnerability scanning",
    installCommand: "pip install pip-audit",
    checkCommand: "pip-audit --version",
  },
  {
    name: "npm",
    required: false,
    purpose: "JavaScript/Node.js package manager",
    installCommand: "https://nodejs.org/",
    checkCommand: "npm --version",
  },
];

/**
 * Check if a command exists on the system
 */
function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get version of a tool if available
 */
function getVersion(checkCommand: string): string | null {
  try {
    const output = execSync(checkCommand, { encoding: "utf-8", stdio: "pipe" });
    return output.trim().split("\n")[0];
  } catch {
    return null;
  }
}

/**
 * Detect available token setup tools
 */
function detectAvailableTools(): AvailableTools {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";

  return {
    direnv: commandExists("direnv"),
    keychain: existsSync(join(homeDir, "bin", "kc.sh")),
    hasEnvrc: existsSync(".envrc"),
    hasEnv: existsSync(".env"),
  };
}

/**
 * Build ranked setup options based on available tools
 */
function buildSetupOptions(tools: AvailableTools): SetupOption[] {
  const options: SetupOption[] = [];

  // Option 1: direnv + keychain (most secure)
  if (tools.direnv && tools.keychain) {
    options.push({
      priority: "recommended",
      method: "direnv + keychain",
      security: "high",
      steps: [
        "Create .envrc with keychain integration:",
        "  echo 'source ~/bin/kc.sh && export GITHUB_TOKEN=$(kc_get GITHUB_PAT)' >> .envrc",
        "  direnv allow",
        "  echo '.envrc' >> .gitignore  # Prevent accidental commit",
      ],
    });
  }

  // Option 2: direnv with plaintext
  if (tools.direnv && !tools.keychain) {
    options.push({
      priority: options.length === 0 ? "recommended" : "alternative",
      method: "direnv with .envrc",
      security: "medium",
      steps: [
        "Create .envrc file:",
        "  echo 'export GITHUB_TOKEN=\"ghp_your_token_here\"' >> .envrc",
        "  direnv allow",
        "  echo '.envrc' >> .gitignore  # IMPORTANT: Prevent token leak!",
      ],
    });
  }

  // Option 3: Shell profile (persistent)
  options.push({
    priority: "alternative",
    method: "shell profile",
    security: "medium",
    steps: [
      "Add to ~/.zshrc or ~/.bashrc:",
      "  echo 'export GITHUB_TOKEN=\"ghp_your_token_here\"' >> ~/.zshrc",
      "  source ~/.zshrc",
    ],
  });

  // Option 4: .env file
  options.push({
    priority: "alternative",
    method: ".env file",
    security: "low",
    steps: [
      "Create .env file:",
      "  echo 'GITHUB_TOKEN=ghp_your_token_here' >> .env",
      "  echo '.env' >> .gitignore  # CRITICAL: Prevent token leak!",
    ],
  });

  // Option 5: Current session only
  options.push({
    priority: "alternative",
    method: "current session",
    security: "low",
    steps: [
      "Export in current shell (temporary):",
      '  export GITHUB_TOKEN="ghp_your_token_here"',
      "",
      "Note: Token will be lost when you close the terminal",
    ],
  });

  return options;
}

/**
 * Check GitHub token with smart detection
 */
function checkGitHubToken(): TokenCheckResult {
  // Check if token is already set (any method works!)
  if (process.env.GITHUB_TOKEN) {
    return { found: true, source: "GITHUB_TOKEN" };
  }
  if (process.env.GH_TOKEN) {
    return { found: true, source: "GH_TOKEN" };
  }

  // Token not found - detect available tools and provide suggestions
  const tools = detectAvailableTools();
  const setupOptions = buildSetupOptions(tools);

  return {
    found: false,
    setupOptions,
  };
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

  // Standard system health check
  logger.section("System Health Check");

  let hasErrors = false;
  let hasWarnings = false;

  // Check GitHub token
  const tokenStatus = checkGitHubToken();
  if (tokenStatus.found) {
    logger.success(`GitHub token: ${tokenStatus.source}`);
  } else {
    logger.warn("GitHub token: Not found");
    logger.blank();

    // Show ranked setup options
    if (tokenStatus.setupOptions && tokenStatus.setupOptions.length > 0) {
      logger.log("Setup Options (ranked by security & your system):");
      logger.blank();

      // Show recommended option first
      const recommended = tokenStatus.setupOptions.filter(
        (opt) => opt.priority === "recommended",
      );
      const alternatives = tokenStatus.setupOptions.filter(
        (opt) => opt.priority === "alternative",
      );

      if (recommended.length > 0) {
        for (const option of recommended) {
          logger.success(
            `✨ Recommended: ${option.method} (${option.security} security)`,
          );
          for (const step of option.steps) {
            logger.log(`   ${step}`);
          }
          logger.blank();
        }
      }

      // Show alternatives
      if (alternatives.length > 0) {
        for (let i = 0; i < alternatives.length; i++) {
          const option = alternatives[i];
          logger.log(
            `Alternative ${i + 1}: ${option.method} (${option.security} security)`,
          );
          for (const step of option.steps) {
            logger.log(`   ${step}`);
          }
          if (i < alternatives.length - 1) {
            logger.blank();
          }
        }
      }

      logger.blank();
      logger.log("Generate token at: https://github.com/settings/tokens");
      logger.log(
        "Required scopes: repo (full control of private repositories)",
      );
    }

    hasWarnings = true;
  }

  logger.blank();
  logger.log("Required Tools:");
  logger.divider();

  // Check required tools
  const requiredTools = TOOLS.filter((t) => t.required);
  for (const tool of requiredTools) {
    const exists = commandExists(tool.name);
    if (exists) {
      const version = tool.checkCommand ? getVersion(tool.checkCommand) : null;
      logger.success(`${tool.name.padEnd(20)} ${version || "(installed)"}`);
    } else {
      logger.error(`${tool.name.padEnd(20)} NOT FOUND`);
      logger.info(`  ${tool.purpose}`);
      if (tool.installCommand) {
        logger.info(`  Install: ${tool.installCommand}`);
      }
      hasErrors = true;
    }
  }

  logger.blank();
  logger.log("Optional Tools:");
  logger.divider();

  // Check optional tools
  const optionalTools = TOOLS.filter((t) => !t.required);
  for (const tool of optionalTools) {
    const exists = commandExists(tool.name);
    if (exists) {
      const version = tool.checkCommand ? getVersion(tool.checkCommand) : null;
      logger.success(`${tool.name.padEnd(20)} ${version || "(installed)"}`);
    } else {
      logger.warn(`${tool.name.padEnd(20)} NOT FOUND (optional)`);
      logger.info(`  ${tool.purpose}`);
      if (tool.installCommand) {
        logger.info(`  Install: ${tool.installCommand}`);
      }
      hasWarnings = true;
    }
  }

  logger.blank();
  logger.divider();

  // Summary
  if (hasErrors) {
    logger.error("⚠️  Required tools are missing - gpm may not work correctly");
    logger.info("   Please install missing required tools before using gpm");
  } else if (hasWarnings) {
    logger.warn("ℹ️  Some optional tools are missing");
    logger.info("   gpm will work but some features may be limited:");
    logger.info("   • Secret scanning requires detect-secrets");
    logger.info("   • Python security scans require pip-audit");
    logger.info("   • Enhanced GitHub features require gh CLI");
  } else {
    logger.success("✅ All tools installed - your setup is complete!");
  }

  logger.blank();
  logger.log("Next Steps:");
  logger.info("  gpm init              - Initialize .gpm.yml configuration");
  logger.info("  gpm docs              - View documentation");
  logger.info("  gpm --help            - Show all commands");
}
