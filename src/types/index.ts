/**
 * Core types for git-workflow-manager
 */

export interface CheckRunDetails {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  html_url: string;
  details_url: string;
  output: {
    title: string;
    summary: string;
    text: string;
    annotations_count: number;
  };
  started_at: string;
  completed_at: string;
  duration_ms?: number;
}

export interface CheckSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;

  // Detailed failure information
  failureDetails: FailureDetail[];

  // Overall status
  overallStatus: 'success' | 'failure' | 'pending';

  // Timing
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export interface FailureDetail {
  checkName: string;
  errorType: ErrorType;
  summary: string;
  affectedFiles: string[];
  annotations: Annotation[];
  suggestedFix: string | null;
  url: string;
}

export enum ErrorType {
  TEST_FAILURE = 'test_failure',
  LINTING_ERROR = 'linting_error',
  TYPE_ERROR = 'type_error',
  SECURITY_ISSUE = 'security_issue',
  BUILD_ERROR = 'build_error',
  FORMAT_ERROR = 'format_error',
  UNKNOWN = 'unknown'
}

export interface Annotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'failure' | 'warning' | 'notice';
  message: string;
  title: string;
  raw_details?: string;
}

export interface PollerOptions {
  token: string;
  owner: string;
  repo: string;
}

export interface GitHubServiceOptions {
  token: string;
  owner?: string;
  repo?: string;
}

export interface PROptions {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface WorkflowConfig {
  // Branch protection settings
  branchProtection?: {
    enabled: boolean;
    requireReviews?: number;
    requireStatusChecks?: string[];
    enforceAdmins?: boolean;
  };

  // CI/CD settings
  ci?: {
    waitForChecks?: boolean;
    failFast?: boolean;
    retryFlaky?: boolean;
    timeout?: number; // in minutes
  };

  // Security settings
  security?: {
    scanSecrets?: boolean;
    scanDependencies?: boolean;
    allowedVulnerabilities?: string[];
  };

  // PR template settings
  pr?: {
    templatePath?: string;
    autoAssign?: string[];
    autoLabel?: string[];
  };

  // Session 3.1: Auto-fix settings
  autoFix?: {
    enabled?: boolean;           // Enable/disable auto-fix globally
    maxAttempts?: number;        // Max fix attempts per error type (default: 2)
    maxChangedLines?: number;    // Max lines that can be changed (default: 1000)
    requireTests?: boolean;      // Run tests after fix (default: true)
    enableDryRun?: boolean;      // Enable dry-run mode by default (default: false)
    autoMerge?: boolean;         // Auto-merge fix PRs if checks pass (default: false)
    createPR?: boolean;          // Create PR for fixes (default: true)
  };

  // Phase 2: Git Hooks settings
  hooks?: {
    prePush?: {
      enabled?: boolean;         // Pre-push hook installed (default: false)
      reminder?: boolean;        // Show reminder message (default: true)
    };
    postCommit?: {
      enabled?: boolean;         // Post-commit hook installed (default: false)
      reminder?: boolean;        // Show reminder message (default: true)
    };
  };
}

export interface GitServiceOptions {
  workingDir: string;
}

export interface BranchInfo {
  current: string;
  isClean: boolean;
  hasUncommittedChanges: boolean;
  remoteBranches: string[];
}

export interface MergeOptions {
  method?: 'merge' | 'squash' | 'rebase';
  commitTitle?: string;
  commitMessage?: string;
  sha?: string;
}

export interface PollStrategy {
  type: 'fixed' | 'exponential';
  initialInterval: number;
  maxInterval?: number;
  multiplier?: number;
}

export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
  pollStrategy?: PollStrategy;
  onProgress?: (progress: ProgressUpdate) => void;
  failFast?: boolean;
  retryFlaky?: boolean;
  retryOptions?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface ProgressUpdate {
  timestamp: Date;
  elapsed: number;
  total: number;
  passed: number;
  failed: number;
  pending: number;
  newFailures: string[];
  newPasses: string[];
}

export interface CheckResult {
  success: boolean;
  summary: CheckSummary;
  duration: number;
  reason?: string;
  retriesUsed: number;
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Phase 3: Branch Protection Types
export interface ProtectionStatus {
  enabled: boolean;
  requiredStatusChecks?: string[];
  strictChecks?: boolean;
  requiredReviews?: number;
  dismissStaleReviews?: boolean;
  requireCodeOwnerReviews?: boolean;
  enforceAdmins?: boolean;
  requireConversationResolution?: boolean;
  requireLinearHistory?: boolean;
  allowForcePushes?: boolean;
  allowDeletions?: boolean;
}

export interface ValidationResult {
  ready: boolean;
  issues: string[];
  warnings: string[];
  protection?: ProtectionStatus;
}

export type ProtectionPreset = 'basic' | 'standard' | 'strict';

// Phase 3: Security Scanner Types
export interface SecretFinding {
  file: string;
  line: number;
  type: string;
  context?: string;
}

export interface SecretScanResult {
  found: boolean;
  secrets: SecretFinding[];
  blocked?: boolean;
  skipped?: boolean;
  reason?: string;
}

export interface Vulnerability {
  package: string;
  version: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cve: string;
  description: string;
}

export interface VulnerabilityResult {
  total?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  shouldBlock?: boolean;
  vulnerabilities?: Vulnerability[];
  skipped?: boolean;
  reason?: string;
}

export interface SecurityScanResult {
  secrets: SecretScanResult;
  vulnerabilities: VulnerabilityResult;
  passed: boolean;
  blockers: string[];
  warnings: string[];
}

// Phase 6: Auto-Fix Types
export interface AutoFixConfig {
  maxAttempts: number;        // Default: 2
  maxChangedLines: number;    // Default: 1000
  requireTests: boolean;      // Default: true
  enableDryRun: boolean;      // Default: true
}

export interface AutoFixResult {
  success: boolean;
  reason?: string;
  prNumber?: number;
  changedLines?: number;
  attempts?: number;
  errorType?: ErrorType;
  error?: string;
  language?: string;
  verificationFailed?: boolean;
  verificationErrors?: string[];
  rolledBack?: boolean;
}

export interface AutoFixSuggestion {
  command: string;
  autoFixable: boolean;
  executionStrategy: 'deterministic' | 'ai' | 'manual';
  confidence?: number;
}

// Session 3.2: Auto-fix metrics tracking
export interface AutoFixMetrics {
  totalAttempts: number;
  successfulFixes: number;
  failedFixes: number;
  rollbackCount: number;
  verificationFailures: number;
  dryRunAttempts: number;

  // Breakdown by error type
  byErrorType: {
    [key in ErrorType]?: {
      attempts: number;
      successes: number;
      failures: number;
    };
  };

  // Breakdown by reason
  byReason: {
    [reason: string]: number;
  };

  // Timing
  averageFixDuration?: number;
  totalFixDuration: number;

  // Date range
  startTime: Date;
  lastUpdated: Date;
}

// Phase 1.5: Git Worktree Types
/**
 * Git worktree information
 */
export interface WorktreeInfo {
  path: string;          // Absolute path to worktree
  commit: string;        // Current commit hash
  branch: string | null; // Branch name (null if detached HEAD)
  isMain: boolean;       // True if this is the main/bare worktree
}

/**
 * Worktree conflict error details
 */
export interface WorktreeConflict {
  branchName: string;
  worktrees: string[];   // Paths where branch is checked out
}
