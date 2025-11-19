import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock dependencies BEFORE importing the module that uses them
jest.mock("../../src/services/GitService");
jest.mock("../../src/utils/logger");
jest.mock("../../src/utils/spinner", () => ({
  spinner: {
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
  },
}));

// Now import after mocks are set up
import { featureCommand } from "../../src/commands/feature";
import { GitService } from "../../src/services/GitService";
import { logger } from "../../src/utils/logger";
import { spinner } from "../../src/utils/spinner";

describe("featureCommand", () => {
  let mockGitService: jest.Mocked<GitService>;

  // Mock process.exit to throw an error so we can test error paths
  beforeEach(() => {
    jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock GitService instance
    mockGitService = {
      getBranchInfo: jest.fn(),
      getDefaultBranch: jest.fn(),
      branchExists: jest.fn(),
      getBranchWorktrees: jest.fn(),
      fetch: jest.fn(),
      checkout: jest.fn(),
      pull: jest.fn(),
      createBranch: jest.fn(),
    } as any;

    (GitService as jest.MockedClass<typeof GitService>).mockImplementation(
      () => mockGitService,
    );

    // Mock spinner
    (spinner.start as jest.Mock).mockReturnValue(undefined);
    (spinner.succeed as jest.Mock).mockReturnValue(undefined);
    (spinner.fail as jest.Mock).mockReturnValue(undefined);
  });

  describe("basic functionality", () => {
    it("should create feature branch successfully", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([]);

      await featureCommand("test-feature", {});

      expect(mockGitService.createBranch).toHaveBeenCalledWith(
        "feature/test-feature",
        "main",
      );
      expect(logger.success).toHaveBeenCalledWith("Feature branch created!");
    });

    it("should error when working directory is not clean", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: false,
        hasUncommittedChanges: true,
        remoteBranches: [],
      });

      await expect(featureCommand("test-feature", {})).rejects.toThrow(
        "process.exit called",
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Working directory has uncommitted changes. Commit or stash them first.",
      );
    });

    it("should error when branch already exists", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(true);

      await expect(featureCommand("test-feature", {})).rejects.toThrow(
        "process.exit called",
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("already exists"),
      );
    });

    it("should use custom base branch when provided", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([]);

      await featureCommand("test-feature", { from: "develop" });

      expect(mockGitService.checkout).toHaveBeenCalledWith("develop");
      expect(mockGitService.createBranch).toHaveBeenCalledWith(
        "feature/test-feature",
        "develop",
      );
    });
  });

  describe("worktree conflict detection", () => {
    it("should error when branch checked out in another worktree", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([
        "/path/to/other/worktree",
      ]);

      await expect(featureCommand("test-feature", {})).rejects.toThrow(
        "process.exit called",
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("already checked out in another worktree"),
        "WORKTREE_CONFLICT",
        expect.objectContaining({
          branch: "feature/test-feature",
          conflictingWorktrees: ["/path/to/other/worktree"],
        }),
        expect.arrayContaining([
          expect.stringContaining("cd /path/to/other/worktree"),
          expect.stringContaining("use a different branch name"),
          expect.stringContaining("git worktree remove"),
        ]),
      );
    });

    it("should succeed when branch checked out in current worktree only", async () => {
      const currentPath = process.cwd();

      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([currentPath]);

      await featureCommand("test-feature", {});

      expect(mockGitService.createBranch).toHaveBeenCalledWith(
        "feature/test-feature",
        "main",
      );
      expect(logger.success).toHaveBeenCalledWith("Feature branch created!");
    });

    it("should filter out current worktree from conflict list", async () => {
      const currentPath = process.cwd();

      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([
        currentPath,
        "/path/to/other/worktree",
      ]);

      await expect(featureCommand("test-feature", {})).rejects.toThrow(
        "process.exit called",
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("already checked out in another worktree"),
        "WORKTREE_CONFLICT",
        expect.objectContaining({
          currentWorktree: currentPath,
          conflictingWorktrees: ["/path/to/other/worktree"],
        }),
        expect.any(Array),
      );
    });

    it("should error when branch in multiple other worktrees", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([
        "/path/to/worktree1",
        "/path/to/worktree2",
        "/path/to/worktree3",
      ]);

      await expect(featureCommand("test-feature", {})).rejects.toThrow(
        "process.exit called",
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("already checked out in another worktree"),
        "WORKTREE_CONFLICT",
        expect.objectContaining({
          conflictingWorktrees: [
            "/path/to/worktree1",
            "/path/to/worktree2",
            "/path/to/worktree3",
          ],
        }),
        expect.arrayContaining([
          expect.stringContaining("cd /path/to/worktree1"),
        ]),
      );
    });

    it("should proceed when getBranchWorktrees returns empty array", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([]);

      await featureCommand("test-feature", {});

      expect(mockGitService.createBranch).toHaveBeenCalledWith(
        "feature/test-feature",
        "main",
      );
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("branch name sanitization", () => {
    it("should convert spaces to hyphens", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([]);

      await featureCommand("my test feature", {});

      expect(mockGitService.createBranch).toHaveBeenCalledWith(
        "feature/my-test-feature",
        "main",
      );
    });

    it("should convert uppercase to lowercase", async () => {
      mockGitService.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
        hasUncommittedChanges: false,
        remoteBranches: [],
      });
      mockGitService.getDefaultBranch.mockResolvedValue("main");
      mockGitService.branchExists.mockResolvedValue(false);
      mockGitService.getBranchWorktrees.mockResolvedValue([]);

      await featureCommand("TEST-FEATURE", {});

      expect(mockGitService.createBranch).toHaveBeenCalledWith(
        "feature/test-feature",
        "main",
      );
    });
  });
});
