/**
 * SetupOrchestrator service - orchestrates the complete setup experience
 * Coordinates tool detection, token setup, and provides actionable recommendations
 */

import { ToolDetector, Check } from "./ToolDetector";
import { KeychainIntegration } from "./KeychainIntegration";
import { logger } from "../utils/logger";
import prompts from "prompts";
import { execSync } from "child_process";

/**
 * Setup step result
 */
export interface SetupStep {
  name: string;
  status: "pending" | "completed" | "skipped" | "failed";
  message?: string;
  action?: () => Promise<void>;
}

/**
 * Setup report
 */
export interface SetupReport {
  timestamp: string;
  steps: SetupStep[];
  overallStatus: "success" | "partial" | "failed";
  recommendations: string[];
}

/**
 * Tool installation info
 */
interface ToolInstallInfo {
  name: string;
  command: string;
  package?: string;
  manager?: "npm" | "pip" | "brew" | "apt" | "manual";
}

/**
 * Service for orchestrating the complete setup experience
 */
export class SetupOrchestrator {
  private detector: ToolDetector;
  private keychain: KeychainIntegration;

  constructor() {
    this.detector = new ToolDetector();
    this.keychain = new KeychainIntegration();
  }

  /**
   * Run the interactive setup wizard
   */
  async runInteractiveSetup(): Promise<SetupReport> {
    const steps: SetupStep[] = [];
    const recommendations: string[] = [];
    const timestamp = new Date().toISOString();

    logger.section("🚀 gpm Setup Wizard");
    logger.blank();
    logger.info(
      "This wizard will help you set up gpm for optimal performance.",
    );
    logger.info(
      "We'll check your system, configure authentication, and suggest improvements.",
    );
    logger.blank();

    // Step 1: System detection
    logger.info("📊 Analyzing your system...");
    const response =
      await this.detector.generateDoctorResponse("0.0.0-development");

    // Step 2: Check GitHub token
    const tokenCheck = response.checks.find((c) => c.id === "github.token");
    if (tokenCheck?.status !== "ok") {
      steps.push({
        name: "GitHub Token Setup",
        status: "pending",
        message: "GitHub token not configured",
      });

      const { setupToken } = await prompts({
        type: "confirm",
        name: "setupToken",
        message: "GitHub token not found. Would you like to set it up now?",
        initial: true,
      });

      if (setupToken) {
        try {
          await this.setupGitHubToken();
          steps[steps.length - 1].status = "completed";
          steps[steps.length - 1].message =
            "GitHub token configured successfully";
        } catch (error: any) {
          steps[steps.length - 1].status = "failed";
          steps[steps.length - 1].message =
            `Failed to setup token: ${error.message}`;
          recommendations.push(
            "Set up GitHub token manually: gpm setup github-token",
          );
        }
      } else {
        steps[steps.length - 1].status = "skipped";
        recommendations.push(
          "Set up GitHub token later: gpm setup github-token",
        );
      }
    } else {
      steps.push({
        name: "GitHub Token Setup",
        status: "completed",
        message: "GitHub token already configured",
      });
    }

    // Step 3: Check required tools
    const requiredMissing = response.checks.filter(
      (c) =>
        c.id.startsWith("tool.") &&
        c.status === "missing" &&
        (c.id === "tool.git" || c.id === "tool.node"),
    );

    if (requiredMissing.length > 0) {
      for (const tool of requiredMissing) {
        const toolName = tool.id.replace("tool.", "");
        steps.push({
          name: `Install ${toolName}`,
          status: "failed",
          message: `Required tool ${toolName} is missing`,
        });
        recommendations.push(
          `Install ${toolName}: ${tool.recommendedAction || "see documentation"}`,
        );
      }
    }

    // Step 4: Check optional tools
    const optionalMissing = response.checks.filter(
      (c) =>
        c.id.startsWith("tool.") &&
        c.status === "missing" &&
        c.id !== "tool.git" &&
        c.id !== "tool.node",
    );

    if (optionalMissing.length > 0) {
      logger.blank();
      logger.warn(`⚠️  Found ${optionalMissing.length} missing optional tools`);

      const { installOptional } = await prompts({
        type: "confirm",
        name: "installOptional",
        message: "Would you like help installing optional tools?",
        initial: false,
      });

      if (installOptional) {
        await this.suggestToolInstallation(optionalMissing);
      }

      // Add recommendations for missing tools
      for (const tool of optionalMissing) {
        const toolName = tool.id.replace("tool.", "");
        if (tool.recommendedAction) {
          recommendations.push(`${toolName}: ${tool.recommendedAction}`);
        }
      }
    }

    // Step 5: Check package.json scripts
    const missingScripts = response.checks.filter(
      (c) => c.id.startsWith("script.") && c.status === "missing",
    );

    if (missingScripts.length > 0) {
      logger.blank();
      logger.info(
        `📝 Found ${missingScripts.length} recommended npm scripts missing`,
      );

      for (const script of missingScripts) {
        const scriptName = script.id.replace("script.", "");
        steps.push({
          name: `Add npm script: ${scriptName}`,
          status: "skipped",
          message: script.details,
        });

        if (script.recommendedAction) {
          const parts = script.recommendedAction.split(":");
          if (parts.length === 3 && parts[0] === "add-script") {
            recommendations.push(
              `Add to package.json scripts: "${parts[1]}": "${parts[2]}"`,
            );
          }
        }
      }
    }

    // Step 6: Configuration check
    const hasConfig = await this.checkConfiguration();
    if (!hasConfig) {
      logger.blank();
      const { createConfig } = await prompts({
        type: "confirm",
        name: "createConfig",
        message: "No .gpm.yml configuration found. Create one now?",
        initial: true,
      });

      if (createConfig) {
        try {
          await this.createConfiguration();
          steps.push({
            name: "Create .gpm.yml",
            status: "completed",
            message: "Configuration file created",
          });
        } catch (error: any) {
          steps.push({
            name: "Create .gpm.yml",
            status: "failed",
            message: `Failed to create config: ${error.message}`,
          });
          recommendations.push("Create configuration manually: gpm init");
        }
      } else {
        steps.push({
          name: "Create .gpm.yml",
          status: "skipped",
          message: "Configuration creation skipped",
        });
        recommendations.push("Create configuration later: gpm init");
      }
    }

    // Determine overall status
    const failedSteps = steps.filter((s) => s.status === "failed");
    const completedSteps = steps.filter((s) => s.status === "completed");

    const overallStatus =
      failedSteps.length > 0
        ? "failed"
        : completedSteps.length === steps.length
          ? "success"
          : "partial";

    // Final report
    logger.blank();
    logger.divider();
    logger.section("📋 Setup Summary");
    logger.blank();

    for (const step of steps) {
      const icon =
        step.status === "completed"
          ? "✅"
          : step.status === "failed"
            ? "❌"
            : step.status === "skipped"
              ? "⏭️"
              : "⏳";
      logger.log(`${icon} ${step.name}: ${step.message || step.status}`);
    }

    if (recommendations.length > 0) {
      logger.blank();
      logger.section("💡 Recommendations");
      for (const rec of recommendations) {
        logger.info(`• ${rec}`);
      }
    }

    logger.blank();
    if (overallStatus === "success") {
      logger.success("✅ Setup complete! You're ready to use gpm.");
    } else if (overallStatus === "partial") {
      logger.warn(
        "⚠️  Setup partially complete. Some optional features may be limited.",
      );
    } else {
      logger.error(
        "❌ Setup incomplete. Please address the failed steps above.",
      );
    }

    return {
      timestamp,
      steps,
      overallStatus,
      recommendations,
    };
  }

  /**
   * Run automated setup with JSON output
   */
  async runAutomatedSetup(): Promise<SetupReport> {
    const timestamp = new Date().toISOString();
    const steps: SetupStep[] = [];
    const recommendations: string[] = [];

    // Get system status
    const response =
      await this.detector.generateDoctorResponse("0.0.0-development");

    // Process each check
    for (const check of response.checks) {
      if (check.status !== "ok") {
        steps.push({
          name: check.id,
          status: check.status === "missing" ? "failed" : "skipped",
          message: check.details,
        });

        if (check.recommendedAction) {
          recommendations.push(`${check.id}: ${check.recommendedAction}`);
        }
      } else {
        steps.push({
          name: check.id,
          status: "completed",
          message: check.details,
        });
      }
    }

    const failedSteps = steps.filter((s) => s.status === "failed");
    const overallStatus =
      failedSteps.length > 0
        ? "failed"
        : response.status === "ok"
          ? "success"
          : "partial";

    return {
      timestamp,
      steps,
      overallStatus,
      recommendations,
    };
  }

  // Private helper methods

  private async setupGitHubToken(): Promise<void> {
    // Get available storage methods
    const methods = await this.keychain.detectAvailableMethods();

    // Generate token instructions
    logger.blank();
    logger.info("📝 To create a GitHub token:");
    logger.info("1. Visit: https://github.com/settings/tokens/new");
    logger.info("2. Name: 'gpm CLI Access'");
    logger.info("3. Expiration: 90 days recommended");
    logger.info("4. Scopes: Select 'repo' (full control)");
    logger.info("5. Click 'Generate token' and copy it");
    logger.blank();

    // Get token from user
    const { token } = await prompts({
      type: "password",
      name: "token",
      message: "Paste your GitHub token:",
      validate: (value: string) => {
        if (!value) return "Token is required";
        if (!value.startsWith("ghp_") && !value.startsWith("github_pat_")) {
          return "Invalid token format";
        }
        return true;
      },
    });

    if (!token) {
      throw new Error("No token provided");
    }

    // Validate token
    logger.info("Validating token...");
    const validation = await this.keychain.validateToken(token);
    if (!validation.valid) {
      throw new Error(`Token validation failed: ${validation.message}`);
    }

    logger.success("✅ Token validated!");

    // Choose storage method
    const methodChoices = methods.map((m) => ({
      title: `${m.description} (${m.security} security)`,
      value: m.method,
    }));

    const { method } = await prompts({
      type: "select",
      name: "method",
      message: "Choose storage method:",
      choices: methodChoices,
    });

    if (!method) {
      throw new Error("No storage method selected");
    }

    // Store token
    const result = await this.keychain.storeToken(token, method);
    if (!result.success) {
      throw new Error(result.message || "Failed to store token");
    }
  }

  private async suggestToolInstallation(missingTools: Check[]): Promise<void> {
    const installCommands: ToolInstallInfo[] = [];

    for (const tool of missingTools) {
      const toolName = tool.id.replace("tool.", "");

      // Parse the recommended action
      if (tool.recommendedAction?.startsWith("install:")) {
        const command = tool.recommendedAction.replace("install:", "");
        let manager: ToolInstallInfo["manager"] = "manual";

        if (command.includes("npm install")) manager = "npm";
        else if (command.includes("pip install")) manager = "pip";
        else if (command.includes("brew install")) manager = "brew";
        else if (command.includes("apt install")) manager = "apt";

        installCommands.push({
          name: toolName,
          command,
          manager,
        });
      }
    }

    if (installCommands.length === 0) return;

    logger.blank();
    logger.info("📦 Installation commands for missing tools:");
    logger.blank();

    // Group by package manager
    const grouped = installCommands.reduce(
      (acc, cmd) => {
        if (!acc[cmd.manager!]) acc[cmd.manager!] = [];
        acc[cmd.manager!].push(cmd);
        return acc;
      },
      {} as Record<string, ToolInstallInfo[]>,
    );

    for (const [manager, commands] of Object.entries(grouped)) {
      logger.info(`${manager}:`);
      for (const cmd of commands) {
        logger.log(`  ${cmd.command}`);
      }
      logger.blank();
    }

    const { runInstall } = await prompts({
      type: "confirm",
      name: "runInstall",
      message: "Would you like to run these install commands now?",
      initial: false,
    });

    if (runInstall) {
      for (const cmd of installCommands) {
        try {
          logger.info(`Installing ${cmd.name}...`);
          execSync(cmd.command, { stdio: "inherit" });
          logger.success(`✅ ${cmd.name} installed`);
        } catch {
          logger.error(`❌ Failed to install ${cmd.name}`);
        }
      }
    }
  }

  private async checkConfiguration(): Promise<boolean> {
    try {
      const { existsSync } = await import("fs");
      return existsSync(".gpm.yml");
    } catch {
      return false;
    }
  }

  private async createConfiguration(): Promise<void> {
    const { writeFileSync } = await import("fs");

    const config = `# Git PR Manager Configuration
# Generated by gpm setup

github:
  defaultBranch: main
  protectMain: true

ci:
  waitForChecks: true
  timeout: 1800000  # 30 minutes
  retryFlaky: true

workflow:
  autoDelete: true
  skipVerify: false

security:
  scanSecrets: true
  scanDependencies: true

verification:
  detectionEnabled: true
  preferMakefile: true
  allowInstall: false
`;

    writeFileSync(".gpm.yml", config);
  }
}
