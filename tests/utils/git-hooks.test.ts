import {
  getGitHooksDir,
  fileExists,
  isGpmHook,
} from "../../src/utils/git-hooks";
import * as fs from "fs/promises";
import { execSync } from "child_process";
import * as path from "path";

// Mock dependencies
jest.mock("fs/promises");
jest.mock("child_process");

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("git-hooks utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getGitHooksDir", () => {
    describe("using git rev-parse (primary method)", () => {
      it("should use git rev-parse for standard repo", async () => {
        // Mock git rev-parse returning .git
        mockedExecSync.mockReturnValue(".git");

        const testRepo = path.resolve("/test/repo");
        const result = await getGitHooksDir(testRepo);

        expect(mockedExecSync).toHaveBeenCalledWith(
          "git rev-parse --git-common-dir",
          expect.objectContaining({
            cwd: testRepo,
            encoding: "utf-8",
          }),
        );

        expect(result).toBe(path.join(testRepo, ".git", "hooks"));
      });

      it("should use git rev-parse for worktree", async () => {
        // Mock git rev-parse returning path to bare repo (absolute path)
        const testBare = path.resolve("/test/.bare");
        mockedExecSync.mockReturnValue(testBare);

        const testRepoMain = path.resolve("/test/repo/main");
        const result = await getGitHooksDir(testRepoMain);

        expect(mockedExecSync).toHaveBeenCalledWith(
          "git rev-parse --git-common-dir",
          expect.objectContaining({
            cwd: testRepoMain,
          }),
        );

        // When git rev-parse returns absolute path, path.resolve uses it directly
        expect(result).toBe(path.join(testBare, "hooks"));
      });

      it("should handle relative path from git rev-parse", async () => {
        // Mock git rev-parse returning relative path
        mockedExecSync.mockReturnValue("../.bare");

        const testRepoMain = path.resolve("/test/repo/main");
        const result = await getGitHooksDir(testRepoMain);

        expect(result).toBe(path.resolve(testRepoMain, "..", ".bare", "hooks"));
      });
    });

    describe("fallback to manual .git detection", () => {
      beforeEach(() => {
        // Mock git rev-parse failing
        mockedExecSync.mockImplementation(() => {
          throw new Error("git command not found");
        });
      });

      it("should handle standard .git directory", async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false,
        } as any);

        const testRepo = path.resolve("/test/repo");
        const result = await getGitHooksDir(testRepo);

        expect(result).toBe(path.join(testRepo, ".git", "hooks"));
      });

      it("should handle worktree .git file", async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true,
        } as any);

        const testRepoBare = path.resolve("/test/repo/.bare");
        mockedFs.readFile.mockResolvedValue(
          `gitdir: ${path.join(testRepoBare, "worktrees", "main")}\n`,
        );

        const testRepoMain = path.resolve("/test/repo/main");
        const result = await getGitHooksDir(testRepoMain);

        // Should navigate from .bare/worktrees/main -> .bare/hooks
        expect(result).toBe(path.join(testRepoBare, "hooks"));
      });

      it("should handle worktree .git file with relative path", async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true,
        } as any);

        mockedFs.readFile.mockResolvedValue(
          "gitdir: ../.bare/worktrees/main\n",
        );

        const testRepoMain = path.resolve("/test/repo/main");
        const result = await getGitHooksDir(testRepoMain);

        expect(result).toBe(path.resolve(testRepoMain, "..", ".bare", "hooks"));
      });

      it("should throw error when not in git repo", async () => {
        mockedFs.stat.mockRejectedValue(new Error("ENOENT"));

        const testNotRepo = path.resolve("/test/not-a-repo");
        await expect(getGitHooksDir(testNotRepo)).rejects.toThrow(
          "Not a git repository",
        );
      });

      it("should throw error when .git file is invalid", async () => {
        mockedFs.stat.mockResolvedValue({
          isDirectory: () => false,
          isFile: () => true,
        } as any);

        mockedFs.readFile.mockResolvedValue("invalid content");

        const testRepo = path.resolve("/test/repo");
        await expect(getGitHooksDir(testRepo)).rejects.toThrow(
          "Not a git repository",
        );
      });
    });
  });

  describe("fileExists", () => {
    it("should return true when file exists", async () => {
      mockedFs.access.mockResolvedValue(undefined);

      const testFile = path.resolve("/test/file.txt");
      const result = await fileExists(testFile);

      expect(result).toBe(true);
      expect(mockedFs.access).toHaveBeenCalledWith(testFile);
    });

    it("should return false when file does not exist", async () => {
      mockedFs.access.mockRejectedValue(new Error("ENOENT"));

      const testMissing = path.resolve("/test/missing.txt");
      const result = await fileExists(testMissing);

      expect(result).toBe(false);
    });
  });

  describe("isGpmHook", () => {
    it("should return true for gpm pre-push hook", async () => {
      const hookContent = `#!/bin/sh
# gpm pre-push hook
# Installed via: gpm install-hooks
`;
      mockedFs.readFile.mockResolvedValue(hookContent);

      const hookPath = path.resolve("/test/.git/hooks/pre-push");
      const result = await isGpmHook(hookPath);

      expect(result).toBe(true);
    });

    it("should return true for gpm post-commit hook", async () => {
      const hookContent = `#!/bin/sh
# gpm post-commit hook
# Installed via: gpm install-hooks
`;
      mockedFs.readFile.mockResolvedValue(hookContent);

      const hookPath = path.resolve("/test/.git/hooks/post-commit");
      const result = await isGpmHook(hookPath);

      expect(result).toBe(true);
    });

    it("should return false for non-gpm hook", async () => {
      const hookContent = `#!/bin/sh
# Some other hook
# Not created by gpm
`;
      mockedFs.readFile.mockResolvedValue(hookContent);

      const hookPath = path.resolve("/test/.git/hooks/pre-push");
      const result = await isGpmHook(hookPath);

      expect(result).toBe(false);
    });

    it("should return false when hook file cannot be read", async () => {
      mockedFs.readFile.mockRejectedValue(new Error("ENOENT"));

      const hookPath = path.resolve("/test/.git/hooks/pre-push");
      const result = await isGpmHook(hookPath);

      expect(result).toBe(false);
    });

    it("should return false for empty file", async () => {
      mockedFs.readFile.mockResolvedValue("");

      const result = await isGpmHook("/test/.git/hooks/pre-push");

      expect(result).toBe(false);
    });
  });
});
