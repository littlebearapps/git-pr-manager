/**
 * Tests for CommandResolver
 *
 * Phase 1a: Foundation - Command Resolution
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { CommandResolver } from "../../src/services/CommandResolver";
import { LanguageDetectionService } from "../../src/services/LanguageDetectionService";

// Mock LanguageDetectionService
jest.mock("../../src/services/LanguageDetectionService");

const MockedLanguageDetectionService =
  LanguageDetectionService as jest.MockedClass<typeof LanguageDetectionService>;

describe("CommandResolver", () => {
  let resolver: CommandResolver;
  let mockLanguageDetector: jest.Mocked<LanguageDetectionService>;
  const testDir = "/test/project";

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instance
    mockLanguageDetector = {
      getToolCommands: jest.fn(),
      checkToolAvailable: jest.fn(),
      getMakefileTargets: jest.fn(),
      detectLanguage: jest.fn(),
      detectPackageManager: jest.fn(),
      detectWorkspaceRoot: jest.fn(),
    } as any;

    // Configure default return values
    mockLanguageDetector.detectWorkspaceRoot.mockResolvedValue(null);

    // Mock constructor to return our mock instance
    MockedLanguageDetectionService.mockImplementation(
      () => mockLanguageDetector,
    );

    resolver = new CommandResolver(testDir);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with working directory", () => {
      expect(MockedLanguageDetectionService).toHaveBeenCalledWith(testDir);
    });

    it("should initialize with default working directory", () => {
      jest.clearAllMocks();
      new CommandResolver();
      expect(MockedLanguageDetectionService).toHaveBeenCalledWith(
        process.cwd(),
      );
    });
  });

  describe("resolve", () => {
    it("should prioritize custom config command", async () => {
      const config = {
        commands: {
          lint: "custom-lint-command",
        },
      };

      const result = await resolver.resolve({
        task: "lint",
        language: "python",
        config,
      });

      expect(result).toEqual({
        command: "custom-lint-command",
        source: "config",
        language: "python",
        packageManager: undefined,
      });

      // Should not call language detector
      expect(mockLanguageDetector.getToolCommands).not.toHaveBeenCalled();
    });

    it("should use Makefile target when preferMakefile is true", async () => {
      const config = {
        preferMakefile: true,
      };

      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["ruff check ."],
        test: ["pytest"],
        install: ["pip install -r requirements.txt"],
      });

      const result = await resolver.resolve({
        task: "lint",
        language: "python",
        config,
        makefileTargets: ["lint", "test", "build"],
      });

      expect(result).toEqual({
        command: "make lint",
        source: "makefile",
        language: "python",
        packageManager: undefined,
      });
    });

    it("should use custom Makefile target mapping", async () => {
      const config = {
        preferMakefile: true,
        makefileTargets: {
          lint: "check",
        },
      };

      const result = await resolver.resolve({
        task: "lint",
        language: "python",
        config,
        makefileTargets: ["check", "test"],
      });

      expect(result).toEqual({
        command: "make check",
        source: "makefile",
        language: "python",
        packageManager: undefined,
      });
    });

    // Phase 1b: Makefile alias tests
    it("should use Makefile alias when target name differs", async () => {
      const config = {
        preferMakefile: true,
        makefileAliases: {
          check: "test" as const,
          verify: "lint" as const,
        },
      };

      // Looking for 'test' task, but Makefile has 'check'
      const result = await resolver.resolve({
        task: "test",
        language: "python",
        config,
        makefileTargets: ["check", "verify", "build"],
      });

      expect(result).toEqual({
        command: "make check",
        source: "makefile",
        language: "python",
        packageManager: undefined,
      });
    });

    it("should prefer default target name over alias", async () => {
      const config = {
        preferMakefile: true,
        makefileAliases: {
          check: "test" as const,
        },
      };

      // Makefile has both 'test' and 'check', should prefer direct match
      const result = await resolver.resolve({
        task: "test",
        language: "python",
        config,
        makefileTargets: ["test", "check", "build"],
      });

      expect(result).toEqual({
        command: "make test",
        source: "makefile",
        language: "python",
        packageManager: undefined,
      });
    });

    it("should handle multiple aliases correctly", async () => {
      const config = {
        preferMakefile: true,
        makefileAliases: {
          check: "test" as const,
          verify: "lint" as const,
          compile: "build" as const,
        },
      };

      // Test lint task with verify alias
      const lintResult = await resolver.resolve({
        task: "lint",
        language: "nodejs",
        config,
        makefileTargets: ["verify", "check", "compile"],
      });

      expect(lintResult).toEqual({
        command: "make verify",
        source: "makefile",
        language: "nodejs",
        packageManager: undefined,
      });

      // Test build task with compile alias
      const buildResult = await resolver.resolve({
        task: "build",
        language: "nodejs",
        config,
        makefileTargets: ["verify", "check", "compile"],
      });

      expect(buildResult).toEqual({
        command: "make compile",
        source: "makefile",
        language: "nodejs",
        packageManager: undefined,
      });
    });

    it("should fall through to package manager when Makefile target not found", async () => {
      const config = {
        preferMakefile: true,
      };

      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["ruff check ."],
        test: ["pytest"],
        install: ["pip install -r requirements.txt"],
      });

      mockLanguageDetector.checkToolAvailable.mockResolvedValue(true);

      const result = await resolver.resolve({
        task: "lint",
        language: "python",
        packageManager: "pip",
        config,
        makefileTargets: ["test", "build"], // No 'lint' target
      });

      expect(result).toEqual({
        command: "ruff check .",
        source: "package-manager", // Changed from 'native' to 'package-manager'
        language: "python",
        packageManager: "pip",
      });
    });

    it("should use package manager command when available", async () => {
      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["npm run lint", "npx eslint ."],
        test: ["npm test"],
        install: ["npm ci"],
      });

      mockLanguageDetector.checkToolAvailable.mockResolvedValue(true);

      const result = await resolver.resolve({
        task: "lint",
        language: "nodejs",
        packageManager: "npm",
      });

      expect(result).toEqual({
        command: "npm run lint",
        source: "package-manager",
        language: "nodejs",
        packageManager: "npm",
      });

      expect(mockLanguageDetector.checkToolAvailable).toHaveBeenCalledWith(
        "npm",
      );
    });

    it("should fall back to next command when tool not available", async () => {
      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["npm run lint", "npx eslint ."],
        test: ["npm test"],
        install: ["npm ci"],
      });

      // First tool (npm) not available, second tool (npx) available
      mockLanguageDetector.checkToolAvailable
        .mockResolvedValueOnce(false) // npm not found
        .mockResolvedValueOnce(true); // npx found

      const result = await resolver.resolve({
        task: "lint",
        language: "nodejs",
        packageManager: "npm",
      });

      expect(result).toEqual({
        command: "npx eslint .",
        source: "package-manager",
        language: "nodejs",
        packageManager: "npm",
      });

      expect(mockLanguageDetector.checkToolAvailable).toHaveBeenCalledTimes(2);
    });

    it("should skip make commands when preferMakefile is true", async () => {
      const config = {
        preferMakefile: true,
      };

      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["make lint", "ruff check ."],
        test: ["pytest"],
        install: ["pip install -r requirements.txt"],
      });

      mockLanguageDetector.checkToolAvailable.mockResolvedValue(true);

      const result = await resolver.resolve({
        task: "lint",
        language: "python",
        config,
        makefileTargets: [], // No Makefile
      });

      // Should skip 'make lint' and use 'ruff check .'
      expect(result).toEqual({
        command: "ruff check .",
        source: "native",
        language: "python",
        packageManager: undefined,
      });
    });

    it("should return not-found when no commands available", async () => {
      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["ruff check ."],
        test: ["pytest"],
        install: ["pip install -r requirements.txt"],
      });

      mockLanguageDetector.checkToolAvailable.mockResolvedValue(false);

      const result = await resolver.resolve({
        task: "lint",
        language: "python",
      });

      expect(result).toEqual({
        command: "",
        source: "not-found",
        language: "python",
        packageManager: undefined,
        optional: false,
      });
    });

    it("should handle empty command chain", async () => {
      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: [], // Empty command chain
        test: ["pytest"],
        install: ["pip install -r requirements.txt"],
      });

      const result = await resolver.resolve({
        task: "lint",
        language: "python",
      });

      expect(result).toEqual({
        command: "",
        source: "not-found",
        language: "python",
        packageManager: undefined,
        optional: false,
      });
    });

    it("should work with Go language", async () => {
      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["make lint", "golangci-lint run"],
        test: ["go test ./..."],
        build: ["go build"],
        install: ["go mod download"],
      });

      mockLanguageDetector.checkToolAvailable.mockResolvedValue(true);

      const result = await resolver.resolve({
        task: "lint",
        language: "go",
        packageManager: "go-mod",
        makefileTargets: ["lint", "test"], // Added makefileTargets
      });

      expect(result.command).toBe("make lint");
      expect(result.language).toBe("go");
    });

    it("should work with Rust language", async () => {
      mockLanguageDetector.getToolCommands.mockResolvedValue({
        lint: ["cargo clippy"],
        test: ["cargo test"],
        build: ["cargo build"],
        install: ["cargo fetch"],
      });

      mockLanguageDetector.checkToolAvailable.mockResolvedValue(true);

      const result = await resolver.resolve({
        task: "lint",
        language: "rust",
        packageManager: "cargo",
      });

      expect(result.command).toBe("cargo clippy");
      expect(result.language).toBe("rust");
    });
  });

  describe("getSuggestedInstallCommand", () => {
    it("should return install command for ruff (Python)", () => {
      const suggestion = resolver.getSuggestedInstallCommand("ruff", "python");
      expect(suggestion).toBe("pip install ruff");
    });

    it("should return install command for pytest (Python)", () => {
      const suggestion = resolver.getSuggestedInstallCommand(
        "pytest",
        "python",
      );
      expect(suggestion).toBe("pip install pytest");
    });

    it("should return install command for mypy (Python)", () => {
      const suggestion = resolver.getSuggestedInstallCommand("mypy", "python");
      expect(suggestion).toBe("pip install mypy");
    });

    it("should return install command for eslint (Node.js)", () => {
      const suggestion = resolver.getSuggestedInstallCommand(
        "eslint",
        "nodejs",
      );
      expect(suggestion).toBe("npm install -D eslint");
    });

    it("should return install command for golangci-lint (Go)", () => {
      const suggestion = resolver.getSuggestedInstallCommand(
        "golangci-lint",
        "go",
      );
      expect(suggestion).toBe(
        "go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest",
      );
    });

    it("should return null for unknown tool", () => {
      const suggestion = resolver.getSuggestedInstallCommand(
        "unknown-tool",
        "python",
      );
      expect(suggestion).toBeNull();
    });

    it("should return null for tool in wrong language", () => {
      // pytest only has Python install command, not Node.js
      const suggestion = resolver.getSuggestedInstallCommand(
        "pytest",
        "nodejs",
      );
      expect(suggestion).toBeNull();
    });
  });

  describe("getDetectionSummary", () => {
    it("should generate summary for Python with package manager", async () => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([
        "lint",
        "test",
        "build",
      ]);

      const summary = await resolver.getDetectionSummary("python", "poetry");

      expect(summary).toContain("Language: python");
      expect(summary).toContain("Package Manager: poetry");
      expect(summary).toContain("Makefile Targets: lint, test, build");
    });

    it("should generate summary without package manager", async () => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([
        "lint",
        "test",
      ]);

      const summary = await resolver.getDetectionSummary("nodejs");

      expect(summary).toContain("Language: nodejs");
      expect(summary).not.toContain("Package Manager:");
      expect(summary).toContain("Makefile Targets: lint, test");
    });

    it("should handle no Makefile", async () => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([]);

      const summary = await resolver.getDetectionSummary("go", "go-mod");

      expect(summary).toContain("Language: go");
      expect(summary).toContain("Package Manager: go-mod");
      expect(summary).toContain("Makefile: Not found");
    });

    it("should include section header and divider", async () => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([]);

      const summary = await resolver.getDetectionSummary("rust", "cargo");

      expect(summary).toContain("▸ Detection Summary");
      expect(summary).toContain("─".repeat(80));
    });
  });
});
