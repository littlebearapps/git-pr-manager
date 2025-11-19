import { Octokit } from "@octokit/rest";
import {
  PollerOptions,
  CheckSummary,
  FailureDetail,
  Annotation,
  WaitOptions,
  ProgressUpdate,
  CheckResult,
  TimeoutError,
  ErrorType,
  PollStrategy,
} from "../types";
import { ErrorClassifier } from "../utils/ErrorClassifier";
import { SuggestionEngine } from "../utils/SuggestionEngine";
import { logger } from "../utils/logger";

/**
 * EnhancedCIPoller - Intelligent CI status polling with rich error reporting
 */
export class EnhancedCIPoller {
  private github: Octokit;
  private owner: string;
  private repo: string;
  private errorClassifier: ErrorClassifier;
  private suggestionEngine: SuggestionEngine;

  constructor(options: PollerOptions) {
    this.github = new Octokit({ auth: options.token });
    this.owner = options.owner;
    this.repo = options.repo;
    this.errorClassifier = new ErrorClassifier();
    this.suggestionEngine = new SuggestionEngine();
  }

  /**
   * Get detailed check status for a PR
   */
  async getDetailedCheckStatus(prNumber: number): Promise<CheckSummary> {
    // Get PR details
    const { data: pr } = await this.github.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    const headSha = pr.head.sha;

    // Get check runs (GitHub Actions, GitHub Apps)
    const { data: checkRuns } = await this.github.rest.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: headSha,
      per_page: 100,
    });

    // Get commit statuses (legacy, external services)
    const { data: commitStatus } =
      await this.github.rest.repos.getCombinedStatusForRef({
        owner: this.owner,
        repo: this.repo,
        ref: headSha,
      });

    return this.parseCheckDetails(checkRuns, commitStatus);
  }

  /**
   * Parse check run details and extract actionable information
   */
  private parseCheckDetails(checkRuns: any, commitStatus: any): CheckSummary {
    const allChecks = checkRuns.check_runs;
    const failures = allChecks.filter((c: any) => c.conclusion === "failure");
    const pending = allChecks.filter((c: any) => c.status !== "completed");

    const failureDetails: FailureDetail[] = failures.map((check: any) => {
      const errorType = this.errorClassifier.classify(check);
      const affectedFiles = this.extractFiles(check.output?.text || "");
      const suggestedFix = this.suggestionEngine.getSuggestion(
        check.output?.summary || "",
        errorType,
        affectedFiles,
      );

      return {
        checkName: check.name,
        errorType,
        summary: check.output?.summary || "No summary available",
        affectedFiles,
        annotations: [], // Fetched separately if needed
        suggestedFix,
        url: check.html_url,
      };
    });

    return {
      total: allChecks.length + commitStatus.statuses.length,
      passed: allChecks.filter((c: any) => c.conclusion === "success").length,
      failed: failures.length,
      pending: pending.length,
      skipped: allChecks.filter((c: any) => c.conclusion === "skipped").length,
      failureDetails,
      overallStatus:
        failures.length > 0
          ? "failure"
          : pending.length > 0
            ? "pending"
            : "success",
      startedAt: new Date(allChecks[0]?.started_at || Date.now()),
      completedAt: pending.length === 0 ? new Date() : undefined,
      duration: this.calculateDuration(allChecks),
    };
  }

  /**
   * Extract file paths from check output
   */
  private extractFiles(checkOutput: string): string[] {
    const patterns = [
      // pytest: tests/test_auth.py::test_login FAILED
      /([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))::/g,

      // TypeScript: src/components/Button.tsx(45,12): error TS2322
      /([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))\(\d+,\d+\)/g,

      // Python traceback: File "app/models/user.py", line 123
      /File "([a-zA-Z0-9_\-\/\.]+\.(py|ts|tsx|js|jsx|go|rs))"/g,

      // ESLint: /path/to/file.js
      /\/([a-zA-Z0-9_\-\/]+\.(py|ts|tsx|js|jsx|go|rs))/g,
    ];

    const files = new Set<string>();
    for (const pattern of patterns) {
      const matches = checkOutput.matchAll(pattern);
      for (const match of matches) {
        files.add(match[1]);
      }
    }

    return Array.from(files);
  }

  /**
   * Fetch annotations for failed checks (detailed error info)
   */
  async getCheckAnnotations(
    checkRunId: number,
    limit = 50,
  ): Promise<Annotation[]> {
    const { data: annotations } = await this.github.rest.checks.listAnnotations(
      {
        owner: this.owner,
        repo: this.repo,
        check_run_id: checkRunId,
        per_page: limit,
      },
    );

    return annotations.map((ann: any) => ({
      path: ann.path,
      start_line: ann.start_line,
      end_line: ann.end_line,
      annotation_level: ann.annotation_level,
      message: ann.message,
      title: ann.title,
      raw_details: ann.raw_details,
    }));
  }

  /**
   * Calculate next polling interval based on strategy
   *
   * Exponential backoff: Increases interval gradually to reduce API calls
   * Adaptive behavior: Adjusts based on check duration patterns
   */
  private calculateNextInterval(
    currentInterval: number,
    strategy: PollStrategy,
    checkDuration?: number,
  ): number {
    if (strategy.type === "fixed") {
      return strategy.initialInterval;
    }

    // Exponential backoff with multiplier
    const multiplier = strategy.multiplier ?? 1.5;
    let nextInterval = Math.floor(currentInterval * multiplier);

    // Cap at maxInterval
    const maxInterval = strategy.maxInterval ?? 30000;
    nextInterval = Math.min(nextInterval, maxInterval);

    // Adaptive adjustment: If checks complete quickly, poll more aggressively
    if (checkDuration && checkDuration < 10000) {
      nextInterval = Math.max(nextInterval / 2, strategy.initialInterval);
    }

    return nextInterval;
  }

  /**
   * Wait for CI checks with async polling and progress updates
   */
  async waitForChecks(
    prNumber: number,
    options: WaitOptions = {},
  ): Promise<CheckResult> {
    const {
      timeout = 600000, // 10 minutes
      pollInterval = 10000, // 10 seconds (fallback for fixed strategy)
      pollStrategy = {
        type: "exponential",
        initialInterval: 5000,
        maxInterval: 30000,
        multiplier: 1.5,
      },
      onProgress,
      failFast = true,
      retryFlaky = false,
      retryOptions = { maxRetries: 3, retryDelay: 5000 },
    } = options;

    const startTime = Date.now();
    let previousStatus: CheckSummary | null = null;
    let retryCount = 0;
    let currentInterval = pollStrategy.initialInterval ?? pollInterval;
    let registrationPolls = 0;

    while (Date.now() - startTime < timeout) {
      const status = await this.getDetailedCheckStatus(prNumber);

      // Race condition handling: checks not yet registered
      if (status.total === 0) {
        const elapsed = Date.now() - startTime;
        const MAX_WAIT_FOR_REGISTRATION = 20000; // 20 seconds

        if (elapsed < MAX_WAIT_FOR_REGISTRATION) {
          const waitTime = Math.min(
            5000,
            1000 * Math.pow(2, registrationPolls),
          );
          registrationPolls++;
          await this.sleep(waitTime);
          // Do not emit progress spam for repeated 0/0 states
          previousStatus = status;
          continue;
        }

        // After grace period, treat as no checks configured
        onProgress?.({
          timestamp: new Date(),
          elapsed,
          total: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          newFailures: [],
          newPasses: [],
        });

        logger.warn("No CI checks configured for this repository");
        logger.info("Skipping CI check wait - no checks to monitor");

        return {
          success: true,
          summary: status,
          duration: Date.now() - startTime,
          retriesUsed: retryCount + registrationPolls,
        };
      }

      // Report progress if status changed
      if (this.hasStatusChanged(previousStatus, status)) {
        const progress: ProgressUpdate = {
          timestamp: new Date(),
          elapsed: Date.now() - startTime,
          total: status.total,
          passed: status.passed,
          failed: status.failed,
          pending: status.pending,
          newFailures: this.getNewFailures(previousStatus, status),
          newPasses: this.getNewPasses(previousStatus, status),
        };

        onProgress?.(progress);
      }

      // Check for completion
      if (status.pending === 0) {
        const success = status.failed === 0;

        // Handle flaky test retries
        if (!success && retryFlaky && retryCount < retryOptions.maxRetries) {
          const isRetryable = this.isRetryable(status, [
            "timeout",
            "network",
            "flaky",
          ]);

          if (isRetryable) {
            retryCount++;
            console.log(
              `⚠️  Retryable failure detected (attempt ${retryCount}/${retryOptions.maxRetries})`,
            );
            console.log(
              `   Waiting ${retryOptions.retryDelay}ms before retry...`,
            );
            await this.sleep(retryOptions.retryDelay);
            continue;
          }
        }

        return {
          success,
          summary: status,
          duration: Date.now() - startTime,
          retriesUsed: retryCount,
        };
      }

      // Fail fast on critical errors
      if (failFast && this.hasCriticalFailure(status)) {
        return {
          success: false,
          summary: status,
          duration: Date.now() - startTime,
          reason: "critical_failure",
          retriesUsed: retryCount,
        };
      }

      previousStatus = status;

      // Calculate next interval based on strategy and check duration
      currentInterval = this.calculateNextInterval(
        currentInterval,
        pollStrategy,
        status.duration,
      );

      await this.sleep(currentInterval);
    }

    throw new TimeoutError(`CI checks did not complete within ${timeout}ms`);
  }

  /**
   * Check if failures are retryable (flaky tests, network issues)
   */
  private isRetryable(status: CheckSummary, patterns: string[]): boolean {
    return status.failureDetails.some((failure) =>
      patterns.some((pattern) =>
        failure.summary.toLowerCase().includes(pattern.toLowerCase()),
      ),
    );
  }

  /**
   * Check for critical failures that should trigger fail-fast
   */
  private hasCriticalFailure(status: CheckSummary): boolean {
    return status.failureDetails.some(
      (f) =>
        f.errorType === ErrorType.TEST_FAILURE ||
        f.errorType === ErrorType.BUILD_ERROR ||
        f.errorType === ErrorType.SECURITY_ISSUE,
    );
  }

  /**
   * Detect status changes for progress reporting
   */
  private hasStatusChanged(
    prev: CheckSummary | null,
    current: CheckSummary,
  ): boolean {
    if (!prev) return true;

    return (
      prev.passed !== current.passed ||
      prev.failed !== current.failed ||
      prev.pending !== current.pending
    );
  }

  private getNewFailures(
    prev: CheckSummary | null,
    current: CheckSummary,
  ): string[] {
    if (!prev) return [];

    const prevFailed = new Set(prev.failureDetails.map((f) => f.checkName));
    return current.failureDetails
      .filter((f) => !prevFailed.has(f.checkName))
      .map((f) => f.checkName);
  }

  private getNewPasses(
    prev: CheckSummary | null,
    current: CheckSummary,
  ): string[] {
    if (!prev) return [];

    const prevFailed = new Set(prev.failureDetails.map((f) => f.checkName));
    const currentFailed = new Set(
      current.failureDetails.map((f) => f.checkName),
    );

    return Array.from(prevFailed).filter((name) => !currentFailed.has(name));
  }

  private calculateDuration(checks: any[]): number | undefined {
    const completed = checks.filter((c) => c.completed_at);
    if (completed.length === 0) return undefined;

    const durations = completed.map(
      (c) =>
        new Date(c.completed_at!).getTime() - new Date(c.started_at).getTime(),
    );

    return Math.max(...durations);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      // Prevent timer from keeping Node.js process alive
      timer.unref();
    });
  }
}
