import { Octokit } from "@octokit/rest";
import { ProtectionStatus, ValidationResult, ProtectionPreset } from "../types";

interface Review {
  id: number;
  user: { id: number } | null;
  state: string;
  submitted_at?: string;
}

/**
 * BranchProtectionChecker - Validates and configures branch protection
 */
export class BranchProtectionChecker {
  constructor(
    private octokit: Octokit,
    private owner: string,
    private repo: string,
  ) {}

  /**
   * Get branch protection configuration
   */
  async getProtection(branch: string = "main"): Promise<ProtectionStatus> {
    try {
      const { data: protection } =
        await this.octokit.rest.repos.getBranchProtection({
          owner: this.owner,
          repo: this.repo,
          branch,
        });

      return {
        enabled: true,
        requiredStatusChecks: protection.required_status_checks?.contexts || [],
        strictChecks: protection.required_status_checks?.strict || false,
        requiredReviews:
          protection.required_pull_request_reviews
            ?.required_approving_review_count || 0,
        dismissStaleReviews:
          protection.required_pull_request_reviews?.dismiss_stale_reviews ||
          false,
        requireCodeOwnerReviews:
          protection.required_pull_request_reviews
            ?.require_code_owner_reviews || false,
        enforceAdmins: protection.enforce_admins?.enabled || false,
        requireConversationResolution:
          protection.required_conversation_resolution?.enabled || false,
        requireLinearHistory:
          protection.required_linear_history?.enabled || false,
        allowForcePushes: protection.allow_force_pushes?.enabled || false,
        allowDeletions: protection.allow_deletions?.enabled || false,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return { enabled: false };
      }
      throw error;
    }
  }

  /**
   * Validate PR readiness for merge
   * Optimized with parallel API calls to reduce latency
   */
  async validatePRReadiness(prNumber: number): Promise<ValidationResult> {
    // Fetch PR details first (need base.ref for protection check)
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    // Parallel fetch: protection + check status + reviews
    const [protection, checkStatus, reviews] = await Promise.all([
      this.getProtection(pr.base.ref),
      this.getCheckStatus(pr.head.sha),
      this.octokit.rest.pulls.listReviews({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      }),
    ]);

    if (!protection.enabled) {
      return {
        ready: true,
        issues: [],
        warnings: ["No branch protection configured - consider enabling it"],
        protection,
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check required status checks
    if (
      protection.requiredStatusChecks &&
      protection.requiredStatusChecks.length > 0
    ) {
      const missingChecks = protection.requiredStatusChecks.filter(
        (required) =>
          !checkStatus.allChecks.some(
            (check: any) =>
              check.name === required || check.context === required,
          ),
      );

      if (missingChecks.length > 0) {
        issues.push(`Missing required checks: ${missingChecks.join(", ")}`);
      }

      const failedRequiredChecks = protection.requiredStatusChecks.filter(
        (required) =>
          checkStatus.failedChecks.some(
            (f: any) => f.name === required || f.context === required,
          ),
      );

      if (failedRequiredChecks.length > 0) {
        issues.push(
          `Failed required checks: ${failedRequiredChecks.join(", ")}`,
        );
      }

      // Warn if strict checks enabled and branch is out of date
      if (protection.strictChecks) {
        const { data: comparison } =
          await this.octokit.rest.repos.compareCommits({
            owner: this.owner,
            repo: this.repo,
            base: pr.base.sha,
            head: pr.head.sha,
          });

        if (comparison.behind_by > 0) {
          warnings.push(
            `Branch is ${comparison.behind_by} commit(s) behind base - strict checks require update`,
          );
        }
      }
    }

    // Check PR reviews (already fetched in parallel above)
    if (protection.requiredReviews && protection.requiredReviews > 0) {
      const latestReviews = this.getLatestReviews(reviews.data as Review[]);
      const approvals = latestReviews.filter(
        (r) => r.state === "APPROVED",
      ).length;

      if (approvals < protection.requiredReviews) {
        issues.push(
          `Need ${protection.requiredReviews - approvals} more approval(s)`,
        );
      }

      // Check for requested changes
      const changesRequested = latestReviews.filter(
        (r) => r.state === "CHANGES_REQUESTED",
      ).length;
      if (changesRequested > 0) {
        issues.push(`${changesRequested} reviewer(s) requested changes`);
      }
    }

    // Check conversation resolution (parallel fetch of comments)
    if (protection.requireConversationResolution) {
      const [{ data: comments }, { data: reviewComments }] = await Promise.all([
        this.octokit.rest.issues.listComments({
          owner: this.owner,
          repo: this.repo,
          issue_number: prNumber,
        }),
        this.octokit.rest.pulls.listReviewComments({
          owner: this.owner,
          repo: this.repo,
          pull_number: prNumber,
        }),
      ]);

      // Count unresolved threads (heuristic: comments without "resolved" or checkmark)
      const unresolvedIssueComments = comments.filter(
        (c) =>
          !c.body?.includes("✓") && !c.body?.toLowerCase().includes("resolved"),
      );

      const unresolvedReviewComments = reviewComments.filter(
        (c) =>
          !c.body?.includes("✓") && !c.body?.toLowerCase().includes("resolved"),
      );

      const totalUnresolved =
        unresolvedIssueComments.length + unresolvedReviewComments.length;

      if (totalUnresolved > 0) {
        warnings.push(
          `Possibly ${totalUnresolved} unresolved conversation(s) - verify manually`,
        );
      }
    }

    return {
      ready: issues.length === 0,
      issues,
      warnings,
      protection,
    };
  }

  /**
   * Auto-configure branch protection
   */
  async setupProtection(
    branch: string = "main",
    preset: ProtectionPreset = "standard",
  ): Promise<void> {
    const configs = {
      basic: {
        required_status_checks: null,
        enforce_admins: false,
        required_pull_request_reviews: null,
        restrictions: null,
        required_conversation_resolution: false,
      },
      standard: {
        required_status_checks: {
          strict: true,
          contexts: ["ci", "security"],
        },
        enforce_admins: false,
        required_pull_request_reviews: {
          required_approving_review_count: 0,
          dismiss_stale_reviews: true,
          require_code_owner_reviews: false,
        },
        restrictions: null,
        required_conversation_resolution: true,
        required_linear_history: false,
        allow_force_pushes: false,
        allow_deletions: false,
      },
      strict: {
        required_status_checks: {
          strict: true,
          contexts: ["ci", "security", "tests", "lint"],
        },
        enforce_admins: true,
        required_pull_request_reviews: {
          required_approving_review_count: 1,
          dismiss_stale_reviews: true,
          require_code_owner_reviews: true,
        },
        restrictions: null,
        required_conversation_resolution: true,
        required_linear_history: true,
        allow_force_pushes: false,
        allow_deletions: false,
      },
    };

    await this.octokit.rest.repos.updateBranchProtection({
      owner: this.owner,
      repo: this.repo,
      branch,
      ...configs[preset],
    });
  }

  /**
   * Get latest reviews from each user
   */
  private getLatestReviews(reviews: Review[]): Review[] {
    // Group by user, keep only latest review from each user
    const reviewsByUser = new Map<number, Review>();

    for (const review of reviews.sort(
      (a, b) =>
        new Date(b.submitted_at!).getTime() -
        new Date(a.submitted_at!).getTime(),
    )) {
      if (review.user && !reviewsByUser.has(review.user.id)) {
        reviewsByUser.set(review.user.id, review);
      }
    }

    return Array.from(reviewsByUser.values());
  }

  /**
   * Get check status for a commit
   * Optimized with parallel API calls
   */
  private async getCheckStatus(sha: string) {
    // Parallel fetch: check runs + commit statuses
    const [{ data: checkRuns }, { data: commitStatus }] = await Promise.all([
      this.octokit.rest.checks.listForRef({
        owner: this.owner,
        repo: this.repo,
        ref: sha,
      }),
      this.octokit.rest.repos.getCombinedStatusForRef({
        owner: this.owner,
        repo: this.repo,
        ref: sha,
      }),
    ]);

    const allChecks = [
      ...checkRuns.check_runs.map((c) => ({
        name: c.name,
        status: c.conclusion,
      })),
      ...commitStatus.statuses.map((s) => ({
        context: s.context,
        status: s.state,
      })),
    ];

    const failedChecks = allChecks.filter(
      (c) => c.status === "failure" || c.status === "error",
    );

    return { allChecks, failedChecks };
  }
}
