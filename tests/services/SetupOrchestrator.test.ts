import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { SetupOrchestrator } from "../../src/services/SetupOrchestrator";
import { ToolDetector } from "../../src/services/ToolDetector";
import {
  KeychainIntegration,
  StorageMethod,
} from "../../src/services/KeychainIntegration";
import prompts from "prompts";
import * as fs from "fs";

// Mock dependencies
jest.mock("../../src/services/ToolDetector");
jest.mock("../../src/services/KeychainIntegration");
jest.mock("child_process");
jest.mock("prompts");
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const mockPrompts = prompts as jest.MockedFunction<typeof prompts>;
const mockFs = fs as jest.Mocked<typeof fs>;

const mockedToolDetector = ToolDetector as jest.MockedClass<
  typeof ToolDetector
>;
const mockedKeychain = KeychainIntegration as jest.MockedClass<
  typeof KeychainIntegration
>;

describe("SetupOrchestrator", () => {
  let orchestrator: SetupOrchestrator;
  let mockDetectorInstance: any;
  let mockKeychainInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ToolDetector instance
    mockDetectorInstance = {
      generateDoctorResponse: jest.fn(),
    };

    // Mock KeychainIntegration instance
    mockKeychainInstance = {
      detectAvailableMethods: jest.fn(),
      validateToken: jest.fn(),
      storeToken: jest.fn(),
    };

    mockedToolDetector.mockImplementation(() => mockDetectorInstance);
    mockedKeychain.mockImplementation(() => mockKeychainInstance);

    orchestrator = new SetupOrchestrator();
  });

  describe("runInteractiveSetup", () => {
    it("should complete successfully when all checks pass", async () => {
      // Mock doctor response - all checks OK
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "ok",
        checks: [
          { id: "github.token", status: "ok", details: "Token found" },
          { id: "tool.git", status: "ok", details: "git version 2.51.0" },
          { id: "tool.node", status: "ok", details: "v20.10.0" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      expect(report.overallStatus).toBe("success");
      expect(report.steps).toHaveLength(1); // Only token setup step
      expect(report.steps[0].status).toBe("completed");
      expect(report.recommendations).toHaveLength(0);
    });

    it("should prompt for GitHub token when not found", async () => {
      // Mock doctor response - token missing
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "github.token",
            status: "missing",
            details: "GitHub token not found",
            recommendedAction: "run:gpm setup github-token",
          },
          { id: "tool.git", status: "ok", details: "git version 2.51.0" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // User declines token setup
      mockPrompts.mockResolvedValueOnce({ setupToken: false });

      // Mock config check - no config
      mockFs.existsSync.mockReturnValue(false);

      // User declines config creation
      mockPrompts.mockResolvedValueOnce({ createConfig: false });

      const report = await orchestrator.runInteractiveSetup();

      expect(report.steps.length).toBeGreaterThan(0);
      const tokenStep = report.steps.find(
        (s) => s.name === "GitHub Token Setup",
      );
      expect(tokenStep?.status).toBe("skipped");
      expect(report.recommendations).toContain(
        "Set up GitHub token later: gpm setup github-token",
      );
    });

    it("should setup GitHub token when user confirms", async () => {
      // Mock doctor response - token missing
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "github.token", status: "missing", details: "Token not found" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // User confirms token setup
      mockPrompts
        .mockResolvedValueOnce({ setupToken: true })
        // Provide token
        .mockResolvedValueOnce({ token: "ghp_test_token_123" })
        // Choose storage method
        .mockResolvedValueOnce({ method: StorageMethod.ENV_FILE });

      // Mock keychain methods
      mockKeychainInstance.detectAvailableMethods.mockResolvedValue([
        {
          method: StorageMethod.ENV_FILE,
          available: true,
          priority: 1,
          description: ".env file",
          security: "low" as const,
        },
      ]);

      mockKeychainInstance.validateToken.mockResolvedValue({
        valid: true,
        scopes: ["repo"],
        message: "Token valid",
      });

      mockKeychainInstance.storeToken.mockResolvedValue({
        method: StorageMethod.ENV_FILE,
        success: true,
        message: "Token stored",
      });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      const tokenStep = report.steps.find(
        (s) => s.name === "GitHub Token Setup",
      );
      expect(tokenStep?.status).toBe("completed");
      expect(mockKeychainInstance.validateToken).toHaveBeenCalledWith(
        "ghp_test_token_123",
      );
      expect(mockKeychainInstance.storeToken).toHaveBeenCalled();
    });

    it("should handle token setup failure gracefully", async () => {
      // Mock doctor response - token missing
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "github.token", status: "missing", details: "Token not found" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // User confirms token setup
      mockPrompts
        .mockResolvedValueOnce({ setupToken: true })
        .mockResolvedValueOnce({ token: "ghp_invalid" })
        .mockResolvedValueOnce({ method: StorageMethod.ENV_FILE });

      // Token validation fails
      mockKeychainInstance.detectAvailableMethods.mockResolvedValue([
        {
          method: StorageMethod.ENV_FILE,
          available: true,
          priority: 1,
          description: ".env file",
          security: "low" as const,
        },
      ]);

      mockKeychainInstance.validateToken.mockResolvedValue({
        valid: false,
        message: "Invalid token",
      });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      const tokenStep = report.steps.find(
        (s) => s.name === "GitHub Token Setup",
      );
      expect(tokenStep?.status).toBe("failed");
      expect(tokenStep?.message).toContain("Failed to setup token");
      expect(report.recommendations).toContain(
        "Set up GitHub token manually: gpm setup github-token",
      );
    });

    it("should detect missing required tools", async () => {
      // Mock doctor response - git missing
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "errors",
        checks: [
          { id: "github.token", status: "ok", details: "Token found" },
          {
            id: "tool.git",
            status: "missing",
            details: "git not found",
            recommendedAction: "install:brew install git",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      expect(report.overallStatus).toBe("failed");
      const gitStep = report.steps.find((s) => s.name === "Install git");
      expect(gitStep?.status).toBe("failed");
      expect(report.recommendations).toContain(
        "Install git: install:brew install git",
      );
    });

    it("should handle missing optional tools", async () => {
      // Mock doctor response - gh missing (optional)
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "github.token", status: "ok", details: "Token found" },
          { id: "tool.git", status: "ok", details: "git version 2.51.0" },
          {
            id: "tool.gh",
            status: "missing",
            details: "gh not found",
            recommendedAction: "install:brew install gh",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // User declines optional tool installation
      mockPrompts.mockResolvedValueOnce({ installOptional: false });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      expect(report.recommendations).toContainEqual(
        expect.stringContaining("gh: install:brew install gh"),
      );
    });

    it("should detect missing package.json scripts", async () => {
      // Mock doctor response - test script missing
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "github.token", status: "ok", details: "Token found" },
          {
            id: "script.test",
            status: "missing",
            details: "Script 'test' not found",
            recommendedAction: "add-script:test:jest",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      const scriptStep = report.steps.find(
        (s) => s.name === "Add npm script: test",
      );
      expect(scriptStep?.status).toBe("skipped");
      expect(report.recommendations).toContainEqual(
        expect.stringContaining('Add to package.json scripts: "test": "jest"'),
      );
    });

    it("should create configuration when user confirms", async () => {
      // Mock doctor response - all OK
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "ok",
        checks: [{ id: "github.token", status: "ok", details: "Token found" }],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // No config file exists
      mockFs.existsSync.mockReturnValue(false);

      // User confirms config creation
      mockPrompts.mockResolvedValueOnce({ createConfig: true });

      const report = await orchestrator.runInteractiveSetup();

      const configStep = report.steps.find((s) => s.name === "Create .gpm.yml");
      expect(configStep?.status).toBe("completed");
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        ".gpm.yml",
        expect.stringContaining("github:"),
      );
    });

    it("should handle configuration creation failure", async () => {
      // Mock doctor response
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "ok",
        checks: [{ id: "github.token", status: "ok", details: "Token found" }],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // No config file
      mockFs.existsSync.mockReturnValue(false);

      // User confirms but writeFileSync fails
      mockPrompts.mockResolvedValueOnce({ createConfig: true });
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const report = await orchestrator.runInteractiveSetup();

      const configStep = report.steps.find((s) => s.name === "Create .gpm.yml");
      expect(configStep?.status).toBe("failed");
      expect(report.recommendations).toContain(
        "Create configuration manually: gpm init",
      );
    });
  });

  describe("runAutomatedSetup", () => {
    it("should generate report from doctor response", async () => {
      // Mock doctor response
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "ok",
        checks: [
          { id: "github.token", status: "ok", details: "Token found" },
          { id: "tool.git", status: "ok", details: "git version 2.51.0" },
          { id: "tool.node", status: "ok", details: "v20.10.0" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      const report = await orchestrator.runAutomatedSetup();

      expect(report.overallStatus).toBe("success");
      expect(report.steps).toHaveLength(3);
      expect(report.steps.every((s) => s.status === "completed")).toBe(true);
      expect(report.recommendations).toHaveLength(0);
    });

    it("should mark missing tools as failed", async () => {
      // Mock doctor response - some tools missing
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "tool.git",
            status: "missing",
            details: "git not found",
            recommendedAction: "install:brew install git",
          },
          { id: "tool.node", status: "ok", details: "v20.10.0" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      const report = await orchestrator.runAutomatedSetup();

      expect(report.overallStatus).toBe("failed");
      const gitStep = report.steps.find((s) => s.name === "tool.git");
      expect(gitStep?.status).toBe("failed");
      expect(report.recommendations).toContain(
        "tool.git: install:brew install git",
      );
    });

    it("should include recommendations for all non-ok checks", async () => {
      // Mock doctor response
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "tool.gh",
            status: "missing",
            details: "gh not found",
            recommendedAction: "install:brew install gh",
          },
          {
            id: "script.test",
            status: "missing",
            details: "Test script missing",
            recommendedAction: "add-script:test:jest",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      const report = await orchestrator.runAutomatedSetup();

      expect(report.recommendations).toHaveLength(2);
      expect(report.recommendations).toContain(
        "tool.gh: install:brew install gh",
      );
      expect(report.recommendations).toContain(
        "script.test: add-script:test:jest",
      );
    });

    it("should return partial status when some checks fail", async () => {
      // Mock doctor response - warnings status with incompatible tool (not missing)
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "tool.git", status: "ok", details: "git version 2.51.0" },
          {
            id: "tool.node",
            status: "incompatible",
            details: "Node version too old",
            recommendedAction: "update:brew upgrade node",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      const report = await orchestrator.runAutomatedSetup();

      expect(report.overallStatus).toBe("partial");
      const nodeStep = report.steps.find((s) => s.name === "tool.node");
      expect(nodeStep?.status).toBe("skipped"); // incompatible becomes skipped, not failed
    });
  });

  describe("edge cases", () => {
    it("should handle no token provided during setup", async () => {
      // Mock doctor response
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "github.token", status: "missing", details: "Token not found" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // User confirms token setup
      mockPrompts
        .mockResolvedValueOnce({ setupToken: true })
        // But doesn't provide a token (cancel prompt)
        .mockResolvedValueOnce({ token: undefined });

      mockKeychainInstance.detectAvailableMethods.mockResolvedValue([]);

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      const tokenStep = report.steps.find(
        (s) => s.name === "GitHub Token Setup",
      );
      expect(tokenStep?.status).toBe("failed");
    });

    it("should handle invalid token format", async () => {
      // Mock doctor response
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "github.token", status: "missing", details: "Token not found" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // User provides invalid token
      mockPrompts
        .mockResolvedValueOnce({ setupToken: true })
        .mockResolvedValueOnce({ token: "invalid_format" })
        .mockResolvedValueOnce({ method: StorageMethod.ENV_FILE });

      mockKeychainInstance.detectAvailableMethods.mockResolvedValue([
        {
          method: StorageMethod.ENV_FILE,
          available: true,
          priority: 1,
          description: ".env file",
          security: "low" as const,
        },
      ]);

      // Validation will fail
      mockKeychainInstance.validateToken.mockResolvedValue({
        valid: false,
        message: "Invalid token",
      });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      const tokenStep = report.steps.find(
        (s) => s.name === "GitHub Token Setup",
      );
      expect(tokenStep?.status).toBe("failed");
    });

    it("should handle storage method selection cancellation", async () => {
      // Mock doctor response
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          { id: "github.token", status: "missing", details: "Token not found" },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      // User provides token but cancels method selection
      mockPrompts
        .mockResolvedValueOnce({ setupToken: true })
        .mockResolvedValueOnce({ token: "ghp_test" })
        .mockResolvedValueOnce({ method: undefined }); // User cancels

      mockKeychainInstance.detectAvailableMethods.mockResolvedValue([
        {
          method: StorageMethod.ENV_FILE,
          available: true,
          priority: 1,
          description: ".env file",
          security: "low" as const,
        },
      ]);

      mockKeychainInstance.validateToken.mockResolvedValue({
        valid: true,
        scopes: ["repo"],
      });

      // Mock config check
      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      const tokenStep = report.steps.find(
        (s) => s.name === "GitHub Token Setup",
      );
      expect(tokenStep?.status).toBe("failed");
    });

    it("should include timestamp in reports", async () => {
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "ok",
        checks: [{ id: "github.token", status: "ok", details: "Token found" }],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      mockFs.existsSync.mockReturnValue(true);

      const report = await orchestrator.runInteractiveSetup();

      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe("tool installation suggestions", () => {
    it("should skip suggestions when no tools are missing", async () => {
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "ok",
        checks: [{ id: "tool.git", status: "ok", details: "Git found" }],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      mockFs.existsSync.mockReturnValue(true);
      mockPrompts
        .mockResolvedValueOnce({ setupToken: false })
        .mockResolvedValueOnce({ installOptional: false });

      const report = await orchestrator.runInteractiveSetup();

      expect(report.steps).toBeDefined();
    });

    it("should handle missing tools without install commands", async () => {
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "tool.custom",
            status: "missing",
            details: "Custom tool not found",
            recommendedAction: "Please install manually",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      mockFs.existsSync.mockReturnValue(true);
      mockPrompts
        .mockResolvedValueOnce({ setupToken: false })
        .mockResolvedValueOnce({ installOptional: false });

      const report = await orchestrator.runInteractiveSetup();

      expect(report.steps).toBeDefined();
    });

    it("should parse npm install commands", async () => {
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "tool.eslint",
            status: "missing",
            details: "ESLint not found",
            recommendedAction: "install:npm install -g eslint",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      mockFs.existsSync.mockReturnValue(true);
      mockPrompts
        .mockResolvedValueOnce({ installOptional: false })
        .mockResolvedValueOnce({ runInstall: false });

      const report = await orchestrator.runInteractiveSetup();

      expect(report.steps).toBeDefined();
      expect(mockPrompts).toHaveBeenCalled();
    });

    it("should parse pip install commands", async () => {
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "tool.detect-secrets",
            status: "missing",
            details: "detect-secrets not found",
            recommendedAction: "install:pip install detect-secrets",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      mockFs.existsSync.mockReturnValue(true);
      mockPrompts
        .mockResolvedValueOnce({ installOptional: false })
        .mockResolvedValueOnce({ runInstall: false });

      await orchestrator.runInteractiveSetup();

      expect(mockPrompts).toHaveBeenCalled();
    });

    it("should parse brew install commands", async () => {
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "tool.gh",
            status: "missing",
            details: "GitHub CLI not found",
            recommendedAction: "install:brew install gh",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "darwin",
        },
      });

      mockFs.existsSync.mockReturnValue(true);
      mockPrompts
        .mockResolvedValueOnce({ installOptional: false })
        .mockResolvedValueOnce({ runInstall: false });

      await orchestrator.runInteractiveSetup();

      expect(mockPrompts).toHaveBeenCalled();
    });

    it("should parse apt install commands", async () => {
      mockDetectorInstance.generateDoctorResponse.mockResolvedValue({
        status: "warnings",
        checks: [
          {
            id: "tool.git",
            status: "missing",
            details: "Git not found",
            recommendedAction: "install:apt install git",
          },
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          gpm_version: "0.0.0-development",
          platform: "linux",
        },
      });

      mockFs.existsSync.mockReturnValue(true);
      mockPrompts
        .mockResolvedValueOnce({ installOptional: false })
        .mockResolvedValueOnce({ runInstall: false });

      await orchestrator.runInteractiveSetup();

      expect(mockPrompts).toHaveBeenCalled();
    });
  });
});
