import { ErrorType, AutoFixSuggestion } from '../types';

/**
 * SuggestionEngine - Generates suggested fixes for CI failures
 * Enhanced in Phase 6 to support auto-fix detection and execution strategies
 */
export class SuggestionEngine {
  /**
   * Get enhanced suggestion with execution metadata
   */
  getSuggestion(
    summary: string,
    errorType: ErrorType,
    affectedFiles: string[]
  ): AutoFixSuggestion {
    const command = this.getCommand(errorType, affectedFiles, summary);
    const autoFixable = this.isAutoFixable(errorType, affectedFiles);
    const strategy = this.getExecutionStrategy(errorType);
    const confidence = this.calculateConfidence(errorType, affectedFiles);

    return {
      command,
      autoFixable,
      executionStrategy: strategy,
      confidence
    };
  }

  /**
   * Get command suggestion (legacy behavior)
   */
  private getCommand(errorType: ErrorType, affectedFiles: string[], summary: string): string {
    switch (errorType) {
      case ErrorType.TEST_FAILURE:
        if (affectedFiles.length > 0) {
          // Detect Python vs Node.js
          const hasPython = affectedFiles.some(f => f.endsWith('.py'));
          const hasNode = affectedFiles.some(f => f.endsWith('.ts') || f.endsWith('.js'));

          if (hasPython) {
            return `pytest ${affectedFiles.join(' ')} -v`;
          } else if (hasNode) {
            return `npm test -- ${affectedFiles.join(' ')}`;
          }
        }
        return 'npm test -- --verbose';

      case ErrorType.LINTING_ERROR:
        if (affectedFiles.length > 0) {
          const hasPython = affectedFiles.some(f => f.endsWith('.py'));
          if (hasPython) {
            return `ruff check --fix ${affectedFiles.join(' ')}`;
          }
        }
        return 'npm run lint -- --fix';

      case ErrorType.TYPE_ERROR:
        return 'npm run typecheck';

      case ErrorType.FORMAT_ERROR:
        if (affectedFiles.length > 0) {
          const hasPython = affectedFiles.some(f => f.endsWith('.py'));
          if (hasPython) {
            return `black ${affectedFiles.join(' ')}`;
          }
        }
        return 'npm run format';

      case ErrorType.BUILD_ERROR:
        return 'npm run build';

      case ErrorType.SECURITY_ISSUE:
        if (summary.includes('secret')) {
          return 'Review and remove secrets from code';
        } else if (summary.includes('dependency') || summary.includes('vulnerability')) {
          return 'npm audit fix';
        } else if (summary.includes('codeql')) {
          return 'Review CodeQL findings at check details URL';
        }
        return 'Review security scan findings';

      default:
        return 'No specific suggestion available';
    }
  }

  /**
   * Determine if error is auto-fixable
   */
  private isAutoFixable(errorType: ErrorType, files: string[]): boolean {
    switch (errorType) {
      case ErrorType.LINTING_ERROR:
      case ErrorType.FORMAT_ERROR:
        return true;  // Always auto-fixable

      case ErrorType.TYPE_ERROR:
        return false;  // Limited capability (Phase 7)

      case ErrorType.SECURITY_ISSUE:
        return files.some(f => f === 'package-lock.json');  // Only npm audit

      default:
        return false;
    }
  }

  /**
   * Determine execution strategy
   */
  private getExecutionStrategy(errorType: ErrorType): 'deterministic' | 'ai' | 'manual' {
    switch (errorType) {
      case ErrorType.LINTING_ERROR:
      case ErrorType.FORMAT_ERROR:
        return 'deterministic';  // Use existing tools

      case ErrorType.TEST_FAILURE:
      case ErrorType.TYPE_ERROR:
      case ErrorType.BUILD_ERROR:
        return 'ai';  // Phase 7: Codex

      default:
        return 'manual';  // Requires human intervention
    }
  }

  /**
   * Calculate confidence in auto-fix
   */
  private calculateConfidence(errorType: ErrorType, files: string[]): number {
    // Simple heuristic for now
    if (errorType === ErrorType.LINTING_ERROR || errorType === ErrorType.FORMAT_ERROR) {
      return 0.95;  // Very confident in deterministic tools
    }
    if (errorType === ErrorType.SECURITY_ISSUE && files.includes('package-lock.json')) {
      return 0.85;  // npm audit is reliable
    }
    return 0.5;  // Low confidence for others
  }
}
