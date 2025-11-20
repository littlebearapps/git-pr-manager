// Mock dependencies first
jest.mock("child_process");
jest.mock("fs");
jest.mock("../../src/utils/logger", () => ({
  logger: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    blank: jest.fn(),
    section: jest.fn(),
    log: jest.fn(),
    divider: jest.fn(),
  },
}));

// Import after mocks are set up
import { doctorCommand } from "../../src/commands/doctor";
import { logger } from "../../src/utils/logger";
import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockedReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;
const mockedReaddirSync = readdirSync as jest.MockedFunction<
  typeof readdirSync
>;

describe("doctor command", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original environment
    originalEnv = { ...process.env };

    // Mock execSync for command existence checks
    mockedExecSync.mockImplementation(((cmd: string) => {
      // Default: most commands exist
      if (cmd.includes("command -v git")) return Buffer.from("");
      if (cmd.includes("command -v node")) return Buffer.from("");
      if (cmd.includes("command -v gh")) return Buffer.from("");
      if (cmd.includes("command -v npm")) return Buffer.from("");
      if (cmd.includes("command -v direnv")) return Buffer.from("");

      // Version commands
      if (cmd.includes("git --version"))
        return Buffer.from("git version 2.51.0");
      if (cmd.includes("node --version")) return Buffer.from("v20.10.0");
      if (cmd.includes("gh --version")) return Buffer.from("gh version 2.78.0");
      if (cmd.includes("npm --version")) return Buffer.from("11.6.0");

      // Optional tools not installed
      if (cmd.includes("detect-secrets") || cmd.includes("pip-audit")) {
        throw new Error("Command not found");
      }

      throw new Error("Command not found");
    }) as any);

    // Mock existsSync
    mockedExistsSync.mockImplementation((path: any) => {
      const pathStr = path.toString();

      // Keychain helper exists
      if (pathStr.includes("bin/kc.sh")) return true;

      // No .envrc or .env by default
      if (pathStr.includes(".envrc") || pathStr.includes(".env")) return false;

      return false;
    });
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe("GitHub token detection", () => {
    it("should detect GITHUB_TOKEN when set", async () => {
      process.env.GITHUB_TOKEN = "ghp_test_token";

      await doctorCommand();

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining("token: GitHub token found (GITHUB_TOKEN)"),
      );
    });

    it("should detect GH_TOKEN when set", async () => {
      delete process.env.GITHUB_TOKEN; // Ensure GITHUB_TOKEN is not set
      process.env.GH_TOKEN = "ghp_test_token";

      await doctorCommand();

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining("token: GitHub token found (GH_TOKEN)"),
      );
    });

    it("should suggest setup when no token is set", async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;

      await doctorCommand();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("gpm setup"),
      );
    });
  });

  describe("Tool detection integration", () => {
    it("should use ToolDetector for system health check", async () => {
      process.env.GITHUB_TOKEN = "test_token";

      await doctorCommand();

      // Verify doctor command runs and uses ToolDetector
      // ToolDetector handles all tool detection and output formatting
      expect(logger.section).toHaveBeenCalledWith("System Health Check");
      expect(logger.divider).toHaveBeenCalled();
    });

    it("should display Next Steps section", async () => {
      process.env.GITHUB_TOKEN = "test_token";

      await doctorCommand();

      // Verify Next Steps section with setup suggestion
      expect(logger.log).toHaveBeenCalledWith("Next Steps:");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("gpm setup"),
      );
    });
  });

  describe("Pre-release validation (--pre-release flag)", () => {
    beforeEach(() => {
      // Mock fs.readFileSync for reading files
      mockedReadFileSync.mockImplementation((path: any) => {
        const pathStr = path.toString();

        // README.md with valid badge
        if (pathStr.includes("README.md")) {
          return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
        }

        // .github/workflows/ci.yml
        if (pathStr.includes(".github/workflows/ci.yml")) {
          return "name: CI\non: push";
        }

        // .github/workflows/publish.yml
        if (pathStr.includes(".github/workflows/publish.yml")) {
          return "name: Release\non: push";
        }

        // package.json with placeholder version
        if (pathStr.includes("package.json")) {
          return JSON.stringify({ version: "0.0.0-development" });
        }

        // .releaserc.json without git plugin
        if (pathStr.includes(".releaserc.json")) {
          return JSON.stringify({
            plugins: [
              "@semantic-release/commit-analyzer",
              "@semantic-release/npm",
              "@semantic-release/github",
            ],
          });
        }

        return "";
      });

      // Mock fs.readdirSync for listing workflow files
      mockedReaddirSync.mockImplementation((path: any) => {
        if (path.toString().includes(".github/workflows")) {
          return ["ci.yml", "publish.yml"] as any;
        }
        return [] as any;
      });

      // Mock execSync for git commands
      mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
        // When encoding is specified, return string; otherwise return Buffer
        const hasEncoding = options && options.encoding;

        // Git status (clean working directory)
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding ? "" : Buffer.from("");
        }

        // Current branch (main)
        if (cmd.includes("git branch --show-current")) {
          return hasEncoding ? "main" : Buffer.from("main");
        }

        // Git rev-parse HEAD
        if (cmd.includes("git rev-parse HEAD")) {
          return hasEncoding ? "abc123def456" : Buffer.from("abc123def456");
        }

        // gh run list (all checks passed)
        if (cmd.includes("gh run list")) {
          const data = JSON.stringify([
            { status: "completed", conclusion: "success" },
            { status: "completed", conclusion: "success" },
          ]);
          return hasEncoding ? data : Buffer.from(data);
        }

        return hasEncoding ? "" : Buffer.from("");
      }) as any);

      // Mock existsSync for workflow files
      mockedExistsSync.mockImplementation((path: any) => {
        const pathStr = path.toString();

        // Required workflow files exist
        if (pathStr.includes(".github/workflows/ci.yml")) return true;
        if (pathStr.includes(".github/workflows/publish.yml")) return true;
        if (pathStr.includes(".github/workflows")) return true;

        // Config files exist
        if (pathStr.includes("README.md")) return true;
        if (pathStr.includes("package.json")) return true;
        if (pathStr.includes(".releaserc.json")) return true;

        return false;
      });
    });

    describe("All checks passing", () => {
      it("should pass pre-release validation when all checks succeed", async () => {
        // Ensure clean mock state - reset all mocks explicitly
        mockedExistsSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes(".github/workflows/ci.yml")) return true;
          if (pathStr.includes(".github/workflows/publish.yml")) return true;
          if (pathStr.includes(".github/workflows")) return true;
          if (pathStr.includes("README.md")) return true;
          if (pathStr.includes("package.json")) return true;
          if (pathStr.includes(".releaserc.json")) return true;
          return false;
        });

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }
          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }
          if (pathStr.includes(".github/workflows/publish.yml")) {
            return "name: Release\non: push";
          }
          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }
          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({
              plugins: [
                "@semantic-release/commit-analyzer",
                "@semantic-release/npm",
                "@semantic-release/github",
              ],
            });
          }
          return "";
        });

        mockedReaddirSync.mockImplementation((path: any) => {
          if (path.toString().includes(".github/workflows")) {
            return ["ci.yml", "publish.yml"] as any;
          }
          return [] as any;
        });

        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main");
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123def456" : Buffer.from("abc123def456");
          }
          if (cmd.includes("gh run list")) {
            const data = JSON.stringify([
              { status: "completed", conclusion: "success" },
              { status: "completed", conclusion: "success" },
            ]);
            return hasEncoding ? data : Buffer.from(data);
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.section).toHaveBeenCalledWith("Pre-Release Validation");
        expect(logger.success).toHaveBeenCalledWith("✅ Workflow files exist");
        expect(logger.success).toHaveBeenCalledWith(
          "✅ Badge URLs match workflows",
        );
        expect(logger.success).toHaveBeenCalledWith(
          "✅ package.json version is placeholder",
        );
        expect(logger.success).toHaveBeenCalledWith(
          "✅ @semantic-release/git plugin NOT present",
        );
        expect(logger.success).toHaveBeenCalledWith(
          "✅ Working directory clean",
        );
        expect(logger.success).toHaveBeenCalledWith("✅ On main branch");
        expect(logger.success).toHaveBeenCalledWith("✅ All CI checks passed");
        expect(logger.success).toHaveBeenCalledWith(
          "✅ Pre-release validation PASSED",
        );
        expect(logger.info).toHaveBeenCalledWith("   Ready to publish!");
        expect(exitSpy).not.toHaveBeenCalled();

        exitSpy.mockRestore();
      });
    });

    describe("Workflow files check", () => {
      it("should fail when required workflow files are missing", async () => {
        mockedExistsSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          // ci.yml missing
          if (pathStr.includes(".github/workflows/ci.yml")) return false;
          if (pathStr.includes(".github/workflows/publish.yml")) return true;
          return true;
        });

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.error).toHaveBeenCalledWith(
          "❌ Workflow files exist: Required workflow files missing",
        );
        expect(logger.error).toHaveBeenCalledWith(
          "⛔ Pre-release validation FAILED",
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
      });
    });

    describe("Badge URLs check", () => {
      it("should fail when badge references non-existent workflow", async () => {
        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();

          // README with badge for "Test" workflow that doesn't exist
          if (pathStr.includes("README.md")) {
            return "[![Test](https://github.com/littlebearapps/git-pr-manager/workflows/Test/badge.svg)]";
          }

          // Only CI workflow exists
          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }

          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }

          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({ plugins: ["@semantic-release/npm"] });
          }

          return "";
        });

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.error).toHaveBeenCalledWith(
          "❌ Badge URLs match workflows: README badges reference non-existent workflows",
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
      });

      it("should pass when badge URLs match actual workflows", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();

          // README with valid badge
          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }

          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }

          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }

          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({ plugins: ["@semantic-release/npm"] });
          }

          return "";
        });

        await doctorCommand({ preRelease: true });

        expect(logger.success).toHaveBeenCalledWith(
          "✅ Badge URLs match workflows",
        );

        exitSpy.mockRestore();
      });
    });

    describe("package.json version check", () => {
      it("should warn when package.json version is not placeholder", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();

          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "1.7.0" }); // Wrong version
          }

          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }

          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }

          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({ plugins: ["@semantic-release/npm"] });
          }

          return "";
        });

        await doctorCommand({ preRelease: true });

        expect(logger.warn).toHaveBeenCalledWith(
          '⚠️  package.json version is placeholder: package.json version should be "0.0.0-development" for single source of truth',
        );
        expect(logger.warn).toHaveBeenCalledWith(
          "⚠️  Pre-release validation passed with warnings",
        );

        exitSpy.mockRestore();
      });

      it("should pass when package.json has placeholder version", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.success).toHaveBeenCalledWith(
          "✅ package.json version is placeholder",
        );

        exitSpy.mockRestore();
      });
    });

    describe("@semantic-release/git plugin check", () => {
      it("should warn when git plugin is present", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();

          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({
              plugins: [
                "@semantic-release/commit-analyzer",
                "@semantic-release/git", // Git plugin present (bad)
                "@semantic-release/npm",
              ],
            });
          }

          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }

          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }

          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }

          return "";
        });

        await doctorCommand({ preRelease: true });

        expect(logger.warn).toHaveBeenCalledWith(
          "⚠️  @semantic-release/git plugin NOT present: @semantic-release/git plugin found - should be removed for Alternative D",
        );

        exitSpy.mockRestore();
      });

      it("should warn when git plugin is present with config", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();

          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({
              plugins: [
                "@semantic-release/commit-analyzer",
                ["@semantic-release/git", { assets: ["package.json"] }], // Git plugin with config
                "@semantic-release/npm",
              ],
            });
          }

          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }

          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }

          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }

          return "";
        });

        await doctorCommand({ preRelease: true });

        expect(logger.warn).toHaveBeenCalledWith(
          "⚠️  @semantic-release/git plugin NOT present: @semantic-release/git plugin found - should be removed for Alternative D",
        );

        exitSpy.mockRestore();
      });

      it("should pass when git plugin is not present", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.success).toHaveBeenCalledWith(
          "✅ @semantic-release/git plugin NOT present",
        );

        exitSpy.mockRestore();
      });

      it("should pass when no .releaserc.json exists", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        mockedExistsSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes(".releaserc.json")) return false;
          if (pathStr.includes(".github/workflows/ci.yml")) return true;
          if (pathStr.includes(".github/workflows/publish.yml")) return true;
          if (pathStr.includes(".github/workflows")) return true;
          if (pathStr.includes("README.md")) return true;
          if (pathStr.includes("package.json")) return true;
          return false;
        });

        await doctorCommand({ preRelease: true });

        expect(logger.success).toHaveBeenCalledWith(
          "✅ @semantic-release/git plugin NOT present",
        );

        exitSpy.mockRestore();
      });
    });

    describe("Working directory clean check", () => {
      it("should fail when working directory has uncommitted changes", async () => {
        mockedExecSync.mockImplementation(((cmd: string) => {
          if (cmd.includes("git status --porcelain")) {
            return Buffer.from("M src/index.ts\n"); // Uncommitted changes
          }
          if (cmd.includes("git branch --show-current")) {
            return Buffer.from("main");
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return Buffer.from("abc123");
          }
          if (cmd.includes("gh run list")) {
            return Buffer.from(
              JSON.stringify([{ status: "completed", conclusion: "success" }]),
            );
          }
          return Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.error).toHaveBeenCalledWith(
          "❌ Working directory clean: Uncommitted changes detected",
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
      });

      it("should pass when working directory is clean", async () => {
        // Complete mock setup for all checks to pass
        mockedExistsSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes(".github/workflows/ci.yml")) return true;
          if (pathStr.includes(".github/workflows/publish.yml")) return true;
          if (pathStr.includes(".github/workflows")) return true;
          if (pathStr.includes("README.md")) return true;
          if (pathStr.includes("package.json")) return true;
          if (pathStr.includes(".releaserc.json")) return true;
          return false;
        });

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }
          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }
          if (pathStr.includes(".github/workflows/publish.yml")) {
            return "name: Release\non: push";
          }
          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }
          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({ plugins: ["@semantic-release/npm"] });
          }
          return "";
        });

        mockedReaddirSync.mockImplementation((path: any) => {
          if (path.toString().includes(".github/workflows")) {
            return ["ci.yml", "publish.yml"] as any;
          }
          return [] as any;
        });

        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          // When encoding is specified, return string; otherwise return Buffer
          const hasEncoding = options && options.encoding;

          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main");
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123def456" : Buffer.from("abc123def456");
          }
          if (cmd.includes("gh run list")) {
            const data = JSON.stringify([
              { status: "completed", conclusion: "success" },
            ]);
            return hasEncoding ? data : Buffer.from(data);
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.success).toHaveBeenCalledWith(
          "✅ Working directory clean",
        );

        exitSpy.mockRestore();
      });
    });

    describe("On main branch check", () => {
      it("should fail when not on main branch", async () => {
        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding
              ? "feature/my-feature\n"
              : Buffer.from("feature/my-feature\n"); // On feature branch
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123" : Buffer.from("abc123");
          }
          if (cmd.includes("gh run list")) {
            const data = JSON.stringify([
              { status: "completed", conclusion: "success" },
            ]);
            return hasEncoding ? data : Buffer.from(data);
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.error).toHaveBeenCalledWith(
          "❌ On main branch: Not on main branch - releases must be from main",
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
      });

      it("should pass when on main branch", async () => {
        // Complete mock setup for all checks to pass
        mockedExistsSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes(".github/workflows/ci.yml")) return true;
          if (pathStr.includes(".github/workflows/publish.yml")) return true;
          if (pathStr.includes(".github/workflows")) return true;
          if (pathStr.includes("README.md")) return true;
          if (pathStr.includes("package.json")) return true;
          if (pathStr.includes(".releaserc.json")) return true;
          return false;
        });

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }
          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }
          if (pathStr.includes(".github/workflows/publish.yml")) {
            return "name: Release\non: push";
          }
          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }
          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({ plugins: ["@semantic-release/npm"] });
          }
          return "";
        });

        mockedReaddirSync.mockImplementation((path: any) => {
          if (path.toString().includes(".github/workflows")) {
            return ["ci.yml", "publish.yml"] as any;
          }
          return [] as any;
        });

        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main"); // On main branch
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123def456" : Buffer.from("abc123def456");
          }
          if (cmd.includes("gh run list")) {
            const data = JSON.stringify([
              { status: "completed", conclusion: "success" },
            ]);
            return hasEncoding ? data : Buffer.from(data);
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.success).toHaveBeenCalledWith("✅ On main branch");

        exitSpy.mockRestore();
      });
    });

    describe("All CI checks passed", () => {
      it("should warn when CI checks have not passed", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        // Complete mock setup for all previous checks to pass
        mockedExistsSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes(".github/workflows/ci.yml")) return true;
          if (pathStr.includes(".github/workflows/publish.yml")) return true;
          if (pathStr.includes(".github/workflows")) return true;
          if (pathStr.includes("README.md")) return true;
          if (pathStr.includes("package.json")) return true;
          if (pathStr.includes(".releaserc.json")) return true;
          return false;
        });

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();
          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }
          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }
          if (pathStr.includes(".github/workflows/publish.yml")) {
            return "name: Release\non: push";
          }
          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "0.0.0-development" });
          }
          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({ plugins: ["@semantic-release/npm"] });
          }
          return "";
        });

        mockedReaddirSync.mockImplementation((path: any) => {
          if (path.toString().includes(".github/workflows")) {
            return ["ci.yml", "publish.yml"] as any;
          }
          return [] as any;
        });

        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main");
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123" : Buffer.from("abc123");
          }
          if (cmd.includes("gh run list")) {
            const data = JSON.stringify([
              { status: "completed", conclusion: "success" },
              { status: "completed", conclusion: "failure" }, // One check failed
            ]);
            return hasEncoding ? data : Buffer.from(data);
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.warn).toHaveBeenCalledWith(
          "⚠️  All CI checks passed: CI checks have not all passed for HEAD commit",
        );
        expect(logger.warn).toHaveBeenCalledWith(
          "⚠️  Pre-release validation passed with warnings",
        );

        exitSpy.mockRestore();
      });

      it("should pass when all CI checks succeeded", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(logger.success).toHaveBeenCalledWith("✅ All CI checks passed");

        exitSpy.mockRestore();
      });

      it("should pass when gh CLI is not available (graceful degradation)", async () => {
        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main");
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123" : Buffer.from("abc123");
          }
          if (cmd.includes("gh run list")) {
            throw new Error("gh CLI not found"); // gh not available
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        await doctorCommand({ preRelease: true });

        // Should skip this check gracefully when gh not available
        expect(logger.success).toHaveBeenCalledWith("✅ All CI checks passed");

        exitSpy.mockRestore();
      });
    });

    describe("Error handling", () => {
      it("should handle check failures gracefully", async () => {
        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            // Return dirty status (check fails normally, not via exception)
            return hasEncoding ? "M file.ts" : Buffer.from("M file.ts");
          }
          if (cmd.includes("git branch --show-current")) {
            // Return feature branch (another failure)
            return hasEncoding ? "feature/test" : Buffer.from("feature/test");
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        // Both checks should fail with their normal error messages
        expect(logger.error).toHaveBeenCalledWith(
          "❌ Working directory clean: Uncommitted changes detected",
        );
        expect(logger.error).toHaveBeenCalledWith(
          "❌ On main branch: Not on main branch - releases must be from main",
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
      });
    });

    describe("Exit codes", () => {
      it("should exit with code 1 when validation fails", async () => {
        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "M file.ts" : Buffer.from("M file.ts"); // Uncommitted changes
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main");
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
      });

      it("should not exit when validation passes", async () => {
        // Reset mocks to "all passing" state from beforeEach
        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          // Git status (clean working directory)
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }

          // Current branch (main)
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main");
          }

          // Git rev-parse HEAD
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123def456" : Buffer.from("abc123def456");
          }

          // gh run list (all checks passed)
          if (cmd.includes("gh run list")) {
            const data = JSON.stringify([
              { status: "completed", conclusion: "success" },
              { status: "completed", conclusion: "success" },
            ]);
            return hasEncoding ? data : Buffer.from(data);
          }

          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(exitSpy).not.toHaveBeenCalled();

        exitSpy.mockRestore();
      });

      it("should not exit when only warnings present", async () => {
        // Reset execSync mock to "all passing" state
        mockedExecSync.mockImplementation(((cmd: string, options?: any) => {
          const hasEncoding = options && options.encoding;
          if (cmd.includes("git status --porcelain")) {
            return hasEncoding ? "" : Buffer.from("");
          }
          if (cmd.includes("git branch --show-current")) {
            return hasEncoding ? "main" : Buffer.from("main");
          }
          if (cmd.includes("git rev-parse HEAD")) {
            return hasEncoding ? "abc123def456" : Buffer.from("abc123def456");
          }
          if (cmd.includes("gh run list")) {
            const data = JSON.stringify([
              { status: "completed", conclusion: "success" },
              { status: "completed", conclusion: "success" },
            ]);
            return hasEncoding ? data : Buffer.from(data);
          }
          return hasEncoding ? "" : Buffer.from("");
        }) as any);

        mockedReadFileSync.mockImplementation((path: any) => {
          const pathStr = path.toString();

          if (pathStr.includes("package.json")) {
            return JSON.stringify({ version: "1.7.0" }); // Wrong version (warning)
          }

          if (pathStr.includes("README.md")) {
            return "[![CI](https://github.com/littlebearapps/git-pr-manager/workflows/CI/badge.svg)]";
          }

          if (pathStr.includes(".github/workflows/ci.yml")) {
            return "name: CI\non: push";
          }

          if (pathStr.includes(".releaserc.json")) {
            return JSON.stringify({ plugins: ["@semantic-release/npm"] });
          }

          return "";
        });

        const exitSpy = jest
          .spyOn(process, "exit")
          .mockImplementation((() => {}) as any);

        await doctorCommand({ preRelease: true });

        expect(exitSpy).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
          "⚠️  Pre-release validation passed with warnings",
        );

        exitSpy.mockRestore();
      });
    });
  });
});
