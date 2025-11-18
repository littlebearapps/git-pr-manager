import { CheckSummary, ProgressUpdate, ErrorType } from '../types';
import chalk from 'chalk';

/**
 * OutputFormatter - Formats CI check results for console output
 */
export class OutputFormatter {
  /**
   * Format check summary for Claude Code CLI
   */
  formatCheckSummary(summary: CheckSummary): string {
    const lines: string[] = [];

    // Header
    if (summary.overallStatus === 'success') {
      lines.push('✅ All CI Checks Passed!');
    } else if (summary.overallStatus === 'pending') {
      lines.push('⏳ CI Checks In Progress...');
    } else {
      lines.push(`🔴 CI Checks Failed (${summary.failed}/${summary.total})`);
    }

    lines.push('');

    // Critical failures (if any)
    if (summary.failureDetails.length > 0) {
      lines.push('Critical Failures:');
      for (const failure of summary.failureDetails) {
        lines.push(`  ${this.getErrorIcon(failure.errorType)} ${failure.checkName} (${failure.errorType})`);
        lines.push(`     Summary: ${failure.summary}`);

        if (failure.affectedFiles.length > 0) {
          lines.push(`     Files affected:`);
          for (const file of failure.affectedFiles.slice(0, 5)) {
            lines.push(`       - ${file}`);
          }
          if (failure.affectedFiles.length > 5) {
            lines.push(`       ... and ${failure.affectedFiles.length - 5} more`);
          }
        }

        if (failure.suggestedFix) {
          lines.push(`     Suggested fix: ${failure.suggestedFix}`);
        }

        lines.push(`     Details: ${failure.url}`);
        lines.push('');
      }
    }

    // Passed checks
    const passedCount = summary.passed;
    if (passedCount > 0) {
      lines.push(`Passed (${passedCount}):`);
      lines.push(`  ✅ ${passedCount} check(s) passed`);
      lines.push('');
    }

    // Pending checks
    if (summary.pending > 0) {
      lines.push(`Pending (${summary.pending}):`);
      lines.push(`  ⏳ ${summary.pending} check(s) in progress`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format progress update
   */
  formatProgress(progress: ProgressUpdate): string {
    const elapsed = Math.floor(progress.elapsed / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Special case: no checks configured
    if (progress.total === 0) {
      return `${chalk.gray(`[${timeStr}]`)} ${chalk.yellow('⚠️  No CI checks configured')}`;
    }

    const lines: string[] = [];
    lines.push(`[${timeStr}] ${progress.passed + progress.failed}/${progress.total} checks completed`);

    if (progress.newPasses.length > 0) {
      for (const name of progress.newPasses) {
        lines.push(`  ✅ ${name}`);
      }
    }

    if (progress.newFailures.length > 0) {
      for (const name of progress.newFailures) {
        lines.push(`  ❌ ${name}`);
      }
    }

    if (progress.pending > 0) {
      lines.push(`  ⏳ ${progress.pending} in progress...`);
    }

    return lines.join('\n');
  }

  /**
   * Get emoji icon for error type
   */
  private getErrorIcon(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.TEST_FAILURE:
        return '🧪';
      case ErrorType.LINTING_ERROR:
        return '📝';
      case ErrorType.TYPE_ERROR:
        return '🔤';
      case ErrorType.SECURITY_ISSUE:
        return '🔒';
      case ErrorType.BUILD_ERROR:
        return '🔨';
      case ErrorType.FORMAT_ERROR:
        return '✨';
      default:
        return '❌';
    }
  }

  /**
   * Format check summary in compact mode (one line)
   */
  formatCompact(summary: CheckSummary): string {
    if (summary.overallStatus === 'success') {
      return `✅ ${summary.passed}/${summary.total} checks passed`;
    } else if (summary.overallStatus === 'pending') {
      return `⏳ ${summary.total - summary.pending}/${summary.total} checks completed (${summary.pending} pending)`;
    } else {
      return `🔴 ${summary.failed} check(s) failed, ${summary.passed} passed`;
    }
  }
}
