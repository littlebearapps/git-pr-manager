import { BranchProtectionChecker } from "../../src/services/BranchProtectionChecker";
import { ProtectionPreset } from "../../src/types";

describe("BranchProtectionChecker", () => {
  let checker: BranchProtectionChecker;
  let mockGetBranchProtection: jest.Mock;
  let mockUpdateBranchProtection: jest.Mock;
  let mockGetPR: jest.Mock;
  let mockListReviews: jest.Mock;
  let mockListReviewComments: jest.Mock;
  let mockListForRef: jest.Mock;
  let mockListComments: jest.Mock;
  let mockGetCombinedStatusForRef: jest.Mock;
  let mockCompareCommits: jest.Mock;

  beforeEach(() => {
    // Create individual mock functions
    mockGetBranchProtection = jest.fn();
    mockUpdateBranchProtection = jest.fn();
    mockGetPR = jest.fn();
    mockListReviews = jest.fn();
    mockListReviewComments = jest.fn();
    mockListForRef = jest.fn(() =>
      Promise.resolve({ data: { check_runs: [] } }),
    );
    mockListComments = jest.fn();
    mockGetCombinedStatusForRef = jest.fn(() =>
      Promise.resolve({ data: { statuses: [] } }),
    );
    mockCompareCommits = jest.fn();

    // Create mock Octokit instance
    const mockOctokit = {
      rest: {
        repos: {
          getBranchProtection: mockGetBranchProtection,
          updateBranchProtection: mockUpdateBranchProtection,
          getCombinedStatusForRef: mockGetCombinedStatusForRef,
          compareCommits: mockCompareCommits,
        },
        pulls: {
          get: mockGetPR,
          listReviews: mockListReviews,
          listReviewComments: mockListReviewComments,
        },
        checks: {
          listForRef: mockListForRef,
        },
        issues: {
          listComments: mockListComments,
        },
      },
    } as any;

    checker = new BranchProtectionChecker(mockOctokit, "owner", "repo");
  });

  describe("getProtection", () => {
    it("should return protection status when branch is protected", async () => {
      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            strict: true,
            contexts: ["ci", "security", "tests"],
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: true,
            required_approving_review_count: 2,
          },
          required_conversation_resolution: {
            enabled: true,
          },
          required_linear_history: {
            enabled: true,
          },
          enforce_admins: {
            enabled: true,
          },
          allow_force_pushes: {
            enabled: false,
          },
          allow_deletions: {
            enabled: false,
          },
        },
      };

      mockGetBranchProtection.mockResolvedValue(mockProtection as any);

      const result = await checker.getProtection("main");

      expect(result.enabled).toBe(true);
      expect(result.requiredStatusChecks).toEqual(["ci", "security", "tests"]);
      expect(result.strictChecks).toBe(true);
      expect(result.requiredReviews).toBe(2);
      expect(result.dismissStaleReviews).toBe(true);
      expect(result.requireCodeOwnerReviews).toBe(true);
      expect(result.requireConversationResolution).toBe(true);
      expect(result.requireLinearHistory).toBe(true);
      expect(result.enforceAdmins).toBe(true);
      expect(result.allowForcePushes).toBe(false);
      expect(result.allowDeletions).toBe(false);
    });

    it("should return disabled status when branch is not protected", async () => {
      const error: any = new Error("Branch not protected");
      error.status = 404;
      mockGetBranchProtection.mockRejectedValue(error);

      const result = await checker.getProtection("main");

      expect(result.enabled).toBe(false);
      // When disabled, only enabled property is returned
      expect(result.requiredStatusChecks).toBeUndefined();
      expect(result.requiredReviews).toBeUndefined();
    });

    it("should handle protection with no required checks", async () => {
      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: null,
          required_pull_request_reviews: null,
          enforce_admins: { enabled: false },
          allow_force_pushes: { enabled: false },
          allow_deletions: { enabled: false },
        },
      };

      mockGetBranchProtection.mockResolvedValue(mockProtection as any);

      const result = await checker.getProtection("main");

      expect(result.enabled).toBe(true);
      expect(result.requiredStatusChecks).toEqual([]);
      expect(result.requiredReviews).toBe(0);
    });
  });

  describe("validatePRReadiness", () => {
    it("should pass validation when all requirements are met", async () => {
      // Mock PR details
      const mockPR = {
        data: {
          number: 123,
          base: { ref: "main" },
          head: { sha: "abc123" },
        },
      };

      // Mock protection with requirements
      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            strict: true,
            contexts: ["ci", "security"],
          },
          required_pull_request_reviews: {
            required_approving_review_count: 1,
          },
          required_conversation_resolution: {
            enabled: true,
          },
        },
      };

      // Mock successful checks
      const mockChecks = {
        data: {
          check_runs: [
            { name: "ci", status: "completed", conclusion: "success" },
            { name: "security", status: "completed", conclusion: "success" },
          ],
        },
      };

      // Mock approved reviews
      const mockReviews = {
        data: [{ state: "APPROVED", user: { login: "reviewer1" } }],
      };

      // Mock no unresolved comments
      const mockComments = {
        data: [],
      };

      mockGetPR.mockResolvedValue(mockPR as any);
      mockGetBranchProtection.mockResolvedValue(mockProtection as any);
      mockListForRef.mockResolvedValue(mockChecks as any);
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      } as any);
      mockCompareCommits.mockResolvedValue({ data: { behind_by: 0 } } as any);
      mockListReviews.mockResolvedValue(mockReviews as any);
      mockListComments.mockResolvedValue(mockComments as any);
      mockListReviewComments.mockResolvedValue(mockComments as any);

      const result = await checker.validatePRReadiness(123);

      expect(result.ready).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it("should fail validation when required checks are missing", async () => {
      const mockPR = {
        data: {
          number: 123,
          base: { ref: "main" },
          head: { sha: "abc123" },
        },
      };

      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            strict: true,
            contexts: ["ci", "security", "tests"],
          },
        },
      };

      // Only ci check present, missing security and tests
      const mockChecks = {
        data: {
          check_runs: [
            { name: "ci", status: "completed", conclusion: "success" },
          ],
        },
      };

      mockGetPR.mockResolvedValue(mockPR as any);
      mockGetBranchProtection.mockResolvedValue(mockProtection as any);
      mockListForRef.mockResolvedValue(mockChecks as any);
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      } as any);
      mockCompareCommits.mockResolvedValue({ data: { behind_by: 0 } } as any);
      mockListReviews.mockResolvedValue({ data: [] } as any);
      mockListComments.mockResolvedValue({ data: [] } as any);
      mockListReviewComments.mockResolvedValue({ data: [] } as any);

      const result = await checker.validatePRReadiness(123);

      expect(result.ready).toBe(false);
      expect(result.issues.some((i) => i.includes("security"))).toBe(true);
      expect(result.issues.some((i) => i.includes("tests"))).toBe(true);
    });

    it("should fail validation when required reviews are missing", async () => {
      const mockPR = {
        data: {
          number: 123,
          base: { ref: "main" },
          head: { sha: "abc123" },
        },
      };

      const mockProtection = {
        data: {
          enabled: true,
          required_pull_request_reviews: {
            required_approving_review_count: 2,
          },
        },
      };

      // Only 1 approval, need 2
      const mockReviews = {
        data: [{ state: "APPROVED", user: { login: "reviewer1" } }],
      };

      mockGetPR.mockResolvedValue(mockPR as any);
      mockGetBranchProtection.mockResolvedValue(mockProtection as any);
      mockListForRef.mockResolvedValue({ data: { check_runs: [] } } as any);
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      } as any);
      mockListReviews.mockResolvedValue(mockReviews as any);
      mockListComments.mockResolvedValue({ data: [] } as any);
      mockListReviewComments.mockResolvedValue({ data: [] } as any);

      const result = await checker.validatePRReadiness(123);

      expect(result.ready).toBe(false);
      expect(result.issues.some((i) => i.includes("approval"))).toBe(true);
    });

    it("should fail validation when checks have failed", async () => {
      const mockPR = {
        data: {
          number: 123,
          base: { ref: "main" },
          head: { sha: "abc123" },
        },
      };

      const mockProtection = {
        data: {
          enabled: true,
          required_status_checks: {
            contexts: ["ci"],
          },
        },
      };

      // Check failed
      const mockChecks = {
        data: {
          check_runs: [
            { name: "ci", status: "completed", conclusion: "failure" },
          ],
        },
      };

      mockGetPR.mockResolvedValue(mockPR as any);
      mockGetBranchProtection.mockResolvedValue(mockProtection as any);
      mockListForRef.mockResolvedValue(mockChecks as any);
      mockGetCombinedStatusForRef.mockResolvedValue({
        data: { statuses: [] },
      } as any);
      mockListReviews.mockResolvedValue({ data: [] } as any);
      mockListComments.mockResolvedValue({ data: [] } as any);
      mockListReviewComments.mockResolvedValue({ data: [] } as any);

      const result = await checker.validatePRReadiness(123);

      expect(result.ready).toBe(false);
      expect(
        result.issues.some((i) => i.includes("ci") && i.includes("Failed")),
      ).toBe(true);
    });

    it("should pass when branch has no protection", async () => {
      const mockPR = {
        data: {
          number: 123,
          base: { ref: "main" },
          head: { sha: "abc123" },
        },
      };

      const error: any = new Error("Branch not protected");
      error.status = 404;

      mockGetPR.mockResolvedValue(mockPR as any);
      mockGetBranchProtection.mockRejectedValue(error);

      const result = await checker.validatePRReadiness(123);

      expect(result.ready).toBe(true);
      expect(result.issues).toEqual([]);
      expect(
        result.warnings.some((w) => w.includes("No branch protection")),
      ).toBe(true);
    });
  });

  describe("setupProtection", () => {
    it("should setup basic protection preset", async () => {
      mockUpdateBranchProtection.mockResolvedValue({} as any);

      await checker.setupProtection("main", "basic");

      expect(mockUpdateBranchProtection).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          branch: "main",
          required_status_checks: null,
          required_pull_request_reviews: null,
          enforce_admins: false,
          required_conversation_resolution: false,
          restrictions: null,
        }),
      );
    });

    it("should setup standard protection preset", async () => {
      mockUpdateBranchProtection.mockResolvedValue({} as any);

      await checker.setupProtection("main", "standard");

      expect(mockUpdateBranchProtection).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          branch: "main",
          required_status_checks: {
            strict: true,
            contexts: ["ci", "security"],
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: false,
            required_approving_review_count: 0,
          },
          required_conversation_resolution: true,
          enforce_admins: false,
          allow_force_pushes: false,
          allow_deletions: false,
        }),
      );
    });

    it("should setup strict protection preset", async () => {
      mockUpdateBranchProtection.mockResolvedValue({} as any);

      await checker.setupProtection("main", "strict");

      expect(mockUpdateBranchProtection).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          branch: "main",
          required_status_checks: {
            strict: true,
            contexts: ["ci", "security", "tests", "lint"],
          },
          required_pull_request_reviews: {
            dismiss_stale_reviews: true,
            require_code_owner_reviews: true,
            required_approving_review_count: 1,
          },
          required_conversation_resolution: true,
          required_linear_history: true,
          enforce_admins: true,
          allow_force_pushes: false,
          allow_deletions: false,
        }),
      );
    });

    it("should handle API errors gracefully", async () => {
      const error = new Error("API rate limit exceeded");
      mockUpdateBranchProtection.mockRejectedValue(error);

      await expect(checker.setupProtection("main", "standard")).rejects.toThrow(
        "API rate limit exceeded",
      );
    });
  });

  describe("preset validation", () => {
    it("should accept valid preset types", async () => {
      mockUpdateBranchProtection.mockResolvedValue({} as any);

      const presets: ProtectionPreset[] = ["basic", "standard", "strict"];

      for (const preset of presets) {
        await expect(
          checker.setupProtection("main", preset),
        ).resolves.not.toThrow();
      }

      expect(mockUpdateBranchProtection).toHaveBeenCalledTimes(3);
    });
  });
});
