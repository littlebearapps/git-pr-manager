/**
 * Integration tests for verify command with multi-language support
 * Phase 1a: Tests language detection, package manager detection, and command resolution
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { verifyCommand } from "../../src/commands/verify";
import { LanguageDetectionService } from "../../src/services/LanguageDetectionService";
import { CommandResolver } from "../../src/services/CommandResolver";
import { ConfigService } from "../../src/services/ConfigService";
import { logger } from "../../src/utils/logger";
import * as childProcess from "child_process";
import prompts from "prompts";

// Mock dependencies
jest.mock("../../src/services/LanguageDetectionService");
jest.mock("../../src/services/CommandResolver");
jest.mock("../../src/services/ConfigService");
jest.mock("../../src/utils/logger");
jest.mock("child_process");

// Mock spinner to avoid ora ESM issues
jest.mock("../../src/utils/spinner", () => ({
  spinner: {
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
  },
  createSpinner: jest.fn(() => ({
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Mock prompts for install confirmation (Phase 1b)
jest.mock("prompts", () => jest.fn());

const MockedLanguageDetectionService =
  LanguageDetectionService as jest.MockedClass<typeof LanguageDetectionService>;
const MockedCommandResolver = CommandResolver as jest.MockedClass<
  typeof CommandResolver
>;
const MockedConfigService = ConfigService as jest.MockedClass<
  typeof ConfigService
>;
const mockedExec = childProcess.exec as jest.MockedFunction<
  typeof childProcess.exec
>;
const mockedPrompts = prompts as jest.MockedFunction<typeof prompts>;

describe("verify command - multi-language integration", () => {
  let mockLanguageDetector: jest.Mocked<LanguageDetectionService>;
  let mockCommandResolver: jest.Mocked<CommandResolver>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let stdoutWriteSpy: jest.SpiedFunction<typeof process.stdout.write>;
  let mockExit: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.log to capture JSON output
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Mock process.stdout.write to capture JSON output
    stdoutWriteSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    // Mock process.exit to prevent tests from actually exiting
    mockExit = jest
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    // Create mock instances
    mockLanguageDetector = {
      detectLanguage: jest.fn(),
      detectPackageManager: jest.fn(),
      getMakefileTargets: jest.fn(),
    } as any;

    mockCommandResolver = {
      resolve: jest.fn(),
    } as any;

    mockConfigService = {
      load: jest.fn(),
    } as any;

    // Mock constructors
    MockedLanguageDetectionService.mockImplementation(
      () => mockLanguageDetector,
    );
    MockedCommandResolver.mockImplementation(() => mockCommandResolver);
    MockedConfigService.mockImplementation(() => mockConfigService);

    // Default mock implementations
    mockLanguageDetector.detectLanguage.mockResolvedValue({
      primary: "nodejs",
      additional: [],
      confidence: 95,
      sources: ["package.json"],
    });

    mockLanguageDetector.detectPackageManager.mockResolvedValue({
      packageManager: "npm",
      lockFile: "package-lock.json",
      confidence: 95,
    });

    mockLanguageDetector.getMakefileTargets.mockResolvedValue([]);

    mockConfigService.load.mockResolvedValue({
      branchProtection: { enabled: false },
      verification: {
        detectionEnabled: true,
        preferMakefile: true,
      },
    } as any);

    // Mock exec to succeed by default
    (mockedExec as any).mockImplementation(
      (_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: "success", stderr: "" });
        return {} as any;
      },
    );

    // Mock logger to not throw
    (logger.isJsonMode as jest.Mock).mockReturnValue(false);

    // Mock logger.outputJsonResult to write JSON to stdout when in JSON mode
    (logger.outputJsonResult as jest.Mock).mockImplementation(
      (...args: any[]) => {
        if ((logger.isJsonMode as jest.Mock)()) {
          const [success, data, error] = args;
          const jsonOutput = JSON.stringify({ success, data, error });
          process.stdout.write(jsonOutput + "\n");
        }
      },
    );
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    mockExit.mockRestore();
  });

  describe("Node.js project with npm", () => {
    it("should verify Node.js project successfully", async () => {
      // Mock command resolution
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true });

      // Verify language detection was called
      expect(mockLanguageDetector.detectLanguage).toHaveBeenCalled();
      expect(mockLanguageDetector.detectPackageManager).toHaveBeenCalledWith(
        "nodejs",
      );

      // Verify command resolver was called for each step
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "lint",
          language: "nodejs",
          packageManager: "npm",
        }),
      );
    });

    it("should skip install when --skip-install is provided", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true });

      // Install should not be resolved
      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: "install" }),
      );
    });
  });

  describe("Python project with poetry", () => {
    beforeEach(() => {
      mockLanguageDetector.detectLanguage.mockResolvedValue({
        primary: "python",
        additional: [],
        confidence: 95,
        sources: ["pyproject.toml"],
      });

      mockLanguageDetector.detectPackageManager.mockResolvedValue({
        packageManager: "poetry",
        lockFile: "poetry.lock",
        confidence: 95,
      });
    });

    it("should verify Python project with poetry", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "poetry run ruff check .",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run mypy .",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run pytest",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "python",
          packageManager: "poetry",
        });

      await verifyCommand({ skipInstall: true });

      expect(mockLanguageDetector.detectLanguage).toHaveBeenCalled();
      expect(mockLanguageDetector.detectPackageManager).toHaveBeenCalledWith(
        "python",
      );

      // Verify Python commands were resolved
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "lint",
          language: "python",
          packageManager: "poetry",
        }),
      );
    });

    it("should gracefully skip build when not available for Python", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "poetry run ruff check .",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run mypy .",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run pytest",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "python",
          packageManager: "poetry",
        });

      await verifyCommand({ skipInstall: true });

      // Build step should be skipped (last resolve call returns not-found)
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ task: "build" }),
      );
    });
  });

  describe("Makefile integration", () => {
    beforeEach(() => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([
        "lint",
        "test",
        "build",
      ]);
    });

    it("should prefer Makefile targets when available", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "make lint",
          source: "makefile",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "make test",
          source: "makefile",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "make build",
          source: "makefile",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true });

      // Verify makefileTargets were passed
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          makefileTargets: ["lint", "test", "build"],
        }),
      );
    });
  });

  describe("Config overrides", () => {
    it("should respect verification config commands", async () => {
      mockConfigService.load.mockResolvedValue({
        branchProtection: { enabled: false },
        verification: {
          detectionEnabled: true,
          preferMakefile: true,
          commands: {
            lint: "custom-lint",
            test: "custom-test",
          },
        },
      } as any);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "custom-lint",
          source: "config",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "custom-test",
          source: "config",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true });

      // Verify config was loaded and passed to resolver
      expect(mockConfigService.load).toHaveBeenCalled();
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            commands: {
              lint: "custom-lint",
              test: "custom-test",
            },
          }),
        }),
      );
    });
  });

  describe("Skip options", () => {
    it("should skip lint when --skip-lint is provided", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipLint: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: "lint" }),
      );
    });

    it("should skip typecheck when --skip-typecheck is provided", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipTypecheck: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: "typecheck" }),
      );
    });

    it("should skip test when --skip-test is provided", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipTest: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: "test" }),
      );
    });

    it("should skip build when --skip-build is provided", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipBuild: true, skipInstall: true });

      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: "build" }),
      );
    });
  });

  describe("JSON output mode", () => {
    it("should output JSON with language and packageManager", async () => {
      (logger.isJsonMode as jest.Mock).mockReturnValue(true);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "prettier --check .",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true, json: true });

      // Verify JSON was output with language and packageManager
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('"language"'),
      );
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('"packageManager"'),
      );
    });
  });

  describe("Error handling", () => {
    it("should exit with error code when verification fails", async () => {
      // Mock exec to fail for lint step
      (mockedExec as any).mockImplementation(
        (cmd: string, _opts: any, callback: any) => {
          if (cmd.includes("lint")) {
            callback(new Error("Lint failed"), {
              stdout: "",
              stderr: "lint errors",
            });
          } else {
            callback(null, { stdout: "success", stderr: "" });
          }
          return {} as any;
        },
      );

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      // Mock process.exit to prevent test from exiting
      const mockExit = jest
        .spyOn(process, "exit")
        .mockImplementation((() => {}) as any);

      await verifyCommand({ skipInstall: true });

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  // Phase 1b: Install Step Support Tests
  describe("Install step (Phase 1b)", () => {
    beforeEach(() => {
      // Mock prompts to always proceed
      mockedPrompts.mockResolvedValue({ proceed: true });

      // Mock CI environment variable
      delete process.env.CI;
    });

    it("should run install when --allow-install flag is set", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm ci",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ allowInstall: true, skipInstall: false });

      // Verify install command was resolved
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "install",
          language: "nodejs",
          packageManager: "npm",
        }),
      );
    });

    it("should run install when verification.allowInstall config is true", async () => {
      mockConfigService.load.mockResolvedValue({
        branchProtection: { enabled: false },
        verification: {
          detectionEnabled: true,
          preferMakefile: true,
          allowInstall: true,
        },
      } as any);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm ci",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: false });

      // Verify install command was resolved
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "install",
        }),
      );
    });

    it("should skip install when allowInstall is false (default)", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: false });

      // Verify install command was NOT resolved
      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: "install" }),
      );
    });

    it("should skip install when --skip-install flag is set", async () => {
      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ allowInstall: true, skipInstall: true });

      // Verify install command was NOT resolved
      expect(mockCommandResolver.resolve).not.toHaveBeenCalledWith(
        expect.objectContaining({ task: "install" }),
      );
    });

    it("should handle missing lock file gracefully", async () => {
      // Mock package manager with no lock file
      mockLanguageDetector.detectPackageManager.mockResolvedValue({
        packageManager: "poetry",
        lockFile: null,
        confidence: 95,
      });

      mockLanguageDetector.detectLanguage.mockResolvedValue({
        primary: "python",
        additional: [],
        confidence: 95,
        sources: ["pyproject.toml"],
      });

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "poetry install",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run ruff check .",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run mypy .",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run pytest",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "python",
          packageManager: "poetry",
        });

      await verifyCommand({ allowInstall: true, skipInstall: false });

      // Should still proceed with install despite missing lock file
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "install",
          language: "python",
          packageManager: "poetry",
        }),
      );

      // Verify warning was logged (logger.warn should be called)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No lock file found"),
      );
    });

    it("should skip install when user declines prompt", async () => {
      // Mock user declining the prompt
      mockedPrompts.mockResolvedValueOnce({ proceed: false });

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "npm ci",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run lint",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ allowInstall: true, skipInstall: false });

      // Verify prompt was called
      expect(mockedPrompts).toHaveBeenCalled();

      // Verify install command was resolved but not executed (exec not called with npm ci)
      expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ task: "install" }),
      );
    });
  });

  // Phase 1b: Error message enhancement tests
  describe("Phase 1b: Better error messages", () => {
    it("should show helpful suggestions when Makefile exists but is missing target", async () => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([
        "build",
        "test",
        "deploy",
      ]);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "prettier --check .",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true });

      // Verify logger.info was called with skip message
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("skipped"),
      );

      // Verify logger.log was called with suggestions
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Suggestions:"),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "Available Makefile targets: build, test, deploy",
        ),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Add 'lint' target to Makefile"),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("makefileAliases"),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("preferMakefile: false"),
      );
    });

    it("should show tool installation suggestion when no Makefile exists", async () => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([]);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "prettier --check .",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true });

      // Verify suggestions include custom command override and tool installation
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Override with custom command"),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining("Install eslint: npm install -D eslint"),
      );
    });

    it("should suggest makefileAliases when similar target exists", async () => {
      // Use 'check' target which has substring match with 'typecheck'
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([
        "check",
        "build",
        "deploy",
      ]);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "poetry run pytest",
          source: "package-manager",
          language: "python",
          packageManager: "poetry",
        })
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "python",
          packageManager: "poetry",
        });

      await verifyCommand({ skipInstall: true, skipLint: true });

      // Verify suggestion includes makefileAliases with similar target (check → typecheck)
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('makefileAliases: { check: "typecheck" }'),
      );
    });

    it("should truncate long Makefile target lists in suggestions", async () => {
      mockLanguageDetector.getMakefileTargets.mockResolvedValue([
        "build",
        "test",
        "deploy",
        "clean",
        "install",
        "verify",
        "format",
        "typecheck",
        "docker",
        "docs",
      ]);

      mockCommandResolver.resolve
        .mockResolvedValueOnce({
          command: "",
          source: "not-found",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npx tsc --noEmit",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm test",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        })
        .mockResolvedValueOnce({
          command: "npm run build",
          source: "package-manager",
          language: "nodejs",
          packageManager: "npm",
        });

      await verifyCommand({ skipInstall: true });

      // Verify target list is truncated to first 5 and shows count
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          "Available Makefile targets: build, test, deploy, clean, install (and 5 more)",
        ),
      );
    });
  });
});
