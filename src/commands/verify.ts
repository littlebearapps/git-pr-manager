import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import { LanguageDetectionService } from '../services/LanguageDetectionService';
import { CommandResolver } from '../services/CommandResolver';
import { ConfigService } from '../services/ConfigService';
import chalk from 'chalk';
import prompts from 'prompts';

const execAsync = promisify(exec);

interface VerifyOptions {
  skipLint?: boolean;
  skipTypecheck?: boolean;
  skipTest?: boolean;
  skipBuild?: boolean;
  skipInstall?: boolean;
  allowInstall?: boolean;  // Phase 1b: Opt-in install support
  json?: boolean;
}

interface VerifyStepResult {
  step: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
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
export async function verifyCommand(options: VerifyOptions = {}): Promise<void> {
  const startTime = Date.now();
  const results: VerifyStepResult[] = [];
  const failedSteps: string[] = [];

  // Check logger's JSON mode (set by global --json flag)
  const jsonMode = logger.isJsonMode();

  if (!jsonMode) {
    logger.section('Running Verification Checks');
  }

  // Initialize services
  const languageDetector = new LanguageDetectionService();
  const commandResolver = new CommandResolver();
  const configService = new ConfigService();

  try {
    // Detect language and package manager
    const detectedLanguage = await languageDetector.detectLanguage();
    const detectedPkgManager = await languageDetector.detectPackageManager(detectedLanguage.primary);
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

    // Step 0: Install dependencies (Phase 1b: opt-in with prompt)
    // Only run install if:
    // 1. allowInstall flag is set OR verification.allowInstall is true
    // 2. AND skipInstall is not set
    const shouldInstall = (options.allowInstall || verificationConfig?.allowInstall) && !options.skipInstall;

    if (shouldInstall) {
      const installResult = await resolveAndRunInstall(
        commandResolver,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
        detectedPkgManager.lockFile,
        makefileTargets,
        verificationConfig,
        jsonMode
      );

      if (installResult) {
        results.push(installResult);
        if (!installResult.passed && !installResult.skipped) {
          failedSteps.push('install');
        }
      }
    }

    // Step 1: Lint
    if (!options.skipLint) {
      const lintResult = await resolveAndRun(
        'lint',
        'Lint',
        commandResolver,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
        makefileTargets,
        verificationConfig,
        jsonMode
      );

      if (lintResult) {
        results.push(lintResult);
        if (!lintResult.passed && !lintResult.skipped) {
          failedSteps.push('lint');
        }
      }
    }

    // Step 2: Type checking (optional - not all languages need it)
    if (!options.skipTypecheck) {
      const typecheckResult = await resolveAndRun(
        'typecheck',
        'Type Check',
        commandResolver,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
        makefileTargets,
        verificationConfig,
        jsonMode
      );

      if (typecheckResult) {
        results.push(typecheckResult);
        // Don't fail if typecheck is skipped (not available for language)
        if (!typecheckResult.passed && !typecheckResult.skipped) {
          failedSteps.push('typecheck');
        }
      }
    }

    // Step 3: Tests
    if (!options.skipTest) {
      const testResult = await resolveAndRun(
        'test',
        'Tests',
        commandResolver,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
        makefileTargets,
        verificationConfig,
        jsonMode
      );

      if (testResult) {
        results.push(testResult);
        if (!testResult.passed && !testResult.skipped) {
          failedSteps.push('test');
        }
      }
    }

    // Step 4: Build (optional - not all languages need it)
    if (!options.skipBuild) {
      const buildResult = await resolveAndRun(
        'build',
        'Build',
        commandResolver,
        detectedLanguage.primary,
        detectedPkgManager.packageManager,
        makefileTargets,
        verificationConfig,
        jsonMode
      );

      if (buildResult) {
        results.push(buildResult);
        // Don't fail if build is skipped (not available for language)
        if (!buildResult.passed && !buildResult.skipped) {
          failedSteps.push('build');
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    const success = failedSteps.length === 0;

    // Output results
    if (jsonMode) {
      const result: VerifyResult = {
        success,
        steps: results,
        totalDuration,
        failedSteps,
        language: detectedLanguage.primary,
        packageManager: detectedPkgManager.packageManager
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      logger.blank();
      if (success) {
        logger.success(`✅ All verification checks passed! (${formatDuration(totalDuration)})`);
      } else {
        logger.error(`❌ Verification failed (${failedSteps.length}/${results.length} steps failed)`);
        logger.blank();
        logger.log('Failed steps:');
        failedSteps.forEach(step => logger.log(`  • ${step}`));
      }
    }

    if (!success) {
      process.exit(1);
    }
  } catch (error: any) {
    if (jsonMode) {
      console.log(JSON.stringify({
        success: false,
        error: error.message,
        steps: results,
        totalDuration: Date.now() - startTime,
        failedSteps
      }, null, 2));
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
  task: 'lint' | 'typecheck' | 'test' | 'build' | 'install',
  name: string,
  resolver: CommandResolver,
  language: any,
  packageManager: any,
  makefileTargets: string[],
  verificationConfig: any,
  jsonMode: boolean
): Promise<VerifyStepResult | null> {
  // Resolve command
  const resolved = await resolver.resolve({
    task,
    language,
    packageManager,
    makefileTargets,
    config: verificationConfig
  });

  // If command not found, skip this step
  if (resolved.source === 'not-found') {
    const result: VerifyStepResult = {
      step: name,
      passed: true,
      duration: 0,
      skipped: true,
      reason: `${task} command not available for ${language}`
    };

    if (!jsonMode) {
      logger.info(`ℹ️  ${name}: skipped (not available for ${language})`);
    }

    return result;
  }

  // Display command source in verbose mode
  if (!jsonMode && logger.getLevel() >= 3) {
    logger.debug(`${name} command: ${resolved.command} (source: ${resolved.source})`);
  }

  // Run the command
  return runStep(name, resolved.command, jsonMode);
}

/**
 * Run a single verification step
 */
async function runStep(
  name: string,
  command: string,
  jsonMode: boolean = false
): Promise<VerifyStepResult> {
  const stepStartTime = Date.now();

  if (!jsonMode) {
    spinner.start(`Running ${name}...`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    const duration = Date.now() - stepStartTime;

    if (!jsonMode) {
      spinner.succeed(`${name} passed (${formatDuration(duration)})`);
    }

    return {
      step: name,
      passed: true,
      duration,
      output: stdout + stderr
    };
  } catch (error: any) {
    const duration = Date.now() - stepStartTime;

    if (!jsonMode) {
      spinner.fail(`${name} failed (${formatDuration(duration)})`);

      // Show error output
      if (error.stdout || error.stderr) {
        logger.blank();
        logger.log(chalk.dim('Output:'));
        const output = (error.stdout || '') + (error.stderr || '');
        // Show last 20 lines of output
        const lines = output.split('\n');
        const relevantLines = lines.slice(-20).join('\n');
        logger.log(chalk.dim(relevantLines));
        logger.blank();
      }
    }

    return {
      step: name,
      passed: false,
      duration,
      error: error.message,
      output: (error.stdout || '') + (error.stderr || '')
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
  jsonMode: boolean
): Promise<VerifyStepResult | null> {
  // Resolve install command
  const resolved = await resolver.resolve({
    task: 'install',
    language,
    packageManager,
    makefileTargets,
    config: verificationConfig
  });

  // If command not found, skip
  if (resolved.source === 'not-found') {
    const result: VerifyStepResult = {
      step: 'Install Dependencies',
      passed: true,
      duration: 0,
      skipped: true,
      reason: `install command not available for ${language}`
    };

    if (!jsonMode) {
      logger.info('ℹ️  Install Dependencies: skipped (not available)');
    }

    return result;
  }

  // Check for missing lock file
  if (!lockFile && !jsonMode) {
    logger.warn(`⚠️  Warning: No lock file found for ${packageManager}`);
    logger.warn('   Consider creating a lock file for reproducible installs:');

    // Show lock file creation command based on package manager
    const lockFileCommands: Record<string, string> = {
      poetry: 'poetry lock',
      pipenv: 'pipenv lock',
      uv: 'uv lock',
      pip: 'pip freeze > requirements.txt',
      pnpm: 'pnpm install',
      yarn: 'yarn install',
      bun: 'bun install',
      npm: 'npm install',
      'go-mod': 'go mod tidy',
      cargo: 'cargo update'
    };

    const lockCommand = lockFileCommands[packageManager || ''];
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
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with installation?',
      initial: true
    });

    if (!response.proceed) {
      const result: VerifyStepResult = {
        step: 'Install Dependencies',
        passed: true,
        duration: 0,
        skipped: true,
        reason: 'user cancelled'
      };

      logger.info('ℹ️  Install cancelled by user');
      return result;
    }

    logger.blank();
  } else if (!jsonMode) {
    // In CI or automated mode, just show what we're about to run
    logger.info(`📦 Running install command: ${chalk.cyan(resolved.command)}`);
    logger.blank();
  }

  // Run the install step
  return runStep('Install Dependencies', resolved.command, jsonMode);
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
