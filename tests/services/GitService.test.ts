import type { StatusResult } from "simple-git";

// Mock simple-git module
jest.mock("simple-git");

// Import after mock is defined
import simpleGit from "simple-git";
import { GitService } from "../../src/services/GitService";

// Create mock git instance
const mockGitInstance = {
  status: jest.fn(),
  branch: jest.fn(),
  checkout: jest.fn(),
  checkoutLocalBranch: jest.fn(),
  push: jest.fn(),
  pull: jest.fn(),
  fetch: jest.fn(),
  deleteLocalBranch: jest.fn(),
  getRemotes: jest.fn(),
  add: jest.fn(),
  commit: jest.fn(),
  diff: jest.fn(),
  log: jest.fn(),
  stash: jest.fn(),
  raw: jest.fn(),
};

describe("GitService", () => {
  let service: GitService;

  beforeEach(() => {
    // Set the return value for the mocked simpleGit function
    (simpleGit as jest.Mock).mockReturnValue(mockGitInstance);
    jest.clearAllMocks();
    service = new GitService({ workingDir: "/test/dir" });
  });

  describe("Constructor", () => {
    it("should initialize with provided working directory", () => {
      expect(service).toBeDefined();
    });
  });

  describe("Branch Info and Status", () => {
    describe("getCurrentBranch", () => {
      it("should return current branch name", async () => {
        mockGitInstance.status.mockResolvedValue({
          current: "feature-branch",
          isClean: () => true,
        } as StatusResult);

        const result = await service.getCurrentBranch();

        expect(result).toBe("feature-branch");
        expect(mockGitInstance.status).toHaveBeenCalled();
      });

      it('should return "unknown" if current branch is null', async () => {
        mockGitInstance.status.mockResolvedValue({
          current: null,
          isClean: () => true,
        } as StatusResult);

        const result = await service.getCurrentBranch();

        expect(result).toBe("unknown");
      });
    });

    describe("getBranchInfo", () => {
      it("should return comprehensive branch information", async () => {
        mockGitInstance.status.mockResolvedValue({
          current: "main",
          isClean: () => true,
        } as StatusResult);

        mockGitInstance.branch.mockResolvedValue({
          branches: {
            main: {},
            "feature-branch": {},
            "remotes/origin/main": {},
            "remotes/origin/feature-branch": {},
          },
        });

        const result = await service.getBranchInfo();

        expect(result).toEqual({
          current: "main",
          isClean: true,
          hasUncommittedChanges: false,
          remoteBranches: [
            "remotes/origin/main",
            "remotes/origin/feature-branch",
          ],
        });
      });

      it("should indicate uncommitted changes when not clean", async () => {
        mockGitInstance.status.mockResolvedValue({
          current: "main",
          isClean: () => false,
        } as StatusResult);

        mockGitInstance.branch.mockResolvedValue({
          branches: {},
        });

        const result = await service.getBranchInfo();

        expect(result.isClean).toBe(false);
        expect(result.hasUncommittedChanges).toBe(true);
      });
    });

    describe("isClean", () => {
      it("should return true when working directory is clean", async () => {
        mockGitInstance.status.mockResolvedValue({
          isClean: () => true,
        } as StatusResult);

        const result = await service.isClean();

        expect(result).toBe(true);
      });

      it("should return false when working directory has changes", async () => {
        mockGitInstance.status.mockResolvedValue({
          isClean: () => false,
        } as StatusResult);

        const result = await service.isClean();

        expect(result).toBe(false);
      });
    });

    describe("getStatus", () => {
      it("should return git status result", async () => {
        const mockStatus: Partial<StatusResult> = {
          current: "main",
          isClean: () => true,
          files: [],
        };

        mockGitInstance.status.mockResolvedValue(mockStatus);

        const result = await service.getStatus();

        expect(result).toBe(mockStatus);
      });
    });
  });

  describe("Branch Operations", () => {
    describe("createBranch", () => {
      it("should create and checkout new branch without base branch", async () => {
        await service.createBranch("new-feature");

        expect(mockGitInstance.checkoutLocalBranch).toHaveBeenCalledWith(
          "new-feature",
        );
        expect(mockGitInstance.checkout).not.toHaveBeenCalled();
      });

      it("should checkout base branch before creating new branch", async () => {
        await service.createBranch("new-feature", "main");

        expect(mockGitInstance.checkout).toHaveBeenCalledWith("main");
        expect(mockGitInstance.checkoutLocalBranch).toHaveBeenCalledWith(
          "new-feature",
        );
      });
    });

    describe("checkout", () => {
      it("should checkout existing branch", async () => {
        await service.checkout("existing-branch");

        expect(mockGitInstance.checkout).toHaveBeenCalledWith(
          "existing-branch",
        );
      });
    });

    describe("deleteBranch", () => {
      it("should delete branch without force", async () => {
        await service.deleteBranch("old-branch");

        expect(mockGitInstance.deleteLocalBranch).toHaveBeenCalledWith(
          "old-branch",
        );
      });

      it("should force delete branch when specified", async () => {
        await service.deleteBranch("old-branch", true);

        expect(mockGitInstance.deleteLocalBranch).toHaveBeenCalledWith(
          "old-branch",
          true,
        );
      });
    });

    describe("listBranches", () => {
      it("should return all branch names", async () => {
        mockGitInstance.branch.mockResolvedValue({
          all: ["main", "feature-1", "feature-2", "remotes/origin/main"],
        });

        const result = await service.listBranches();

        expect(result).toEqual([
          "main",
          "feature-1",
          "feature-2",
          "remotes/origin/main",
        ]);
      });
    });

    describe("branchExists", () => {
      it("should return true when branch exists", async () => {
        mockGitInstance.branch.mockResolvedValue({
          all: ["main", "feature-branch"],
        });

        const result = await service.branchExists("feature-branch");

        expect(result).toBe(true);
      });

      it("should return false when branch does not exist", async () => {
        mockGitInstance.branch.mockResolvedValue({
          all: ["main", "feature-branch"],
        });

        const result = await service.branchExists("nonexistent");

        expect(result).toBe(false);
      });
    });

    describe("getDefaultBranch", () => {
      it("should return default branch from remote", async () => {
        mockGitInstance.raw.mockResolvedValue("refs/remotes/origin/main\n");

        const result = await service.getDefaultBranch();

        expect(result).toBe("main");
        expect(mockGitInstance.raw).toHaveBeenCalledWith([
          "symbolic-ref",
          "refs/remotes/origin/HEAD",
        ]);
      });

      it('should fallback to "main" if it exists locally', async () => {
        mockGitInstance.raw.mockRejectedValue(new Error("No remote HEAD"));
        mockGitInstance.branch.mockResolvedValue({
          all: ["main", "feature-branch"],
        });

        const result = await service.getDefaultBranch();

        expect(result).toBe("main");
      });

      it('should fallback to "master" if "main" does not exist', async () => {
        mockGitInstance.raw.mockRejectedValue(new Error("No remote HEAD"));
        mockGitInstance.branch.mockResolvedValue({
          all: ["master", "feature-branch"],
        });

        const result = await service.getDefaultBranch();

        expect(result).toBe("master");
      });

      it('should return "main" as final fallback', async () => {
        mockGitInstance.raw.mockRejectedValue(new Error("No remote HEAD"));
        mockGitInstance.branch.mockResolvedValue({
          all: ["feature-branch", "develop"],
        });

        const result = await service.getDefaultBranch();

        expect(result).toBe("main");
      });
    });
  });

  describe("Remote Operations", () => {
    describe("push", () => {
      it("should push to origin without upstream", async () => {
        mockGitInstance.status.mockResolvedValue({
          current: "feature-branch",
        } as StatusResult);

        await service.push();

        expect(mockGitInstance.push).toHaveBeenCalledWith(
          "origin",
          "feature-branch",
        );
      });

      it("should push with upstream flag", async () => {
        mockGitInstance.status.mockResolvedValue({
          current: "feature-branch",
        } as StatusResult);

        await service.push("origin", undefined, true);

        expect(mockGitInstance.push).toHaveBeenCalledWith([
          "-u",
          "origin",
          "feature-branch",
        ]);
      });

      it("should push specified branch", async () => {
        await service.push("origin", "custom-branch");

        expect(mockGitInstance.push).toHaveBeenCalledWith(
          "origin",
          "custom-branch",
        );
      });

      it("should push to custom remote", async () => {
        mockGitInstance.status.mockResolvedValue({
          current: "feature-branch",
        } as StatusResult);

        await service.push("upstream");

        expect(mockGitInstance.push).toHaveBeenCalledWith(
          "upstream",
          "feature-branch",
        );
      });
    });

    describe("pull", () => {
      it("should pull from origin without branch", async () => {
        await service.pull();

        expect(mockGitInstance.pull).toHaveBeenCalledWith();
      });

      it("should pull specified branch from remote", async () => {
        await service.pull("origin", "main");

        expect(mockGitInstance.pull).toHaveBeenCalledWith("origin", "main");
      });
    });

    describe("fetch", () => {
      it("should fetch from origin by default", async () => {
        await service.fetch();

        expect(mockGitInstance.fetch).toHaveBeenCalledWith("origin");
      });

      it("should fetch from specified remote", async () => {
        await service.fetch("upstream");

        expect(mockGitInstance.fetch).toHaveBeenCalledWith("upstream");
      });
    });

    describe("getRemoteUrl", () => {
      it("should return remote URL for origin", async () => {
        mockGitInstance.getRemotes.mockResolvedValue([
          {
            name: "origin",
            refs: {
              fetch: "https://github.com/user/repo.git",
              push: "https://github.com/user/repo.git",
            },
          },
        ]);

        const result = await service.getRemoteUrl();

        expect(result).toBe("https://github.com/user/repo.git");
        expect(mockGitInstance.getRemotes).toHaveBeenCalledWith(true);
      });

      it("should return remote URL for specified remote", async () => {
        mockGitInstance.getRemotes.mockResolvedValue([
          {
            name: "upstream",
            refs: {
              fetch: "https://github.com/upstream/repo.git",
              push: "https://github.com/upstream/repo.git",
            },
          },
        ]);

        const result = await service.getRemoteUrl("upstream");

        expect(result).toBe("https://github.com/upstream/repo.git");
      });

      it("should throw error when remote not found", async () => {
        mockGitInstance.getRemotes.mockResolvedValue([
          {
            name: "origin",
            refs: {
              fetch: "https://github.com/user/repo.git",
              push: "https://github.com/user/repo.git",
            },
          },
        ]);

        await expect(service.getRemoteUrl("nonexistent")).rejects.toThrow(
          "Remote 'nonexistent' not found",
        );
      });
    });
  });

  describe("Staging and Commit", () => {
    describe("add", () => {
      it("should add single file", async () => {
        await service.add("file.txt");

        expect(mockGitInstance.add).toHaveBeenCalledWith("file.txt");
      });

      it("should add multiple files", async () => {
        await service.add(["file1.txt", "file2.txt"]);

        expect(mockGitInstance.add).toHaveBeenCalledWith([
          "file1.txt",
          "file2.txt",
        ]);
      });
    });

    describe("commit", () => {
      it("should commit with message", async () => {
        await service.commit("feat: add new feature");

        expect(mockGitInstance.commit).toHaveBeenCalledWith(
          "feat: add new feature",
        );
      });
    });

    describe("getDiff", () => {
      it("should return diff for unstaged changes", async () => {
        mockGitInstance.diff.mockResolvedValue(
          "diff --git a/file.txt b/file.txt",
        );

        const result = await service.getDiff();

        expect(result).toBe("diff --git a/file.txt b/file.txt");
        expect(mockGitInstance.diff).toHaveBeenCalledWith();
      });
    });

    describe("getStagedDiff", () => {
      it("should return diff for staged changes", async () => {
        mockGitInstance.diff.mockResolvedValue(
          "diff --git a/file.txt b/file.txt",
        );

        const result = await service.getStagedDiff();

        expect(result).toBe("diff --git a/file.txt b/file.txt");
        expect(mockGitInstance.diff).toHaveBeenCalledWith(["--cached"]);
      });
    });
  });

  describe("History and State", () => {
    describe("getLog", () => {
      it("should get commit log without options", async () => {
        const mockLog = {
          latest: { hash: "abc123", message: "test commit" },
        };

        mockGitInstance.log.mockResolvedValue(mockLog);

        const result = await service.getLog();

        expect(result).toBe(mockLog);
        expect(mockGitInstance.log).toHaveBeenCalledWith({});
      });

      it("should get commit log with maxCount", async () => {
        const mockLog = {
          latest: { hash: "abc123", message: "test commit" },
        };

        mockGitInstance.log.mockResolvedValue(mockLog);

        await service.getLog({ maxCount: 10 });

        expect(mockGitInstance.log).toHaveBeenCalledWith({ maxCount: 10 });
      });

      it("should get commit log with from and to", async () => {
        const mockLog = {
          latest: { hash: "abc123", message: "test commit" },
        };

        mockGitInstance.log.mockResolvedValue(mockLog);

        await service.getLog({ from: "main", to: "feature-branch" });

        expect(mockGitInstance.log).toHaveBeenCalledWith({
          from: "main",
          to: "feature-branch",
        });
      });
    });

    describe("stash", () => {
      it("should stash without message", async () => {
        await service.stash();

        expect(mockGitInstance.stash).toHaveBeenCalledWith();
      });

      it("should stash with message", async () => {
        await service.stash("WIP: feature implementation");

        expect(mockGitInstance.stash).toHaveBeenCalledWith([
          "push",
          "-m",
          "WIP: feature implementation",
        ]);
      });
    });

    describe("stashPop", () => {
      it("should pop stashed changes", async () => {
        await service.stashPop();

        expect(mockGitInstance.stash).toHaveBeenCalledWith(["pop"]);
      });
    });
  });

  describe("Worktree Methods", () => {
    describe("getWorktrees", () => {
      it("should parse worktree list output", async () => {
        const mockOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature/test`;

        mockGitInstance.raw.mockResolvedValue(mockOutput);

        const worktrees = await service.getWorktrees();

        expect(worktrees).toHaveLength(2);
        expect(worktrees[0]).toMatchObject({
          path: "/path/to/main",
          commit: "abc123",
          branch: "main",
        });
        expect(worktrees[1]).toMatchObject({
          path: "/path/to/feature",
          commit: "def456",
          branch: "feature/test",
        });
      });

      it("should handle detached HEAD", async () => {
        const mockOutput = `worktree /path/to/detached
HEAD abc123
detached`;

        mockGitInstance.raw.mockResolvedValue(mockOutput);

        const worktrees = await service.getWorktrees();

        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].branch).toBeNull();
      });

      it("should handle non-worktree repository", async () => {
        mockGitInstance.raw.mockRejectedValue(new Error("not a worktree"));
        mockGitInstance.status.mockResolvedValue({
          current: "main",
          files: [],
        } as any);
        mockGitInstance.log.mockResolvedValue({
          latest: { hash: "abc123" },
        } as any);

        const worktrees = await service.getWorktrees();

        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].path).toBe("/test/dir"); // workingDir from mock setup
        expect(worktrees[0].branch).toBe("main");
        expect(worktrees[0].commit).toBe("abc123");
      });

      it("should return empty array when branch/commit info unavailable", async () => {
        mockGitInstance.raw.mockRejectedValue(new Error("not a worktree"));
        mockGitInstance.status.mockRejectedValue(new Error("no git repo"));

        const worktrees = await service.getWorktrees();

        expect(worktrees).toHaveLength(0);
      });

      it("should handle bare repository", async () => {
        const mockOutput = `worktree /path/to/.bare
HEAD 0000000
bare`;

        mockGitInstance.raw.mockResolvedValue(mockOutput);

        const worktrees = await service.getWorktrees();

        expect(worktrees).toHaveLength(1);
        expect(worktrees[0].isMain).toBe(true);
      });
    });

    describe("getBranchWorktrees", () => {
      it("should return empty array when branch not checked out", async () => {
        const mockOutput = `worktree /path/main
HEAD abc
branch refs/heads/main`;

        mockGitInstance.raw.mockResolvedValue(mockOutput);

        const paths = await service.getBranchWorktrees("feature/test");

        expect(paths).toEqual([]);
      });

      it("should return worktree paths where branch is active", async () => {
        const mockOutput = `worktree /path/worktree1
HEAD abc123
branch refs/heads/feature/test

worktree /path/worktree2
HEAD def456
branch refs/heads/main

worktree /path/worktree3
HEAD ghi789
branch refs/heads/feature/test`;

        mockGitInstance.raw.mockResolvedValue(mockOutput);

        const paths = await service.getBranchWorktrees("feature/test");

        expect(paths).toEqual(["/path/worktree1", "/path/worktree3"]);
      });

      it("should handle single worktree with matching branch", async () => {
        const mockOutput = `worktree /path/to/feature
HEAD abc123
branch refs/heads/feature/test`;

        mockGitInstance.raw.mockResolvedValue(mockOutput);

        const paths = await service.getBranchWorktrees("feature/test");

        expect(paths).toEqual(["/path/to/feature"]);
      });

      it("should ignore detached HEAD worktrees", async () => {
        const mockOutput = `worktree /path/worktree1
HEAD abc123
detached

worktree /path/worktree2
HEAD def456
branch refs/heads/feature/test`;

        mockGitInstance.raw.mockResolvedValue(mockOutput);

        const paths = await service.getBranchWorktrees("feature/test");

        expect(paths).toEqual(["/path/worktree2"]);
      });
    });

    describe("isWorktreeRepository", () => {
      it("should return true for worktree repo", async () => {
        mockGitInstance.raw.mockResolvedValue(
          "worktree /path\nHEAD abc\nbranch refs/heads/main",
        );

        const isWorktree = await service.isWorktreeRepository();

        expect(isWorktree).toBe(true);
      });

      it("should return false for standard repo", async () => {
        mockGitInstance.raw.mockRejectedValue(new Error("not a worktree"));

        const isWorktree = await service.isWorktreeRepository();

        expect(isWorktree).toBe(false);
      });

      it("should call git worktree list", async () => {
        mockGitInstance.raw.mockResolvedValue("worktree /path\nHEAD abc");

        await service.isWorktreeRepository();

        expect(mockGitInstance.raw).toHaveBeenCalledWith(["worktree", "list"]);
      });
    });
  });
});
