import { OutputFormatter } from "../../src/utils/OutputFormatter";
import {
  CheckSummary,
  ProgressUpdate,
  ErrorType,
  FailureDetail,
} from "../../src/types";

describe("OutputFormatter", () => {
  let formatter: OutputFormatter;

  beforeEach(() => {
    formatter = new OutputFormatter();
  });

  describe("formatCheckSummary", () => {
    it("should format success summary correctly", () => {
      const summary: CheckSummary = {
        total: 5,
        passed: 5,
        failed: 0,
        pending: 0,
        skipped: 0,
        overallStatus: "success",
        failureDetails: [],
        startedAt: new Date(),
      };

      const result = formatter.formatCheckSummary(summary);

      expect(result).toContain("✅ All CI Checks Passed!");
      expect(result).toContain("Passed (5):");
      expect(result).toContain("✅ 5 check(s) passed");
      expect(result).not.toContain("Critical Failures");
    });

    it("should format pending summary correctly", () => {
      const summary: CheckSummary = {
        total: 5,
        passed: 2,
        failed: 0,
        pending: 3,
        skipped: 0,
        overallStatus: "pending",
        failureDetails: [],
        startedAt: new Date(),
      };

      const result = formatter.formatCheckSummary(summary);

      expect(result).toContain("⏳ CI Checks In Progress...");
      expect(result).toContain("Passed (2):");
      expect(result).toContain("Pending (3):");
      expect(result).toContain("⏳ 3 check(s) in progress");
    });

    it("should format failure summary with details", () => {
      const failures: FailureDetail[] = [
        {
          checkName: "Test Suite",
          errorType: ErrorType.TEST_FAILURE,
          summary: "Unit tests failed",
          affectedFiles: ["src/test.ts"],
          annotations: [],
          suggestedFix: "Run npm test to see details",
          url: "https://github.com/example/pr/1/checks",
        },
      ];

      const summary: CheckSummary = {
        total: 3,
        passed: 2,
        failed: 1,
        pending: 0,
        skipped: 0,
        overallStatus: "failure",
        failureDetails: failures,
        startedAt: new Date(),
      };

      const result = formatter.formatCheckSummary(summary);

      expect(result).toContain("🔴 CI Checks Failed (1/3)");
      expect(result).toContain("Critical Failures:");
      expect(result).toContain("🧪 Test Suite (test_failure)");
      expect(result).toContain("Summary: Unit tests failed");
      expect(result).toContain("Files affected:");
      expect(result).toContain("- src/test.ts");
      expect(result).toContain("Suggested fix: Run npm test to see details");
      expect(result).toContain(
        "Details: https://github.com/example/pr/1/checks",
      );
    });

    it("should truncate affected files list when more than 5 files", () => {
      const failures: FailureDetail[] = [
        {
          checkName: "Lint Check",
          errorType: ErrorType.LINTING_ERROR,
          summary: "Multiple linting errors",
          affectedFiles: [
            "file1.ts",
            "file2.ts",
            "file3.ts",
            "file4.ts",
            "file5.ts",
            "file6.ts",
            "file7.ts",
          ],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com/checks",
        },
      ];

      const summary: CheckSummary = {
        total: 1,
        passed: 0,
        failed: 1,
        pending: 0,
        skipped: 0,
        overallStatus: "failure",
        failureDetails: failures,
        startedAt: new Date(),
      };

      const result = formatter.formatCheckSummary(summary);

      expect(result).toContain("- file1.ts");
      expect(result).toContain("- file5.ts");
      expect(result).toContain("... and 2 more");
      expect(result).not.toContain("file6.ts");
    });

    it("should handle failure without suggested fix", () => {
      const failures: FailureDetail[] = [
        {
          checkName: "Build Check",
          errorType: ErrorType.BUILD_ERROR,
          summary: "Build failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com/checks",
        },
      ];

      const summary: CheckSummary = {
        total: 1,
        passed: 0,
        failed: 1,
        pending: 0,
        skipped: 0,
        overallStatus: "failure",
        failureDetails: failures,
        startedAt: new Date(),
      };

      const result = formatter.formatCheckSummary(summary);

      expect(result).toContain("🔨 Build Check (build_error)");
      expect(result).not.toContain("Suggested fix:");
    });

    it("should display all error type icons correctly", () => {
      const failures: FailureDetail[] = [
        {
          checkName: "Test",
          errorType: ErrorType.TEST_FAILURE,
          summary: "Test failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com",
        },
        {
          checkName: "Lint",
          errorType: ErrorType.LINTING_ERROR,
          summary: "Lint failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com",
        },
        {
          checkName: "Type",
          errorType: ErrorType.TYPE_ERROR,
          summary: "Type failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com",
        },
        {
          checkName: "Security",
          errorType: ErrorType.SECURITY_ISSUE,
          summary: "Security failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com",
        },
        {
          checkName: "Build",
          errorType: ErrorType.BUILD_ERROR,
          summary: "Build failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com",
        },
        {
          checkName: "Format",
          errorType: ErrorType.FORMAT_ERROR,
          summary: "Format failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com",
        },
        {
          checkName: "Unknown",
          errorType: ErrorType.UNKNOWN,
          summary: "Unknown failed",
          affectedFiles: [],
          annotations: [],
          suggestedFix: null,
          url: "https://example.com",
        },
      ];

      const summary: CheckSummary = {
        total: 7,
        passed: 0,
        failed: 7,
        pending: 0,
        skipped: 0,
        overallStatus: "failure",
        failureDetails: failures,
        startedAt: new Date(),
      };

      const result = formatter.formatCheckSummary(summary);

      expect(result).toContain("🧪 Test");
      expect(result).toContain("📝 Lint");
      expect(result).toContain("🔤 Type");
      expect(result).toContain("🔒 Security");
      expect(result).toContain("🔨 Build");
      expect(result).toContain("✨ Format");
      expect(result).toContain("❌ Unknown");
    });
  });

  describe("formatProgress", () => {
    it("should format progress with elapsed time in seconds", () => {
      const progress: ProgressUpdate = {
        passed: 2,
        failed: 0,
        pending: 1,
        total: 3,
        elapsed: 45000, // 45 seconds
        newPasses: [],
        newFailures: [],
        timestamp: new Date(),
      };

      const result = formatter.formatProgress(progress);

      expect(result).toContain("[00:45]");
      expect(result).toContain("2/3 checks completed");
      expect(result).toContain("⏳ 1 in progress...");
    });

    it("should format progress with elapsed time in minutes", () => {
      const progress: ProgressUpdate = {
        passed: 5,
        failed: 1,
        pending: 2,
        total: 8,
        elapsed: 125000, // 2 minutes 5 seconds
        newPasses: [],
        newFailures: [],
        timestamp: new Date(),
      };

      const result = formatter.formatProgress(progress);

      expect(result).toContain("[02:05]");
      expect(result).toContain("6/8 checks completed");
    });

    it("should display new passes", () => {
      const progress: ProgressUpdate = {
        passed: 2,
        failed: 0,
        pending: 1,
        total: 3,
        elapsed: 30000,
        newPasses: ["Lint Check", "Type Check"],
        newFailures: [],
        timestamp: new Date(),
      };

      const result = formatter.formatProgress(progress);

      expect(result).toContain("✅ Lint Check");
      expect(result).toContain("✅ Type Check");
    });

    it("should display new failures", () => {
      const progress: ProgressUpdate = {
        passed: 1,
        failed: 2,
        pending: 0,
        total: 3,
        elapsed: 60000,
        newPasses: [],
        newFailures: ["Test Suite", "Build"],
        timestamp: new Date(),
      };

      const result = formatter.formatProgress(progress);

      expect(result).toContain("❌ Test Suite");
      expect(result).toContain("❌ Build");
    });

    it("should not show pending line when pending is zero", () => {
      const progress: ProgressUpdate = {
        passed: 3,
        failed: 0,
        pending: 0,
        total: 3,
        elapsed: 45000,
        newPasses: [],
        newFailures: [],
        timestamp: new Date(),
      };

      const result = formatter.formatProgress(progress);

      expect(result).not.toContain("in progress");
    });
  });

  describe("formatCompact", () => {
    it("should format success compactly", () => {
      const summary: CheckSummary = {
        total: 5,
        passed: 5,
        failed: 0,
        pending: 0,
        skipped: 0,
        overallStatus: "success",
        failureDetails: [],
        startedAt: new Date(),
      };

      const result = formatter.formatCompact(summary);

      expect(result).toBe("✅ 5/5 checks passed");
    });

    it("should format pending compactly", () => {
      const summary: CheckSummary = {
        total: 5,
        passed: 2,
        failed: 0,
        pending: 3,
        skipped: 0,
        overallStatus: "pending",
        failureDetails: [],
        startedAt: new Date(),
      };

      const result = formatter.formatCompact(summary);

      expect(result).toBe("⏳ 2/5 checks completed (3 pending)");
    });

    it("should format failure compactly", () => {
      const summary: CheckSummary = {
        total: 5,
        passed: 3,
        failed: 2,
        pending: 0,
        skipped: 0,
        overallStatus: "failure",
        failureDetails: [],
        startedAt: new Date(),
      };

      const result = formatter.formatCompact(summary);

      expect(result).toBe("🔴 2 check(s) failed, 3 passed");
    });
  });
});
