/**
 * Structured error classes for better error handling and UX
 *
 * All custom errors include:
 * - Error code for programmatic handling
 * - Human-readable message
 * - Optional context/details
 * - Actionable suggestions for resolution
 * - JSON serialization for API responses
 */

/**
 * Base workflow error class
 */
export class WorkflowError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'WorkflowError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      suggestions: this.suggestions,
      name: this.name
    };
  }
}

/**
 * Git-related errors
 * Automatically includes worktree context in error details
 */
export class GitError extends WorkflowError {
  constructor(message: string, details?: any, suggestions: string[] = []) {
    // Add worktree context if available
    const enhancedDetails = {
      ...details,
      worktree: process.cwd() // Current working directory (worktree path)
    };

    super('GIT_ERROR', message, enhancedDetails, suggestions);
    this.name = 'GitError';
  }
}

/**
 * GitHub API errors
 */
export class GitHubAPIError extends WorkflowError {
  constructor(message: string, details?: any, suggestions: string[] = []) {
    super('GITHUB_API_ERROR', message, details, suggestions);
    this.name = 'GitHubAPIError';
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends WorkflowError {
  constructor(
    message: string = 'GitHub API rate limit exceeded',
    details?: { remaining: number; limit: number; resetAt: Date },
    suggestions: string[] = []
  ) {
    const defaultSuggestions = [
      'Wait for rate limit reset',
      'Use a GitHub token with higher rate limit',
      'Enable caching to reduce API calls'
    ];

    super(
      'RATE_LIMIT_EXCEEDED',
      message,
      details,
      suggestions.length > 0 ? suggestions : defaultSuggestions
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends WorkflowError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(
      'AUTH_ERROR',
      message,
      details,
      [
        'Set GITHUB_TOKEN environment variable',
        'Ensure token has required permissions',
        'Generate new token at https://github.com/settings/tokens'
      ]
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Branch protection errors
 */
export class BranchProtectionError extends WorkflowError {
  constructor(message: string, details?: any, suggestions: string[] = []) {
    const defaultSuggestions = [
      'Check branch protection rules on GitHub',
      'Ensure all required checks pass',
      'Get required PR reviews'
    ];

    super(
      'BRANCH_PROTECTION_ERROR',
      message,
      details,
      suggestions.length > 0 ? suggestions : defaultSuggestions
    );
    this.name = 'BranchProtectionError';
  }
}

/**
 * CI check failures
 */
export class CICheckError extends WorkflowError {
  constructor(
    message: string = 'CI checks failed',
    details?: {
      failedChecks: string[];
      prNumber: number;
      prUrl: string;
    },
    suggestions: string[] = []
  ) {
    const defaultSuggestions = [
      'Review failed checks on GitHub',
      'Fix issues and push changes',
      'Re-run failed checks if transient'
    ];

    super(
      'CI_CHECK_FAILED',
      message,
      details,
      suggestions.length > 0 ? suggestions : defaultSuggestions
    );
    this.name = 'CICheckError';
  }
}

/**
 * Merge conflict errors
 */
export class MergeConflictError extends WorkflowError {
  constructor(message: string = 'Merge conflicts detected', details?: any) {
    super(
      'MERGE_CONFLICT',
      message,
      details,
      [
        'Pull latest changes from base branch',
        'Resolve conflicts manually',
        'Run tests after resolving conflicts'
      ]
    );
    this.name = 'MergeConflictError';
  }
}

/**
 * Worktree conflict error - branch already checked out elsewhere
 */
export class WorktreeConflictError extends WorkflowError {
  constructor(
    branchName: string,
    worktreePaths: string[],
    currentPath: string
  ) {
    const message = `Branch '${branchName}' is already checked out in another worktree`;
    const details = {
      branch: branchName,
      currentWorktree: currentPath,
      conflictingWorktrees: worktreePaths
    };
    const suggestions = [
      `Switch to existing worktree: cd ${worktreePaths[0]}`,
      `Or use a different branch name`,
      `Or remove the worktree: git worktree remove ${worktreePaths[0]}`
    ];

    super('WORKTREE_CONFLICT', message, details, suggestions);
    this.name = 'WorktreeConflictError';
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends WorkflowError {
  constructor(message: string, details?: any, suggestions: string[] = []) {
    const defaultSuggestions = [
      'Run `gpm init` to create config file',
      'Check .gpm.yml syntax',
      'Refer to documentation for config options'
    ];

    super(
      'CONFIG_ERROR',
      message,
      details,
      suggestions.length > 0 ? suggestions : defaultSuggestions
    );
    this.name = 'ConfigError';
  }
}

/**
 * Security scan errors
 */
export class SecurityError extends WorkflowError {
  constructor(
    message: string = 'Security scan failed',
    details?: {
      secrets?: string[];
      vulnerabilities?: any[];
    },
    suggestions: string[] = []
  ) {
    const defaultSuggestions = [
      'Remove secrets from code',
      'Update vulnerable dependencies',
      'Review security findings carefully'
    ];

    super(
      'SECURITY_ERROR',
      message,
      details,
      suggestions.length > 0 ? suggestions : defaultSuggestions
    );
    this.name = 'SecurityError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends WorkflowError {
  constructor(
    message: string,
    details?: { issues: string[]; warnings?: string[] },
    suggestions: string[] = []
  ) {
    super('VALIDATION_ERROR', message, details, suggestions);
    this.name = 'ValidationError';
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends WorkflowError {
  constructor(
    message: string = 'Operation timed out',
    details?: { timeout: number; elapsed: number },
    suggestions: string[] = []
  ) {
    const defaultSuggestions = [
      'Increase timeout in configuration',
      'Check for long-running tests',
      'Verify CI is not stuck'
    ];

    super(
      'TIMEOUT_ERROR',
      message,
      details,
      suggestions.length > 0 ? suggestions : defaultSuggestions
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Helper function to convert any error to WorkflowError
 */
export function toWorkflowError(error: unknown): WorkflowError {
  if (error instanceof WorkflowError) {
    return error;
  }

  if (error instanceof Error) {
    return new WorkflowError('UNKNOWN_ERROR', error.message, { originalError: error });
  }

  return new WorkflowError('UNKNOWN_ERROR', String(error));
}

/**
 * Helper function to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError || error instanceof TimeoutError) {
    return true;
  }

  if (error instanceof WorkflowError) {
    // Network errors, transient failures are retryable
    return ['NETWORK_ERROR', 'TRANSIENT_ERROR', 'TIMEOUT_ERROR'].includes(error.code);
  }

  return false;
}
