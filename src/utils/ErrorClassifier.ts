import { ErrorType } from '../types';

/**
 * ErrorClassifier - Classifies CI check failures into error types
 */
export class ErrorClassifier {
  /**
   * Classify error type based on check run details
   */
  classify(check: any): ErrorType {
    const name = check.name.toLowerCase();
    const summary = (check.output?.summary || '').toLowerCase();
    const title = (check.output?.title || '').toLowerCase();

    // Test failures
    if (this.isTestFailure(name, summary, title)) {
      return ErrorType.TEST_FAILURE;
    }

    // Linting errors
    if (this.isLintingError(name, summary, title)) {
      return ErrorType.LINTING_ERROR;
    }

    // Type errors
    if (this.isTypeError(name, summary, title)) {
      return ErrorType.TYPE_ERROR;
    }

    // Security issues
    if (this.isSecurityIssue(name, summary, title)) {
      return ErrorType.SECURITY_ISSUE;
    }

    // Build errors
    if (this.isBuildError(name, summary, title)) {
      return ErrorType.BUILD_ERROR;
    }

    // Format errors
    if (this.isFormatError(name, summary, title)) {
      return ErrorType.FORMAT_ERROR;
    }

    return ErrorType.UNKNOWN;
  }

  private isTestFailure(name: string, summary: string, title: string): boolean {
    const keywords = ['test', 'spec', 'pytest', 'jest', 'mocha', 'unittest', 'vitest'];
    return keywords.some(kw =>
      name.includes(kw) || summary.includes(kw) || title.includes(kw)
    );
  }

  private isLintingError(name: string, summary: string, title: string): boolean {
    const keywords = ['lint', 'eslint', 'pylint', 'flake8', 'ruff'];
    return keywords.some(kw =>
      name.includes(kw) || summary.includes(kw) || title.includes(kw)
    );
  }

  private isTypeError(name: string, summary: string, title: string): boolean {
    const keywords = ['type', 'typecheck', 'mypy', 'typescript', 'tsc'];
    return keywords.some(kw =>
      name.includes(kw) || summary.includes(kw) || title.includes(kw)
    );
  }

  private isSecurityIssue(name: string, summary: string, title: string): boolean {
    const keywords = ['security', 'codeql', 'secret', 'vuln', 'dependency'];
    return keywords.some(kw =>
      name.includes(kw) || summary.includes(kw) || title.includes(kw)
    );
  }

  private isBuildError(name: string, summary: string, title: string): boolean {
    const keywords = ['build', 'compile', 'webpack', 'tsc', 'babel', 'rollup', 'vite'];
    return keywords.some(kw =>
      name.includes(kw) || summary.includes(kw) || title.includes(kw)
    );
  }

  private isFormatError(name: string, summary: string, title: string): boolean {
    const keywords = ['format', 'prettier', 'black', 'autopep8'];
    return keywords.some(kw =>
      name.includes(kw) || summary.includes(kw) || title.includes(kw)
    );
  }
}
