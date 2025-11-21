// Mock dependencies first
jest.mock("../../src/services/GitService");
jest.mock("../../src/services/ConfigService");
jest.mock("../../src/utils/logger", () => ({
  logger: {
    section: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    blank: jest.fn(),
    error: jest.fn(),
    outputJsonResult: jest.fn(),
  },
}));

// Import after mocks are set up
import { statusCommand } from "../../src/commands/status";
import { GitService } from "../../src/services/GitService";
import { ConfigService } from "../../src/services/ConfigService";
import { logger } from "../../src/utils/logger";

const mockedGitService = GitService as jest.MockedClass<typeof GitService>;
const mockedConfigService = ConfigService as jest.MockedClass<
  typeof ConfigService
>;

describe("status command", () => {
  let mockGitServiceInstance: any;
  let mockConfigServiceInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock GitService instance
    mockGitServiceInstance = {
      getBranchInfo: jest.fn(),
      getStatus: jest.fn(),
    };

    // Mock ConfigService instance
    mockConfigServiceInstance = {
      exists: jest.fn(),
      getConfig: jest.fn(),
    };

    mockedGitService.mockImplementation(() => mockGitServiceInstance);
    mockedConfigService.mockImplementation(() => mockConfigServiceInstance);
  });

  describe("Clean working directory", () => {
    it("should show clean status when no changes exist", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: true,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(false);

      await statusCommand();

      expect(logger.section).toHaveBeenCalledWith("Git Workflow Status");
      expect(logger.log).toHaveBeenCalled();
    });
  });

  describe("Uncommitted changes", () => {
    it("should display modified files when working directory is dirty", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: false,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: ["file1.ts", "file2.ts"],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(false);

      await statusCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Modified:"),
      );
    });

    it("should display created files", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: false,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: ["new-file.ts"],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(false);

      await statusCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Created:"),
      );
    });

    it("should display deleted files", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: false,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: ["old-file.ts"],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(false);

      await statusCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Deleted:"),
      );
    });

    it("should display untracked files", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: false,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        not_added: ["untracked.ts"],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(false);

      await statusCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Untracked:"),
      );
    });
  });

  describe("Configuration status", () => {
    it("should display config exists message when .gpm.yml present", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: true,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(true);
      mockConfigServiceInstance.getConfig.mockResolvedValue({
        ci: { waitForChecks: true, failFast: false },
        security: { scanSecrets: true },
        branchProtection: { enabled: true },
      });

      await statusCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(".gpm.yml"),
      );
    });

    it("should display not initialized message when .gpm.yml missing", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: true,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(false);

      await statusCommand();

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Not initialized"),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("gpm init"),
      );
    });
  });

  describe("Next steps suggestions", () => {
    it("should suggest init when no config exists", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: true,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(false);

      await statusCommand();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("gpm init --interactive"),
      );
    });

    it("should suggest feature command when on main branch", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "main",
        isClean: true,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(true);
      mockConfigServiceInstance.getConfig.mockResolvedValue({});

      await statusCommand();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("gpm feature"),
      );
    });

    it("should suggest commit when on feature branch with uncommitted changes", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: false,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: ["file.ts"],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(true);
      mockConfigServiceInstance.getConfig.mockResolvedValue({});

      await statusCommand();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("git add"),
      );
    });

    it("should suggest ship command when on clean feature branch", async () => {
      mockGitServiceInstance.getBranchInfo.mockResolvedValue({
        current: "feature/test",
        isClean: true,
      });

      mockGitServiceInstance.getStatus.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        not_added: [],
      });

      mockConfigServiceInstance.exists.mockResolvedValue(true);
      mockConfigServiceInstance.getConfig.mockResolvedValue({});

      await statusCommand();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("gpm ship"),
      );
    });
  });

  describe("Error handling", () => {
    it("should handle errors gracefully", async () => {
      mockGitServiceInstance.getBranchInfo.mockRejectedValue(
        new Error("Git error"),
      );

      const exitSpy = jest
        .spyOn(process, "exit")
        .mockImplementation((() => {}) as any);

      await statusCommand();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get status"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });
});
