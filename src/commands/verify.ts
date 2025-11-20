import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger";
import { spinner } from "../utils/spinner";
import { LanguageDetectionService } from "../services/LanguageDetectionService";
import { CommandResolver } from "../services/CommandResolver";
import { ConfigService } from "../services/ConfigService";
import { ToolDetector } from "../services/ToolDetector";
import chalk from "chalk";
import prompts from "prompts";

const execAsync = promisify(exec);

interface VerifyOptions {
  skipFormat?: boolean; // Phase 1c
  skipLint?: boolean;
  skipTypecheck?: boolean;
  skipTest?: boolean;
  skipBuild?: boolean;
  skipInstall?: boolean;
  allowInstall?: boolean; // Phase 1b: Opt-in install support
  json?: boolean;
}

interface VerifyStepResult {
  step: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
  // Enhanced error format for AI agents (Phase A.1)
  fixable?: boolean; // Can this error be auto-fixed?
  autoFixCommand?: string; // Command to auto-fix the error
  suggestions?: string[]; // Additional suggestions for fixing
  skipped?: boolean;
  reason?: string;
}

interface VerifyResult {
  success: boolean;
  steps: VerifyStepResult[];
  totalDuration: number;
  failedSteps: string[];
  language: string;
  packageManager?: string;
}

/**
 * Run pre-commit verification checks
 * Executes lint, typecheck, tests, and build using language-specific commands
 *
 * Phase 1a: Multi-language support
 * - Auto-detects project language (Python, Node.js, Go, Rust)
 * - Resolves appropriate commands for each language
 * - Respects verification config from .gpm.yml
 */
export async function verifyCommand(
  options: VerifyOptions = {},
): Promise<void> {
  const startTime = Date.now();
  const results: VerifyStepResult[] = [];
  const failedSteps: string[] = [];

  // Check logger's JSON mode (set by global --json flag)
  const jsonMode = logger.isJsonMode();

  if (!jsonMode) {
    logger.section("Running Verification Checks");
  }

  // Initialize services
  const languageDetector = new LanguageDetectionService();
  const commandResolver = new CommandResolver();
  const configService = new ConfigService();

  try {
    // Detect language and package manager
    const detectedLanguage = await languageDetector.detectLanguage();
    const detectedPkgManager = await languageDetector.detectPackageManager(
      detectedLanguage.primary,
    );
    const config = await configService.load();
    const verificationConfig = config.verification;

    if (!jsonMode) {
      logger.info(`Detected language: ${detectedLanguage.primary}`);
      if (detectedPkgManager.packageManager) {
        logger.info(`Package manager: ${detectedPkgManager.packageManager}`);
      }
      logger.blank();
    }

    // Get Makefile targets
    const makefileTargets = await languageDetector.getMakefileTargets();

    // Phase 1c: Get task order from config (default: format → lint → typecheck → test → build)
    const defaultTaskOrder: (
      | "format"
      | "lint"
      | "typecheck"
      | "test"
      | "build"
      | "install"
    )[] = ["format", "lint", "typecheck", "test", "build"];
    const taskOrder = verificationConfig?.tasks || defaultTaskOrder;

    // Phase 1c: Get skip list from config and merge with CLI flags
    const configSkipTasks = verificationConfig?.skipTasks || [];
    const cliSkipTasks: string[] = [];
    if (options.skipFormat) cliSkipTasks.push("format");
    if (options.skipLint) cliSkipTasks.push("lint");
    if (options.skipTypecheck) cliSkipTasks.push("typecheck");
    if (options.skipTest) cliSkipTasks.push("test");
    if (options.skipBuild) cliSkipTasks.push("build");
    if (options.skipInstall) cliSkipTasks.push("install");
    const skipTasks = [...new Set([...configSkipTasks, ...cliSkipTasks])];

    // Phase 1c: Fail-fast mode (default: true)
    const stopOnFirstFailure = verificationConfig?.stopOnFirstFailure !== false;

    // Handle install step separately (Phase 1b: opt-in with prompt)
    const shouldInstall =
      (options.allowInstall || verificationConfig?.allowInstall) &&
      !skipTasks.includes("install");

    if (shouldInstall) {
      const installResult = await resolveAndRunInstall(
        commandResolver,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
        detectedPkgManager.lockFile,
        makefileTargets,
        verificationConfig,
        jsonMode,
      );

      if (installResult) {
        results.push(installResult);
        if (!installResult.passed && !installResult.skipped) {
          failedSteps.push("install");
          if (stopOnFirstFailure) {
            // Exit early on failure with fail-fast
            const totalDuration = Date.now() - startTime;
            outputResults(
              results,
              failedSteps,
              totalDuration,
              detectedLanguage.primary,
              detectedPkgManager.packageManager,
              jsonMode,
            );
            // Phase 4: Offer setup help on failure (non-JSON mode only)
            if (!jsonMode) {
              await offerSetupHelp(
                failedSteps,
                detectedLanguage.primary,
                detectedPkgManager.packageManager,
              );
            }
            process.exit(1);
          }
        }
      }
    }

    // Execute verification tasks in configured order
    for (const task of taskOrder) {
      // Skip if in skip list
      if (skipTasks.includes(task)) {
        if (!jsonMode) {
          logger.info(`⏭️  ${getTaskDisplayName(task)}: Skipping (configured)`);
        }
        continue;
      }

      // Resolve and run task
      const taskResult = await resolveAndRun(
        task,
        getTaskDisplayName(task),
        commandResolver,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
        makefileTargets,
        verificationConfig,
        jsonMode,
      );

      if (taskResult) {
        results.push(taskResult);
        if (!taskResult.passed && !taskResult.skipped) {
          failedSteps.push(task);

          // Phase 1c: Fail-fast mode - exit on first failure
          if (stopOnFirstFailure) {
            const totalDuration = Date.now() - startTime;
            outputResults(
              results,
              failedSteps,
              totalDuration,
              detectedLanguage.primary,
              detectedPkgManager.packageManager,
              jsonMode,
            );
            // Phase 4: Offer setup help on failure (non-JSON mode only)
            if (!jsonMode) {
              await offerSetupHelp(
                failedSteps,
                detectedLanguage.primary,
                detectedPkgManager.packageManager,
              );
            }
            process.exit(1);
          }
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    const success = failedSteps.length === 0;

    // Output results
    outputResults(
      results,
      failedSteps,
      totalDuration,
      detectedLanguage.primary,
      detectedPkgManager.packageManager,
      jsonMode,
    );

    // Phase 4: If verification failed and not in JSON mode, offer setup help
    if (!success && !jsonMode) {
      await offerSetupHelp(
        failedSteps,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
      );
    }

    if (!success) {
      process.exit(1);
    }
  } catch (error: any) {
    if (jsonMode) {
      const payload: VerifyResult = {
        success: false,
        steps: results,
        totalDuration: Date.now() - startTime,
        failedSteps,
        language: "unknown",
        packageManager: undefined,
      };
      logger.outputJsonResult(false, payload, {
        code: "ERROR",
        message: error.message,
      });
    } else {
      logger.error(`Verification failed: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Resolve command for a task and run it
 */
async function resolveAndRun(
  task: "format" | "lint" | "typecheck" | "test" | "build" | "install",
  name: string,
  resolver: CommandResolver,
  language: any,
  packageManager: any,
  makefileTargets: string[],
  verificationConfig: any,
  jsonMode: boolean,
): Promise<VerifyStepResult | null> {
  // Resolve command
  const resolved = await resolver.resolve({
    task,
    language,
    packageManager,
    makefileTargets,
    config: verificationConfig,
  });

  // If command not found, check if task is optional (Phase 1c: build is optional)
  if (resolved.source === "not-found") {
    // For optional tasks (build), skip gracefully without suggestions
    if (resolved.optional) {
      const result: VerifyStepResult = {
        step: name,
        passed: true,
        duration: 0,
        skipped: true,
        reason: `${task} command not available (optional)`,
      };

      if (!jsonMode) {
        logger.info(`ℹ️  ${name}: skipped (no ${task} command found)`);
      }

      return result;
    }

    // For required tasks, provide helpful suggestions
    const suggestions = generateCommandNotFoundSuggestions(
      task,
      language,
      packageManager,
      makefileTargets,
      verificationConfig,
    );

    const result: VerifyStepResult = {
      step: name,
      passed: true,
      duration: 0,
      skipped: true,
      reason: `${task} command not available for ${language}${suggestions.length > 0 ? ". " + suggestions.join(". ") : ""}`,
    };

    if (!jsonMode) {
      logger.info(`ℹ️  ${name}: skipped (not available for ${language})`);

      // Show suggestions in non-JSON mode
      if (suggestions.length > 0) {
        logger.blank();
        logger.log(chalk.dim("Suggestions:"));
        suggestions.forEach((suggestion) => {
          logger.log(chalk.dim(`  • ${suggestion}`));
        });
        logger.blank();
      }
    }

    return result;
  }

  // Display command source in verbose mode
  if (!jsonMode && logger.getLevel() >= 3) {
    logger.debug(
      `${name} command: ${resolved.command} (source: ${resolved.source})`,
    );
  }

  // Run the command
  return runStep(name, resolved.command, jsonMode);
}

/**
 * Generate helpful suggestions when a command is not found
 * Phase 1b: Better error messages for missing Makefile targets and tools
 */
function generateCommandNotFoundSuggestions(
  task: string,
  language: string,
  packageManager: string | undefined,
  makefileTargets: string[],
  verificationConfig: any,
): string[] {
  const suggestions: string[] = [];
  const preferMakefile = verificationConfig?.preferMakefile !== false; // Default: true

  // Case 1: Makefile exists but is missing the target
  if (preferMakefile && makefileTargets.length > 0) {
    // Show available targets
    if (makefileTargets.length <= 5) {
      suggestions.push(
        `Available Makefile targets: ${makefileTargets.join(", ")}`,
      );
    } else {
      const first5 = makefileTargets.slice(0, 5);
      suggestions.push(
        `Available Makefile targets: ${first5.join(", ")} (and ${makefileTargets.length - 5} more)`,
      );
    }

    // Suggest adding the missing target
    suggestions.push(`Add '${task}' target to Makefile`);

    // Suggest using makefileAliases if a similar target exists
    const similarTargets = makefileTargets.filter(
      (target) => target.includes(task) || task.includes(target),
    );

    if (similarTargets.length > 0) {
      const example = similarTargets[0];
      suggestions.push(
        `Use makefileAliases in .gpm.yml: makefileAliases: { ${example}: "${task}" }`,
      );
    } else {
      suggestions.push(
        `Use makefileAliases in .gpm.yml if Makefile uses different target name`,
      );
    }

    // Suggest disabling preferMakefile
    suggestions.push(
      `Set preferMakefile: false in .gpm.yml to use package manager commands`,
    );
  }

  // Case 2: No Makefile, suggest tool installation or config override
  else {
    // Suggest custom command override
    suggestions.push(
      `Override with custom command in .gpm.yml: commands: { ${task}: "your-command" }`,
    );

    // Suggest common tool installation for this language/task
    const installSuggestion = getToolInstallSuggestion(
      task,
      language,
      packageManager,
    );
    if (installSuggestion) {
      suggestions.push(installSuggestion);
    }
  }

  return suggestions;
}

/**
 * Get tool installation suggestion for a specific task and language
 */
function getToolInstallSuggestion(
  task: string,
  language: string,
  _packageManager?: string, // Reserved for future package-manager-specific suggestions
): string | null {
  // Map of task + language to common tools and install commands
  const toolSuggestions: Record<
    string,
    Record<string, { tool: string; install: string }>
  > = {
    lint: {
      python: { tool: "ruff", install: "pip install ruff" },
      nodejs: { tool: "eslint", install: "npm install -D eslint" },
      go: {
        tool: "golangci-lint",
        install:
          "go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest",
      },
      rust: { tool: "clippy", install: "rustup component add clippy" },
    },
    test: {
      python: { tool: "pytest", install: "pip install pytest" },
      nodejs: { tool: "jest", install: "npm install -D jest" },
      go: { tool: "go test", install: "built-in (no install needed)" },
      rust: { tool: "cargo test", install: "built-in (no install needed)" },
    },
    typecheck: {
      python: { tool: "mypy", install: "pip install mypy" },
      nodejs: { tool: "tsc", install: "npm install -D typescript" },
    },
    format: {
      python: { tool: "black", install: "pip install black" },
      nodejs: { tool: "prettier", install: "npm install -D prettier" },
      go: { tool: "gofmt", install: "built-in (no install needed)" },
      rust: { tool: "rustfmt", install: "rustup component add rustfmt" },
    },
  };

  const taskTools = toolSuggestions[task];
  if (!taskTools) {
    return null;
  }

  const suggestion = taskTools[language];
  if (!suggestion) {
    return null;
  }

  if (suggestion.install === "built-in (no install needed)") {
    return `${suggestion.tool} is built-in for ${language}`;
  }

  return `Install ${suggestion.tool}: ${suggestion.install}`;
}

/**
 * Get auto-fix information for a failed verification step
 * Returns fixable status, auto-fix command, and suggestions for AI agents
 */
function getAutoFixInfo(
  stepName: string,
  originalCommand: string,
): { fixable: boolean; autoFixCommand?: string; suggestions?: string[] } {
  const lowerStepName = stepName.toLowerCase();
  const lowerCommand = originalCommand.toLowerCase();

  // Format check failures - usually auto-fixable
  if (lowerStepName.includes("format")) {
    if (lowerCommand.includes("prettier")) {
      return {
        fixable: true,
        autoFixCommand: originalCommand.replace(/--check|--list-different|-l/g, "--write"),
        suggestions: ["Run prettier with --write flag to auto-format"],
      };
    } else if (lowerCommand.includes("black")) {
      return {
        fixable: true,
        autoFixCommand: originalCommand.replace(/--check|--diff/g, "").trim(),
        suggestions: ["Run black without --check flag to auto-format"],
      };
    } else if (lowerCommand.includes("gofmt")) {
      return {
        fixable: true,
        autoFixCommand: originalCommand.replace(/-l/g, "-w"),
        suggestions: ["Run gofmt with -w flag to auto-format"],
      };
    } else if (lowerCommand.includes("cargo fmt")) {
      return {
        fixable: true,
        autoFixCommand: originalCommand.replace(/--check/g, "").trim(),
        suggestions: ["Run cargo fmt without --check flag to auto-format"],
      };
    }
  }

  // Lint errors - may be auto-fixable
  if (lowerStepName.includes("lint")) {
    if (lowerCommand.includes("eslint") || lowerCommand.includes("npm run lint")) {
      return {
        fixable: true,
        autoFixCommand: `${originalCommand} --fix`,
        suggestions: [
          "Run linter with --fix flag",
          "Review and commit the auto-fixed changes",
        ],
      };
    } else if (lowerCommand.includes("ruff")) {
      return {
        fixable: true,
        autoFixCommand: originalCommand.replace(/check/g, "check --fix"),
        suggestions: ["Run ruff with --fix flag to auto-fix linting issues"],
      };
    }
  }

  // Type errors - not auto-fixable
  if (lowerStepName.includes("typecheck") || lowerStepName.includes("type")) {
    return {
      fixable: false,
      suggestions: [
        "Review type errors in the output above",
        "Fix type annotations manually",
        "Run 'tsc --noEmit' for detailed type checking",
      ],
    };
  }

  // Test failures - not auto-fixable
  if (lowerStepName.includes("test")) {
    return {
      fixable: false,
      suggestions: [
        "Review test failures in the output above",
        "Fix the failing tests manually",
        "Run tests in watch mode for faster feedback",
      ],
    };
  }

  // Build failures - not auto-fixable
  if (lowerStepName.includes("build")) {
    return {
      fixable: false,
      suggestions: [
        "Review build errors in the output above",
        "Ensure all dependencies are installed",
        "Check for TypeScript/compilation errors",
      ],
    };
  }

  // Default: not fixable
  return {
    fixable: false,
    suggestions: ["Review the error output above for details"],
  };
}

/**
 * Run a single verification step
 */
async function runStep(
  name: string,
  command: string,
  jsonMode: boolean = false,
): Promise<VerifyStepResult> {
  const stepStartTime = Date.now();

  if (!jsonMode) {
    spinner.start(`Running ${name}...`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    const duration = Date.now() - stepStartTime;

    if (!jsonMode) {
      spinner.succeed(`${name} passed (${formatDuration(duration)})`);
    }

    return {
      step: name,
      passed: true,
      duration,
      output: stdout + stderr,
    };
  } catch (error: any) {
    const duration = Date.now() - stepStartTime;

    if (!jsonMode) {
      spinner.fail(`${name} failed (${formatDuration(duration)})`);

      // Show error output
      if (error.stdout || error.stderr) {
        logger.blank();
        logger.log(chalk.dim("Output:"));
        const output = (error.stdout || "") + (error.stderr || "");
        // Show last 20 lines of output
        const lines = output.split("\n");
        const relevantLines = lines.slice(-20).join("\n");
        logger.log(chalk.dim(relevantLines));
        logger.blank();
      }
    }

    // Enhanced error format: Determine if fixable and provide auto-fix command
    const autoFixInfo = getAutoFixInfo(name, command);

    return {
      step: name,
      passed: false,
      duration,
      error: error.message,
      output: (error.stdout || "") + (error.stderr || ""),
      fixable: autoFixInfo.fixable,
      autoFixCommand: autoFixInfo.autoFixCommand,
      suggestions: autoFixInfo.suggestions,
    };
  }
}

/**
 * Resolve and run install step with user prompt (Phase 1b)
 */
async function resolveAndRunInstall(
  resolver: CommandResolver,
  language: any,
  packageManager: any,
  lockFile: string | null,
  makefileTargets: string[],
  verificationConfig: any,
  jsonMode: boolean,
): Promise<VerifyStepResult | null> {
  // Resolve install command
  const resolved = await resolver.resolve({
    task: "install",
    language,
    packageManager,
    makefileTargets,
    config: verificationConfig,
  });

  // If command not found, skip
  if (resolved.source === "not-found") {
    const result: VerifyStepResult = {
      step: "Install Dependencies",
      passed: true,
      duration: 0,
      skipped: true,
      reason: `install command not available for ${language}`,
    };

    if (!jsonMode) {
      logger.info("ℹ️  Install Dependencies: skipped (not available)");
    }

    return result;
  }

  // Check for missing lock file
  if (!lockFile && !jsonMode) {
    logger.warn(`⚠️  Warning: No lock file found for ${packageManager}`);
    logger.warn("   Consider creating a lock file for reproducible installs:");

    // Show lock file creation command based on package manager
    const lockFileCommands: Record<string, string> = {
      poetry: "poetry lock",
      pipenv: "pipenv lock",
      uv: "uv lock",
      pip: "pip freeze > requirements.txt",
      pnpm: "pnpm install",
      yarn: "yarn install",
      bun: "bun install",
      npm: "npm install",
      "go-mod": "go mod tidy",
      cargo: "cargo update",
    };

    const lockCommand = lockFileCommands[packageManager || ""];
    if (lockCommand) {
      logger.warn(`   ${chalk.cyan(lockCommand)}`);
    }
    logger.blank();
  }

  // Prompt for confirmation (unless JSON mode or CI environment)
  if (!jsonMode && !process.env.CI) {
    logger.info(`📦 About to run install command:`);
    logger.info(`   ${chalk.cyan(resolved.command)}`);
    logger.blank();

    const response = await prompts({
      type: "confirm",
      name: "proceed",
      message: "Proceed with installation?",
      initial: true,
    });

    if (!response.proceed) {
      const result: VerifyStepResult = {
        step: "Install Dependencies",
        passed: true,
        duration: 0,
        skipped: true,
        reason: "user cancelled",
      };

      logger.info("ℹ️  Install cancelled by user");
      return result;
    }

    logger.blank();
  } else if (!jsonMode) {
    // In CI or automated mode, just show what we're about to run
    logger.info(`📦 Running install command: ${chalk.cyan(resolved.command)}`);
    logger.blank();
  }

  // Run the install step
  return runStep("Install Dependencies", resolved.command, jsonMode);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Get display name for a task
 * Phase 1c: Helper function for task display names
 */
function getTaskDisplayName(task: string): string {
  const displayNames: Record<string, string> = {
    format: "Format",
    lint: "Lint",
    typecheck: "Type Check",
    test: "Tests",
    build: "Build",
    install: "Install Dependencies",
  };
  return displayNames[task] || task;
}

/**
 * Output verification results
 * Phase 1c: Centralized output function for success and failure cases
 */
function outputResults(
  results: VerifyStepResult[],
  failedSteps: string[],
  totalDuration: number,
  language: string,
  packageManager: string | undefined,
  jsonMode: boolean,
): void {
  const success = failedSteps.length === 0;

  if (jsonMode) {
    const result: VerifyResult = {
      success,
      steps: results,
      totalDuration,
      failedSteps,
      language,
      packageManager,
    };
    // Emit single-line JSON via logger
    logger.outputJsonResult(success, result);
  } else {
    logger.blank();
    if (success) {
      logger.success(
        `✅ All verification checks passed! (${formatDuration(totalDuration)})`,
      );
    } else {
      logger.error(
        `❌ Verification failed (${failedSteps.length}/${results.length} steps failed)`,
      );
      logger.blank();
      logger.log("Failed steps:");
      failedSteps.forEach((step) => logger.log(`  • ${step}`));
    }
  }
}

/**
 * Offer setup help when verification fails
 * Phase 4: Integration with setup command
 */
async function offerSetupHelp(
  failedSteps: string[],
  language: string,
  packageManager?: string,
): Promise<void> {
  // Check if any failed steps could benefit from setup
  const missingToolSteps = failedSteps.filter((step) =>
    ["lint", "typecheck", "test", "format", "build"].includes(step),
  );

  if (missingToolSteps.length === 0) {
    return;
  }

  // Use ToolDetector to check for missing tools
  const detector = new ToolDetector();
  const toolStatuses = await detector.detectInstalledTools();
  const missingTools = toolStatuses.filter((t) => t.status === "missing");

  if (missingTools.length > 0) {
    logger.blank();
    logger.warn("💡 Missing tools detected:");
    missingTools.forEach((tool) => {
      logger.log(`  • ${tool.name}: ${tool.recommendedAction || "Not found"}`);
    });

    logger.blank();
    logger.info("Need help setting up your environment?");

    const { runSetup } = await prompts({
      type: "confirm",
      name: "runSetup",
      message: "Would you like to run the setup wizard?",
      initial: true,
    });

    if (runSetup) {
      logger.blank();
      logger.info("Starting setup wizard...");

      // Import and run setup command
      const { setupCommand } = await import("./setup");
      await setupCommand();
    } else {
      logger.blank();
      logger.info("You can run the setup wizard later with: gpm setup");

      // Offer specific suggestions for failed steps
      missingToolSteps.forEach((step) => {
        const suggestion = getToolInstallSuggestion(step, language, packageManager);
        if (suggestion) {
          logger.log(`  • For ${step}: ${suggestion}`);
        }
      });
    }
  }
}
