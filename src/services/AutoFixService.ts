import { exec } from 'child_process';
import { promisify } from 'util';
import { GitService } from './GitService';
import { GitHubService } from './GitHubService';
import { VerifyService } from './VerifyService';
import { ErrorType, FailureDetail, AutoFixResult, AutoFixConfig, AutoFixMetrics } from '../types';

const execAsync = promisify(exec);

/**
 * AutoFixService - Handles automated fixing of deterministic errors
 * Supports: linting errors, formatting errors, type errors (limited), security issues (limited)
 * Phase 6 Session 2: Adds post-fix verification and rollback capability
 */
export class AutoFixService {
  private git: GitService;
  private github: GitHubService;
  private verify?: VerifyService;
  private config: AutoFixConfig;
  private attemptTracker: Map<string, number>;
  private stashedChanges: string | null = null;

  // Session 3.2: Metrics tracking
  private metrics: AutoFixMetrics;
  private enableLogging: boolean;

  constructor(
    git: GitService,
    github: GitHubService,
    config?: Partial<AutoFixConfig>,
    verify?: VerifyService,
    enableLogging: boolean = true
  ) {
    this.git = git;
    this.github = github;
    this.verify = verify;
    this.enableLogging = enableLogging;
    this.config = {
      maxAttempts: 2,
      maxChangedLines: 1000,
      requireTests: true,
      enableDryRun: false,  // Session 2.3: Dry-run is opt-in, not opt-out
      ...config
    };
    this.attemptTracker = new Map();

    // Session 3.2: Initialize metrics
    this.metrics = {
      totalAttempts: 0,
      successfulFixes: 0,
      failedFixes: 0,
      rollbackCount: 0,
      verificationFailures: 0,
      dryRunAttempts: 0,
      byErrorType: {},
      byReason: {},
      totalFixDuration: 0,
      startTime: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Attempt to auto-fix a failure
   * Session 2.3: Added dryRun parameter for simulation mode
   * Session 3.2: Added logging and metrics tracking
   */
  async attemptFix(failure: FailureDetail, prNumber: number, dryRun?: boolean): Promise<AutoFixResult> {
    const startTime = Date.now();

    // Check if auto-fixable
    if (!this.isAutoFixable(failure.errorType)) {
      this.log('info', `Error type ${failure.errorType} is not auto-fixable`);
      return { success: false, reason: 'not_auto_fixable', errorType: failure.errorType };
    }

    // Check attempt limit
    const attemptKey = this.getAttemptKey(prNumber, failure.errorType);
    const attempts = this.attemptTracker.get(attemptKey) || 0;

    if (attempts >= this.config.maxAttempts) {
      this.log('warn', `Max attempts (${this.config.maxAttempts}) reached for ${failure.errorType}`);
      return { success: false, reason: 'max_attempts_reached', attempts };
    }

    // Use config default if not specified
    const useDryRun = dryRun !== undefined ? dryRun : this.config.enableDryRun;

    this.log('info', `Starting auto-fix attempt for ${failure.errorType}`, {
      prNumber,
      dryRun: useDryRun,
      attempt: attempts + 1,
      maxAttempts: this.config.maxAttempts
    });

    // Route to specific fixer
    let result: AutoFixResult;
    switch (failure.errorType) {
      case ErrorType.LINTING_ERROR:
        result = await this.fixLintingErrors(failure.affectedFiles, useDryRun);
        break;
      case ErrorType.FORMAT_ERROR:
        result = await this.fixFormatErrors(failure.affectedFiles, useDryRun);
        break;
      case ErrorType.TYPE_ERROR:
        result = await this.fixTypeErrors(failure.affectedFiles, useDryRun);
        break;
      case ErrorType.SECURITY_ISSUE:
        result = await this.fixSecurityIssues(failure, useDryRun);
        break;
      default:
        this.log('error', `Unsupported error type: ${failure.errorType}`);
        return { success: false, reason: 'unsupported_type' };
    }

    // Track attempt (only for actual fixes, not dry runs)
    if (!useDryRun) {
      this.attemptTracker.set(attemptKey, attempts + 1);
    }

    // Calculate duration and track metrics
    const duration = Date.now() - startTime;
    this.trackMetrics(failure.errorType, result, useDryRun, duration);

    // Log result
    if (result.success) {
      this.log('info', `Auto-fix successful for ${failure.errorType}`, {
        prNumber: result.prNumber,
        changedLines: result.changedLines,
        duration: `${duration}ms`
      });
    } else {
      this.log('warn', `Auto-fix failed for ${failure.errorType}`, {
        reason: result.reason,
        rolledBack: result.rolledBack,
        verificationFailed: result.verificationFailed,
        duration: `${duration}ms`
      });
    }

    return result;
  }

  /**
   * Fix linting errors using project's linter
   * Session 2.3: Added dryRun parameter
   */
  private async fixLintingErrors(files: string[], dryRun: boolean = false): Promise<AutoFixResult> {
    const language = this.detectLanguage(files);

    try {
      // Session 2.3: Dry-run mode - simulate without executing
      if (dryRun) {
        if (language === 'javascript' || language === 'typescript') {
          if (await this.hasCommand('eslint')) {
            return {
              success: true,
              reason: 'dry_run',
              error: `Would run: npx eslint --fix ${files.join(' ')}`
            };
          } else if (await this.hasPackageScript('lint:fix')) {
            return {
              success: true,
              reason: 'dry_run',
              error: 'Would run: npm run lint:fix'
            };
          } else {
            return { success: false, reason: 'no_lint_tool' };
          }
        } else if (language === 'python') {
          if (await this.hasCommand('ruff')) {
            return {
              success: true,
              reason: 'dry_run',
              error: `Would run: ruff check --fix ${files.join(' ')}`
            };
          } else {
            return { success: false, reason: 'no_lint_tool' };
          }
        } else {
          return { success: false, reason: 'unsupported_language', language };
        }
      }

      // Session 2.2: Save state before making changes
      await this.saveState();

      if (language === 'javascript' || language === 'typescript') {
        // Try eslint first
        if (await this.hasCommand('eslint')) {
          await execAsync(`npx eslint --fix ${files.join(' ')}`);
        } else if (await this.hasPackageScript('lint:fix')) {
          await execAsync('npm run lint:fix');
        } else {
          return { success: false, reason: 'no_lint_tool' };
        }
      } else if (language === 'python') {
        // Try ruff, then fallback to pylint
        if (await this.hasCommand('ruff')) {
          await execAsync(`ruff check --fix ${files.join(' ')}`);
        } else {
          return { success: false, reason: 'no_lint_tool' };
        }
      } else {
        return { success: false, reason: 'unsupported_language', language };
      }

      // Verify changes
      const diff = await this.git.getDiff();
      if (!diff || diff.length === 0) {
        return { success: false, reason: 'no_changes' };
      }

      // Check change size
      const changedLines = this.countChangedLines(diff);
      if (changedLines > this.config.maxChangedLines) {
        await this.restoreState();
        return { success: false, reason: 'too_many_changes', changedLines, rolledBack: true };
      }

      // Session 2.1: Verify changes after fix
      const verification = await this.verifyChanges();
      if (!verification.success) {
        await this.restoreState();
        return {
          success: false,
          reason: 'verification_failed',
          verificationFailed: true,
          verificationErrors: verification.errors,
          rolledBack: true
        };
      }

      // Create fix PR
      const prResult = await this.createFixPR(
        'fix: auto-fix linting errors',
        `Automatically fixed linting errors in:\n${files.map(f => `- ${f}`).join('\n')}`,
        files
      );

      return { success: true, prNumber: prResult.number, changedLines };

    } catch (error) {
      await this.restoreState();
      return { success: false, reason: 'execution_failed', error: (error as Error).message, rolledBack: true };
    }
  }

  /**
   * Fix formatting errors
   * Session 2.3: Added dryRun parameter
   */
  private async fixFormatErrors(files: string[], dryRun: boolean = false): Promise<AutoFixResult> {
    const language = this.detectLanguage(files);

    try {
      // Session 2.3: Dry-run mode - simulate without executing
      if (dryRun) {
        if (language === 'javascript' || language === 'typescript') {
          if (await this.hasCommand('prettier')) {
            return {
              success: true,
              reason: 'dry_run',
              error: `Would run: npx prettier --write ${files.join(' ')}`
            };
          } else if (await this.hasPackageScript('format')) {
            return {
              success: true,
              reason: 'dry_run',
              error: 'Would run: npm run format'
            };
          } else {
            return { success: false, reason: 'no_format_tool' };
          }
        } else if (language === 'python') {
          if (await this.hasCommand('black')) {
            return {
              success: true,
              reason: 'dry_run',
              error: `Would run: black ${files.join(' ')}`
            };
          } else {
            return { success: false, reason: 'no_format_tool' };
          }
        } else if (language === 'go') {
          return {
            success: true,
            reason: 'dry_run',
            error: 'Would run: go fmt ./...'
          };
        } else {
          return { success: false, reason: 'unsupported_language', language };
        }
      }

      // Session 2.2: Save state before making changes
      await this.saveState();

      if (language === 'javascript' || language === 'typescript') {
        if (await this.hasCommand('prettier')) {
          await execAsync(`npx prettier --write ${files.join(' ')}`);
        } else if (await this.hasPackageScript('format')) {
          await execAsync('npm run format');
        } else {
          return { success: false, reason: 'no_format_tool' };
        }
      } else if (language === 'python') {
        if (await this.hasCommand('black')) {
          await execAsync(`black ${files.join(' ')}`);
        } else {
          return { success: false, reason: 'no_format_tool' };
        }
      } else if (language === 'go') {
        await execAsync('go fmt ./...');
      } else {
        return { success: false, reason: 'unsupported_language', language };
      }

      const diff = await this.git.getDiff();
      if (!diff || diff.length === 0) {
        return { success: false, reason: 'no_changes' };
      }

      // Check change size
      const changedLines = this.countChangedLines(diff);
      if (changedLines > this.config.maxChangedLines) {
        await this.restoreState();
        return { success: false, reason: 'too_many_changes', changedLines, rolledBack: true };
      }

      // Session 2.1: Verify changes after fix
      const verification = await this.verifyChanges();
      if (!verification.success) {
        await this.restoreState();
        return {
          success: false,
          reason: 'verification_failed',
          verificationFailed: true,
          verificationErrors: verification.errors,
          rolledBack: true
        };
      }

      const prResult = await this.createFixPR(
        'style: auto-format code',
        `Automatically formatted code using ${language} formatter.`,
        files
      );

      return { success: true, prNumber: prResult.number, changedLines };

    } catch (error) {
      await this.restoreState();
      return { success: false, reason: 'execution_failed', error: (error as Error).message, rolledBack: true };
    }
  }

  /**
   * Fix type errors (limited capability)
   * Session 2.3: Added dryRun parameter
   */
  private async fixTypeErrors(_files: string[], dryRun: boolean = false): Promise<AutoFixResult> {
    // TypeScript: Use tsc with --noEmit to identify, but limited auto-fix
    // This is a stretch goal - most type errors need manual intervention

    if (dryRun) {
      return {
        success: false,
        reason: 'limited_auto_fix_capability',
        error: 'Type errors require manual intervention (Phase 7: Codex)'
      };
    }

    // For now, return not_auto_fixable
    // Phase 7 (Codex) will handle this better
    return { success: false, reason: 'limited_auto_fix_capability' };
  }

  /**
   * Fix security issues (npm audit fix, limited scope)
   * Session 2.3: Added dryRun parameter
   */
  private async fixSecurityIssues(failure: FailureDetail, dryRun: boolean = false): Promise<AutoFixResult> {
    const language = this.detectLanguage(failure.affectedFiles);

    try {
      // Session 2.3: Dry-run mode - simulate without executing
      if (dryRun) {
        if (language === 'javascript' || language === 'typescript') {
          if (failure.summary.includes('dependency') || failure.summary.includes('vulnerability')) {
            return {
              success: true,
              reason: 'dry_run',
              error: 'Would run: npm audit fix'
            };
          }
        }
        return { success: false, reason: 'limited_auto_fix_capability' };
      }

      // Session 2.2: Save state before making changes
      await this.saveState();

      if (language === 'javascript' || language === 'typescript') {
        // Only for dependency vulnerabilities
        if (failure.summary.includes('dependency') || failure.summary.includes('vulnerability')) {
          await execAsync('npm audit fix');

          const diff = await this.git.getDiff();
          if (!diff) {
            return { success: false, reason: 'no_changes' };
          }

          // Check change size
          const changedLines = this.countChangedLines(diff);
          if (changedLines > this.config.maxChangedLines) {
            await this.restoreState();
            return { success: false, reason: 'too_many_changes', changedLines, rolledBack: true };
          }

          // Session 2.1: Verify changes after fix
          const verification = await this.verifyChanges();
          if (!verification.success) {
            await this.restoreState();
            return {
              success: false,
              reason: 'verification_failed',
              verificationFailed: true,
              verificationErrors: verification.errors,
              rolledBack: true
            };
          }

          const prResult = await this.createFixPR(
            'fix: auto-fix dependency vulnerabilities',
            'Automatically fixed npm audit vulnerabilities.',
            ['package-lock.json']
          );

          return { success: true, prNumber: prResult.number, changedLines };
        }
      }

      // Secret detection and other security issues -> Phase 7 (Codex)
      return { success: false, reason: 'limited_auto_fix_capability' };

    } catch (error) {
      await this.restoreState();
      return { success: false, reason: 'execution_failed', error: (error as Error).message, rolledBack: true };
    }
  }

  /**
   * Create fix PR
   */
  private async createFixPR(
    title: string,
    body: string,
    files: string[]
  ): Promise<{ number: number; url: string }> {
    // Get current branch
    const branch = await this.git.getCurrentBranch();

    // Create fix branch
    const fixBranch = `${branch}-autofix-${Date.now()}`;
    await this.git.createBranch(fixBranch);

    // Stage and commit
    await this.git.add(files);
    await this.git.commit(`${title}\n\n${body}\n\n🤖 Auto-generated by git-workflow-manager`);

    // Push
    await this.git.push('origin', fixBranch, true);

    // Create PR
    const pr = await this.github.createPR({
      title,
      body: `${body}\n\n**Auto-Fix Details**:\n- Affected files: ${files.length}\n- Original branch: ${branch}\n\n🤖 This PR was automatically generated by git-workflow-manager`,
      head: fixBranch,
      base: branch,
      draft: false
    });

    return { number: pr.number, url: pr.html_url };
  }

  /**
   * Helper: Check if error type is auto-fixable
   */
  private isAutoFixable(errorType: ErrorType): boolean {
    return [
      ErrorType.LINTING_ERROR,
      ErrorType.FORMAT_ERROR,
      ErrorType.SECURITY_ISSUE,  // Limited - only npm audit for dependencies
      // ErrorType.TYPE_ERROR,  // Limited - Phase 7
    ].includes(errorType);
  }

  /**
   * Helper: Detect language from file extensions
   */
  private detectLanguage(files: string[]): string {
    // Check for JavaScript/TypeScript files (including package-lock.json for npm audit)
    if (files.some(f =>
      f.endsWith('.ts') || f.endsWith('.tsx') ||
      f.endsWith('.js') || f.endsWith('.jsx') ||
      f.endsWith('package-lock.json') || f.endsWith('package.json')
    )) {
      return files.some(f => f.endsWith('.ts') || f.endsWith('.tsx')) ? 'typescript' : 'javascript';
    }
    if (files.some(f => f.endsWith('.py'))) return 'python';
    if (files.some(f => f.endsWith('.go'))) return 'go';
    if (files.some(f => f.endsWith('.rs'))) return 'rust';
    return 'unknown';
  }

  /**
   * Helper: Check if command exists
   */
  private async hasCommand(cmd: string): Promise<boolean> {
    try {
      await execAsync(`which ${cmd}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Check if package.json has script
   */
  private async hasPackageScript(script: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('npm run');
      return stdout.includes(script);
    } catch {
      return false;
    }
  }

  /**
   * Helper: Count changed lines in diff
   */
  private countChangedLines(diff: string): number {
    return (diff.match(/^[\+\-]/gm) || []).length;
  }

  /**
   * Helper: Generate attempt tracking key
   */
  private getAttemptKey(prNumber: number, errorType: ErrorType): string {
    return `${prNumber}:${errorType}`;
  }

  /**
   * Session 2.2: Save current state for potential rollback
   */
  private async saveState(): Promise<void> {
    try {
      // Check if there are any changes to stash
      const status = await execAsync('git status --porcelain');

      if (status.stdout.trim()) {
        // Stash current changes
        const stashResult = await execAsync('git stash push -m "gwm-autofix-backup"');
        this.stashedChanges = stashResult.stdout;
      }
    } catch (error) {
      // If stash fails, continue (changes might already be committed)
      console.warn('Warning: Could not save state:', (error as Error).message);
    }
  }

  /**
   * Session 2.2: Restore previous state (rollback)
   */
  private async restoreState(): Promise<boolean> {
    try {
      if (!this.stashedChanges) {
        return false; // Nothing to restore
      }

      // Restore stashed changes
      await execAsync('git stash pop');
      this.stashedChanges = null;
      return true;
    } catch (error) {
      console.error('Error restoring state:', (error as Error).message);
      return false;
    }
  }

  /**
   * Session 2.1: Verify changes after auto-fix
   * Returns true if verification passes, false otherwise
   */
  private async verifyChanges(): Promise<{ success: boolean; errors: string[] }> {
    // Skip verification if VerifyService not provided or requireTests is false
    if (!this.verify || !this.config.requireTests) {
      return { success: true, errors: [] };
    }

    try {
      const result = await this.verify.runChecks({ timeout: 120000 }); // 2 minutes
      return {
        success: result.success,
        errors: result.errors
      };
    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Session 3.2: Track metrics for an auto-fix attempt
   */
  private trackMetrics(
    errorType: ErrorType,
    result: AutoFixResult,
    dryRun: boolean,
    duration: number
  ): void {
    this.metrics.lastUpdated = new Date();
    this.metrics.totalFixDuration += duration;

    // Track dry-run separately
    if (dryRun) {
      this.metrics.dryRunAttempts++;
      return;
    }

    // Track overall metrics
    this.metrics.totalAttempts++;
    if (result.success) {
      this.metrics.successfulFixes++;
    } else {
      this.metrics.failedFixes++;
    }

    // Track rollbacks and verification failures
    if (result.rolledBack) {
      this.metrics.rollbackCount++;
    }
    if (result.verificationFailed) {
      this.metrics.verificationFailures++;
    }

    // Track by error type
    if (!this.metrics.byErrorType[errorType]) {
      this.metrics.byErrorType[errorType] = {
        attempts: 0,
        successes: 0,
        failures: 0
      };
    }
    this.metrics.byErrorType[errorType]!.attempts++;
    if (result.success) {
      this.metrics.byErrorType[errorType]!.successes++;
    } else {
      this.metrics.byErrorType[errorType]!.failures++;
    }

    // Track by reason
    if (result.reason) {
      this.metrics.byReason[result.reason] = (this.metrics.byReason[result.reason] || 0) + 1;
    }

    // Update average duration
    if (this.metrics.totalAttempts > 0) {
      this.metrics.averageFixDuration = this.metrics.totalFixDuration / this.metrics.totalAttempts;
    }
  }

  /**
   * Session 3.2: Log auto-fix attempt
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    if (!this.enableLogging) return;

    const timestamp = new Date().toISOString();
    const prefix = `[AutoFix ${timestamp}]`;

    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data || '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data || '');
        break;
    }
  }

  /**
   * Session 3.2: Get current metrics
   */
  getMetrics(): AutoFixMetrics {
    return { ...this.metrics };
  }

  /**
   * Session 3.2: Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      successfulFixes: 0,
      failedFixes: 0,
      rollbackCount: 0,
      verificationFailures: 0,
      dryRunAttempts: 0,
      byErrorType: {},
      byReason: {},
      totalFixDuration: 0,
      startTime: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Session 3.2: Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }
}
