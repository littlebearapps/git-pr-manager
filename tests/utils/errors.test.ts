import {
  WorkflowError,
  GitError,
  GitHubAPIError,
  RateLimitError,
  AuthenticationError,
  BranchProtectionError,
  CICheckError,
  MergeConflictError,
  ConfigError,
  SecurityError,
  ValidationError,
  TimeoutError,
  toWorkflowError,
  isRetryableError,
} from "../../src/utils/errors";

describe("Error Classes", () => {
  describe("WorkflowError (Base Class)", () => {
    it("should create error with required parameters", () => {
      const error = new WorkflowError("TEST_CODE", "Test message");

      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("Test message");
      expect(error.name).toBe("WorkflowError");
      expect(error.details).toBeUndefined();
      expect(error.suggestions).toEqual([]);
    });

    it("should create error with all parameters", () => {
      const details = { foo: "bar" };
      const suggestions = ["Suggestion 1", "Suggestion 2"];
      const error = new WorkflowError(
        "TEST_CODE",
        "Test message",
        details,
        suggestions,
      );

      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("Test message");
      expect(error.details).toEqual(details);
      expect(error.suggestions).toEqual(suggestions);
    });

    it("should be instanceof Error", () => {
      const error = new WorkflowError("TEST_CODE", "Test message");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WorkflowError);
    });

    it("should serialize to JSON correctly", () => {
      const error = new WorkflowError(
        "TEST_CODE",
        "Test message",
        { detail: "value" },
        ["Fix 1", "Fix 2"],
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: "TEST_CODE",
        message: "Test message",
        details: { detail: "value" },
        suggestions: ["Fix 1", "Fix 2"],
        name: "WorkflowError",
      });
    });

    it("should include stack trace", () => {
      const error = new WorkflowError("TEST_CODE", "Test message");

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });
  });

  describe("GitError", () => {
    it("should create GitError with message only", () => {
      const error = new GitError("Git operation failed");

      expect(error.code).toBe("GIT_ERROR");
      expect(error.message).toBe("Git operation failed");
      expect(error.name).toBe("GitError");
      expect(error.suggestions).toEqual([]);
    });

    it("should create GitError with details and suggestions", () => {
      const details = { command: "git push" };
      const suggestions = ["Check remote URL", "Verify credentials"];
      const error = new GitError("Push failed", details, suggestions);

      expect(error.code).toBe("GIT_ERROR");
      expect(error.details).toMatchObject(details); // Original details preserved
      expect(error.details.worktree).toBe(process.cwd()); // Worktree context added
      expect(error.suggestions).toEqual(suggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new GitError("Test");

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(GitError);
    });

    it("should include worktree context in details", () => {
      const error = new GitError("Test error", { file: "test.ts" });

      expect(error.details.worktree).toBe(process.cwd());
      expect(error.details.file).toBe("test.ts");
    });

    it("should preserve existing details when adding worktree context", () => {
      const originalDetails = { command: "git push", exitCode: 1 };
      const error = new GitError("Push failed", originalDetails);

      expect(error.details).toMatchObject(originalDetails);
      expect(error.details.worktree).toBe(process.cwd());
    });
  });

  describe("GitHubAPIError", () => {
    it("should create GitHubAPIError with correct code", () => {
      const error = new GitHubAPIError("API request failed");

      expect(error.code).toBe("GITHUB_API_ERROR");
      expect(error.message).toBe("API request failed");
      expect(error.name).toBe("GitHubAPIError");
    });

    it("should accept custom details and suggestions", () => {
      const details = { status: 404, endpoint: "/repos/user/repo" };
      const suggestions = ["Check repository name", "Verify token permissions"];
      const error = new GitHubAPIError("Not found", details, suggestions);

      expect(error.details).toEqual(details);
      expect(error.suggestions).toEqual(suggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new GitHubAPIError("Test");

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(GitHubAPIError);
    });
  });

  describe("RateLimitError", () => {
    it("should create with default message and suggestions", () => {
      const error = new RateLimitError();

      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.message).toBe("GitHub API rate limit exceeded");
      expect(error.name).toBe("RateLimitError");
      expect(error.suggestions).toEqual([
        "Wait for rate limit reset",
        "Use a GitHub token with higher rate limit",
        "Enable caching to reduce API calls",
      ]);
    });

    it("should accept custom message and details", () => {
      const details = { remaining: 0, limit: 5000, resetAt: new Date() };
      const error = new RateLimitError("Rate limit hit", details);

      expect(error.message).toBe("Rate limit hit");
      expect(error.details).toEqual(details);
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should use custom suggestions if provided", () => {
      const customSuggestions = ["Custom suggestion 1", "Custom suggestion 2"];
      const error = new RateLimitError(
        "Rate limit hit",
        undefined,
        customSuggestions,
      );

      expect(error.suggestions).toEqual(customSuggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new RateLimitError();

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(RateLimitError);
    });
  });

  describe("AuthenticationError", () => {
    it("should create with default message and suggestions", () => {
      const error = new AuthenticationError();

      expect(error.code).toBe("AUTH_ERROR");
      expect(error.message).toBe("Authentication failed");
      expect(error.name).toBe("AuthenticationError");
      expect(error.suggestions).toEqual([
        "Set GITHUB_TOKEN environment variable",
        "Ensure token has required permissions",
        "Generate new token at https://github.com/settings/tokens",
      ]);
    });

    it("should accept custom message and details", () => {
      const details = { tokenType: "personal" };
      const error = new AuthenticationError("Token expired", details);

      expect(error.message).toBe("Token expired");
      expect(error.details).toEqual(details);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(AuthenticationError);
    });
  });

  describe("BranchProtectionError", () => {
    it("should create with default suggestions", () => {
      const error = new BranchProtectionError("Protected branch");

      expect(error.code).toBe("BRANCH_PROTECTION_ERROR");
      expect(error.message).toBe("Protected branch");
      expect(error.name).toBe("BranchProtectionError");
      expect(error.suggestions).toEqual([
        "Check branch protection rules on GitHub",
        "Ensure all required checks pass",
        "Get required PR reviews",
      ]);
    });

    it("should use custom suggestions if provided", () => {
      const customSuggestions = ["Custom fix"];
      const error = new BranchProtectionError(
        "Protected",
        {},
        customSuggestions,
      );

      expect(error.suggestions).toEqual(customSuggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new BranchProtectionError("Test");

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(BranchProtectionError);
    });
  });

  describe("CICheckError", () => {
    it("should create with default message and suggestions", () => {
      const error = new CICheckError();

      expect(error.code).toBe("CI_CHECK_FAILED");
      expect(error.message).toBe("CI checks failed");
      expect(error.name).toBe("CICheckError");
      expect(error.suggestions).toEqual([
        "Review failed checks on GitHub",
        "Fix issues and push changes",
        "Re-run failed checks if transient",
      ]);
    });

    it("should accept custom details", () => {
      const details = {
        failedChecks: ["test", "lint"],
        prNumber: 123,
        prUrl: "https://github.com/user/repo/pull/123",
      };
      const error = new CICheckError("Tests failed", details);

      expect(error.message).toBe("Tests failed");
      expect(error.details).toEqual(details);
    });

    it("should use custom suggestions if provided", () => {
      const customSuggestions = ["Run tests locally"];
      const error = new CICheckError("Failed", undefined, customSuggestions);

      expect(error.suggestions).toEqual(customSuggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new CICheckError();

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(CICheckError);
    });
  });

  describe("MergeConflictError", () => {
    it("should create with default message and suggestions", () => {
      const error = new MergeConflictError();

      expect(error.code).toBe("MERGE_CONFLICT");
      expect(error.message).toBe("Merge conflicts detected");
      expect(error.name).toBe("MergeConflictError");
      expect(error.suggestions).toEqual([
        "Pull latest changes from base branch",
        "Resolve conflicts manually",
        "Run tests after resolving conflicts",
      ]);
    });

    it("should accept custom message and details", () => {
      const details = { files: ["src/index.ts", "package.json"] };
      const error = new MergeConflictError("Conflicts in 2 files", details);

      expect(error.message).toBe("Conflicts in 2 files");
      expect(error.details).toEqual(details);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new MergeConflictError();

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(MergeConflictError);
    });
  });

  describe("ConfigError", () => {
    it("should create with default suggestions", () => {
      const error = new ConfigError("Invalid config");

      expect(error.code).toBe("CONFIG_ERROR");
      expect(error.message).toBe("Invalid config");
      expect(error.name).toBe("ConfigError");
      expect(error.suggestions).toEqual([
        "Run `gpm init` to create config file",
        "Check .gpm.yml syntax",
        "Refer to documentation for config options",
      ]);
    });

    it("should use custom suggestions if provided", () => {
      const customSuggestions = ["Fix YAML syntax"];
      const error = new ConfigError("Parse error", {}, customSuggestions);

      expect(error.suggestions).toEqual(customSuggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new ConfigError("Test");

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(ConfigError);
    });
  });

  describe("SecurityError", () => {
    it("should create with default message and suggestions", () => {
      const error = new SecurityError();

      expect(error.code).toBe("SECURITY_ERROR");
      expect(error.message).toBe("Security scan failed");
      expect(error.name).toBe("SecurityError");
      expect(error.suggestions).toEqual([
        "Remove secrets from code",
        "Update vulnerable dependencies",
        "Review security findings carefully",
      ]);
    });

    it("should accept custom details with secrets and vulnerabilities", () => {
      const details = {
        secrets: ["API_KEY", "PASSWORD"],
        vulnerabilities: [{ cve: "CVE-2024-1234", severity: "high" }],
      };
      const error = new SecurityError("Found 2 secrets", details);

      expect(error.message).toBe("Found 2 secrets");
      expect(error.details).toEqual(details);
    });

    it("should use custom suggestions if provided", () => {
      const customSuggestions = ["Rotate leaked credentials"];
      const error = new SecurityError(
        "Secrets found",
        undefined,
        customSuggestions,
      );

      expect(error.suggestions).toEqual(customSuggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new SecurityError();

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(SecurityError);
    });
  });

  describe("ValidationError", () => {
    it("should create ValidationError with issues", () => {
      const details = { issues: ["Issue 1", "Issue 2"] };
      const error = new ValidationError("Validation failed", details);

      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Validation failed");
      expect(error.name).toBe("ValidationError");
      expect(error.details).toEqual(details);
      expect(error.suggestions).toEqual([]);
    });

    it("should accept warnings in details", () => {
      const details = {
        issues: ["Critical issue"],
        warnings: ["Warning 1", "Warning 2"],
      };
      const error = new ValidationError("Validation failed", details);

      expect(error.details).toEqual(details);
    });

    it("should accept custom suggestions", () => {
      const suggestions = ["Fix validation errors"];
      const error = new ValidationError("Failed", { issues: [] }, suggestions);

      expect(error.suggestions).toEqual(suggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new ValidationError("Test", { issues: [] });

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe("TimeoutError", () => {
    it("should create with default message and suggestions", () => {
      const error = new TimeoutError();

      expect(error.code).toBe("TIMEOUT_ERROR");
      expect(error.message).toBe("Operation timed out");
      expect(error.name).toBe("TimeoutError");
      expect(error.suggestions).toEqual([
        "Increase timeout in configuration",
        "Check for long-running tests",
        "Verify CI is not stuck",
      ]);
    });

    it("should accept custom details with timeout info", () => {
      const details = { timeout: 30000, elapsed: 35000 };
      const error = new TimeoutError("CI timeout", details);

      expect(error.message).toBe("CI timeout");
      expect(error.details).toEqual(details);
    });

    it("should use custom suggestions if provided", () => {
      const customSuggestions = ["Cancel and retry"];
      const error = new TimeoutError("Timeout", undefined, customSuggestions);

      expect(error.suggestions).toEqual(customSuggestions);
    });

    it("should be instanceof WorkflowError", () => {
      const error = new TimeoutError();

      expect(error).toBeInstanceOf(WorkflowError);
      expect(error).toBeInstanceOf(TimeoutError);
    });
  });
});

describe("Helper Functions", () => {
  describe("toWorkflowError", () => {
    it("should return WorkflowError as-is", () => {
      const original = new WorkflowError("TEST_CODE", "Test message");
      const result = toWorkflowError(original);

      expect(result).toBe(original);
      expect(result.code).toBe("TEST_CODE");
    });

    it("should return specialized error as-is", () => {
      const original = new GitError("Git failed");
      const result = toWorkflowError(original);

      expect(result).toBe(original);
      expect(result).toBeInstanceOf(GitError);
    });

    it("should convert standard Error to WorkflowError", () => {
      const original = new Error("Standard error");
      const result = toWorkflowError(original);

      expect(result).toBeInstanceOf(WorkflowError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("Standard error");
      expect(result.details).toEqual({ originalError: original });
    });

    it("should convert string to WorkflowError", () => {
      const result = toWorkflowError("Error string");

      expect(result).toBeInstanceOf(WorkflowError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("Error string");
    });

    it("should convert number to WorkflowError", () => {
      const result = toWorkflowError(404);

      expect(result).toBeInstanceOf(WorkflowError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("404");
    });

    it("should convert null to WorkflowError", () => {
      const result = toWorkflowError(null);

      expect(result).toBeInstanceOf(WorkflowError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("null");
    });

    it("should convert undefined to WorkflowError", () => {
      const result = toWorkflowError(undefined);

      expect(result).toBeInstanceOf(WorkflowError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("undefined");
    });

    it("should convert object to WorkflowError", () => {
      const result = toWorkflowError({ error: "custom" });

      expect(result).toBeInstanceOf(WorkflowError);
      expect(result.code).toBe("UNKNOWN_ERROR");
      expect(result.message).toBe("[object Object]");
    });
  });

  describe("isRetryableError", () => {
    it("should return true for RateLimitError", () => {
      const error = new RateLimitError();

      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for TimeoutError", () => {
      const error = new TimeoutError();

      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for NETWORK_ERROR code", () => {
      const error = new WorkflowError("NETWORK_ERROR", "Network failed");

      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for TRANSIENT_ERROR code", () => {
      const error = new WorkflowError("TRANSIENT_ERROR", "Transient failure");

      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for TIMEOUT_ERROR code", () => {
      const error = new WorkflowError("TIMEOUT_ERROR", "Timeout");

      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for GitError", () => {
      const error = new GitError("Git failed");

      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for GitHubAPIError", () => {
      const error = new GitHubAPIError("API failed");

      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for SecurityError", () => {
      const error = new SecurityError();

      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for standard Error", () => {
      const error = new Error("Standard error");

      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for string", () => {
      expect(isRetryableError("error")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isRetryableError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isRetryableError(undefined)).toBe(false);
    });
  });
});
