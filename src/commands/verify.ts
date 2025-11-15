import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface VerifyOptions {
  skipLint?: boolean;
  skipTypecheck?: boolean;
  skipTest?: boolean;
  skipBuild?: boolean;
  json?: boolean;
}

interface VerifyStepResult {
  step: string;
  passed: boolean;
  duration: number;
  output?: string;
  error?: string;
}

interface VerifyResult {
  success: boolean;
  steps: VerifyStepResult[];
  totalDuration: number;
  failedSteps: string[];
}

/**
 * Run pre-commit verification checks
 * Executes lint, typecheck, tests, and build
 */
export async function verifyCommand(options: VerifyOptions = {}): Promise<void> {
  const startTime = Date.now();
  const results: VerifyStepResult[] = [];
  const failedSteps: string[] = [];

  if (!options.json) {
    logger.section('Running Verification Checks');
  }

  // Step 1: ESLint
  if (!options.skipLint) {
    const lintResult = await runStep('Lint (ESLint)', 'npm run lint', options.json);
    results.push(lintResult);
    if (!lintResult.passed) {
      failedSteps.push('lint');
    }
  }

  // Step 2: TypeScript type checking
  if (!options.skipTypecheck) {
    const typecheckResult = await runStep(
      'Type Check (TypeScript)',
      'npx tsc --noEmit',
      options.json
    );
    results.push(typecheckResult);
    if (!typecheckResult.passed) {
      failedSteps.push('typecheck');
    }
  }

  // Step 3: Tests
  if (!options.skipTest) {
    const testResult = await runStep('Tests (Jest)', 'npm test', options.json);
    results.push(testResult);
    if (!testResult.passed) {
      failedSteps.push('test');
    }
  }

  // Step 4: Build
  if (!options.skipBuild) {
    const buildResult = await runStep('Build (TypeScript)', 'npm run build', options.json);
    results.push(buildResult);
    if (!buildResult.passed) {
      failedSteps.push('build');
    }
  }

  const totalDuration = Date.now() - startTime;
  const success = failedSteps.length === 0;

  // Output results
  if (options.json) {
    const result: VerifyResult = {
      success,
      steps: results,
      totalDuration,
      failedSteps
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
