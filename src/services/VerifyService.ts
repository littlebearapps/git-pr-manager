import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface VerifyResult {
  success: boolean;
  output: string;
  errors: string[];
  duration: number;
}

export interface VerifyOptions {
  onProgress?: (message: string) => void;
  timeout?: number; // in milliseconds
}

/**
 * VerifyService - Runs pre-commit verification checks
 */
export class VerifyService {
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  /**
   * Run verification checks
   * Looks for verify.sh or package.json scripts
   */
  async runChecks(options: VerifyOptions = {}): Promise<VerifyResult> {
    const startTime = Date.now();

    // Try to find verification script
    const script = await this.discoverVerifyScript();

    if (!script) {
      return {
        success: true,
        output: 'No verification script found',
        errors: [],
        duration: Date.now() - startTime
      };
    }

    options.onProgress?.('Running verification checks...');

    try {
      const result = await this.executeScript(script, options);
      const duration = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        output: result.stdout + result.stderr,
        errors: this.parseErrors(result.stdout, result.stderr, result.exitCode),
        duration
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: error.message,
        errors: [error.message],
        duration
      };
    }
  }

  /**
   * Discover verification script
   * Returns command to execute
   */
  private async discoverVerifyScript(): Promise<string | null> {
    // 1. Check for built-in gwm verify command
    // This works when gwm is installed or we're in the built dist/
    try {
      const { execSync } = require('child_process');
      execSync('command -v gwm', { stdio: 'ignore' });
      return 'gwm verify';
    } catch {
      // gwm not in PATH, continue to other methods
    }

    // 2. Check for verify.sh
    const verifyShPath = path.join(this.workingDir, 'verify.sh');
    try {
      await fs.access(verifyShPath);
      return `bash ${verifyShPath}`;
    } catch {
      // Not found
    }

    // 3. Check for package.json with verify script
    const packageJsonPath = path.join(this.workingDir, 'package.json');
    try {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );

      // Check for common verification scripts
      const scripts = packageJson.scripts || {};

      if (scripts.verify) {
        return 'npm run verify';
      } else if (scripts.precommit) {
        return 'npm run precommit';
      } else if (scripts['pre-commit']) {
        return 'npm run pre-commit';
      } else if (scripts.test && scripts.lint) {
        // Run both test and lint
        return 'npm test && npm run lint';
      } else if (scripts.test) {
        return 'npm test';
      }
    } catch {
      // package.json not found or invalid
    }

    // 4. Check for Python tox.ini
    const toxIniPath = path.join(this.workingDir, 'tox.ini');
    try {
      await fs.access(toxIniPath);
      return 'tox';
    } catch {
      // Not found
    }

    // 5. Check for Makefile with verify target
    const makefilePath = path.join(this.workingDir, 'Makefile');
    try {
      const makefile = await fs.readFile(makefilePath, 'utf-8');
      if (makefile.includes('verify:')) {
        return 'make verify';
      } else if (makefile.includes('test:')) {
        return 'make test';
      }
    } catch {
      // Not found
    }

    return null;
  }

  /**
   * Execute verification script
   */
  private async executeScript(
    command: string,
    options: VerifyOptions
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 300000; // 5 minutes default

      const child = exec(command, {
        cwd: this.workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        options.onProgress?.(text.trim());
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
      });

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse errors from output
   */
  private parseErrors(
    stdout: string,
    stderr: string,
    exitCode: number
  ): string[] {
    const errors: string[] = [];

    if (exitCode !== 0) {
      // Look for common error patterns
      const combined = stdout + '\n' + stderr;

      // Filter out test console output to avoid false positives
      const isTestOutput = (line: string): boolean => {
        return (
          line.includes('console.log') ||
          line.includes('console.warn') ||
          line.includes('console.error') ||
          line.trim().startsWith('at ') || // Stack traces
          /^\s+\d+\s+\|/.test(line) || // Line number markers
          /^\s*>?\s*\d+\s*\|/.test(line) || // Code line markers (e.g., "> 691 |")
          line.includes('AutoFix') || // AutoFix log messages
          /^error\s*\{/.test(line.trim()) // Object dumps starting with "error {"
        );
      };

      // Test failures - support both Jest (FAIL) and pytest (FAILED) formats
      const testFailures = combined.match(/FAILED?\s+.*$/gm);
      if (testFailures) {
        // Only include lines that look like actual test failures (not console output)
        const realFailures = testFailures.filter(line => !isTestOutput(line));
        errors.push(...realFailures);
      }

      // Linting errors (exclude test console output)
      const lintErrors = combined
        .split('\n')
        .filter(line => /error\s+/.test(line) && !isTestOutput(line))
        .slice(0, 10); // Limit to 10
      if (lintErrors.length > 0) {
        errors.push(...lintErrors);
      }

      // Type errors
      const typeErrors = combined.match(/TS\d+:.*$/gm);
      if (typeErrors) {
        errors.push(...typeErrors.slice(0, 10));
      }

      // If no specific errors found, use generic message
      if (errors.length === 0) {
        errors.push(`Verification failed with exit code ${exitCode}`);
      }
    }

    return errors;
  }

  /**
   * Check if verification script exists
   */
  async hasVerifyScript(): Promise<boolean> {
    const script = await this.discoverVerifyScript();
    return script !== null;
  }

  /**
   * Get verification command that would be run
   */
  async getVerifyCommand(): Promise<string | null> {
    return await this.discoverVerifyScript();
  }
}
