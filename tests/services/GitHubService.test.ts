import { RequestError } from "@octokit/request-error";

// Mock child_process for parseRemoteUrlSync
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

// Import after mock is set up and type cast to mocked version
import * as childProcess from "child_process";
const mockChildProcess = childProcess as jest.Mocked<typeof childProcess>;

// Mock logger to avoid console output during tests
jest.mock("../../src/utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
  },
}));

// Create mock methods that will be shared across all Octokit instances
const mockOctokitMethods = {
  users: {
    getAuthenticated: jest.fn(),
  },
  pulls: {
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    merge: jest.fn(),
  },
  git: {
    deleteRef: jest.fn(),
  },
  repos: {
    get: jest.fn(),
  },
  rateLimit: {
    get: jest.fn(),
  },
};

// Mock Octokit class - create a class that has the right structure
class MockOctokit {
  rest = mockOctokitMethods;
  constructor(_options?: any) {
    // Constructor can receive options but we don't need to do anything with them
  }
}

// Add plugin method as a static method that returns the same class
(MockOctokit as any).plugin = jest.fn().mockReturnValue(MockOctokit);

jest.mock("@octokit/rest", () => ({
  Octokit: MockOctokit,
}));

jest.mock("@octokit/plugin-throttling", () => ({
  throttling: {},
}));

// Import after mocks are set up
import {
  GitHubService,
  AuthError,
  PRExistsError,
  NotFoundError,
  MergeBlockedError,
  MergeConflictError,
} from "../../src/services/GitHubService";
import { logger } from "../../src/utils/logger";

describe("GitHubService", () => {
  let mockOctokit: any;
  let service: GitHubService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Use the mockOctokitMethods from the top-level scope
    mockOctokit = mockOctokitMethods;
  });

  describe("Constructor", () => {
    it("should initialize with provided owner and repo", () => {
      service = new GitHubService({
        token: "test-token",
        owner: "testowner",
        repo: "testrepo",
      });

      expect(service.owner).toBe("testowner");
      expect(service.repo).toBe("testrepo");
    });

    it("should parse owner and repo from git remote if not provided", () => {
      mockChildProcess.execSync.mockReturnValue(
        "git@github.com:littlebearapps/notebridge.git\n",
      );

      service = new GitHubService({
        token: "test-token",
      });

      expect(service.owner).toBe("littlebearapps");
      expect(service.repo).toBe("notebridge");
    });

    it("should throw error if git remote parsing fails", () => {
      mockChildProcess.execSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(() => {
        new GitHubService({ token: "test-token" });
      }).toThrow("Failed to parse git remote URL");
    });
  });

  describe("Authentication", () => {
    beforeEach(() => {
      service = new GitHubService({
        token: "test-token",
        owner: "testowner",
        repo: "testrepo",
      });
    });

    it("should verify authentication successfully", async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: "testuser" },
      });

      const result = await service.verifyAuth();

      expect(result).toEqual({ login: "testuser" });
      expect(mockOctokit.users.getAuthenticated).toHaveBeenCalled();
    });

    it("should throw AuthError on authentication failure", async () => {
      const requestError = new RequestError("Bad credentials", 401, {
        request: {
          method: "GET",
          url: "https://api.github.com/user",
          headers: {},
        },
        response: {
          status: 401,
          url: "https://api.github.com/user",
          headers: {},
          data: {},
        },
      });

      mockOctokit.users.getAuthenticated.mockRejectedValue(requestError);

      await expect(service.verifyAuth()).rejects.toThrow(AuthError);
      await expect(service.verifyAuth()).rejects.toThrow(
        "GitHub authentication failed",
      );
    });
  });

  describe("PR Operations", () => {
    beforeEach(() => {
      service = new GitHubService({
        token: "test-token",
        owner: "testowner",
        repo: "testrepo",
      });
    });

    describe("createPR", () => {
      it("should create PR successfully", async () => {
        mockOctokit.pulls.create.mockResolvedValue({
          data: {
            number: 123,
            html_url: "https://github.com/testowner/testrepo/pull/123",
            head: { sha: "abc123" },
          },
        });

        const result = await service.createPR({
          title: "Test PR",
          body: "Test body",
          head: "feature-branch",
          base: "main",
        });

        expect(result).toEqual({
          number: 123,
          html_url: "https://github.com/testowner/testrepo/pull/123",
          head: "abc123",
        });

        expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
          owner: "testowner",
          repo: "testrepo",
          title: "Test PR",
          body: "Test body",
          head: "feature-branch",
          base: "main",
          draft: false,
        });
      });

      it("should create draft PR when specified", async () => {
        mockOctokit.pulls.create.mockResolvedValue({
          data: {
            number: 124,
            html_url: "https://github.com/testowner/testrepo/pull/124",
            head: { sha: "def456" },
          },
        });

        await service.createPR({
          title: "Draft PR",
          body: "Draft body",
          head: "feature-branch",
          base: "main",
          draft: true,
        });

        expect(mockOctokit.pulls.create).toHaveBeenCalledWith(
          expect.objectContaining({ draft: true }),
        );
      });

      it("should throw PRExistsError on 422 status", async () => {
        const requestError = new RequestError("Validation Failed", 422, {
          request: {
            method: "POST",
            url: "https://api.github.com/repos/testowner/testrepo/pulls",
            headers: {},
          },
          response: {
            status: 422,
            url: "https://api.github.com/repos/testowner/testrepo/pulls",
            headers: {},
            data: {},
          },
        });

        mockOctokit.pulls.create.mockRejectedValue(requestError);

        await expect(
          service.createPR({
            title: "Test PR",
            body: "Test body",
            head: "feature-branch",
            base: "main",
          }),
        ).rejects.toThrow(PRExistsError);
      });

      it("should throw NotFoundError on 404 status", async () => {
        const requestError = new RequestError("Not Found", 404, {
          request: {
            method: "POST",
            url: "https://api.github.com/repos/testowner/testrepo/pulls",
            headers: {},
          },
          response: {
            status: 404,
            url: "https://api.github.com/repos/testowner/testrepo/pulls",
            headers: {},
            data: {},
          },
        });

        mockOctokit.pulls.create.mockRejectedValue(requestError);

        await expect(
          service.createPR({
            title: "Test PR",
            body: "Test body",
            head: "feature-branch",
            base: "main",
          }),
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe("getPR", () => {
      it("should get PR details successfully", async () => {
        const mockPR = {
          number: 123,
          title: "Test PR",
          body: "Test body",
          state: "open",
          html_url: "https://github.com/testowner/testrepo/pull/123",
          head: { ref: "feature-branch", sha: "abc123" },
          base: { ref: "main" },
          mergeable: true,
          merged: false,
        };

        mockOctokit.pulls.get.mockResolvedValue({ data: mockPR });

        const result = await service.getPR(123);

        expect(result).toEqual(mockPR);
        expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
          owner: "testowner",
          repo: "testrepo",
          pull_number: 123,
        });
      });

      it("should throw NotFoundError when PR not found", async () => {
        const requestError = new RequestError("Not Found", 404, {
          request: {
            method: "GET",
            url: "https://api.github.com/repos/testowner/testrepo/pulls/999",
            headers: {},
          },
          response: {
            status: 404,
            url: "https://api.github.com/repos/testowner/testrepo/pulls/999",
            headers: {},
            data: {},
          },
        });

        mockOctokit.pulls.get.mockRejectedValue(requestError);

        await expect(service.getPR(999)).rejects.toThrow(NotFoundError);
        await expect(service.getPR(999)).rejects.toThrow(
          "Pull request #999 not found",
        );
      });
    });

    describe("listPRs", () => {
      it("should list open PRs by default", async () => {
        const mockPRs = [
          { number: 1, title: "PR 1", state: "open" },
          { number: 2, title: "PR 2", state: "open" },
        ];

        mockOctokit.pulls.list.mockResolvedValue({ data: mockPRs });

        const result = await service.listPRs();

        expect(result).toEqual(mockPRs);
        expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
          owner: "testowner",
          repo: "testrepo",
          state: "open",
        });
      });

      it("should list closed PRs when specified", async () => {
        const mockPRs = [{ number: 3, title: "PR 3", state: "closed" }];

        mockOctokit.pulls.list.mockResolvedValue({ data: mockPRs });

        const result = await service.listPRs("closed");

        expect(result).toEqual(mockPRs);
        expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
          owner: "testowner",
          repo: "testrepo",
          state: "closed",
        });
      });

      it("should list all PRs when specified", async () => {
        mockOctokit.pulls.list.mockResolvedValue({ data: [] });

        await service.listPRs("all");

        expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
          owner: "testowner",
          repo: "testrepo",
          state: "all",
        });
      });
    });

    describe("mergePR", () => {
      it("should merge PR successfully", async () => {
        mockOctokit.pulls.merge.mockResolvedValue({
          data: {
            merged: true,
            sha: "merge123",
          },
        });

        const result = await service.mergePR(123, { method: "merge" });

        expect(result).toEqual({
          merged: true,
          sha: "merge123",
        });

        expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
          owner: "testowner",
          repo: "testrepo",
          pull_number: 123,
          merge_method: "merge",
          commit_title: undefined,
          commit_message: undefined,
          sha: undefined,
        });
      });

      it("should merge with squash method", async () => {
        mockOctokit.pulls.merge.mockResolvedValue({
          data: { merged: true, sha: "squash123" },
        });

        await service.mergePR(123, {
          method: "squash",
          commitTitle: "Squashed commit",
          commitMessage: "All changes squashed",
        });

        expect(mockOctokit.pulls.merge).toHaveBeenCalledWith(
          expect.objectContaining({
            merge_method: "squash",
            commit_title: "Squashed commit",
            commit_message: "All changes squashed",
          }),
        );
      });

      it("should merge with rebase method", async () => {
        mockOctokit.pulls.merge.mockResolvedValue({
          data: { merged: true, sha: "rebase123" },
        });

        await service.mergePR(123, { method: "rebase" });

        expect(mockOctokit.pulls.merge).toHaveBeenCalledWith(
          expect.objectContaining({ merge_method: "rebase" }),
        );
      });

      it("should throw MergeBlockedError on 405 status", async () => {
        const requestError = new RequestError("Method Not Allowed", 405, {
          request: {
            method: "PUT",
            url: "https://api.github.com/repos/testowner/testrepo/pulls/123/merge",
            headers: {},
          },
          response: {
            status: 405,
            url: "https://api.github.com/repos/testowner/testrepo/pulls/123/merge",
            headers: {},
            data: {},
          },
        });

        mockOctokit.pulls.merge.mockRejectedValue(requestError);

        await expect(service.mergePR(123, { method: "merge" })).rejects.toThrow(
          MergeBlockedError,
        );
        await expect(service.mergePR(123, { method: "merge" })).rejects.toThrow(
          "PR cannot be merged (conflicts or failed checks)",
        );
      });

      it("should throw MergeConflictError on 409 status", async () => {
        const requestError = new RequestError("Conflict", 409, {
          request: {
            method: "PUT",
            url: "https://api.github.com/repos/testowner/testrepo/pulls/123/merge",
            headers: {},
          },
          response: {
            status: 409,
            url: "https://api.github.com/repos/testowner/testrepo/pulls/123/merge",
            headers: {},
            data: {},
          },
        });

        mockOctokit.pulls.merge.mockRejectedValue(requestError);

        await expect(service.mergePR(123, { method: "merge" })).rejects.toThrow(
          MergeConflictError,
        );
        await expect(service.mergePR(123, { method: "merge" })).rejects.toThrow(
          "PR has merge conflicts",
        );
      });
    });
  });

  describe("Branch Operations", () => {
    beforeEach(() => {
      service = new GitHubService({
        token: "test-token",
        owner: "testowner",
        repo: "testrepo",
      });
    });

    it("should delete branch successfully", async () => {
      mockOctokit.git.deleteRef.mockResolvedValue({});

      await service.deleteBranch("feature-branch");

      expect(mockOctokit.git.deleteRef).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        ref: "heads/feature-branch",
      });
    });

    it("should throw error when branch does not exist", async () => {
      const requestError = new RequestError("Unprocessable Entity", 422, {
        request: {
          method: "DELETE",
          url: "https://api.github.com/repos/testowner/testrepo/git/refs/heads/nonexistent",
          headers: {},
        },
        response: {
          status: 422,
          url: "https://api.github.com/repos/testowner/testrepo/git/refs/heads/nonexistent",
          headers: {},
          data: {},
        },
      });

      mockOctokit.git.deleteRef.mockRejectedValue(requestError);

      await expect(service.deleteBranch("nonexistent")).rejects.toThrow(
        "Branch nonexistent does not exist or already deleted",
      );
    });
  });

  describe("Repository Operations", () => {
    beforeEach(() => {
      service = new GitHubService({
        token: "test-token",
        owner: "testowner",
        repo: "testrepo",
      });
    });

    it("should get repository information", async () => {
      const mockRepoData = {
        id: 12345,
        name: "testrepo",
        full_name: "testowner/testrepo",
        private: false,
        default_branch: "main",
      };

      mockOctokit.repos.get.mockResolvedValue({ data: mockRepoData });

      const result = await service.getRepo();

      expect(result).toEqual(mockRepoData);
      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
      });
    });
  });

  describe("Rate Limit", () => {
    beforeEach(() => {
      service = new GitHubService({
        token: "test-token",
        owner: "testowner",
        repo: "testrepo",
      });
    });

    it("should get rate limit status", async () => {
      const mockRateLimit = {
        data: {
          rate: {
            remaining: 4500,
            limit: 5000,
            reset: 1640000000,
            used: 500,
          },
        },
      };

      mockOctokit.rateLimit.get.mockResolvedValue(mockRateLimit);

      const result = await service.getRateLimitStatus();

      expect(result).toEqual({
        remaining: 4500,
        limit: 5000,
        reset: new Date(1640000000 * 1000),
        used: 500,
      });
    });

    it("should warn when rate limit is low", async () => {
      const mockRateLimit = {
        data: {
          rate: {
            remaining: 500,
            limit: 5000,
            reset: 1640000000,
            used: 4500,
          },
        },
      };

      mockOctokit.rateLimit.get.mockResolvedValue(mockRateLimit);

      await service.getRateLimitStatus();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("API rate limit low: 500/5000"),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit resets at:"),
      );
    });

    it("should not warn when rate limit is sufficient", async () => {
      const mockRateLimit = {
        data: {
          rate: {
            remaining: 4500,
            limit: 5000,
            reset: 1640000000,
            used: 500,
          },
        },
      };

      mockOctokit.rateLimit.get.mockResolvedValue(mockRateLimit);

      await service.getRateLimitStatus();

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("URL Parsing", () => {
    beforeEach(() => {
      // Mock execSync to return a valid URL so constructor succeeds
      mockChildProcess.execSync.mockReturnValue(
        "git@github.com:testowner/testrepo.git\n",
      );
      service = new GitHubService({ token: "test-token" });
    });

    it("should parse SSH git URL", () => {
      mockChildProcess.execSync.mockReturnValue(
        "git@github.com:littlebearapps/notebridge.git\n",
      );

      const newService = new GitHubService({ token: "test-token" });

      expect(newService.owner).toBe("littlebearapps");
      expect(newService.repo).toBe("notebridge");
    });

    it("should parse SSH git URL without .git extension", () => {
      mockChildProcess.execSync.mockReturnValue("git@github.com:owner/repo\n");

      const newService = new GitHubService({ token: "test-token" });

      expect(newService.owner).toBe("owner");
      expect(newService.repo).toBe("repo");
    });

    it("should parse HTTPS git URL", () => {
      mockChildProcess.execSync.mockReturnValue(
        "https://github.com/littlebearapps/notebridge.git\n",
      );

      const newService = new GitHubService({ token: "test-token" });

      expect(newService.owner).toBe("littlebearapps");
      expect(newService.repo).toBe("notebridge");
    });

    it("should parse HTTPS git URL without .git extension", () => {
      mockChildProcess.execSync.mockReturnValue("https://github.com/owner/repo\n");

      const newService = new GitHubService({ token: "test-token" });

      expect(newService.owner).toBe("owner");
      expect(newService.repo).toBe("repo");
    });

    it("should throw error for invalid git URL format", () => {
      mockChildProcess.execSync.mockReturnValue("invalid-url\n");

      expect(() => {
        new GitHubService({ token: "test-token" });
      }).toThrow("Could not parse git URL: invalid-url");
    });

    it("should throw error for non-GitHub URL", () => {
      mockChildProcess.execSync.mockReturnValue(
        "https://gitlab.com/owner/repo.git\n",
      );

      expect(() => {
        new GitHubService({ token: "test-token" });
      }).toThrow("Could not parse git URL");
    });
  });

  describe("Error Classes", () => {
    it("should create AuthError with correct name", () => {
      const error = new AuthError("Test auth error");
      expect(error.name).toBe("AuthError");
      expect(error.message).toBe("Test auth error");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create PRExistsError with correct name", () => {
      const error = new PRExistsError("Test PR exists error");
      expect(error.name).toBe("PRExistsError");
      expect(error.message).toBe("Test PR exists error");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create NotFoundError with correct name", () => {
      const error = new NotFoundError("Test not found error");
      expect(error.name).toBe("NotFoundError");
      expect(error.message).toBe("Test not found error");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create MergeBlockedError with correct name", () => {
      const error = new MergeBlockedError("Test merge blocked error");
      expect(error.name).toBe("MergeBlockedError");
      expect(error.message).toBe("Test merge blocked error");
      expect(error).toBeInstanceOf(Error);
    });

    it("should create MergeConflictError with correct name", () => {
      const error = new MergeConflictError("Test merge conflict error");
      expect(error.name).toBe("MergeConflictError");
      expect(error.message).toBe("Test merge conflict error");
      expect(error).toBeInstanceOf(Error);
    });
  });
});
